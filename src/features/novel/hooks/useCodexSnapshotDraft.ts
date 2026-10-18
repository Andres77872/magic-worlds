import { useEffect,useLayoutEffect,useRef,useState } from 'react'
import { useAuth } from '@/app/hooks'
import { adoptNovelMutation,isNovelRevision,isRecord,novelMutationKey,readNovelMutation,retireNovelMutation,writeNovelMutation,type NovelJournalRecord } from '@/shared/novelMutationJournal'
import { canonicalJson } from '@/utils/json'
import type { CodexEntry } from './useCodex'

type Form={label:string;description:string}
interface Checkpoint {refId:string;baseRevision:number;base:Form;form:Form}
const seed=(entry:CodexEntry):Checkpoint=>({refId:entry.id,baseRevision:entry.contextRevision??1,base:{label:entry.label,description:entry.description},form:{label:entry.label,description:entry.description}})
const isForm=(value:unknown):value is Form=>isRecord(value)&&Object.keys(value).length===2&&typeof value.label==='string'&&typeof value.description==='string'
const dirty=(value:Checkpoint)=>canonicalJson(value.form)!==canonicalJson(value.base)
function read(key:string|null,id:string){return readNovelMutation(key,(value):value is Checkpoint=>isRecord(value)&&value.refId===id&&isNovelRevision(value.baseRevision)&&isForm(value.base)&&isForm(value.form))}
export function useCodexSnapshotDraft(entry:CodexEntry,workspaceId:string|null|undefined,disabled:boolean){
    const {userHash}=useAuth()
    const key=novelMutationKey('codex-details',{userHash,workspaceId,storyId:entry.ref.storyId},entry.id)
    const [checkpoint,setCheckpoint]=useState(()=>seed(entry))
    const [recovery,setRecovery]=useState(()=>{
        const record=read(key,entry.id)
        return record&&canonicalJson(record.write.form)!==canonicalJson(seed(entry).form)?record:null
    })
    const [storageFailed,setStorageFailed]=useState(false)
    const origin=useRef<NovelJournalRecord<Checkpoint>|null>(null)
    const live=useRef({checkpoint,recovery})
    useLayoutEffect(()=>{live.current={checkpoint,recovery}})
    useEffect(()=>{
        const stored=read(key,entry.id)
        if(stored&&canonicalJson(stored.write.form)===canonicalJson(seed(entry).form))retireNovelMutation(stored,key)
    },[key,entry])
    useEffect(()=>{
        if(recovery)return
        const timer=setTimeout(()=>{if(dirty(checkpoint)&&!writeNovelMutation(key,checkpoint)&&key)setStorageFailed(true)},200)
        return()=>clearTimeout(timer)
    },[key,checkpoint,recovery])
    useEffect(()=>()=>{const current=live.current;if(!current.recovery&&dirty(current.checkpoint))writeNovelMutation(key,current.checkpoint)},[key])
    useEffect(()=>{
        if(recovery)return
        const account=seed(entry)
        if(!dirty(checkpoint)||canonicalJson(checkpoint.form)===canonicalJson(account.form)){
            if(checkpoint.baseRevision===account.baseRevision&&canonicalJson(checkpoint)===canonicalJson(account))return
            retireNovelMutation({schema:1,write:checkpoint},key);retireNovelMutation(origin.current,null);origin.current=null
            live.current.checkpoint=account
            // eslint-disable-next-line react-hooks/set-state-in-effect -- subscribe a clean or acknowledged private snapshot form to its account head
            setCheckpoint(account)
        }
    },[entry,key,recovery,checkpoint])
    function edit(field:keyof Form,value:string){if(!disabled&&!recovery)setCheckpoint((current)=>({...current,form:{...current.form,[field]:value}}))}
    function resume(){
        if(!recovery)return
        const stored=adoptNovelMutation(key,recovery)
        origin.current=stored?null:recovery
        live.current={checkpoint:recovery.write,recovery:null}
        setCheckpoint(recovery.write);setRecovery(null);setStorageFailed(Boolean(key)&&!stored)
    }
    function resolve(keepLocal:boolean){
        if(disabled)return
        const previous=recovery?.write??checkpoint
        const next=seed(entry)
        if(keepLocal)for(const field of ['label','description'] as const)if(previous.form[field]!==previous.base[field])next.form[field]=previous.form[field]
        if(dirty(next)){
            const record=recovery??origin.current
            const stored=writeNovelMutation(key,next)
            if(stored&&record?.storageKey!==key){retireNovelMutation(record,null);origin.current=null}
            setStorageFailed(Boolean(key)&&!stored)
        }else{retireNovelMutation(recovery??{schema:1,write:previous},key);retireNovelMutation(origin.current,null);origin.current=null}
        live.current={checkpoint:next,recovery:null};setCheckpoint(next);setRecovery(null)
    }
    function acknowledged(){
        retireNovelMutation({schema:1,write:checkpoint},key);retireNovelMutation(origin.current,null);origin.current=null
        const next={...checkpoint,base:{...checkpoint.form}}
        live.current={checkpoint:next,recovery:null};setCheckpoint(next);setRecovery(null)
    }
    return {key,form:checkpoint.form,baseRevision:checkpoint.baseRevision,dirty:dirty(checkpoint),remoteChanged:(entry.contextRevision??1)!==checkpoint.baseRevision,recovery,resume,resolve,edit,acknowledged,storageFailed}
}
