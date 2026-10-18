import { useLayoutEffect,useMemo,useRef } from 'react'
import { useAuth } from '@/app/hooks'
import { ApiError } from '@/infrastructure/api'
import { API_BASE_URL } from '@/infrastructure/api/baseUrl'
import type { StoryAssistantContext,StoryAssistantContextOptions } from '@/shared/types/storyAssistant.types'
import type { StoryWorkspace } from './useStoryWorkspace'

export interface AssistantContextSource {
    key:string;storyId:string;isCurrent:()=>boolean
    prepare:(options:StoryAssistantContextOptions,signal?:AbortSignal)=>Promise<StoryAssistantContext>
}
/** Re-read owned metadata before freezing source versions; never flush or mutate writing. */
export function useAssistantContextSource(storyId:string|null,workspace:StoryWorkspace):AssistantContextSource|null {
    const {userHash}=useAuth()
    const key=!workspace.deviceOnly&&storyId&&userHash&&workspace.workspaceId?JSON.stringify([API_BASE_URL,userHash,workspace.workspaceId,storyId]):null
    const token=useMemo(()=>({key,workspace}),[key,workspace]),live=useRef<object|null>(token)
    useLayoutEffect(()=>{live.current=token;return()=>{live.current=null}},[token])
    return useMemo(()=>{
        if(!key||!storyId)return null
        const isCurrent=()=>live.current===token&&workspace.isCurrent()
        return {key,storyId,isCurrent,prepare:async(options,signal)=>{
            const check=()=>{if(!isCurrent()||signal?.aborted)throw new Error('Assistant source scope changed')}
            check()
            const frozen=structuredClone(options)
            const api=workspace.detachedApi()
            if(!api)throw new Error('Assistant source scope changed')
            const index=await api.getStoryStudioIndex(storyId,{signal})
            check()
            const head=index.chapters.flatMap(chapter=>chapter.scenes).find(scene=>scene.id===frozen.anchorSceneId)
            if(!head||frozen.selection&&(head.revision!==frozen.selection.expectedRevision||head.contentHash!==frozen.selection.expectedContentHash)){
                throw new ApiError(409,'The saved source changed. Select its current saved passage before preparing sources.',{code:'STORY_ASSISTANT_SOURCE_CHANGED',retryable:false})
            }
            const result=await api.previewStoryAssistantContext(index,{...frozen,sourceVersion:index.sourceVersion},{signal})
            check()
            return result
        }}
    },[key,storyId,workspace,token])
}
