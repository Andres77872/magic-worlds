import { useCallback,useLayoutEffect,useRef,useState } from 'react'
import { useAuth,useData } from '@/app/hooks'
import { ApiError } from '@/infrastructure/api'
import { adoptNovelMutation,novelMutationKey,retireNovelMutation,writeNovelMutation,type NovelJournalRecord } from '@/shared/novelMutationJournal'
import { canonicalJson } from '@/utils/json'
import type { StorySceneRestoreAcknowledgement } from '@/shared'
import type { StoryWorkspace } from './useStoryWorkspace'
import { listSceneRestoreJournals,sceneRestoreTarget,type SceneRestoreIntent } from '../persistence/sceneRestoreJournal'

const EVENT='novel-scene-restore:changed',flights=new Set<string>()
export type PendingSceneRestore=NovelJournalRecord<SceneRestoreIntent>&{storageFailed?:boolean}
const signal=()=>window.dispatchEvent(new Event(EVENT))
const requestIdentity=(record:PendingSceneRestore)=>sceneRestoreTarget(record.write)
const intent=(record:PendingSceneRestore)=>({storyId:record.write.storyId,sceneId:record.write.sceneId,revision:record.write.revision,write:record.write.write})

export function useSceneRestores(storyId:string|null,workspace:StoryWorkspace,readOnly:boolean){
    const {userHash,isAuthenticated,openLoginModal}=useAuth()
    const data=useData()
    const scope=JSON.stringify([userHash,workspace.workspaceId,storyId])
    const memory=useRef(new Map<string,Map<string,PendingSceneRestore>>())
    const [state,setState]=useState<{scope:string;items:PendingSceneRestore[];error:string|null}>({scope,items:[],error:null})
    const mounted=useRef(false),live=useRef({scope,storyId,workspace,readOnly,userHash,isAuthenticated,data})
    useLayoutEffect(()=>{live.current={scope,storyId,workspace,readOnly,userHash,isAuthenticated,data}})
    const gather=useCallback(()=>{
        const rows=new Map<string,PendingSceneRestore>()
        for(const record of listSceneRestoreJournals({userHash,workspaceId:workspace.workspaceId})){
            if(record.write.storyId===storyId&&!rows.has(requestIdentity(record)))rows.set(requestIdentity(record),record)
        }
        for(const [id,record] of memory.current.get(scope)??[])rows.set(id,record)
        return [...rows.values()]
    },[scope,storyId,userHash,workspace.workspaceId])
    useLayoutEffect(()=>{
        mounted.current=true
        const refresh=()=>setState((old)=>({scope,items:gather(),error:old.scope===scope?old.error:null}))
        refresh();window.addEventListener('storage',refresh);window.addEventListener(EVENT,refresh)
        return()=>{mounted.current=false;window.removeEventListener('storage',refresh);window.removeEventListener(EVENT,refresh)}
    },[gather,scope])
    const retain=(owner:string,record:PendingSceneRestore)=>{
        let rows=memory.current.get(owner)
        if(!rows){rows=new Map();memory.current.set(owner,rows)}
        rows.set(requestIdentity(record),record);signal()
    }
    async function send(record:PendingSceneRestore,recover:boolean):Promise<StorySceneRestoreAcknowledgement|null>{
        const owner=live.current,key=novelMutationKey('scene-restore',{userHash:owner.userHash,workspaceId:owner.workspace.workspaceId,storyId:record.write.storyId},sceneRestoreTarget(record.write))
        const flight=owner.scope+':'+requestIdentity(record)
        if(!owner.isAuthenticated){openLoginModal();return null}
        if(owner.scope!==scope||owner.storyId!==record.write.storyId||!owner.workspace.isCurrent()||flights.has(flight))return null
        if(!recover&&owner.readOnly)return null
        const current=()=>mounted.current&&live.current.scope===owner.scope&&owner.workspace.isCurrent()
        flights.add(flight)
        let pending:PendingSceneRestore={...record,storageFailed:!adoptNovelMutation(key,record)}
        retain(owner.scope,pending)
        if(current())setState((old)=>({...old,error:null}))
        try {
            const request=record.write
            let ack=request.ack??(recover?await owner.data.recoverStoryRevision(request.storyId,request.sceneId,request.revision,request.write):null)
            if(!ack){
                if(!current())return null
                if(owner.readOnly)throw new ApiError(409,'Restore this novel or workspace before retrying.',{code:'STORY_READ_ONLY'})
                ack=await owner.data.restoreStoryRevision(request.storyId,request.sceneId,request.revision,request.write)
            }
            pending={...pending,write:{...request,ack}}
            pending.storageFailed=!writeNovelMutation(key,pending.write);retain(owner.scope,pending)
            if(!current())return ack
            try {
                const fresh=await owner.data.refreshStoryScene(request.storyId,request.sceneId)
                if(fresh.revision<ack.revision||fresh.revision===ack.revision&&fresh.contentHash!==ack.contentHash)throw new Error('Stale confirmed scene')
            }catch{
                if(current())setState((old)=>({...old,error:'refreshFailed'}))
                return ack
            }
            if(current()){
                // Retire only this acknowledged immutable intent, including
                // identical transferred copies left behind after storage faults.
                for(const candidate of [...listSceneRestoreJournals({userHash:owner.userHash,workspaceId:owner.workspace.workspaceId}),pending,record]){
                    if(canonicalJson(intent(candidate))===canonicalJson(intent(record)))retireNovelMutation(candidate,key)
                }
                memory.current.get(owner.scope)?.delete(requestIdentity(record));signal()
            }
            return ack
        }catch(error){
            const code=error instanceof ApiError?error.code:null
            const definite=error instanceof ApiError&&[400,404,409,422].includes(error.status)&&!['STORY_READ_ONLY','WORKSPACE_ARCHIVED'].includes(code??'')
            if(definite&&current()){
                retireNovelMutation(record,key);memory.current.get(owner.scope)?.delete(requestIdentity(record));signal()
            }
            if(current())setState((old)=>({...old,error:code==='STORY_READ_ONLY'||code==='WORKSPACE_ARCHIVED'?'readOnly':code==='STORY_REVISION_CONFLICT'||code==='STORY_REVISION_SOURCE_CHANGED'?'changed':code==='STORY_PENDING_PROPOSAL'?'proposal':'failed'}))
            throw error
        }finally{flights.delete(flight);signal()}
    }
    const items=state.scope===scope?state.items:[]
    return {items,error:state.scope===scope?state.error:null,
        start:(request:SceneRestoreIntent)=>{
            if(live.current.scope!==scope||!workspace.isCurrent())return Promise.resolve(null)
            if(gather().length)throw new ApiError(409,'Recover the pending restore first.',{code:'STORY_PENDING_OPERATION'})
            return send({schema:1,write:JSON.parse(JSON.stringify(request)) as SceneRestoreIntent},false)
        },
        recover:(record:PendingSceneRestore)=>send(record,true),
        hasPending:(sceneId?:string|null)=>items.some((record)=>!sceneId||record.write.sceneId===sceneId),
        busy:(record:PendingSceneRestore)=>flights.has(scope+':'+requestIdentity(record)),clearError:()=>setState((old)=>({...old,error:null})),
    }
}
export type SceneRestores=ReturnType<typeof useSceneRestores>
