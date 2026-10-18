import type { StoryCodexWrite } from '@/shared'
import { isNovelRequestId,isNovelRevision,isRecord,readNovelMutation,type NovelJournalRecord } from '@/shared/novelMutationJournal'

const id=(value:unknown)=>typeof value==='string'&&value.length>0&&value.length<=64
export function isCodexWrite(value:unknown):value is StoryCodexWrite {
    if(!isRecord(value)||Object.keys(value).length!==3||!isNovelRequestId(value.requestId)||!isNovelRevision(value.expectedContextRevision)||!isRecord(value.operation))return false
    const op=value.operation
    if(op.op==='add')return Object.keys(op).length===2&&Array.isArray(op.refs)&&op.refs.length>0&&op.refs.length<=100&&op.refs.every((ref)=>isRecord(ref)&&id(ref.cardId)&&typeof ref.kind==='string'&&Object.keys(ref).every((key)=>['kind','cardId','source','enabled','precedence','chapterId','sceneId','snapshot'].includes(key)))
    if(op.op==='remove'||op.op==='restore')return Object.keys(op).length===2&&id(op.id)
    if(op.op==='refresh')return Object.keys(op).length===4&&id(op.id)&&id(op.sourceVersionId)&&Array.isArray(op.take)
    // A discovery is replayed as the same request, so a retry after a reload returns the original card or entry.
    if(op.op==='discover')return Object.keys(op).every((key)=>['op','destination','lorebookId','fields'].includes(key))&&['character','world','item','lorebook_entry'].includes(op.destination as string)
        &&isRecord(op.fields)&&typeof op.fields.name==='string'&&typeof op.fields.description==='string'
    return op.op==='update'&&Object.keys(op).length===3&&id(op.id)&&isRecord(op.patch)&&Object.keys(op.patch).length>0&&Object.keys(op.patch).every((key)=>['source','enabled','precedence','chapterId','sceneId','snapshot'].includes(key))
}
export const readCodexJournal=(key:string|null):NovelJournalRecord<StoryCodexWrite>|null=>readNovelMutation(key,isCodexWrite)
