import type { StorySnapshotDetail,StoryFrozenAnnotation,StorySnapshotAnnotationIndex,StorySnapshotAnnotationPage,StorySnapshotAnnotationDetail,StorySnapshotAnnotationQuery } from '@/shared'
import { noteAnchor,personalNote } from './storyAnnotations'
import { snapshotComparison } from './storySnapshots'

export function frozenPersonalNote():StoryFrozenAnnotation {
    const anchor=noteAnchor({revision:2,contentHash:'b'.repeat(64),start:{nodeId:'scene-1-p',offset:4},end:{nodeId:'scene-1-p',offset:12},quote:'original'})
    const {head,updatedAt,...note}=personalNote({body:'Keep Mira’s uncertainty here. This was resolved in the first draft.',state:'resolved',anchor,lastAnchor:anchor,origin:anchor})
    void head;void updatedAt;return note
}
export function snapshotNoteIndex():StorySnapshotAnnotationIndex {
    const note=frozenPersonalNote()
    return {id:note.id,sceneId:note.sceneId,revision:note.revision,anchorVersion:note.anchorVersion,state:note.state,anchorState:note.anchorState,orphanReason:note.orphanReason,
        createdRevision:note.createdRevision,createdAt:note.createdAt,bodyPreview:note.body,quotePreview:note.lastAnchor.quote,contentEvent:4,anchorEvent:6,contentHash:'e'.repeat(64)}
}
export function annotatedSnapshot(){const value=snapshotComparison();value.manifest.annotations={revision:6,notes:[snapshotNoteIndex()]};return value}
const envelope=(snapshot:StorySnapshotDetail)=>({storyId:snapshot.storyId,snapshotId:snapshot.id,manifestHash:snapshot.manifestHash,annotationRevision:snapshot.manifest.annotations?.revision??6})
export const snapshotNoteReaders={
    notes:async(snapshot:StorySnapshotDetail,query:StorySnapshotAnnotationQuery={}):Promise<StorySnapshotAnnotationPage>=>{
        const items=(snapshot.manifest.annotations?.notes??[]).filter((item)=>(item.kind??'note')===(query.kind??'note')&&(!query.after||item.id>query.after)&&(!query.state||item.state===query.state)&&(!query.anchorState||item.anchorState===query.anchorState)&&(!query.sceneId||item.sceneId===query.sceneId))
        return {...envelope(snapshot),items:items.slice(0,50),nextAfter:items.length>50?items[49].id:null}
    },
    note:async(snapshot:StorySnapshotDetail,index:StorySnapshotAnnotationIndex):Promise<StorySnapshotAnnotationDetail>=>({...envelope(snapshot),note:frozenPersonalNote(),contentHash:index.contentHash,recordedAt:'2026-10-16T10:15:00'}),
}
