import { useLayoutEffect,useMemo,useRef } from 'react'
import { useAuth } from '@/app/hooks'
import type { StoryGenerationDetail,StoryGenerationHistoryPage } from '@/shared'
import { API_BASE_URL } from '@/infrastructure/api/baseUrl'
import { apiStorageOrigin } from '@/shared/workspaceStorage'
import type { StoryWorkspace } from './useStoryWorkspace'

export interface GenerationHistorySource {
    key:string
    isCurrent:()=>boolean
    page:(before:string|null,signal?:AbortSignal)=>Promise<StoryGenerationHistoryPage>
    detail:(id:string,signal?:AbortSignal)=>Promise<StoryGenerationDetail>
}
export function useGenerationHistorySource(storyId:string|null,workspace:StoryWorkspace):GenerationHistorySource|null {
    const {userHash,accountKey}=useAuth()
    const key=storyId&&userHash&&workspace.workspaceId?JSON.stringify([apiStorageOrigin(API_BASE_URL),accountKey,userHash,workspace.workspaceId,storyId]):null
    const live=useRef(key);useLayoutEffect(()=>{live.current=key;return()=>{live.current=null}},[key])
    return useMemo(()=>{
        if(!key||!storyId)return null
        const isCurrent=()=>live.current===key&&workspace.isCurrent()
        const client=()=>{const api=isCurrent()?workspace.detachedApi():null;if(!api)throw new Error('Generation history scope changed');return api}
        return {key,isCurrent,page:(before,signal)=>client().getStoryGenerationHistory(storyId,before,{signal}),detail:(id,signal)=>client().getStoryGenerationHistoryDetail(storyId,id,{signal})}
    },[key,storyId,workspace])
}
