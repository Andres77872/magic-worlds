import type { StoryCreateWrite,StoryCreationAcknowledgement } from '@/shared'
import { isStoryCreateWrite,verifyStoryCreationAcknowledgement } from '@/infrastructure/api/storyCreationContract'
import { isRecord,isNovelRequestId,listNovelMutations,novelMutationKey,type NovelJournalRecord } from '@/shared/novelMutationJournal'

export interface NovelCreationIntent { write:StoryCreateWrite;ack?:StoryCreationAcknowledgement;rejected?:'review_required';replacesRequestId?:string }
export type PendingNovelCreation=NovelJournalRecord<NovelCreationIntent>&{storageFailed?:boolean}
export const creationJournalKey=(scope:{userHash:string|null|undefined;workspaceId:string|null|undefined},requestId:string)=>
    novelMutationKey('creation',{...scope,storyId:'creation-request'},requestId)
export function isNovelCreationIntent(value:unknown):value is NovelCreationIntent {
    return isRecord(value)&&Object.keys(value).every((key)=>['write','ack','rejected','replacesRequestId'].includes(key))&&isStoryCreateWrite(value.write)
        &&(value.rejected===undefined||value.rejected==='review_required'&&value.ack===undefined)
        &&(value.replacesRequestId===undefined||isNovelRequestId(value.replacesRequestId)&&value.replacesRequestId!==value.write.requestId)
        &&(value.ack===undefined||verifyStoryCreationAcknowledgement(value.ack,value.write))
}
export const listCreationJournals=(scope:{userHash:string|null|undefined;workspaceId:string|null|undefined}):PendingNovelCreation[]=>
    listNovelMutations('creation',scope,isNovelCreationIntent,(value)=>({storyId:'creation-request',target:value.write.requestId}))
