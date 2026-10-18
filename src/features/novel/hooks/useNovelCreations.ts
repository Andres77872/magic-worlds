import { useFeatureFlags } from '@/shared/hooks/useFeatureFlags'
import type { StoryStudioIndex } from '@/shared/types/storyStudio.types'
import { useEffect,useLayoutEffect,useRef,useState } from 'react'
import { useAuth } from '@/app/hooks/useAuth'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import { ApiError } from '@/infrastructure/api'
import type { StoryCreateRequest,StoryCreationAcknowledgement } from '@/shared'
import { isNovelsFeatureEnabled } from '@/shared/featureFlags'
import { isWorkspaceArchived } from '@/shared/hooks/useWorkspaceReadOnly'
import { adoptNovelMutation,retireNovelMutation,writeNovelMutation } from '@/shared/novelMutationJournal'
import { isStoryCreateWrite } from '@/infrastructure/api/storyCreationContract'
import { canonicalJson } from '@/utils/json'
import { generateUUID } from '@/utils/uuid'
import { creationJournalKey,listCreationJournals,type NovelCreationIntent,type PendingNovelCreation } from '../persistence/creationJournal'

const EVENT='novel-creation:changed'
const changed=()=>window.dispatchEvent(new Event(EVENT))
export interface NovelCreationOptions {replaceRejectedRequestId?:string}

