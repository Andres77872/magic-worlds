import { useEffect,useLayoutEffect,useRef,useState } from 'react'
import { useAuth,useData } from '@/app/hooks'
import { ApiError } from '@/infrastructure/api'
import type { StoryOutline,StoryChapterWrite,StoryNovelWrite } from '@/shared'
import { novelMutationKey,retireNovelMutation,writeNovelMutation,type NovelJournalRecord } from '@/shared/novelMutationJournal'
import { makeRequestId } from '@/utils/uuid'
import { useWorkspaceReadOnly } from '@/shared/hooks/useWorkspaceReadOnly'
import { canonicalJson } from '@/utils/json'
import { metadataDirty,metadataPatch,metadataSeed,metadataUnit,readMetadataJournal,rebaseMetadata,type MetadataCheckpoint,type MetadataForm,type MetadataKind,type MetadataUnit } from '../persistence/metadataJournal'
import { MAX_CHAPTER_BASIS, partBases, summaryBases } from '@/shared/storySummaryBasis'

interface Options {story:StoryOutline;unit:MetadataUnit;kind:MetadataKind;readOnly:boolean;beforeWrite:()=>Promise<boolean>}
/** A form is a scoped draft; closing it never discards unsent input or a request receipt. */
export function useMetadataDraft({story,unit,kind,readOnly,beforeWrite}:Options){
    const {userHash}=useAuth()
    const {updateStory,updateStoryPart,updateStoryChapter,updateStoryScene,refreshStory}=useData()
    const workspaceReadOnly=useWorkspaceReadOnly(story.organization?.workspace_id)
    const key=novelMutationKey('details',{userHash,workspaceId:story.organization?.workspace_id,storyId:story.id},kind+':'+unit.id)
    const [checkpoint,setCheckpoint]=useState(()=>metadataSeed(unit,kind))
    const [recovery,setRecovery]=useState(()=>readMetadataJournal(key,kind,unit.id))
    const [busy,setBusy]=useState(false)
    const [failure,setFailure]=useState<string|null>(null)
    const [saved,setSaved]=useState(false)
    const [storageFailed,setStorageFailed]=useState(false)
    const [conflict,setConflict]=useState<MetadataCheckpoint|null>(null)
    const origin=useRef<NovelJournalRecord<MetadataCheckpoint>|null>(null)
    const flight=useRef(false)
    const mounted=useRef(true)
    const live=useRef({key,checkpoint,recovery,readOnly,story,unit,kind})
    useLayoutEffect(()=>{live.current={key,checkpoint,recovery,readOnly,story,unit,kind}})
    useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
    useEffect(()=>{
        const current=live.current
        if(current.recovery)return
        const timer=setTimeout(()=>{
            if((metadataDirty(current.checkpoint)||current.checkpoint.pending)&&!writeNovelMutation(current.key,current.checkpoint)&&current.key)setStorageFailed(true)
        },200)
        return ()=>clearTimeout(timer)
        // The record is scoped to this form; the cleanup below captures final keystrokes.
    },[checkpoint,key,recovery])
    useEffect(()=>()=>{
        const current=live.current
        if(!current.recovery&&(metadataDirty(current.checkpoint)||current.checkpoint.pending))writeNovelMutation(current.key,current.checkpoint)
    },[])
    useEffect(()=>{
        if(recovery||busy||metadataDirty(checkpoint)||checkpoint.pending||unit.metadataRevision===checkpoint.baseRevision&&(kind!=='scene'||(unit as {revision?:number}).revision===checkpoint.sourceRevision))return
        // eslint-disable-next-line react-hooks/set-state-in-effect -- subscribe a clean form to a newer acknowledged metadata head
        setCheckpoint(metadataSeed(unit,kind))
    },[unit,kind,recovery,busy,checkpoint])
    function edit<K extends keyof MetadataForm>(field:K,value:MetadataForm[K]){
        if(readOnly||busy||recovery||checkpoint.pending||flight.current)return
        setCheckpoint((current)=>({...current,form:{...current.form,[field]:value}}));setSaved(false)
    }
    function setDetail(field:string,value:unknown){
        if(readOnly||busy||recovery||checkpoint.pending||flight.current)return
        setCheckpoint((current)=>({...current,form:{...current.form,details:{...current.form.details,[field]:value}}}));setSaved(false)
    }
    function retire(snapshot:MetadataCheckpoint){
        retireNovelMutation({schema:1,write:snapshot},key)
        retireNovelMutation(origin.current,null)
        origin.current=null
    }
    function resume(){
        if(!recovery)return
        origin.current=recovery
        const stored=writeNovelMutation(key,recovery.write)
        if(stored&&recovery.storageKey!==key){retireNovelMutation(recovery,null);origin.current=null}
        setStorageFailed(Boolean(key)&&!stored)
        live.current.checkpoint=recovery.write;live.current.recovery=null
        setCheckpoint(recovery.write);setRecovery(null);setFailure(null);setSaved(false)
    }
    async function accountVersion(keepLocal:boolean){
        if(flight.current||checkpoint.pending||recovery?.write.pending)return false
        const owner=live.current
        flight.current=true;setBusy(true)
        try{
            const fresh=await refreshStory(owner.story.id)
            if(live.current.key!==owner.key||!mounted.current)return false
            const target=metadataUnit(fresh,kind,unit.id)
            if(!target)throw new Error('Metadata target is unavailable')
            const account=metadataSeed(target,kind)
            if(keepLocal&&conflict&&canonicalJson(account.form)!==canonicalJson(conflict.form)){
                setConflict(account);setFailure('conflict');return false
            }
            const previous=recovery?.write??checkpoint
            const next=keepLocal?rebaseMetadata(previous,account):account
            if(recovery)origin.current=recovery
            if(!keepLocal)retire(previous)
            live.current.checkpoint=next;live.current.recovery=null
            setCheckpoint(next);setRecovery(null);setConflict(null);setFailure(null);setSaved(false)
            if(metadataDirty(next)){
                const stored=writeNovelMutation(key,next)
                setStorageFailed(Boolean(key)&&!stored)
                if(stored&&origin.current?.storageKey!==key){retireNovelMutation(origin.current,null);origin.current=null}
            }
            return true
        }catch{if(live.current.key===owner.key&&mounted.current)setFailure('failed');return false}
        finally{flight.current=false;if(live.current.key===owner.key&&mounted.current)setBusy(false)}
    }
    async function save(){
        if(workspaceReadOnly||readOnly&&!checkpoint.pending||recovery||flight.current)return false
        const owner=live.current
        flight.current=true;setBusy(true);setFailure(null)
        let attempt=checkpoint
        try{
            if(!checkpoint.pending&&!await beforeWrite()||!mounted.current||live.current.key!==owner.key||!checkpoint.pending&&live.current.readOnly)return false
            // A part basis over a unit's limit cannot be stored; such a summary stays untied (rest of K09).
            const bases=kind==='chapter'||kind==='novel'?summaryBases(story):null,part=kind==='part'?partBases(story).get(unit.id)??[]:null
            const basis=bases?kind==='novel'?bases.book:bases.chapters.get(unit.id)??[]:part&&part.length<=MAX_CHAPTER_BASIS?part:undefined
            const write=checkpoint.pending??metadataPatch(checkpoint,makeRequestId('novel-details'),basis)
            if(!write){setFailure(metadataDirty(checkpoint)?'failed':null);return !metadataDirty(checkpoint)}
            attempt={...checkpoint,pending:write}
            live.current.checkpoint=attempt
            setCheckpoint(attempt)
            if(!writeNovelMutation(key,attempt))setStorageFailed(Boolean(key))
            const result=kind==='novel'?await updateStory(story.id,{...write as StoryNovelWrite}):kind==='part'?await updateStoryPart(story.id,unit.id,write as StoryChapterWrite):
                kind==='chapter'?await updateStoryChapter(story.id,unit.id,write as StoryChapterWrite):await updateStoryScene(story.id,unit.id,write as StoryChapterWrite)
            retireNovelMutation({schema:1,write:attempt},key)
            retireNovelMutation(origin.current,null)
            if(live.current.key!==owner.key||!mounted.current)return true
            origin.current=null
            const acknowledged=metadataSeed(result,kind)
            live.current.checkpoint=acknowledged
            setCheckpoint(acknowledged);setConflict(null);setSaved(true);setStorageFailed(false)
            return true
        }catch(error){
            if(live.current.key!==owner.key||!mounted.current)return false
            const definite=error instanceof ApiError&&error.status>=400&&error.status<500&&![408,429].includes(error.status)
            const retained={...attempt,pending:definite?null:attempt.pending}
            live.current.checkpoint=retained
            setCheckpoint(retained);writeNovelMutation(key,retained)
            setFailure(error instanceof ApiError&&error.code==='STORY_COVER_UNAVAILABLE'?'coverUnavailable':error instanceof ApiError&&error.code==='STORY_POV_UNAVAILABLE'?'povUnavailable':error instanceof ApiError&&error.status===409?'conflict':'failed')
            if(error instanceof ApiError&&error.status===409){
                try{
                    const fresh=await refreshStory(story.id)
                    const account=metadataUnit(fresh,kind,unit.id)
                    if(account&&live.current.key===owner.key&&mounted.current)setConflict(metadataSeed(account,kind))
                }catch{/* The local draft remains recoverable while the account read is unavailable. */}
            }
            return false
        }finally{flight.current=false;if(live.current.key===owner.key&&mounted.current)setBusy(false)}
    }
    return {form:checkpoint.form,edit,setDetail,save,busy,failure,saved,storageFailed,recovery,resume,accountVersion,
        pending:Boolean(checkpoint.pending),dirty:metadataDirty(checkpoint),conflict,baseRevision:checkpoint.baseRevision,
        remoteChanged:unit.metadataRevision!==checkpoint.baseRevision,scopeKey:key,
        descriptionDirty:checkpoint.form.description!==checkpoint.base.description,
        canRetry:Boolean(checkpoint.pending)&&!workspaceReadOnly,
        summaryRevision:checkpoint.form.details.summary!==checkpoint.base.details.summary?checkpoint.sourceRevision:checkpoint.form.details.summaryRevision,
        summaryEdited:checkpoint.form.details.summary!==checkpoint.base.details.summary,
    }
}
