import type { StoryAnnotationWrite,StoryAnnotationAcknowledgement,StoryAnnotationSelection } from '@/shared'
import { isRecord,isNovelRevision,listNovelMutations,type NovelJournalRecord } from '@/shared/novelMutationJournal'
import { isAnnotationWrite,isAnnotationSelection,verifyAnnotationAck } from '@/infrastructure/api/storyAnnotationContract'
import { canonicalJson } from '@/utils/json'

const id=(value:unknown):value is string=>typeof value==='string'&&Boolean(value)&&value===value.trim()&&Array.from(value).length<=64
export interface AnnotationIntent {storyId:string;kind?:'bookmark';write:StoryAnnotationWrite;ack?:StoryAnnotationAcknowledgement;draft?:NovelJournalRecord<AnnotationDraft>}
export const annotationIntentKind=(value:AnnotationIntent):'note'|'bookmark'=>value.kind==='bookmark'||value.write.operation.kind==='bookmark'||value.draft?.write.kind==='bookmark'?'bookmark':'note'
export const annotationTarget=(value:AnnotationIntent)=>value.write.operation.id+':'+value.write.requestId
export function isAnnotationIntent(value:unknown):value is AnnotationIntent {
    if(!isRecord(value)||!Object.keys(value).every((key)=>['storyId','kind','write','ack','draft'].includes(key))||'kind' in value&&value.kind!=='bookmark'||!id(value.storyId)||!isAnnotationWrite(value.write)
        ||value.ack!==undefined&&!verifyAnnotationAck(value.ack,value.storyId,value.write))return false
    const kind=value.kind??value.write.operation.kind??(isRecord(value.draft)&&isRecord(value.draft.write)?value.draft.write.kind:undefined)
    if(value.write.operation.kind!==kind)return false
    if(value.draft===undefined)return true
    if(!isRecord(value.draft)||value.draft.schema!==1||!isAnnotationDraft(value.draft.write)||value.draft.storageKey!==undefined&&typeof value.draft.storageKey!=='string')return false
    const draft=value.draft.write,op=value.write.operation
    return draft.kind===kind&&draft.storyId===value.storyId&&draft.annotationId===op.id&&(op.op==='create'&&draft.mode==='create'&&draft.body===op.body&&canonicalJson(draft.selection)===canonicalJson(op.anchor)
        ||op.op==='edit'&&draft.mode==='edit'&&draft.body===op.body&&draft.baseRevision===op.expectedRevision)
}
export const listAnnotationJournals=(scope:{userHash:string|null|undefined;workspaceId:string|null|undefined}):NovelJournalRecord<AnnotationIntent>[]=>
    listNovelMutations('annotation',scope,isAnnotationIntent,(value)=>({storyId:value.storyId,target:annotationTarget(value)}))

export interface AnnotationDraft {
    kind?:'bookmark'
    storyId:string;annotationId:string;body:string;sequence:number
    mode:'create'|'edit';selection:StoryAnnotationSelection|null
    baseRevision:number|null;originalBody:string|null
}
export function isAnnotationDraft(value:unknown):value is AnnotationDraft {
    return isRecord(value)&&Object.keys(value).every((key)=>['storyId','kind','annotationId','body','sequence','mode','selection','baseRevision','originalBody'].includes(key))&&(!('kind' in value)||value.kind==='bookmark')
        &&id(value.storyId)&&id(value.annotationId)&&typeof value.body==='string'&&Array.from(value.body).length<=(value.kind==='bookmark'?255:8000)
        &&Number.isSafeInteger(value.sequence)&&Number(value.sequence)>=0
        &&(value.mode==='create'?isAnnotationSelection(value.selection)&&(value.kind==='bookmark'||Boolean(value.selection.quote.trim()))&&value.baseRevision===null&&value.originalBody===null
            :value.mode==='edit'&&value.selection===null&&isNovelRevision(value.baseRevision)&&typeof value.originalBody==='string'&&Array.from(value.originalBody).length<=(value.kind==='bookmark'?255:8000))
}
export const listAnnotationDrafts=(scope:{userHash:string|null|undefined;workspaceId:string|null|undefined})=>
    listNovelMutations('annotation-draft',scope,isAnnotationDraft,(value)=>({storyId:value.storyId,target:value.annotationId}))
