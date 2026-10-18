import { useLayoutEffect,useMemo,useRef } from 'react'
import { useAuth,useData } from '@/app/hooks'
import { API_BASE_URL } from '@/infrastructure/api/baseUrl'
import type { StorySearchOptions,StorySearchPage,StorySearchRequest,StorySearchResolve,StorySearchResult } from '@/shared/types/storySearch.types'
import type { StoryWorkspace } from './useStoryWorkspace'

export interface ManuscriptSearchSource {
    key:string;storyId:string;isCurrent:()=>boolean
    search:(query:StorySearchRequest)=>Promise<StorySearchPage>
    resolve:(query:StorySearchResolve)=>Promise<StorySearchResult>
}
export type ManuscriptSearchQuery=StorySearchOptions
export function useManuscriptSearchSource(storyId:string|null,workspace:StoryWorkspace):ManuscriptSearchSource|null {
    const {userHash}=useAuth(),{resolveStorySearchResult}=useData()
    const resolver=useRef(resolveStorySearchResult)
    useLayoutEffect(()=>{resolver.current=resolveStorySearchResult},[resolveStorySearchResult])
    const key=storyId&&userHash&&workspace.workspaceId?JSON.stringify([API_BASE_URL,userHash,workspace.workspaceId,storyId]):null
    const token=useMemo(()=>({key,workspace}),[key,workspace]),live=useRef<object|null>(token)
    useLayoutEffect(()=>{live.current=token;return()=>{live.current=null}},[token])
    return useMemo(()=>{
        if(!key||!storyId)return null
        const isCurrent=()=>live.current===token&&workspace.isCurrent()
        const api=()=>{const value=isCurrent()?workspace.detachedApi():null;if(!value)throw new Error('Manuscript search scope changed');return value}
        return {key,storyId,isCurrent,
            search:async(query:StorySearchRequest)=>{const result=await api().searchStoryManuscript(storyId,query);api();return result},
            resolve:async(query:StorySearchResolve)=>{api();const result=await resolver.current(storyId,query);api();return result}}
    },[key,storyId,workspace,token])
}
