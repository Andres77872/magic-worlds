import type { StoryDocumentRevision,StoryDocumentRevisionSummary,StorySceneRevisionHead,StorySceneRevisionPage,StorySceneRestoreWrite,StorySceneRestoreAcknowledgement } from '@/shared'
import { documentMarkdown,documentText } from '@/shared/storyDocument'
import { manuscript,storyScene } from './story'

export function revisionSummary(patch:Partial<StoryDocumentRevisionSummary>={}):StoryDocumentRevisionSummary {
    return {revision:2,parentRevision:1,contentHash:'b'.repeat(64),source:'manual',actor:'author',schemaVersion:1,generationId:null,restoredFrom:null,createdAt:'2026-10-16T10:20:00',...patch}
}
export function revisionHead(patch:Partial<StorySceneRevisionHead>={}):StorySceneRevisionHead {
    return {sceneId:'scene-1',chapterId:'chapter-1',title:'At the gate',revision:3,metadataRevision:2,contentHash:'c'.repeat(64),readOnly:false,...patch}
}
export function revisionPage(patch:Partial<StorySceneRevisionPage>={}):StorySceneRevisionPage {
    return {storyId:'story-1',sceneId:'scene-1',head:revisionHead(),items:[revisionSummary()],nextBefore:null,...patch}
}
export function sceneRevision(patch:Partial<StoryDocumentRevision>={}):StoryDocumentRevision {
    const document=patch.document??manuscript('The old gate glows. 🌒 Mira waits.','old-gate')
    return {...revisionSummary(),storyId:'story-1',sceneId:'scene-1',...patch,document,body:documentMarkdown(document),plainText:documentText(document)}
}
export const currentRevisionScene=()=>storyScene({title:'At the gate',revision:3,metadataRevision:2,contentHash:'c'.repeat(64),document:manuscript('The gate opens to the sea.','current-gate'),details:{notes:'Keep these notes.'}})
export function sceneRestoreWrite(patch:Partial<StorySceneRestoreWrite>={}):StorySceneRestoreWrite {
    return {requestId:'restore-scene-1',expectedRevision:3,expectedContentHash:'c'.repeat(64),sourceContentHash:'b'.repeat(64),...patch}
}
export function sceneRestoreAck(write:StorySceneRestoreWrite=sceneRestoreWrite()):StorySceneRestoreAcknowledgement {
    return {kind:'scene_restore',storyId:'story-1',sceneId:'scene-1',sourceRevision:2,write,revision:write.expectedRevision+1,contentHash:write.sourceContentHash}
}
