import { useLayoutEffect,useMemo,useRef } from 'react'
import { useAuth } from '@/app/hooks'
import { API_BASE_URL } from '@/infrastructure/api/baseUrl'
import type { StoryReadingPage,StoryReadingRequest } from '@/shared/types/storyReading.types'
import type { StoryWorkspace } from './useStoryWorkspace'

export interface ManuscriptReadingSource {
    key:string;storyId:string;isCurrent:()=>boolean
    read:(query:StoryReadingRequest)=>Promise<StoryReadingPage>
}
export function useManuscriptReadingSource(storyId:string|null,workspace:StoryWorkspace):ManuscriptReadingSource|null {
    const {userHash}=useAuth()
    const key=storyId&&userHash&&workspace.workspaceId?JSON.stringify([API_BASE_URL,userHash,workspace.workspaceId,storyId]):null
    const token=useMemo(()=>({key,workspace}),[key,workspace])
    const live=useRef<object|null>(token)
    useLayoutEffect(()=>{live.current=token;return()=>{live.current=null}},[token])
    return useMemo(()=>{
        if(!key||!storyId)return null
        const isCurrent=()=>live.current===token&&workspace.isCurrent()
        return {key,storyId,isCurrent,read:async(query)=>{
            const api=isCurrent()?workspace.detachedApi():null
            if(!api)throw new Error('Manuscript reader scope changed')
            const result=await api.readStoryManuscript(storyId,query)
            if(!isCurrent())throw new Error('Manuscript reader scope changed')
            return result
        }}
    },[key,storyId,workspace,token])
}
