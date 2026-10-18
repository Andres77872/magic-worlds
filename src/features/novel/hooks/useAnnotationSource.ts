import { useLayoutEffect,useMemo,useRef } from 'react'
import { useAuth,useData } from '@/app/hooks'
import type { StoryAnnotation,StoryAnnotationPage,StoryAnnotationQuery,StorySceneDocument } from '@/shared'
import type { StoryWorkspace } from './useStoryWorkspace'

export interface AnnotationSource {
    key:string;storyId:string;isCurrent:()=>boolean
    page:(query:StoryAnnotationQuery)=>Promise<StoryAnnotationPage>
    detail:(annotationId:string)=>Promise<StoryAnnotation>
    currentScene:(sceneId:string)=>Promise<StorySceneDocument>
}
export function useAnnotationSource(storyId:string|null,workspace:StoryWorkspace):AnnotationSource|null {
    const {userHash}=useAuth(),{refreshStoryScene}=useData(),refresh=useRef(refreshStoryScene)
    useLayoutEffect(()=>{refresh.current=refreshStoryScene},[refreshStoryScene])
    return useMemo(()=>{
        if(!storyId)return null
        const api=()=>{const value=workspace.isCurrent()?workspace.detachedApi():null;if(!value)throw new Error('Annotation scope changed');return value}
        return {key:(userHash??'anonymous')+':'+workspace.workspaceId+':'+storyId,storyId,isCurrent:workspace.isCurrent,
            page:(query:StoryAnnotationQuery)=>api().getStoryAnnotations(storyId,query),detail:(annotationId:string)=>api().getStoryAnnotation(storyId,annotationId),
            currentScene:async(sceneId:string)=>{api();const value=await refresh.current(storyId,sceneId);api();return value}}
    },[storyId,userHash,workspace])
}
