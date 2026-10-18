import { useLayoutEffect,useMemo,useRef } from 'react'
import { useAuth,useData } from '@/app/hooks'
import type { StorySceneDocument,StorySnapshotComparison,StorySnapshotPage,StorySnapshotPreview,StorySnapshotSceneView,StorySnapshotScene,StorySnapshotRestoreOptions,StorySnapshotRestorePreview } from '@/shared'
import type { StoryWorkspace } from './useStoryWorkspace'
import type { StorySnapshotDetail,StorySnapshotAnnotationQuery,StorySnapshotAnnotationIndex,StorySnapshotAnnotationPage,StorySnapshotAnnotationDetail } from '@/shared'

export interface StorySnapshotSource {
    key:string
    isCurrent:()=>boolean
    preview:()=>Promise<StorySnapshotPreview>
    list:(before?:number)=>Promise<StorySnapshotPage>
    compare:(id:number)=>Promise<StorySnapshotComparison>
    scene:(snapshotId:number,scene:StorySnapshotScene,hash:string)=>Promise<StorySnapshotSceneView>
    currentScene:(sceneId:string)=>Promise<StorySceneDocument>
    restorePreview:(id:number,options:StorySnapshotRestoreOptions)=>Promise<StorySnapshotRestorePreview>
    notes:(snapshot:StorySnapshotDetail,query?:StorySnapshotAnnotationQuery)=>Promise<StorySnapshotAnnotationPage>
    note:(snapshot:StorySnapshotDetail,index:StorySnapshotAnnotationIndex)=>Promise<StorySnapshotAnnotationDetail>
}
export function useSnapshotSource(storyId:string|null,workspace:StoryWorkspace):StorySnapshotSource|null {
    const {userHash}=useAuth()
    const {refreshStory}=useData()
    const refresh=useRef(refreshStory)
    useLayoutEffect(()=>{refresh.current=refreshStory},[refreshStory])
    return useMemo(()=>{
        if(!storyId)return null
        const api=()=>{const client=workspace.isCurrent()?workspace.detachedApi():null;if(!client)throw new Error('Snapshot scope changed');return client}
        return {key:(userHash??'anonymous')+':'+workspace.workspaceId+':'+storyId,isCurrent:workspace.isCurrent,
            preview:async()=>{api();await refresh.current(storyId);return api().getStorySnapshotPreview(storyId)},list:(before?:number)=>api().getStorySnapshots(storyId,before),
            compare:(id:number)=>api().compareStorySnapshot(storyId,id),scene:(id:number,scene:StorySnapshotScene,hash:string)=>api().getStorySnapshotScene(storyId,id,scene,hash),
            currentScene:(sceneId:string)=>api().getStorySceneDocument(storyId,sceneId),
            notes:(snapshot,query)=>{if(snapshot.storyId!==storyId)throw new Error('Snapshot scope changed');return api().getStorySnapshotAnnotations(snapshot,query)},
            note:(snapshot,index)=>{if(snapshot.storyId!==storyId)throw new Error('Snapshot scope changed');return api().getStorySnapshotAnnotation(snapshot,index)},
            restorePreview:async(id:number,options:StorySnapshotRestoreOptions)=>{api();await refresh.current(storyId);return api().previewStorySnapshotRestore(storyId,id,options)}}
    },[storyId,userHash,workspace])
}
