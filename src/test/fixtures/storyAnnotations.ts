import type { StoryAnnotation,StoryAnnotationAnchor,StoryAnnotationPage,StoryAnnotationSummary,StoryAnnotationWrite,StoryAnnotationAcknowledgement } from '@/shared'
import { revisionHead } from './storyRevisions'

export function noteAnchor(patch:Partial<StoryAnnotationAnchor>={}):StoryAnnotationAnchor {
    return {schemaVersion:1,sceneId:'scene-1',revision:3,contentHash:'c'.repeat(64),start:{nodeId:'current-gate',offset:0},end:{nodeId:'current-gate',offset:8},quote:'The gate',...patch}
}
export function personalNote(patch:Partial<StoryAnnotation>={}):StoryAnnotation {
    return {id:'note-1',storyId:'story-1',sceneId:'scene-1',revision:2,anchorVersion:3,body:'Keep the gate description grounded in Mira’s view.',state:'open',origin:noteAnchor({revision:2,contentHash:'b'.repeat(64)}),anchor:noteAnchor(),lastAnchor:noteAnchor(),anchorState:'attached',orphanReason:null,
        source:{kind:'manual'},createdRevision:2,createdAt:'2026-10-16T10:00:00',updatedAt:'2026-10-16T10:10:00',head:revisionHead(),...patch}
}
export function noteSummary(patch:Partial<StoryAnnotationSummary>={}):StoryAnnotationSummary {
    return {id:'note-1',sceneId:'scene-1',sceneTitle:'At the gate',revision:2,anchorVersion:3,state:'open',anchorState:'attached',orphanReason:null,bodyPreview:'Keep the gate description grounded in Mira’s view.',quotePreview:'The gate',createdRevision:2,createdAt:'2026-10-16T10:00:00',updatedAt:'2026-10-16T10:10:00',readOnly:false,...patch}
}
export function notePage(patch:Partial<StoryAnnotationPage>={}):StoryAnnotationPage {
    return {storyId:'story-1',annotationRevision:5,items:[noteSummary()],nextBefore:null,...patch}
}
export function noteWrite():StoryAnnotationWrite {
    return {requestId:'note-create-1',operation:{op:'create',id:'note-1',body:'Keep this note.',anchor:{sceneId:'scene-1',expectedRevision:3,expectedContentHash:'c'.repeat(64),startOffset:0,endOffset:8,quote:'The gate'}}}
}
export function noteAck(write:StoryAnnotationWrite=noteWrite()):StoryAnnotationAcknowledgement {
    const op=write.operation
    return {kind:'annotation',storyId:'story-1',requestId:write.requestId,annotationId:op.id,annotationRevision:6,
        revision:op.op==='create'?1:op.op==='reanchor'?op.expectedRevision:op.expectedRevision+1,anchorVersion:op.op==='create'?1:op.op==='reanchor'?op.expectedAnchorVersion+1:3,operation:op}
}
