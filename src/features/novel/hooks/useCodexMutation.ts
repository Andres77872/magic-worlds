import { useEffect,useLayoutEffect,useRef,useState } from 'react'
import { useAuth,useData } from '@/app/hooks'
import { ApiError } from '@/infrastructure/api'
import type { StoryOutline,StoryCodexAcknowledgement,StoryCodexOperation,StoryCodexWrite } from '@/shared'
import { adoptNovelMutation,novelMutationKey,retireNovelMutation,type NovelJournalRecord } from '@/shared/novelMutationJournal'
import { makeRequestId } from '@/utils/uuid'
import { canonicalJson } from '@/utils/json'
import { readCodexJournal } from '../persistence/codexJournal'
import type { StoryWorkspace } from './useStoryWorkspace'

const LIBRARY_REFUSALS=['STORY_CODEX_SOURCE_CHANGED','STORY_CODEX_SOURCE_MISSING']

export function useCodexMutation(story:StoryOutline|null,workspace:StoryWorkspace,readOnly:boolean,workspaceReadOnly:boolean){
    const {changeStoryCodex,refreshStory}=useData()
    const {userHash,isAuthenticated,openLoginModal}=useAuth()
    const key=novelMutationKey('codex',{userHash,workspaceId:workspace.workspaceId,storyId:story?.id??null})
    const identity=key??JSON.stringify([userHash,workspace.workspaceId,story?.id])
    const [state,setState]=useState(()=>({identity,record:readCodexJournal(key),busy:false,storageFailed:false,error:null as string|null}))
    const live=useRef({key,identity,story,workspace,readOnly,workspaceReadOnly,isAuthenticated})
    useLayoutEffect(()=>{live.current={key,identity,story,workspace,readOnly,workspaceReadOnly,isAuthenticated}})
    const attempts=useRef(new Map<string,NovelJournalRecord<StoryCodexWrite>>())
    const flights=useRef(new Set<string>())
    const mounted=useRef(true)
    useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
    useEffect(()=>{
        const record=attempts.current.get(identity)??readCodexJournal(key)
        if(record)attempts.current.set(identity,record)
        setState({identity,record,busy:flights.current.has(identity),storageFailed:false,error:null})
    },[identity,key])
    async function perform(operation?:StoryCodexOperation,expectedContextRevision?:number):Promise<StoryCodexAcknowledgement|undefined>{
        const current=live.current
        if(!current.story||!current.workspace.isCurrent())throw new ApiError(409,'The novel workspace changed. Your request is retained.',{code:'STORY_SCOPE_CHANGED'})
        if(flights.current.has(current.identity))throw new ApiError(409,'The Codex request is still running.',{code:'STORY_PENDING_OPERATION'})
        if(!current.isAuthenticated){openLoginModal();return}
        const record=attempts.current.get(current.identity)??readCodexJournal(current.key)
        if(current.workspaceReadOnly||current.readOnly&&!record)return
        if(record&&operation&&canonicalJson(record.write.operation)!==canonicalJson(operation))throw new ApiError(409,'Resolve the pending Codex request first.',{code:'STORY_PENDING_OPERATION'})
        const pending=record??(operation?{schema:1 as const,write:{requestId:makeRequestId('novel-codex'),expectedContextRevision:expectedContextRevision??current.story.contextRevision,operation}}:null)
        if(!pending)return
        attempts.current.set(current.identity,pending);flights.current.add(current.identity)
        const stored=adoptNovelMutation(current.key,pending)
        const isCurrent=()=>mounted.current&&live.current.identity===current.identity&&current.workspace.isCurrent()
        setState({identity:current.identity,record:pending,busy:true,storageFailed:Boolean(current.key)&&!stored,error:null})
        try{
            const ack=await changeStoryCodex(current.story.id,pending.write)
            retireNovelMutation(pending,current.key);attempts.current.delete(current.identity)
            if(isCurrent())setState({identity:current.identity,record:null,busy:false,storageFailed:false,error:null})
            return ack
        }catch(error){
            const definite=error instanceof ApiError&&error.status>=400&&error.status<500&&![408,429].includes(error.status)
            // A library card that changed or left during a review is reported by the review itself; the Codex did not change.
            const library=error instanceof ApiError&&LIBRARY_REFUSALS.includes(error.code??'')
            if(definite){
                retireNovelMutation(pending,current.key);attempts.current.delete(current.identity)
                if(error.status===409&&!library)await refreshStory(current.story.id).catch(()=>{})
            }
            if(isCurrent())setState({identity:current.identity,record:definite?null:pending,busy:false,storageFailed:Boolean(current.key)&&!stored,error:library?null:error instanceof ApiError&&error.status===409?'codexConflict':'failed'})
            throw error
        }finally{flights.current.delete(current.identity)}
    }
    const current=state.identity===identity?state:null
    return {perform,pending:current?.record?.write??null,busy:current?.busy??false,error:current?.error??null,storageFailed:current?.storageFailed??false,retry:async()=>{await perform()},canRetry:!workspaceReadOnly}
}