/** Owned by DataProvider so every novel creation entry point shares recovery. */
export function useNovelCreations(onOpen:(story:StoryStudioIndex)=>void|Promise<void>){
    useFeatureFlags()
    const auth=useAuth(),workspace=useWorkspace()
    const owner={userHash:auth.userHash,workspaceId:workspace.selectedWorkspaceId}
    const scope=JSON.stringify([owner.userHash,owner.workspaceId])
    const identity=JSON.stringify([scope,auth.authEpoch,auth.accountKey,auth.sessionPhase,workspace.workspaceEpoch])
    const mounted=useRef(true)
    const live=useRef({auth,workspace,owner,scope,identity,onOpen})
    useLayoutEffect(()=>{live.current={auth,workspace,owner,scope,identity,onOpen}})
    const memory=useRef(new Map<string,Map<string,PendingNovelCreation>>())
    const flights=useRef(new Map<string,Promise<StoryCreationAcknowledgement|null>>())
    const starts=useRef(new Map<string,Promise<StoryStudioIndex>>())
    const [state,setState]=useState<{identity:string;items:PendingNovelCreation[]}>({identity,items:[]})
    const current=(session:typeof live.current)=>mounted.current&&live.current.identity===session.identity&&live.current.workspace.api===session.workspace.api
    function gather(session=live.current){
        const items=new Map<string,PendingNovelCreation>()
        for(const record of listCreationJournals(session.owner))items.set(record.write.write.requestId,record)
        for(const [id,record] of memory.current.get(session.scope)??[])items.set(id,record)
        return [...items.values()]
    }
    useEffect(()=>{
        mounted.current=true
        const refresh=()=>setState({identity:live.current.identity,items:gather()})
        refresh();window.addEventListener('storage',refresh);window.addEventListener(EVENT,refresh)
        return()=>{mounted.current=false;window.removeEventListener('storage',refresh);window.removeEventListener(EVENT,refresh)}
        // Reads use the committed owner through live; epochs cause an immediate refresh.
    },[identity])
    function retain(session:typeof live.current,record:PendingNovelCreation){
        let records=memory.current.get(session.scope)
        if(!records){records=new Map();memory.current.set(session.scope,records)}
        records.set(record.write.write.requestId,record);changed()
    }
    function retire(record:PendingNovelCreation,session=live.current){
        const key=creationJournalKey(session.owner,record.write.write.requestId)
        retireNovelMutation(record,key)
        const pending:NovelCreationIntent={write:record.write.write,...(record.write.replacesRequestId?{replacesRequestId:record.write.replacesRequestId}:{})}
        retireNovelMutation({...record,write:pending},key)
        memory.current.get(session.scope)?.delete(record.write.write.requestId);changed()
    }
    function access(){
        const session=live.current
        if(!isNovelsFeatureEnabled())throw new ApiError(403,'Novels are disabled.')
        if(!session.auth.isAuthenticated||!session.owner.userHash){session.auth.openLoginModal();throw new ApiError(401,'Login required to recover novel creation.')}
        if(!session.workspace.api||!session.owner.workspaceId)throw new ApiError(409,'Choose a workspace first.')
        return session
    }
    function writable(session:typeof live.current){
        if(isWorkspaceArchived(session.workspace.workspaces??[],session.owner.workspaceId))throw new ApiError(409,'The workspace is archived.',{code:'WORKSPACE_ARCHIVED'})
    }
    async function send(record:PendingNovelCreation,recover:boolean){
        const session=access(),api=session.workspace.api!
        const id=record.write.write.requestId,flight=session.scope+':'+id
        const running=flights.current.get(flight)
        if(running)return running
        const key=creationJournalKey(session.owner,id)
        const stored=adoptNovelMutation(key,record)
        let pending={...record,storageFailed:!stored}
        retain(session,pending)
        const operation=(async()=>{
            let posting=false
            try{
                const ack=record.write.ack??(recover?await api.getStoryCreationResult(record.write.write):null)
                if(!current(session))return null
                let confirmed=ack
                if(!confirmed){
                    if(record.write.rejected)return null
                    writable(session);posting=true
                    confirmed=await api.createStory(record.write.write)
                }
                pending={...pending,write:{write:record.write.write,ack:confirmed,...(record.write.replacesRequestId?{replacesRequestId:record.write.replacesRequestId}:{})}}
                const saved=writeNovelMutation(key,pending.write)
                pending.storageFailed=!saved
                if(saved&&record.storageKey&&record.storageKey!==key)retireNovelMutation(record,null)
                retain(session,pending)
                return current(session)?confirmed:null
            }catch(error){
                if(posting&&error instanceof ApiError&&([400,404,422].includes(error.status)||['STORY_REQUEST_ID_REUSED','STORY_CREATION_SOURCE_CHANGED'].includes(error.code??''))){
                    pending={...pending,write:{...record.write,rejected:'review_required'}}
                    pending.storageFailed=!writeNovelMutation(key,pending.write)
                    retain(session,pending)
                }
                throw error
            }
        })()
        flights.current.set(flight,operation)
        try{return await operation}finally{flights.current.delete(flight);changed()}
    }
    function owned(record:PendingNovelCreation,session=access()){
        const found=gather(session).find((item)=>canonicalJson(item.write.write)===canonicalJson(record.write.write))
        if(!found)throw new ApiError(409,'The creation request belongs to another session.',{code:'STORY_SCOPE_CHANGED'})
        return found
    }
    async function open(record:PendingNovelCreation){
        const session=access(),selected=owned(record,session),ack=selected.write.ack
        if(!ack)throw new ApiError(409,'Recover the creation result first.')
        const story=await session.workspace.api!.getStoryStudioIndex(ack.storyId)
        if(!current(session))throw new ApiError(409,'The novel belongs to the previous session.',{code:'STORY_SCOPE_CHANGED'})
        await session.onOpen(story)
        if(!current(session))throw new ApiError(409,'The novel belongs to the previous session.',{code:'STORY_SCOPE_CHANGED'})
        retire(selected,session)
        const seen=new Set<string>();let replaced=selected.write.replacesRequestId
        while(replaced&&!seen.has(replaced)){
            seen.add(replaced)
            const previous=gather(session).find((item)=>item.write.write.requestId===replaced&&item.write.rejected)
            if(!previous)break
            replaced=previous.write.replacesRequestId;retire(previous,session)
        }
        return story
    }
    async function start(request:StoryCreateRequest,options:NovelCreationOptions={}):Promise<StoryStudioIndex>{
        const session=access()
        writable(session)
        const input=JSON.parse(JSON.stringify(request)) as StoryCreateRequest
        const replacesRequestId=options.replaceRejectedRequestId
        if(replacesRequestId&&!gather(session).some((item)=>item.write.write.requestId===replacesRequestId&&item.write.rejected))throw new ApiError(409,'The retained creation draft is unavailable.',{code:'STORY_SCOPE_CHANGED'})
        const flight=session.identity+':'+canonicalJson({input,replacesRequestId})
        const running=starts.current.get(flight)
        if(running)return running
        if(gather(session).some((item)=>!item.write.ack&&!item.write.rejected))return Promise.reject(new ApiError(409,'Recover the previous novel creation first.',{code:'STORY_PENDING_OPERATION'}))
        const write={...input,requestId:generateUUID()}
        if(!isStoryCreateWrite(write))return Promise.reject(new ApiError(422,'Invalid novel creation request.'))
        const record:PendingNovelCreation={schema:1,write:{write,...(replacesRequestId?{replacesRequestId}:{})}}
        const operation=(async()=>{
            const ack=await send(record,false)
            if(!ack||!current(session))throw new ApiError(409,'The novel belongs to the previous session.',{code:'STORY_SCOPE_CHANGED'})
            return open({...record,write:{...record.write,ack}})
        })()
        starts.current.set(flight,operation)
        void operation.finally(()=>starts.current.delete(flight)).catch(()=>{})
        return operation
    }
    return {sessionKey:identity,items:state.identity===identity?state.items:[],start,retry:async(record:PendingNovelCreation)=>send(owned(record),true),open,
        dismiss:(record:PendingNovelCreation)=>{const selected=gather().find((item)=>canonicalJson(item.write.write)===canonicalJson(record.write.write));if(selected?.write.ack||selected?.write.rejected)retire(selected)},
        busy:(record:PendingNovelCreation)=>flights.current.has(scope+':'+record.write.write.requestId)}
}
export type NovelCreations=ReturnType<typeof useNovelCreations>
