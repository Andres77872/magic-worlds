import { useCallback,useLayoutEffect,useRef,useState } from 'react'
import { useAuth } from '@/app/hooks'
import { ApiError } from '@/infrastructure/api'
import { adoptNovelMutation,novelMutationKey,retireNovelMutation,writeNovelMutation,type NovelJournalRecord } from '@/shared/novelMutationJournal'
import { canonicalJson } from '@/utils/json'
import { makeRequestId } from '@/utils/uuid'
import type { StoryReplacementAck,StoryReplacementPreview } from '@/shared/types/storyReplacement.types'
import { verifyReplacementPreview } from '@/infrastructure/api/storyReplacementContract'
import { isReplacementIntent,listReplacementJournals,matchesReplacementIntent,replacementIntent,type ReplacementIntent } from '../persistence/replacementJournal'
import { listReplacementHistory,type ReplacementHistoryEntry } from '../persistence/replacementForm'
import type { ManuscriptReplacementSource } from './useManuscriptReplacementSource'
import { useReplacementForm } from './useReplacementForm'

const EVENT='novel-manuscript-replace:changed',flights=new Set<string>()
const signal=()=>window.dispatchEvent(new Event(EVENT))
export type PendingReplacement=NovelJournalRecord<ReplacementIntent>&{storageFailed?:boolean}
const requestIdentity=(record:PendingReplacement)=>record.write.write.requestId
const intentIdentity=(record:PendingReplacement)=>canonicalJson({...record.write,ack:undefined})
export function replacementError(error:unknown):string {
    const code=error instanceof ApiError?error.code:null
    if(code==='STORY_REPLACE_REVIEW_TOO_LARGE')return 'reviewLimit'
    if(['STORY_REPLACE_ORIGIN_NOT_FOUND','STORY_REPLACE_ORIGIN_INVALID','STORY_REVISION_CHECKPOINT_MISSING'].includes(code??''))return 'originUnavailable'
    return code==='STORY_READ_ONLY'||code==='WORKSPACE_ARCHIVED'?'readOnly':code==='story_replacement_contract'?'contract':
        code?.startsWith('STORY_REPLACE_')||code==='STORY_PENDING_PROPOSAL'?'changed':'failed'
}
export function useManuscriptReplacements(source:ManuscriptReplacementSource|null,workspaceId:string|null,readOnly:boolean){
    const {userHash,isAuthenticated,openLoginModal}=useAuth(),scope=source?.key??null
    const journalScope={userHash,workspaceId,storyId:source?.storyId??null}
    const form=useReplacementForm(journalScope,scope)
    const memory=useRef(new Map<string,Map<string,PendingReplacement>>()),histories=useRef(new Map<string,ReplacementHistoryEntry[]>())
    const [state,setState]=useState<{scope:string|null;items:PendingReplacement[];history:ReplacementHistoryEntry[];error:string|null;historyStorageFailed:boolean}>({scope,items:[],history:[],error:null,historyStorageFailed:false})
    const mounted=useRef(false),live=useRef({source,scope,readOnly,userHash,isAuthenticated,workspaceId})
    useLayoutEffect(()=>{live.current={source,scope,readOnly,userHash,isAuthenticated,workspaceId}})
    const gather=useCallback(()=>{
        const rows=new Map<string,PendingReplacement>()
        for(const record of listReplacementJournals({userHash,workspaceId}))if(record.write.storyId===source?.storyId&&!rows.has(requestIdentity(record)))rows.set(requestIdentity(record),record)
        for(const [id,record] of memory.current.get(scope??'')??[])rows.set(id,record)
        return [...rows.values()]
    },[scope,source?.storyId,userHash,workspaceId])
    const gatherHistory=useCallback(()=>{
        const entries=[...histories.current.get(scope??'')??[],...source?listReplacementHistory({userHash,workspaceId},source.storyId):[]].sort((a,b)=>b.confirmedAt-a.confirmedAt)
        const seen=new Set<string>()
        return entries.filter((item)=>{if(seen.has(item.originRequestId))return false;seen.add(item.originRequestId);return true}).slice(0,20)
    },[scope,source,userHash,workspaceId])
    useLayoutEffect(()=>{
        mounted.current=true
        const refresh=()=>setState((old)=>({scope,items:gather(),history:gatherHistory(),error:old.scope===scope?old.error:null,historyStorageFailed:old.scope===scope&&old.historyStorageFailed}))
        refresh();window.addEventListener('storage',refresh);window.addEventListener(EVENT,refresh)
        return()=>{mounted.current=false;window.removeEventListener('storage',refresh);window.removeEventListener(EVENT,refresh)}
    },[gather,gatherHistory,scope])
    const retain=(owner:string,record:PendingReplacement)=>{
        let rows=memory.current.get(owner);if(!rows){rows=new Map();memory.current.set(owner,rows)}
        rows.set(requestIdentity(record),record);signal()
    }
    async function send(record:PendingReplacement,recover:boolean):Promise<StoryReplacementAck|null>{
        const owner=live.current
        if(!owner.isAuthenticated){openLoginModal();return null}
        const source=owner.source
        if(!source||source!==live.current.source||owner.scope!==scope||record.write.storyId!==source.storyId||!source.isCurrent())return null
        if(!recover&&owner.readOnly)return null
        const key=novelMutationKey('manuscript-replace',{userHash:owner.userHash,workspaceId:owner.workspaceId,storyId:source.storyId},requestIdentity(record)),flight=source.key+':'+requestIdentity(record)
        if(flights.has(flight))return null
        const current=()=>mounted.current&&live.current.source===source&&source.isCurrent()
        flights.add(flight)
        let pending:PendingReplacement={...record,storageFailed:!adoptNovelMutation(key,record)},sent=false
        retain(source.key,pending)
        if(current())setState((old)=>({...old,error:null}))
        try{
            let ack=record.write.ack??(recover?await source.recover(record.write.write):null)
            if(!ack){
                if(!current())return null
                if(live.current.readOnly)throw new ApiError(409,'Restore this novel or workspace before retrying.',{code:'STORY_READ_ONLY'})
                sent=true;ack=await source.write(record.write.write)
            }
            if(!matchesReplacementIntent(record.write,ack))throw new ApiError(502,'Replacement receipt differs from the reviewed target.',{code:'story_replacement_contract'})
            pending={...pending,write:{...record.write,ack}}
            pending.storageFailed=!writeNovelMutation(key,pending.write);retain(source.key,pending)
            if(!current())return ack
            if(ack.write.operation.op==='replace'){
                const query=ack.write.operation.preview,entry={originRequestId:ack.originRequestId,q:query.q,replacement:query.replacement,confirmedAt:Date.now()}
                const items=[entry,...gatherHistory().filter((item)=>item.originRequestId!==entry.originRequestId)].slice(0,20)
                histories.current.set(source.key,items)
                const stored=writeNovelMutation(novelMutationKey('manuscript-replace-history',{userHash:owner.userHash,workspaceId:owner.workspaceId,storyId:source.storyId},'recent'),{storyId:source.storyId,items})
                if(current())setState((old)=>({...old,historyStorageFailed:!stored}));signal()
            }
            try{
                const fresh=await source.refresh()
                if(fresh.id!==source.storyId||ack.scenes.some((head)=>{
                    const scene=fresh.chapters.flatMap((chapter)=>chapter.scenes).find((scene)=>scene.id===head.sceneId)
                    return !scene||scene.revision<head.revision||scene.revision===head.revision&&scene.contentHash!==head.contentHash
                }))throw new Error('The confirmed manuscript has not loaded')
            }catch{
                if(current())setState((old)=>({...old,error:'refreshFailed'}));return ack
            }
            if(current()){
                for(const candidate of [...listReplacementJournals({userHash:owner.userHash,workspaceId:owner.workspaceId}),pending,record]){
                    if(intentIdentity(candidate)===intentIdentity(record))retireNovelMutation(candidate,key)
                }
                memory.current.get(source.key)?.delete(requestIdentity(record));signal()
            }
            return ack
        }catch(error){
            const definite=sent&&error instanceof ApiError&&[400,409,422].includes(error.status)&&!['STORY_READ_ONLY','WORKSPACE_ARCHIVED'].includes(error.code??'')
            if(definite&&current()){
                // Retire the exact locally retained shape, never another writer's
                // newer acknowledgement or input at the same request key.
                retireNovelMutation(pending,key);retireNovelMutation(record,key);memory.current.get(source.key)?.delete(requestIdentity(record));signal()
            }
            if(current())setState((old)=>({...old,error:replacementError(error)}))
            throw error
        }finally{flights.delete(flight);signal()}
    }
    const items=state.scope===scope?state.items:[]
    return {source,form,items,history:state.scope===scope?state.history:[],error:state.scope===scope?state.error:null,historyStorageFailed:state.scope===scope&&state.historyStorageFailed,
        start:(review:StoryReplacementPreview)=>{
            if(!source||!source.isCurrent()||live.current.source!==source)return Promise.resolve(null)
            if(gather().length)throw new ApiError(409,'Recover the pending replacement first.',{code:'STORY_PENDING_OPERATION'})
            const query=review.operation.op==='replace'?review.operation.preview:{originRequestId:review.operation.originRequestId,direction:review.operation.direction}
            const value=replacementIntent(review,makeRequestId('manuscript-replace'))
            if(!review.canApply||!verifyReplacementPreview(review,source.storyId,query)||!isReplacementIntent(value))throw new ApiError(409,'Refresh the replacement review.',{code:'STORY_REPLACE_PREVIEW_CHANGED'})
            return send({schema:1,write:JSON.parse(JSON.stringify(value)) as ReplacementIntent},false)
        },
        recover:(record:PendingReplacement)=>send(record,true),
        hasPending:(sceneId?:string|null)=>items.some((record)=>!sceneId||record.write.heads.some((head)=>head.sceneId===sceneId)),
        busy:(record:PendingReplacement)=>flights.has((scope??'')+':'+requestIdentity(record)),
        clearError:()=>setState((old)=>({...old,error:null})),readOnly,
    }
}
export type ManuscriptReplacements=ReturnType<typeof useManuscriptReplacements>
