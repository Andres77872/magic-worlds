import type { StoryScene } from './story.types'
import type { StorySearchMatch } from './storySearch.types'

export interface StoryReadingRequest {
    scope?:'novel'|'part'|'chapter'|'scene';unitId?:string|null;includeArchived?:boolean
    sourceSnapshot?:string|null;afterSceneId?:string|null;limit?:number
    windowed?:boolean;startSceneId?:string|null;beforeSceneId?:string|null
}
export type StoryReadingHeader=Pick<StorySearchMatch,'sceneId'|'chapterId'|'partId'|'title'|'chapterTitle'|'partTitle'|'chapterMetadataRevision'|'partMetadataRevision'|'revision'|'metadataRevision'|'contentHash'|'status'|'archived'|'readOnly'>
export interface StoryReadingItem {
    header:StoryReadingHeader
    scene:Pick<StoryScene,'id'|'chapterId'|'revision'|'metadataRevision'|'contentHash'|'document'|'plainText'|'body'>
}
export interface StoryReadingPage {
    schemaVersion:1;storyId:string;sourceSnapshot:string
    sourceStructureRevision:number;sourceMetadataRevision:number;sourceContextRevision:number
    scope:'novel'|'part'|'chapter'|'scene';unitId:string|null;includeArchived:boolean;afterSceneId:string|null
    offset:number;totalScenes:number;nextAfterSceneId:string|null;items:StoryReadingItem[]
    navigation?:{startSceneId:string|null;beforeSceneId:string|null;previousBeforeSceneId:string|null;previousChapterId:string|null;previousPartId:string|null}
}
