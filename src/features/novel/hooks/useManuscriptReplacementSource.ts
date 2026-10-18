import { useLayoutEffect,useMemo,useRef } from 'react'
import { useAuth,useData } from '@/app/hooks'
import { API_BASE_URL } from '@/infrastructure/api/baseUrl'
import type { StoryOutline } from '@/shared'
import type { StoryReplacementAck,StoryReplacementPreview,StoryReplacementRequest,StoryReplacementReverseRequest,StoryReplacementWrite } from '@/shared/types/storyReplacement.types'
import type { StoryWorkspace } from './useStoryWorkspace'

export interface ManuscriptReplacementSource {
    key:string;storyId:string;isCurrent:()=>boolean
    preview:(query:StoryReplacementRequest)=>Promise<StoryReplacementPreview>
    reverse:(query:StoryReplacementReverseRequest)=>Promise<StoryReplacementPreview>
    write:(write:StoryReplacementWrite)=>Promise<StoryReplacementAck>
    recover:(write:StoryReplacementWrite)=>Promise<StoryReplacementAck|null>
    refresh:()=>Promise<StoryOutline>
}
export function useManuscriptReplacementSource(storyId:string|null,workspace:StoryWorkspace):ManuscriptReplacementSource|null {
    const {userHash}=useAuth(),{refreshStory}=useData(),refresh=useRef(refreshStory)
    useLayoutEffect(()=>{refresh.current=refreshStory},[refreshStory])
    const key=storyId&&userHash&&workspace.workspaceId?JSON.stringify([API_BASE_URL,userHash,workspace.workspaceId,storyId]):null
    const token=useMemo(()=>({key,workspace}),[key,workspace]),live=useRef<object|null>(token)
    useLayoutEffect(()=>{live.current=token;return()=>{live.current=null}},[token])
    return useMemo(()=>{
        if(!key||!storyId)return null
        const isCurrent=()=>live.current===token&&workspace.isCurrent()
        const api=()=>{const value=isCurrent()?workspace.detachedApi():null;if(!value)throw new Error('Replacement owner changed');return value}
        return {key,storyId,isCurrent,
            preview:async(query)=>{const result=await api().previewStoryReplacement(storyId,query);api();return result},
            reverse:async(query)=>{const result=await api().previewStoryReplacementReverse(storyId,query);api();return result},
            // Keep the original response reachable for durable recovery after
            // an owner change; the controller gates all UI/cache updates.
            write:(write)=>api().replaceStoryManuscript(storyId,write),recover:(write)=>api().getStoryReplacementResult(storyId,write),
            refresh:async()=>{api();const result=await refresh.current(storyId);api();return result}}
    },[key,storyId,workspace,token])
}
