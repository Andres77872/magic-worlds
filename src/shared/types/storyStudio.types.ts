import type { Story,StoryChapter,StoryScene,StoryUnitMetadata,StoryGeneration,StoryContextTrace } from './story.types'

/** An indexed head carries no editable prose or generation collection. */
export interface StorySceneStatistics {
    schemaVersion:1
    algorithm:'icu-word-en-v1'
    sourceRevision:number
    contentHash:string
    wordCount:number|null
    characterCount:number
    textBytes:number
}
export interface StorySceneHeader extends StoryUnitMetadata {
    chapterId:string
    revision:number
    contentHash:string
    copiedFromRevision:number|null
    statistics:StorySceneStatistics|null
}
export interface StoryChapterHeader extends Omit<StoryChapter,'scenes'|'body'|'activeCardRefs'|'generationHistory'> {
    scenes:StorySceneHeader[]
}
export interface StoryStudioIndex extends Omit<Story,'chapters'|'summary'|'chapterCount'|'sceneCount'> {
    schemaVersion:1
    projection:'studio_index'
    sourceVersion:string
    chapters:StoryChapterHeader[]
}
/** UI metadata consumers accept both complete documents and unloaded heads. */
export interface StorySceneOutline extends StoryUnitMetadata {
    chapterId:string
    revision:number
    contentHash:string
    copiedFromRevision?:number|null
    statistics?:StorySceneStatistics|null
}
export interface StoryChapterOutline extends Omit<StoryChapter,'scenes'|'body'|'activeCardRefs'|'generationHistory'> {
    scenes:StorySceneOutline[]
}
export interface StoryOutline extends Omit<Story,'chapters'> {
    chapters:StoryChapterOutline[]
}
/** Acknowledged changes invalidate the former server sourceVersion. */
export interface StoryStudioState extends Omit<StoryStudioIndex,'projection'|'sourceVersion'> {
    projection:'studio_state'
    sourceVersion:null
}
export type StoryStudioSource=StoryStudioIndex|StoryStudioState
export interface StoryStudioSceneRequest {
    sourceMetadataRevision:number
    sourceStructureRevision:number
    sourceContextRevision:number
    chapterMetadataRevision:number
    partMetadataRevision:number|null
    revision:number
    metadataRevision:number
    contentHash:string
}
export type StorySceneDocument=Omit<StoryScene,'generationHistory'>&{latestGenerationTrace?:StoryContextTrace|null}
export interface StoryStudioDocument extends StorySceneDocument {projection:'scene_document';latestGenerationTrace:StoryContextTrace|null}
export interface StoryStudioScene {
    schemaVersion:2
    projection:'studio_scene'
    storyId:string
    source:StoryStudioSceneRequest
    scene:StoryStudioDocument
}
export interface StoryStudioExcerptHead {sceneId:string;revision:number;metadataRevision:number;contentHash:string}
export interface StoryStudioExcerptsRequest {
    sourceMetadataRevision:number
    sourceStructureRevision:number
    sourceContextRevision:number
    scenes:StoryStudioExcerptHead[]
}
export interface StoryStudioExcerpts {
    schemaVersion:1
    projection:'scene_excerpts'
    storyId:string
    source:StoryStudioExcerptsRequest
    items:Array<StoryStudioExcerptHead&{text:string;truncated:boolean}>
}
export interface StoryGenerationSummary extends Pick<StoryGeneration,'id'|'storyId'|'chapterId'|'sceneId'|'command'|'status'|'baseRevision'|'appliedRevision'> {
    createdAt:string
    chapterTitle:string
    sceneTitle:string
    location:'active'|'archived'|'trashed'
    instructionPreview:string|null
    instructionTruncated:boolean
    outputPreview:string
    outputTruncated:boolean
}
export interface StoryGenerationHistoryPage {schemaVersion:1;storyId:string;before:string|null;items:StoryGenerationSummary[];nextBefore:string|null}
export interface StoryGenerationDetail {schemaVersion:1;storyId:string;generation:StoryGeneration;chapterTitle:string;sceneTitle:string;location:'active'|'archived'|'trashed';refinementSource?:import('./storyAssistant.types').NovelRefinementReference}
