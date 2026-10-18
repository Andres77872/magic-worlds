import type { StorySceneRestoreWrite,StorySceneRestoreAcknowledgement } from '@/shared'
import { isRecord,isNovelRevision,listNovelMutations,type NovelJournalRecord } from '@/shared/novelMutationJournal'
import { isSceneRestoreWrite,verifySceneRestoreAck } from '@/infrastructure/api/storyRevisionContract'

export interface SceneRestoreIntent {storyId:string;sceneId:string;sceneTitle:string;revision:number;write:StorySceneRestoreWrite;ack?:StorySceneRestoreAcknowledgement}
const id=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=64&&value===value.trim()
export function isSceneRestoreIntent(value:unknown):value is SceneRestoreIntent {
    return isRecord(value)&&Object.keys(value).every((key)=>['storyId','sceneId','sceneTitle','revision','write','ack'].includes(key))
        &&id(value.storyId)&&id(value.sceneId)&&typeof value.sceneTitle==='string'&&value.sceneTitle.trim().length>0&&Array.from(value.sceneTitle).length<=255
        &&isNovelRevision(value.revision)&&isSceneRestoreWrite(value.write)
        &&(value.ack===undefined||verifySceneRestoreAck(value.ack,value.storyId,value.sceneId,value.revision,value.write))
}
export const sceneRestoreTarget=(value:SceneRestoreIntent)=>value.sceneId+':'+value.write.requestId
export const listSceneRestoreJournals=(scope:{userHash:string|null|undefined;workspaceId:string|null|undefined}):NovelJournalRecord<SceneRestoreIntent>[]=>
    listNovelMutations('scene-restore',scope,isSceneRestoreIntent,(value)=>({storyId:value.storyId,target:sceneRestoreTarget(value)}))
