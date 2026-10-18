import type { StoryChapterStatus, StoryScene } from './story.types'

/** Literal query over saved canonical prose. Whitespace is significant. */
export interface StorySearchOptions {
    q:string;caseSensitive?:boolean;includeArchived?:boolean
    partId?:string|null;chapterId?:string|null;sceneId?:string|null;status?:StoryChapterStatus|null
}
export interface StorySearchRequest extends StorySearchOptions {limit?:number;cursor?:string|null}
export interface StorySearchPoint {sceneId:string;position:number}
export interface StorySearchResolve extends StorySearchOptions {sourceSnapshot:string;target:StorySearchPoint}
export interface StorySearchMatch extends StorySearchPoint {
    chapterId:string;partId:string|null;title:string;chapterTitle:string;partTitle:string|null
    chapterMetadataRevision:number;partMetadataRevision:number|null
    revision:number;metadataRevision:number;contentHash:string;status:StoryChapterStatus;archived:boolean;readOnly:boolean
    startOffset:number;endOffset:number;quote:string;before:string;after:string;beforeCut:boolean;afterCut:boolean
}
export interface StorySearchEnvelope {
    schemaVersion:1;storyId:string;algorithm:'mysql-icu-literal-v1';sourceSnapshot:string;queryHash:string
    sourceStructureRevision:number;sourceMetadataRevision:number;sourceContextRevision:number
}
export interface StorySearchPage extends StorySearchEnvelope {scenesSearched:number;matchingScenes:number;items:StorySearchMatch[];nextCursor:string|null}
/** Pins/history are omitted, not empty; preserve them from a compatible owned cache. */
export interface StorySearchResult extends StorySearchEnvelope {projection:'scene_document';match:StorySearchMatch;scene:Omit<StoryScene,'activeCardRefs'|'generationHistory'>}
