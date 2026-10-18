/** Personal notes stay separate from canonical scene prose. */
export interface StoryAnnotationPoint {nodeId:string;offset:number}
export interface StoryAnnotationAnchor {schemaVersion:1;sceneId:string;revision:number;contentHash:string;start:StoryAnnotationPoint;end:StoryAnnotationPoint;quote:string}
export interface StoryAnnotationSelection {sceneId:string;expectedRevision:number;expectedContentHash:string;startOffset:number;endOffset:number;quote:string}
/** Sequential edits in the exact canonical UTF-16 plain-text projection. */
export interface StoryAnchorEdit {from:number;to:number;text:string}
export type StoryAnnotationOperation=
    |{op:'create';id:string;body:string;anchor:StoryAnnotationSelection;kind?:'bookmark'}
    |{op:'edit';id:string;expectedRevision:number;body:string;kind?:'bookmark'}
    |{op:'set_state';id:string;expectedRevision:number;state:'open'|'resolved'|'trashed';kind?:'bookmark'}
    |{op:'reanchor';id:string;expectedRevision:number;expectedAnchorVersion:number;anchor:StoryAnnotationSelection;kind?:'bookmark'}
export interface StoryAnnotationWrite {requestId:string;operation:StoryAnnotationOperation}
export type StoryAnnotationState='open'|'resolved'|'trashed'
export type StoryAnnotationOrphanReason='mapping_unavailable'|'passage_changed'|'crosses_scene_split'|'source_unavailable'
export interface StoryAnnotationSummary {
    kind?:'bookmark'
    id:string;sceneId:string;sceneTitle:string;revision:number;anchorVersion:number;state:StoryAnnotationState;anchorState:'attached'|'orphaned';orphanReason:StoryAnnotationOrphanReason|null
    bodyPreview:string;quotePreview:string;createdRevision:number;createdAt:string;updatedAt:string;readOnly:boolean
}
export interface StoryAnnotationPage {storyId:string;annotationRevision:number;items:StoryAnnotationSummary[];nextBefore:string|null}
export interface StoryAnnotationCopyPreview {kind?:'bookmark';storyId:string;annotationRevision:number;scenes:Array<{sceneId:string;open:number;resolved:number;trashed:number}>}
export interface StoryAnnotationQuery {kind?:'note'|'bookmark';sceneId?:string;state?:StoryAnnotationState;anchorState?:'attached'|'orphaned';before?:string;q?:string}
export interface StoryAnnotation {
    kind?:'bookmark'
    id:string;storyId:string;sceneId:string;revision:number;anchorVersion:number;body:string;state:StoryAnnotationState
    origin:StoryAnnotationAnchor;anchor:StoryAnnotationAnchor|null;lastAnchor:StoryAnnotationAnchor;anchorState:'attached'|'orphaned';orphanReason:StoryAnnotationOrphanReason|null
    source:{kind:'manual'}|{kind:'copy';sourceStoryId:string;sourceId:string;sourceSceneId:string;sourceRevision:number;sourceAnchorVersion:number}
    createdRevision:number;createdAt:string;updatedAt:string;head:import('./story.types').StorySceneRevisionHead
}
export interface StoryAnnotationAcknowledgement {
    kind:'annotation';storyId:string;requestId:string;annotationId:string;annotationRevision:number;revision:number;anchorVersion:number;operation:StoryAnnotationOperation
}
export type StoryFrozenAnnotation=Omit<StoryAnnotation,'updatedAt'|'head'>
export interface StorySnapshotAnnotationIndex extends Pick<StoryAnnotationSummary,'kind'|'id'|'sceneId'|'revision'|'anchorVersion'|'state'|'anchorState'|'orphanReason'|'createdRevision'|'createdAt'|'bodyPreview'|'quotePreview'> {
    contentEvent:number;anchorEvent:number;contentHash:string
}
export interface StorySnapshotAnnotationCollection {revision:number;notes:StorySnapshotAnnotationIndex[]}
export interface StorySnapshotAnnotationQuery {kind?:'note'|'bookmark';after?:string;sceneId?:string;state?:StoryAnnotationState;anchorState?:'attached'|'orphaned'}
export interface StorySnapshotAnnotationEnvelope {storyId:string;snapshotId:number;manifestHash:string;annotationRevision:number}
export interface StorySnapshotAnnotationPage extends StorySnapshotAnnotationEnvelope {items:StorySnapshotAnnotationIndex[];nextAfter:string|null}
export interface StorySnapshotAnnotationDetail extends StorySnapshotAnnotationEnvelope {note:StoryFrozenAnnotation;contentHash:string;recordedAt:string}
