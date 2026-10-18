import type { StorySnapshotManifest,StorySnapshotDetail,StorySnapshotAnnotationCollection,StorySnapshotAnnotationIndex,StorySnapshotAnnotationPage,StorySnapshotAnnotationDetail,StorySnapshotAnnotationQuery } from '@/shared'
import { isRecord,isNovelRevision } from '@/shared/novelMutationJournal'
import { isSnapshotHash } from '@/shared/storySnapshotOperation'
import { canonicalJson } from '@/utils/json'
import { verifyAnnotationCore,compareAnnotationIds } from './storyAnnotationContract'

const id=(value:unknown):value is string=>typeof value==='string'&&Boolean(value)&&value===value.trim()&&Array.from(value).length<=64
const text=(value:unknown,max:number)=>typeof value==='string'&&Array.from(value).length<=max
const timestamp=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value))
const reasons=['mapping_unavailable','passage_changed','crosses_scene_split','source_unavailable']
export function verifySnapshotAnnotationIndex(value:unknown,revision:number,scenes:Set<string>):value is StorySnapshotAnnotationIndex {
    return isRecord(value)&&(!Object.prototype.hasOwnProperty.call(value,'kind')||value.kind==='bookmark')&&Object.keys(value).length===(value.kind==='bookmark'?15:14)&&(value.kind!=='bookmark'||value.state!=='resolved')&&id(value.id)&&id(value.sceneId)&&scenes.has(value.sceneId)
        &&['revision','anchorVersion','createdRevision','contentEvent','anchorEvent'].every((key)=>isNovelRevision(value[key]))
        &&Number(value.createdRevision)<=Number(value.contentEvent)&&Number(value.contentEvent)<=Number(value.anchorEvent)&&Number(value.anchorEvent)<=revision
        &&['open','resolved','trashed'].includes(String(value.state))&&(value.anchorState==='attached'?value.orphanReason===null:value.anchorState==='orphaned'&&reasons.includes(String(value.orphanReason)))
        &&timestamp(value.createdAt)&&text(value.bodyPreview,160)&&text(value.quotePreview,160)&&isSnapshotHash(value.contentHash)
}
export function verifySnapshotAnnotationCollection(value:unknown,scenes:Set<string>):value is StorySnapshotAnnotationCollection {
    if(!isRecord(value)||Object.keys(value).length!==2||!isNovelRevision(value.revision)||!Array.isArray(value.notes)||value.notes.length>20_000)return false
    let previous=''
    for(const item of value.notes){if(!verifySnapshotAnnotationIndex(item,value.revision,scenes)||previous&&compareAnnotationIds(item.id,previous)<=0)return false;previous=item.id}
    return true
}
function envelope(value:Record<string,unknown>,snapshot:StorySnapshotDetail){
    return value.storyId===snapshot.storyId&&value.snapshotId===snapshot.id&&value.manifestHash===snapshot.manifestHash&&snapshot.manifest.annotations!==undefined&&value.annotationRevision===snapshot.manifest.annotations.revision
}
export function verifySnapshotAnnotationPage(value:unknown,snapshot:StorySnapshotDetail,query:StorySnapshotAnnotationQuery={}):value is StorySnapshotAnnotationPage {
    if(!isRecord(value)||Object.keys(value).length!==6||!envelope(value,snapshot)||!Array.isArray(value.items)||value.items.length>50)return false
    const expected=snapshot.manifest.annotations!.notes.filter((item)=>(item.kind??'note')===(query.kind??'note')&&(!query.after||compareAnnotationIds(item.id,query.after)>0)&&(!query.sceneId||item.sceneId===query.sceneId)&&(!query.state||item.state===query.state)&&(!query.anchorState||item.anchorState===query.anchorState))
    return canonicalJson(value.items)===canonicalJson(expected.slice(0,50))&&value.nextAfter===(expected.length>50?expected[49].id:null)
}
export function verifySnapshotAnnotationDetail(value:unknown,snapshot:StorySnapshotDetail,index:StorySnapshotAnnotationIndex):value is StorySnapshotAnnotationDetail {
    if(!isRecord(value)||Object.keys(value).length!==7||!envelope(value,snapshot)||!verifyAnnotationCore(value.note,snapshot.storyId,index.id)||Object.keys(value.note).length!==(value.note.kind==='bookmark'?16:15)||value.note.kind!==index.kind||value.contentHash!==index.contentHash||!timestamp(value.recordedAt))return false
    const note=value.note,ref=snapshot.manifest.annotations?.notes.find((item)=>item.id===index.id)
    if(!ref||canonicalJson(ref)!==canonicalJson(index)||Array.from(note.body).slice(0,160).join('')!==index.bodyPreview||Array.from(note.lastAnchor.quote).slice(0,160).join('')!==index.quotePreview)return false
    if(!(['id','sceneId','revision','anchorVersion','state','anchorState','orphanReason','createdRevision','createdAt'] as const).every((key)=>note[key]===index[key]))return false
    return note.anchor===null||matchesScene(snapshot.manifest,note.anchor.sceneId,note.anchor.revision,note.anchor.contentHash)
}
function matchesScene(manifest:StorySnapshotManifest,id:string,revision:number,hash:string){
    const scene=manifest.chapters.flatMap((chapter)=>chapter.scenes).find((item)=>item.id===id)
    return scene?.revision===revision&&scene.contentHash===hash
}
