import { useCallback,useLayoutEffect,useRef,useState } from 'react'
import { useAuth } from '@/app/hooks'
import { ApiError } from '@/infrastructure/api'
import type { StoryAnnotation,StoryAnnotationAcknowledgement,StoryAnnotationWrite } from '@/shared'
import { adoptNovelMutation,novelMutationKey,retireNovelMutation,writeNovelMutation,type NovelJournalRecord } from '@/shared/novelMutationJournal'
import { canonicalJson } from '@/utils/json'
import { annotationTarget,annotationIntentKind,isAnnotationIntent,listAnnotationJournals,type AnnotationIntent } from '../persistence/annotationJournal'
import { verifyBookmarkConfirmation } from '../utils/annotationConfirmation'
import type { StoryWorkspace } from './useStoryWorkspace'
import type { PersonalNoteDraft } from './useAnnotationDrafts'

const EVENT='novel-annotation:changed',flights=new Set<string>(),signal=()=>window.dispatchEvent(new Event(EVENT))
export type PendingAnnotation=NovelJournalRecord<AnnotationIntent>&{storageFailed?:boolean}
const identity=(record:PendingAnnotation)=>annotationTarget(record.write)
const intent=(record:PendingAnnotation)=>({storyId:record.write.storyId,kind:record.write.kind,write:record.write.write,draft:record.write.draft})
function confirmedHead(value:StoryAnnotation,ack:StoryAnnotationAcknowledgement){
    if(value.revision<ack.revision||value.anchorVersion<ack.anchorVersion)return false
    const op=ack.operation
    if(value.revision===ack.revision){
        if((op.op==='create'||op.op==='edit')&&value.body!==op.body)return false
        if(op.op==='create'&&value.state!=='open'||op.op==='set_state'&&value.state!==op.state)return false
    }
    if((op.op==='create'||op.op==='reanchor')&&value.anchorVersion===ack.anchorVersion&&value.head.revision===op.anchor.expectedRevision){
        if(!value.anchor||value.anchor.sceneId!==op.anchor.sceneId||value.anchor.contentHash!==op.anchor.expectedContentHash||value.anchor.quote!==op.anchor.quote)return false
    }
    return true
}
export function useAnnotationMutations(storyId:string|null,workspace:StoryWorkspace,readOnly:boolean,onConfirmed?:(intent:AnnotationIntent,note:StoryAnnotation)=>void){
    const auth=useAuth(),scope=JSON.stringify([auth.userHash,workspace.workspaceId,storyId])
    const live=useRef({scope,storyId,workspace,readOnly,auth}),memory=useRef(new Map<string,Map<string,PendingAnnotation>>()),mounted=useRef(false)
    const confirmed=useRef(onConfirmed)
    useLayoutEffect(()=>{confirmed.current=onConfirmed},[onConfirmed])
    const [state,setState]=useState<{scope:string;items:PendingAnnotation[];error:string|null;errorKind?:'bookmark'}>({scope,items:[],error:null})
    useLayoutEffect(()=>{live.current={scope,storyId,workspace,readOnly,auth}})
    const gather=useCallback(()=>{
        const items=new Map<string,PendingAnnotation>()
        for(const record of listAnnotationJournals({userHash:auth.userHash,workspaceId:workspace.workspaceId}))if(record.write.storyId===storyId&&!items.has(identity(record)))items.set(identity(record),record)
        for(const [key,record] of memory.current.get(scope)??[])items.set(key,record)
        return [...items.values()]
    },[scope,storyId,auth.userHash,workspace.workspaceId])
    useLayoutEffect(()=>{
        mounted.current=true
        const refresh=()=>setState((old)=>({scope,items:gather(),error:old.scope===scope?old.error:null,errorKind:old.scope===scope?old.errorKind:undefined}))
        refresh();window.addEventListener('storage',refresh);window.addEventListener(EVENT,refresh)
        return()=>{mounted.current=false;window.removeEventListener('storage',refresh);window.removeEventListener(EVENT,refresh)}
    },[gather,scope])
    const retain=(owner:string,record:PendingAnnotation)=>{
        let values=memory.current.get(owner);if(!values){values=new Map();memory.current.set(owner,values)}
        values.set(identity(record),record);signal()
    }
    async function send(record:PendingAnnotation,recover:boolean):Promise<StoryAnnotation|null>{
        const owner=live.current,request=record.write,flight=owner.scope+':'+identity(record)
        if(owner.scope!==scope||owner.storyId!==request.storyId||!owner.workspace.isCurrent()||flights.has(flight))return null
        if(!owner.auth.isAuthenticated){owner.auth.openLoginModal();return null}
        const api=owner.workspace.detachedApi();if(!api||!recover&&owner.readOnly)return null
        const current=()=>mounted.current&&live.current.scope===owner.scope&&owner.workspace.isCurrent()
        const key=novelMutationKey('annotation',{userHash:owner.auth.userHash,workspaceId:owner.workspace.workspaceId,storyId:request.storyId},annotationTarget(request))
        flights.add(flight)
        let pending={...record,storageFailed:!adoptNovelMutation(key,record)}
        retain(owner.scope,pending);if(current())setState((old)=>({...old,error:null,errorKind:undefined}))
        try{
            let ack=request.ack??(recover?await api.getStoryAnnotationResult(request.storyId,request.write):null)
            if(!ack){
                if(!current())return null
                if(owner.readOnly)throw new ApiError(409,'Restore the novel or workspace before retrying this note.',{code:'STORY_READ_ONLY'})
                ack=await api.changeStoryAnnotation(request.storyId,request.write)
            }
            pending={...pending,write:{...request,ack}};pending.storageFailed=!writeNovelMutation(key,pending.write);retain(owner.scope,pending)
            if(!current())return null
            let fresh:StoryAnnotation
            try{
                fresh=await api.getStoryAnnotation(request.storyId,ack.annotationId)
                if(!current())return null
                if(!confirmedHead(fresh,ack))throw new Error('Stale confirmed annotation')
                if(!await verifyBookmarkConfirmation(fresh,pending.write,(sceneId,revision,hash)=>api.getStoryRevision(request.storyId,sceneId,revision,hash)))throw new Error('Unverified confirmed bookmark location')
            }catch{if(current())setState((old)=>({...old,error:'refreshFailed',errorKind:annotationIntentKind(request)==='bookmark'?'bookmark':undefined}));return null}
            if(!current())return null
            for(const candidate of [...listAnnotationJournals({userHash:owner.auth.userHash,workspaceId:owner.workspace.workspaceId}),pending,record]){
                if(canonicalJson(intent(candidate))===canonicalJson(intent(record)))retireNovelMutation(candidate,key)
            }
            memory.current.get(owner.scope)?.delete(identity(record));signal()
            confirmed.current?.(pending.write,fresh)
            return fresh
        }catch(error){
            const code=error instanceof ApiError?error.code:null
            const definite=error instanceof ApiError&&[400,404,409,422].includes(error.status)&&!['STORY_READ_ONLY','WORKSPACE_ARCHIVED'].includes(code??'')
            if(definite&&current()){retireNovelMutation(record,key);memory.current.get(owner.scope)?.delete(identity(record));signal()}
            if(current())setState((old)=>({...old,errorKind:annotationIntentKind(request)==='bookmark'?'bookmark':undefined,error:['STORY_ANNOTATION_CONFLICT','STORY_ANNOTATION_ANCHOR_CONFLICT','STORY_ANNOTATION_SOURCE_CHANGED','STORY_ANNOTATION_KIND_MISMATCH'].includes(code??'')?'changed':['STORY_READ_ONLY','WORKSPACE_ARCHIVED'].includes(code??'')?'readOnly':'failed'}))
            throw error
        }finally{flights.delete(flight);signal()}
    }
    const items=state.scope===scope?state.items:[]
    return {items,error:state.scope===scope?state.error:null,...(state.scope===scope&&state.errorKind?{errorKind:state.errorKind}:{}),
        start:(write:StoryAnnotationWrite,draft?:PersonalNoteDraft,kind?:'bookmark')=>{
            if(live.current.scope!==scope||!storyId||!workspace.isCurrent())return Promise.resolve(null)
            const bookmark=kind==='bookmark'||write.operation.kind==='bookmark'||draft?.write.kind==='bookmark'
            const request:AnnotationIntent={storyId,...(bookmark?{kind:'bookmark' as const}:{}),write:JSON.parse(JSON.stringify(write)) as StoryAnnotationWrite,...(draft?{draft:JSON.parse(JSON.stringify(draft)) as PersonalNoteDraft}:{})}
            if(!isAnnotationIntent(request))throw new Error('Invalid personal note request')
            if(gather().some((record)=>record.write.write.operation.id===write.operation.id))throw new ApiError(409,'Recover this note request first.',{code:'STORY_PENDING_OPERATION'})
            return send({schema:1,write:request},false)
        },recover:(record:PendingAnnotation)=>send(record,true),hasPending:(annotationId?:string)=>items.some((record)=>!annotationId||record.write.write.operation.id===annotationId),
        busy:(record:PendingAnnotation)=>flights.has(scope+':'+identity(record)),clearError:()=>setState((old)=>({...old,error:null})),
    }
}
export type AnnotationMutations=ReturnType<typeof useAnnotationMutations>
