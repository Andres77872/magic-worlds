import type { StoryEraseAcknowledgement,StoryErasePreview,StoryEraseWrite } from '@/shared/types/story.types'
import { isNovelRequestId,isRecord } from '@/shared/novelMutationJournal'

export const storyEraseCountKeys=['parts','chapters','scenes','sceneRevisions','structureRevisions','cardRefs','generations','notes','bookmarks','annotationEvents','requestReceipts','executions','conversations','assistantMessages','variants'] as const
const exact=(v:Record<string,unknown>,keys:readonly string[])=>Object.keys(v).length===keys.length&&keys.every((key)=>Object.prototype.hasOwnProperty.call(v,key))
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
const id=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=64&&v===v.trim()
const title=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=510&&[...v].length<=255
const count=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0
const time=(v:unknown):v is string=>typeof v==='string'&&v.length<=40&&/^\d{4}-\d\d-\d\dT/.test(v)&&Number.isFinite(Date.parse(v))

export function isStoryEraseWrite(v:unknown):v is StoryEraseWrite {
    return isRecord(v)&&exact(v,['requestId','expectedSourceVersion','confirmedTitle'])&&isNovelRequestId(v.requestId)&&hash(v.expectedSourceVersion)&&title(v.confirmedTitle)
}
export function verifyStoryErasePreview(v:unknown,storyId:string):v is StoryErasePreview {
    return isRecord(v)&&exact(v,['schema','kind','storyId','title','sourceVersion','trashedAt','policy','activeExecutions','counts'])
        &&v.schema===1&&v.kind==='novel_erase_preview'&&id(v.storyId)&&v.storyId===storyId&&title(v.title)&&hash(v.sourceVersion)&&time(v.trashedAt)
        &&v.policy==='explicit-novel-erase-v1'&&count(v.activeExecutions)&&isRecord(v.counts)&&exact(v.counts,storyEraseCountKeys)
        &&storyEraseCountKeys.every((key)=>count((v.counts as Record<string,unknown>)[key]))&&v.activeExecutions<=Number(v.counts.executions)+Number(v.counts.conversations)
}
export function verifyStoryEraseAcknowledgement(v:unknown,storyId:string,write:StoryEraseWrite):v is StoryEraseAcknowledgement {
    // Source identity binds the exact reviewed title/descendants. The receipt
    // retains only the original intent digest, rather than echoing an erased title.
    return isRecord(v)&&exact(v,['schema','kind','storyId','requestId','sourceVersion','intentHash','erasedAt'])
        &&v.schema===1&&v.kind==='novel_erase'&&id(v.storyId)&&v.storyId===storyId&&v.requestId===write.requestId
        &&v.sourceVersion===write.expectedSourceVersion&&hash(v.intentHash)&&time(v.erasedAt)
}
