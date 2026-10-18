import { useCallback,useEffect,useLayoutEffect,useRef,useState } from 'react'
import { useAuth,useData,useNavigation } from '@/app/hooks'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import { ApiError } from '@/infrastructure/api'
import type { StoryCopyPreview,StoryCopyWrite } from '@/shared'
import { adoptNovelMutation,novelMutationKey,retireNovelMutation,writeNovelMutation,type NovelJournalRecord } from '@/shared/novelMutationJournal'
import { listCopyJournals,type NovelCopyIntent } from '../persistence/copyJournal'

const EVENT='novel-copy:changed'
const flights=new Set<string>()
export type PendingNovelCopy=NovelJournalRecord<NovelCopyIntent>&{storageFailed?:boolean}
const attemptId=(record:PendingNovelCopy)=>record.write.sourceId+':'+record.write.write.requestId
const changed=()=>window.dispatchEvent(new Event(EVENT))

export function useNovelCopies(readOnly:boolean,beforeWrite?:(sourceId:string)=>Promise<boolean>,beforeOpen?:()=>Promise<boolean>){
    const workspace=useWorkspace()
    const {userHash,isAuthenticated,openLoginModal}=useAuth()
    const {openStory}=useData()
    const {setPage}=useNavigation()
    const identity=JSON.stringify([userHash,workspace.selectedWorkspaceId,workspace.workspaceEpoch])
    const memory=useRef(new Map<string,Map<string,PendingNovelCopy>>())
    const [state,setState]=useState<{identity:string;items:PendingNovelCopy[];error:string|null}>({identity,items:[],error:null})
    const mounted=useRef(true)
    const live=useRef({identity,workspace,userHash,isAuthenticated,readOnly,beforeWrite,beforeOpen})
    useLayoutEffect(()=>{live.current={identity,workspace,userHash,isAuthenticated,readOnly,beforeWrite,beforeOpen}})
    const gather=useCallback(()=>{
        const items=new Map<string,PendingNovelCopy>()
        for(const record of listCopyJournals({userHash,workspaceId:workspace.selectedWorkspaceId}))items.set(attemptId(record),record)
        for(const [id,record] of memory.current.get(identity)??[])items.set(id,record)
        return [...items.values()]
    },[identity,userHash,workspace.selectedWorkspaceId])
    useEffect(()=>{
        mounted.current=true
        const refresh=()=>setState((old)=>({identity,items:gather(),error:old.identity===identity?old.error:null}))
        refresh();window.addEventListener('storage',refresh);window.addEventListener(EVENT,refresh)
        return()=>{mounted.current=false;window.removeEventListener('storage',refresh);window.removeEventListener(EVENT,refresh)}
    },[gather,identity])
    const retain=(owner:string,record:PendingNovelCopy)=>{
        let items=memory.current.get(owner)
        if(!items){items=new Map();memory.current.set(owner,items)}
        items.set(attemptId(record),record);changed()
    }
    function clear(record:PendingNovelCopy,owner=identity){
        const scope=live.current
        if(owner!==scope.identity)return
        const key=novelMutationKey('copy',{userHash:scope.userHash,workspaceId:scope.workspace.selectedWorkspaceId,storyId:record.write.sourceId},record.write.write.requestId)
        retireNovelMutation(record,key)
        // An acknowledged result may only have the earlier pending write on disk
        // when storage failed. Retire exactly that same immutable intent too.
        const pending:NovelCopyIntent={sourceId:record.write.sourceId,sourceTitle:record.write.sourceTitle,write:record.write.write}
        retireNovelMutation({...record,write:pending},key)
        memory.current.get(owner)?.delete(attemptId(record));changed()
    }
    async function preview(sourceId:string):Promise<StoryCopyPreview|null>{
        const current=live.current,owner=current.workspace.capture()
        if(!current.isAuthenticated||!current.userHash){openLoginModal();return null}
        if(!current.workspace.api||current.readOnly||!current.workspace.isCurrent(owner))return null
        if(current.beforeWrite&&!await current.beforeWrite(sourceId))return null
        const value=await current.workspace.api.previewStoryCopy(sourceId,true)
        return mounted.current&&live.current.identity===current.identity&&current.workspace.isCurrent(owner)?value:null
    }
    async function send(record:PendingNovelCopy,recover:boolean){
        const current=live.current,owner=current.workspace.capture(),id=attemptId(record),flight=current.identity+':'+id
        if(!current.isAuthenticated||!current.userHash){openLoginModal();return null}
        if(!current.workspace.api||!current.workspace.isCurrent(owner)||flights.has(flight))return null
        if(!recover&&!record.write.ack){
            if(current.readOnly||current.beforeWrite&&!await current.beforeWrite(record.write.sourceId)||!current.workspace.isCurrent(owner))return null
        }
        const key=novelMutationKey('copy',{userHash:current.userHash,workspaceId:current.workspace.selectedWorkspaceId,storyId:record.write.sourceId},record.write.write.requestId)
        const stored=adoptNovelMutation(key,record)
        let pending:PendingNovelCopy={...record,storageFailed:!stored}
        flights.add(flight);retain(current.identity,pending)
        const isCurrent=()=>mounted.current&&live.current.identity===current.identity&&current.workspace.isCurrent(owner)
        if(isCurrent())setState((old)=>({...old,error:null}))
        try{
            let ack=record.write.ack??(recover?await current.workspace.api.getStoryCopyResult(record.write.sourceId,record.write.write):null)
            if(!ack){
                if(current.readOnly)throw new ApiError(409,'This workspace is archived.',{code:'WORKSPACE_ARCHIVED'})
                if(recover&&current.beforeWrite&&!await current.beforeWrite(record.write.sourceId))return null
                if(!current.workspace.isCurrent(owner))return null
                ack=await current.workspace.api.copyStory(record.write.sourceId,record.write.write)
            }
            pending={...pending,write:{...record.write,ack}}
            const saved=writeNovelMutation(key,pending.write)
            if(saved&&record.storageKey&&record.storageKey!==key)retireNovelMutation(record,null)
            pending.storageFailed=!saved
            retain(current.identity,pending)
            return ack
        }catch(error){
            const code=error instanceof ApiError?error.code:null
            const definite=error instanceof ApiError&&(error.status===422||code==='STORY_COPY_SOURCE_CHANGED'||code==='STORY_REQUEST_ID_REUSED')
            if(definite&&isCurrent())clear(record,current.identity)
            if(isCurrent())setState((old)=>({...old,error:code==='STORY_COPY_SOURCE_CHANGED'?'changed':code==='WORKSPACE_ARCHIVED'?'archived':'failed'}))
            throw error
        }finally{flights.delete(flight);changed()}
    }
    async function start(preview:StoryCopyPreview,write:StoryCopyWrite){
        if(gather().some((record)=>record.write.sourceId===preview.sourceId))throw new ApiError(409,'Resolve the previous copy first.',{code:'STORY_PENDING_OPERATION'})
        return send({schema:1,write:{sourceId:preview.sourceId,sourceTitle:preview.sourceTitle,write:JSON.parse(JSON.stringify(write)) as StoryCopyWrite}},false)
    }
    async function open(record:PendingNovelCopy){
        const current=live.current,owner=current.workspace.capture(),ack=record.write.ack
        if(!ack||!current.workspace.api)return
        if(current.beforeOpen&&!await current.beforeOpen())return
        if(!current.workspace.isCurrent(owner)||live.current.identity!==current.identity)return
        await openStory({id:ack.storyId})
        if(!current.workspace.isCurrent(owner)||live.current.identity!==current.identity)return
        clear(record,current.identity);setPage('story')
    }
    const items=state.identity===identity?state.items:[]
    return {items,error:state.identity===identity?state.error:null,preview,start,retry:(record:PendingNovelCopy)=>send(record,true),open,
        dismiss:clear,hasPending:(sourceId:string)=>items.some((item)=>item.write.sourceId===sourceId),
        busy:(record:PendingNovelCopy)=>flights.has(identity+':'+attemptId(record))}
}
export type NovelCopies=ReturnType<typeof useNovelCopies>
