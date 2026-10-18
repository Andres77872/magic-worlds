import { isNovelRequestId,isNovelRevision,isRecord,listNovelMutations,novelMutationKey,readNovelMutation,type NovelJournalRecord,type NovelJournalScope } from './novelMutationJournal'

export type StoryLifecycleAction='archive'|'trash'|'restore'
export interface StoryLifecycleWrite {requestId:string;expectedMetadataRevision:number;action:StoryLifecycleAction}
export interface StoryLifecycleIntent {storyId:string;title:string;write:StoryLifecycleWrite}
export interface PendingStoryLifecycle extends StoryLifecycleIntent {storageFailed:boolean}
export type StoryLifecycleRecord=NovelJournalRecord<StoryLifecycleIntent>
export function isStoryLifecycleIntent(value:unknown):value is StoryLifecycleIntent {
    return isRecord(value)&&typeof value.storyId==='string'&&value.storyId.length>0&&value.storyId.length<=64&&typeof value.title==='string'&&value.title.length<=255
        &&isRecord(value.write)&&isNovelRequestId(value.write.requestId)&&isNovelRevision(value.write.expectedMetadataRevision)&&['archive','trash','restore'].includes(String(value.write.action))
        &&Object.keys(value.write).every((key)=>['requestId','expectedMetadataRevision','action'].includes(key))
}
export const lifecycleJournalKey=(scope:NovelJournalScope,writer?:string):string|null=>novelMutationKey('lifecycle',scope,undefined,writer)
export const readLifecycleJournal=(key:string|null):StoryLifecycleRecord|null=>readNovelMutation(key,isStoryLifecycleIntent)
export const listLifecycleJournals=(scope:Omit<NovelJournalScope,'storyId'>):StoryLifecycleRecord[]=>listNovelMutations('lifecycle',scope,isStoryLifecycleIntent,(value)=>({storyId:value.storyId}))
