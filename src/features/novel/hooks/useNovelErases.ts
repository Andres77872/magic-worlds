import { useCallback,useEffect,useLayoutEffect,useRef,useState } from 'react'
import { useAuth } from '@/app/hooks'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import { ApiError } from '@/infrastructure/api'
import { API_BASE_URL } from '@/infrastructure/api/baseUrl'
import type { StoryEraseAcknowledgement,StoryErasePreview,StoryEraseWrite } from '@/shared'
import { isStoryEraseWrite } from '@/infrastructure/api/storyEraseContract'
import { novelMutationKey,retireNovelMutation,type NovelJournalRecord } from '@/shared/novelMutationJournal'
import { keepEraseJournal,listEraseJournals,type NovelEraseIntent } from '../persistence/eraseJournal'

const EVENT='novel-erase:changed'
const flights=new Set<string>()
const changed=()=>window.dispatchEvent(new Event(EVENT))
export type PendingNovelErase=NovelJournalRecord<NovelEraseIntent>&{storageFailed?:boolean;checkedMissing?:boolean}
export type EraseOutcome=StoryEraseAcknowledgement|'already-erased'|null
export type EraseError='changed'|'confirmation'|'active'|'archived'|'notFound'|'receiptMissing'|'requestConflict'|'alreadyErased'|'pending'|'failed'
export function erasureError(error:unknown):EraseError {
    const code=error instanceof ApiError?error.code:null
    return ({STORY_ERASE_SOURCE_CHANGED:'changed',STORY_ERASE_REQUIRES_TRASH:'changed',STORY_ERASE_CONFIRMATION_MISMATCH:'confirmation',
        STORY_ERASE_EXECUTIONS_ACTIVE:'active',WORKSPACE_ARCHIVED:'archived',STORY_ERASE_RECEIPT_MISSING:'receiptMissing',
        STORY_REQUEST_ID_REUSED:'requestConflict',STORY_ERASED:'alreadyErased',STORY_PENDING_OPERATION:'pending'} as Record<string,EraseError>)[code??'']??'failed'
}
export interface NovelErases {
    scopeKey:string;items:PendingNovelErase[];error:EraseError|null;readOnly:boolean
    preview:(id:string)=>Promise<StoryErasePreview|null>
    start:(preview:StoryErasePreview,write:StoryEraseWrite)=>Promise<EraseOutcome>
    check:(record:PendingNovelErase)=>Promise<EraseOutcome>
    retry:(record:PendingNovelErase)=>Promise<EraseOutcome>
    hasPending:(id:string)=>boolean;busy:(record:PendingNovelErase)=>boolean;isErased:(id:string)=>boolean
}
const attempt=(record:PendingNovelErase)=>JSON.stringify([record.write.storyId,record.write.write.requestId])

