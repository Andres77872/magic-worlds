import { useLayoutEffect,useMemo,useRef } from 'react'
import { useAuth,useData } from '@/app/hooks'
import type { StoryDocumentRevision,StorySceneDocument,StorySceneRevisionHead,StorySceneRevisionPage,StorySceneRevisionQuery } from '@/shared'
import type { StoryWorkspace } from './useStoryWorkspace'

export interface SceneRevisionSource {
    key:string;storyId:string;sceneId:string;isCurrent:()=>boolean
    page:(query:StorySceneRevisionQuery)=>Promise<StorySceneRevisionPage>
    detail:(revision:number,hash:string)=>Promise<StoryDocumentRevision>
    current:()=>Promise<StorySceneDocument>
    head:()=>Promise<StorySceneRevisionHead>
}
export function useSceneRevisionSource(storyId:string|null,sceneId:string|null,workspace:StoryWorkspace):SceneRevisionSource|null {
    const {userHash}=useAuth(),{refreshStoryScene}=useData()
    const refresh=useRef(refreshStoryScene)
    useLayoutEffect(()=>{refresh.current=refreshStoryScene},[refreshStoryScene])
    return useMemo(()=>{
        if(!storyId||!sceneId)return null
        const api=()=>{const value=workspace.isCurrent()?workspace.detachedApi():null;if(!value)throw new Error('Scene history scope changed');return value}
        return {key:(userHash??'anonymous')+':'+workspace.workspaceId+':'+storyId+':'+sceneId,storyId,sceneId,isCurrent:workspace.isCurrent,
            page:(query:StorySceneRevisionQuery)=>api().getStoryRevisions(storyId,sceneId,query),
            detail:(revision:number,hash:string)=>api().getStoryRevision(storyId,sceneId,revision,hash),
            head:async()=>(await api().getStoryRevisions(storyId,sceneId,{before:1})).head,
            current:async()=>{api();const value=await refresh.current(storyId,sceneId);api();return value}}
    },[storyId,sceneId,userHash,workspace])
}
