import type { StoryCopyAcknowledgement,StoryCopyWrite } from '@/shared'
import { listNovelMutations,isRecord,type NovelJournalRecord } from '@/shared/novelMutationJournal'
import { isStoryCopyWrite,verifyStoryCopyAcknowledgement } from '@/infrastructure/api/storyCopyContract'

export interface NovelCopyIntent {sourceId:string;sourceTitle:string;write:StoryCopyWrite;ack?:StoryCopyAcknowledgement}
export function isNovelCopyIntent(value:unknown):value is NovelCopyIntent {
    return isRecord(value)&&Object.keys(value).every((key)=>['sourceId','sourceTitle','write','ack'].includes(key))
        &&typeof value.sourceId==='string'&&value.sourceId.length>0&&value.sourceId.length<=64&&value.sourceId===value.sourceId.trim()
        &&typeof value.sourceTitle==='string'&&value.sourceTitle.length>0&&value.sourceTitle.length<=255&&value.sourceTitle===value.sourceTitle.trim()&&isStoryCopyWrite(value.write)
        &&(value.ack===undefined||verifyStoryCopyAcknowledgement(value.ack,value.sourceId,value.write))
}
export const listCopyJournals=(scope:{userHash:string|null|undefined;workspaceId:string|null|undefined}):NovelJournalRecord<NovelCopyIntent>[]=>
    listNovelMutations('copy',scope,isNovelCopyIntent,(value)=>({storyId:value.sourceId,target:value.write.requestId}))
