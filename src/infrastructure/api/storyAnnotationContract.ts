import type { StoryAnnotation,StoryAnnotationAcknowledgement,StoryAnnotationAnchor,StoryAnnotationPage,StoryAnnotationQuery,StoryAnnotationSelection,StoryAnnotationWrite,StoryAnnotationCopyPreview,StoryFrozenAnnotation } from '@/shared'
import { isNovelRequestId,isNovelRevision,isRecord } from '@/shared/novelMutationJournal'
import { isSnapshotHash } from '@/shared/storySnapshotOperation'
import { canonicalJson } from '@/utils/json'
import { verifySceneRevisionHead } from './storyRevisionContract'

const fields=(value:Record<string,unknown>,keys:string[])=>Object.keys(value).every((key)=>keys.includes(key))
const text=(value:unknown,max:number):value is string=>typeof value==='string'&&Array.from(value).length<=max
const id=(value:unknown):value is string=>text(value,64)&&Boolean(value)&&value===value.trim()
const body=(value:unknown):value is string=>text(value,8000)&&Boolean(value.trim())
const quote=(value:unknown):value is string=>text(value,20_000)
const offset=(value:unknown):value is number=>Number.isSafeInteger(value)&&Number(value)>=0
const timestamp=(value:unknown):value is string=>typeof value==='string'&&Number.isFinite(Date.parse(value))
const states=['open','resolved','trashed'],reasons=['mapping_unavailable','passage_changed','crosses_scene_split','source_unavailable']
const validKind=(value:Record<string,unknown>)=>!Object.prototype.hasOwnProperty.call(value,'kind')||value.kind==='bookmark'
const samePoint=(a:unknown,b:unknown)=>isRecord(a)&&isRecord(b)&&a.nodeId===b.nodeId&&a.offset===b.offset
function nature(value:Record<string,unknown>){
    if(!validKind(value))return false
    if(value.kind==='bookmark')return text(value.body,255)&&value.state!=='resolved'
    return ['origin','lastAnchor','anchor'].every((key)=>value[key]===null||isRecord(value[key])&&typeof value[key].quote==='string'&&Boolean(value[key].quote.trim()))
}
export function verifyAnnotationCopyPreview(value:unknown,storyId:string,kind:'note'|'bookmark'='note'):value is StoryAnnotationCopyPreview {
    if(!isRecord(value)||Object.keys(value).length!==(kind==='bookmark'?4:3)||!validKind(value)||(value.kind??'note')!==kind||value.storyId!==storyId||!isNovelRevision(value.annotationRevision)||!Array.isArray(value.scenes)||value.scenes.length>20_000)return false
    const seen=new Set<string>()
    return value.scenes.every((row)=>{
        if(!isRecord(row)||Object.keys(row).length!==4||!id(row.sceneId)||seen.has(row.sceneId)||!['open','resolved','trashed'].every((key)=>offset(row[key]))||kind==='bookmark'&&row.resolved!==0)return false
        seen.add(row.sceneId);return true
    })
}
function point(value:unknown){return isRecord(value)&&Object.keys(value).length===2&&id(value.nodeId)&&offset(value.offset)}
export function isAnnotationAnchor(value:unknown):value is StoryAnnotationAnchor {
    return isRecord(value)&&Object.keys(value).length===7&&value.schemaVersion===1&&id(value.sceneId)&&isNovelRevision(value.revision)&&isSnapshotHash(value.contentHash)&&point(value.start)&&point(value.end)&&quote(value.quote)&&((value.quote==='')===samePoint(value.start,value.end))
}
export function isAnnotationSelection(value:unknown):value is StoryAnnotationSelection {
    return isRecord(value)&&Object.keys(value).length===6&&id(value.sceneId)&&isNovelRevision(value.expectedRevision)&&isSnapshotHash(value.expectedContentHash)&&offset(value.startOffset)&&offset(value.endOffset)&&value.endOffset>=value.startOffset&&quote(value.quote)&&((value.quote==='')===(value.startOffset===value.endOffset))
}
export function isAnnotationWrite(value:unknown):value is StoryAnnotationWrite {
    if(!isRecord(value)||Object.keys(value).length!==2||!isNovelRequestId(value.requestId)||!isRecord(value.operation))return false
    const op=value.operation
    if(!id(op.id)||!validKind(op))return false
    if(op.op==='create')return fields(op,['op','id','body','anchor','kind'])&&validKind(op)&&Object.keys(op).length===(op.kind==='bookmark'?5:4)&&body(op.body)&&isAnnotationSelection(op.anchor)&&(op.kind==='bookmark'?text(op.body,255):Boolean(op.anchor.quote.trim()))
    if(!isNovelRevision(op.expectedRevision))return false
    const extra=op.kind==='bookmark'?1:0
    if(op.op==='edit')return fields(op,['op','id','expectedRevision','body','kind'])&&Object.keys(op).length===4+extra&&body(op.body)&&(op.kind!=='bookmark'||text(op.body,255))
    if(op.op==='set_state')return fields(op,['op','id','expectedRevision','state','kind'])&&Object.keys(op).length===4+extra&&states.includes(String(op.state))&&(op.kind!=='bookmark'||op.state!=='resolved')
    return op.op==='reanchor'&&fields(op,['op','id','expectedRevision','expectedAnchorVersion','anchor','kind'])&&Object.keys(op).length===5+extra&&isNovelRevision(op.expectedAnchorVersion)&&isAnnotationSelection(op.anchor)&&(op.kind==='bookmark'||Boolean(op.anchor.quote.trim()))
}
function anchorState(value:Record<string,unknown>){
    return value.anchorState==='attached'?value.orphanReason===null:value.anchorState==='orphaned'&&reasons.includes(String(value.orphanReason))
}
function provenance(value:unknown){
    if(!isRecord(value))return false
    if(value.kind==='manual')return Object.keys(value).length===1
    return value.kind==='copy'&&fields(value,['kind','sourceStoryId','sourceId','sourceSceneId','sourceRevision','sourceAnchorVersion'])&&Object.keys(value).length===6
        &&id(value.sourceStoryId)&&id(value.sourceId)&&id(value.sourceSceneId)&&isNovelRevision(value.sourceRevision)&&isNovelRevision(value.sourceAnchorVersion)
}
export function verifyAnnotationCore(value:unknown,storyId:string,annotationId:string):value is StoryFrozenAnnotation {
    if(!isRecord(value)||!nature(value)||value.id!==annotationId||value.storyId!==storyId||!id(value.sceneId)||!isNovelRevision(value.revision)||!isNovelRevision(value.anchorVersion)||!body(value.body)||!states.includes(String(value.state))
        ||!isAnnotationAnchor(value.origin)||!isAnnotationAnchor(value.lastAnchor)||!anchorState(value)||!provenance(value.source)||!isNovelRevision(value.createdRevision)||!timestamp(value.createdAt))return false
    return value.anchorState==='orphaned'?value.anchor===null:isAnnotationAnchor(value.anchor)&&value.anchor.sceneId===value.sceneId&&canonicalJson(value.anchor)===canonicalJson(value.lastAnchor)
}
export function verifyAnnotation(value:unknown,storyId:string,annotationId:string):value is StoryAnnotation {
    if(!isRecord(value)||!nature(value)||!fields(value,['kind','id','storyId','sceneId','revision','anchorVersion','body','state','origin','anchor','lastAnchor','anchorState','orphanReason','source','createdRevision','createdAt','updatedAt','head'])
        ||value.id!==annotationId||value.storyId!==storyId||!id(value.sceneId)||!isNovelRevision(value.revision)||!isNovelRevision(value.anchorVersion)||!body(value.body)||!states.includes(String(value.state))
        ||!isAnnotationAnchor(value.origin)||!isAnnotationAnchor(value.lastAnchor)||!anchorState(value)||!provenance(value.source)||!isNovelRevision(value.createdRevision)||!timestamp(value.createdAt)||!timestamp(value.updatedAt)||!verifySceneRevisionHead(value.head,value.sceneId))return false
    return value.anchorState==='orphaned'?value.anchor===null:isAnnotationAnchor(value.anchor)&&value.anchor.sceneId===value.sceneId&&value.anchor.revision===value.head.revision&&value.anchor.contentHash===value.head.contentHash&&canonicalJson(value.anchor)===canonicalJson(value.lastAnchor)
}
export const compareAnnotationIds=(a:string,b:string)=>{
    const first=new TextEncoder().encode(a),second=new TextEncoder().encode(b)
    for(let index=0;index<Math.min(first.length,second.length);index++)if(first[index]!==second[index])return first[index]-second[index]
    return first.length-second.length
}
export function verifyAnnotationPage(value:unknown,storyId:string,query:StoryAnnotationQuery={}):value is StoryAnnotationPage {
    if(!isRecord(value)||value.storyId!==storyId||!isNovelRevision(value.annotationRevision)||!Array.isArray(value.items)||value.items.length>50||value.nextBefore!==null&&typeof value.nextBefore!=='string')return false
    let ceiling=value.annotationRevision+1,lastId=''
    if(query.before){const colon=query.before.indexOf(':');ceiling=Number(query.before.slice(0,colon));lastId=query.before.slice(colon+1);if(!isNovelRevision(ceiling)||!id(lastId))return false}
    for(const row of value.items){
        if(!isRecord(row)||!validKind(row)||(row.kind??'note')!==(query.kind??'note')||row.kind==='bookmark'&&row.state==='resolved'||!fields(row,['kind','id','sceneId','sceneTitle','revision','anchorVersion','state','anchorState','orphanReason','bodyPreview','quotePreview','createdRevision','createdAt','updatedAt','readOnly'])
            ||!id(row.id)||!id(row.sceneId)||!text(row.sceneTitle,255)||!row.sceneTitle.trim()||!isNovelRevision(row.revision)||!isNovelRevision(row.anchorVersion)||!states.includes(String(row.state))||!anchorState(row)
            ||!text(row.bodyPreview,160)||!text(row.quotePreview,160)||!isNovelRevision(row.createdRevision)||row.createdRevision>value.annotationRevision||!timestamp(row.createdAt)||!timestamp(row.updatedAt)||typeof row.readOnly!=='boolean'
            ||row.createdRevision>ceiling||row.createdRevision===ceiling&&(!lastId||compareAnnotationIds(row.id,lastId)>=0)
            ||query.sceneId&&row.sceneId!==query.sceneId||query.state&&row.state!==query.state||query.anchorState&&row.anchorState!==query.anchorState)return false
        ceiling=row.createdRevision;lastId=row.id
    }
    return value.nextBefore===null||value.items.length===50&&value.nextBefore===ceiling+':'+lastId
}
export function verifyAnnotationAck(value:unknown,storyId:string,write:StoryAnnotationWrite):value is StoryAnnotationAcknowledgement {
    if(!isRecord(value)||Object.keys(value).length!==8||value.kind!=='annotation'||value.storyId!==storyId||value.requestId!==write.requestId||value.annotationId!==write.operation.id
        ||!isNovelRevision(value.annotationRevision)||value.annotationRevision<2||!isNovelRevision(value.revision)||!isNovelRevision(value.anchorVersion)||!isAnnotationWrite({requestId:value.requestId,operation:value.operation})||canonicalJson(value.operation)!==canonicalJson(write.operation))return false
    const op=write.operation
    return op.op==='create'?value.revision===1&&value.anchorVersion===1:op.op==='reanchor'?value.revision===op.expectedRevision&&value.anchorVersion===op.expectedAnchorVersion+1:value.revision===op.expectedRevision+1
}
