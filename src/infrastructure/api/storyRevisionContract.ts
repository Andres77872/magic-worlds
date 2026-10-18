import type { StoryDocumentRevision,StoryDocumentRevisionSummary,StorySceneRevisionHead,StorySceneRevisionPage,StorySceneRevisionQuery,StorySceneRestoreWrite,StorySceneRestoreAcknowledgement } from '@/shared'
import { isRecord,isNovelRequestId,isNovelRevision } from '@/shared/novelMutationJournal'
import { isSnapshotHash } from '@/shared/storySnapshotOperation'
import { isStoryDocument,documentText,documentMarkdown } from '@/shared/storyDocument'
import { canonicalJson } from '@/utils/json'

export const STORY_REVISION_SOURCES=['initial','manual','ai','restore','split','merge','branch','structure'] as const
const id=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=64&&value===value.trim()
const nullableId=(value:unknown)=>value===null||id(value)
const timestamp=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value))
function summary(value:unknown):value is StoryDocumentRevisionSummary {
    return isRecord(value)&&isNovelRevision(value.revision)&&(value.parentRevision===null||isNovelRevision(value.parentRevision)&&value.parentRevision<value.revision)
        &&isSnapshotHash(value.contentHash)&&STORY_REVISION_SOURCES.includes(value.source as typeof STORY_REVISION_SOURCES[number])
        &&['author','system'].includes(String(value.actor))&&(value.schemaVersion===null||isNovelRevision(value.schemaVersion))
        &&nullableId(value.generationId)&&(value.restoredFrom===null||isNovelRevision(value.restoredFrom)&&value.restoredFrom<value.revision)&&timestamp(value.createdAt)
        &&(!('variantId'in value)||id(value.variantId)&&id(value.generationId)&&value.variantId!==value.generationId&&value.source==='ai')
}
export function verifySceneRevisionHead(value:unknown,sceneId:string):value is StorySceneRevisionHead {
    return isRecord(value)&&value.sceneId===sceneId&&id(value.chapterId)&&typeof value.title==='string'&&Boolean(value.title.trim())&&Array.from(value.title).length<=255
        &&isNovelRevision(value.revision)&&isNovelRevision(value.metadataRevision)&&isSnapshotHash(value.contentHash)&&typeof value.readOnly==='boolean'
}
export function verifySceneRevisionPage(value:unknown,storyId:string,sceneId:string,query:StorySceneRevisionQuery={}):value is StorySceneRevisionPage {
    if(!isRecord(value)||value.storyId!==storyId||value.sceneId!==sceneId||!isRecord(value.head)||!Array.isArray(value.items)||value.items.length>50
        ||value.nextBefore!==null&&!isNovelRevision(value.nextBefore))return false
    const head=value.head
    if(!verifySceneRevisionHead(head,sceneId))return false
    let ceiling=Math.min(query.before??Number.MAX_SAFE_INTEGER,head.revision+1)
    for(const row of value.items){
        if(!summary(row)||row.revision>=ceiling||['document','body','plainText'].some((key)=>key in row)
            ||query.source&&row.source!==query.source||query.actor&&row.actor!==query.actor
            ||query.fromDate&&row.createdAt.slice(0,10)<query.fromDate||query.throughDate&&row.createdAt.slice(0,10)>query.throughDate)return false
        ceiling=row.revision
    }
    return value.nextBefore===null||value.items.length===50&&value.nextBefore===value.items[49].revision
}
export function verifySceneRevision(value:unknown,storyId:string,sceneId:string,revision:number,expectedHash?:string):value is StoryDocumentRevision {
    return summary(value)&&isRecord(value)&&value.storyId===storyId&&value.sceneId===sceneId&&value.revision===revision&&value.schemaVersion===1
        &&(expectedHash===undefined||value.contentHash===expectedHash)&&isStoryDocument(value.document)
        &&value.body===documentMarkdown(value.document)&&value.plainText===documentText(value.document)
}
export function isSceneRestoreWrite(value:unknown):value is StorySceneRestoreWrite {
    return isRecord(value)&&Object.keys(value).length===4&&isNovelRequestId(value.requestId)&&isNovelRevision(value.expectedRevision)&&isSnapshotHash(value.expectedContentHash)&&isSnapshotHash(value.sourceContentHash)
}
export function verifySceneRestoreAck(value:unknown,storyId:string,sceneId:string,revision:number,write:StorySceneRestoreWrite):value is StorySceneRestoreAcknowledgement {
    return isRecord(value)&&Object.keys(value).length===7&&value.kind==='scene_restore'&&value.storyId===storyId&&value.sceneId===sceneId
        &&value.sourceRevision===revision&&value.revision===write.expectedRevision+1&&value.contentHash===write.sourceContentHash
        &&isSceneRestoreWrite(value.write)&&canonicalJson(value.write)===canonicalJson(write)
}
