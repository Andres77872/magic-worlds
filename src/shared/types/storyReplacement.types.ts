import type { StoryDocumentNode } from './story.types'
import type { StorySearchOptions,StorySearchPoint } from './storySearch.types'

export interface StoryReplacementRequest extends StorySearchOptions {
    sourceSnapshot:string;replacement:string;targets:StorySearchPoint[]
}
export interface StoryReplacementReverseRequest {originRequestId:string;direction:'undo'|'redo'}
export type StoryReplacementOperation=
    |{op:'replace';preview:StoryReplacementRequest}
    |({op:'reverse';sourceSnapshot:string}&StoryReplacementReverseRequest)
export interface StoryReplacementWrite {requestId:string;previewHash:string;operation:StoryReplacementOperation}
export interface StoryReplacementMatch extends StorySearchPoint {startOffset:number;endOffset:number;quote:string}
export type StoryReplacementReason=null|'unchanged'|'reference'|'structure'|'read_only'|'proposal'|'limit'|'changed'
export interface StoryReplacementChange extends StoryReplacementMatch {
    replacement:string;reason:StoryReplacementReason;original:StoryDocumentNode[];proposed:StoryDocumentNode[]
}
export interface StoryReplacementScene {
    sceneId:string;title:string;revision:number;metadataRevision:number;contentHash:string;targetHash:string;changed:number
}
export interface StoryReplacementPreview {
    schemaVersion:1;kind:'manuscript_replace_preview';algorithm:'canonical-inline-literal-v1'
    storyId:string;sourceSnapshot:string;sourceStructureRevision:number;sourceMetadataRevision:number;sourceContextRevision:number
    operation:StoryReplacementOperation;previewHash:string;scenes:StoryReplacementScene[];changes:StoryReplacementChange[]
    counts:{selected:number;changed:number;unchanged:number;blocked:number;scenes:number};canApply:boolean
}
export interface StoryReplacementAck {
    kind:'manuscript_replace';storyId:string;algorithm:'canonical-inline-literal-v1';write:StoryReplacementWrite;originRequestId:string
    scenes:Array<{sceneId:string;fromRevision:number;fromHash:string;revision:number;contentHash:string;changed:number}>
    matches:StoryReplacementMatch[]
}