export function useNovelErases(readOnly:boolean,onErased:(id:string)=>void):NovelErases {
    const workspace=useWorkspace(),auth=useAuth()
    const base=JSON.stringify([API_BASE_URL,auth.userHash,workspace.selectedWorkspaceId])
    const identity=JSON.stringify([base,workspace.workspaceEpoch])
    const memory=useRef(new Map<string,Map<string,PendingNovelErase>>())
    const erased=useRef(new Set<string>())
    const mounted=useRef(true)
    const live=useRef({base,identity,workspace,auth,readOnly,onErased})
    useLayoutEffect(()=>{live.current={base,identity,workspace,auth,readOnly,onErased}})
    const [state,setState]=useState<{identity:string;items:PendingNovelErase[];error:EraseError|null}>({identity,items:[],error:null})
    const gather=useCallback(()=>{
        const rows=new Map<string,PendingNovelErase>()
        for(const record of listEraseJournals({userHash:auth.userHash,workspaceId:workspace.selectedWorkspaceId}))rows.set(attempt(record),record)
        for(const [id,record] of memory.current.get(base)??[])rows.set(id,record)
        return [...rows.values()]
    },[auth.userHash,base,workspace.selectedWorkspaceId])
    useEffect(()=>{
        mounted.current=true
        const refresh=()=>setState((old)=>({identity,items:gather(),error:old.identity===identity?old.error:null}))
        refresh();window.addEventListener('storage',refresh);window.addEventListener(EVENT,refresh)
        return()=>{mounted.current=false;window.removeEventListener('storage',refresh);window.removeEventListener(EVENT,refresh)}
    },[gather,identity])
    const current=()=>mounted.current&&live.current.identity===identity
    function retain(scope:string,record:PendingNovelErase){
        let rows=memory.current.get(scope)
        if(!rows){rows=new Map();memory.current.set(scope,rows)}
        rows.set(attempt(record),record);changed()
    }
    function retire(record:PendingNovelErase,key:string|null,acknowledged:PendingNovelErase){
        retireNovelMutation(acknowledged,key);retireNovelMutation(record,key)
        memory.current.get(base)?.delete(attempt(record));changed()
    }
    async function preview(id:string){
        if(!current())return null
        const source=live.current,owner=source.workspace.capture()
        if(!source.auth.isAuthenticated){source.auth.openLoginModal();return null}
        if(!source.workspace.api||!source.workspace.isCurrent(owner))return null
        const value=await source.workspace.api.previewStoryErase(id)
        return current()&&source.workspace.isCurrent(owner)?value:null
    }
    async function send(record:PendingNovelErase,mode:'start'|'check'|'retry'):Promise<EraseOutcome>{
        if(!current())return null
        const source=live.current,owner=source.workspace.capture(),flight=base+':'+attempt(record)
        if(!source.auth.isAuthenticated){source.auth.openLoginModal();return null}
        if(!source.workspace.api||!source.workspace.isCurrent(owner)||flights.has(flight))return null
        if(mode==='start'&&source.readOnly)return null
        const isCurrent=()=>current()&&source.workspace.isCurrent(owner)
        const key=novelMutationKey('erase',{userHash:source.auth.userHash,workspaceId:source.workspace.selectedWorkspaceId,storyId:record.write.storyId},record.write.write.requestId)
        let pending:PendingNovelErase={...record,storageFailed:!keepEraseJournal(key,record)}
        flights.add(flight);retain(base,pending)
        if(isCurrent())setState((old)=>({...old,error:null}))
        try{
            let ack=mode==='start'?null:await source.workspace.api.getStoryEraseResult(record.write.storyId,record.write.write)
            if(!ack&&record.write.ack)throw new ApiError(409,'The confirmed receipt is unavailable.',{code:'STORY_ERASE_RECEIPT_MISSING'})
            if(!ack&&mode==='check'){
                pending={...pending,checkedMissing:true};retain(base,pending)
                if(isCurrent())setState((old)=>({...old,error:'notFound'}))
                return null
            }
            if(!ack){
                if(record.write.ack)throw new ApiError(409,'The confirmed receipt is unavailable.',{code:'STORY_ERASE_RECEIPT_MISSING'})
                if(source.readOnly||live.current.readOnly)throw new ApiError(409,'This workspace is archived.',{code:'WORKSPACE_ARCHIVED'})
                if(!isCurrent())return null
                ack=await source.workspace.api.permanentlyEraseStory(record.write.storyId,record.write.write)
            }
            const confirmed={...record.write,ack}
            pending={...pending,write:confirmed,checkedMissing:false,storageFailed:!keepEraseJournal(key,record,confirmed)}
            retain(base,pending)
            if(isCurrent()){
                erased.current.add(base+':'+record.write.storyId)
                live.current.onErased(record.write.storyId)
                if(isCurrent())retire(record,key,pending)
            }
            return ack
        }catch(error){
            const reason=erasureError(error)
            if(isCurrent()){
                if(reason==='alreadyErased'){
                    erased.current.add(base+':'+record.write.storyId)
                    live.current.onErased(record.write.storyId);if(isCurrent())retire(record,key,pending)
                    setState((old)=>({...old,error:reason}));return 'already-erased'
                }
                if(['changed','confirmation','active'].includes(reason))retire(record,key,pending)
                setState((old)=>({...old,error:reason}))
            }
            throw error
        }finally{flights.delete(flight);changed()}
    }
    async function start(source:StoryErasePreview,write:StoryEraseWrite){
        if(!current())return null
        if(gather().some((record)=>record.write.storyId===source.storyId))throw new ApiError(409,'Resolve the previous erase first.',{code:'STORY_PENDING_OPERATION'})
        if(!isStoryEraseWrite(write)||write.confirmedTitle!==source.title||write.expectedSourceVersion!==source.sourceVersion||source.activeExecutions)
            throw new ApiError(409,'Review the current novel first.',{code:'STORY_ERASE_SOURCE_CHANGED'})
        return send({schema:1,write:{storyId:source.storyId,write:{...write}}},'start')
    }
    const items=state.identity===identity?state.items:[]
    return {scopeKey:identity,items,error:state.identity===identity?state.error:null,readOnly,preview,start,check:(record)=>send(record,'check'),retry:(record)=>send(record,'retry'),
        hasPending:(id)=>items.some((record)=>record.write.storyId===id),busy:(record)=>flights.has(base+':'+attempt(record)),isErased:(id)=>erased.current.has(base+':'+id)}
}
