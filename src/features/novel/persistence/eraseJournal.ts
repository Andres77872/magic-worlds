import type { StoryEraseAcknowledgement,StoryEraseWrite } from '@/shared'
import { adoptNovelMutation,isRecord,listNovelMutations,writeNovelMutation,type NovelJournalRecord } from '@/shared/novelMutationJournal'
import { isStoryEraseWrite,verifyStoryEraseAcknowledgement } from '@/infrastructure/api/storyEraseContract'
import { canonicalJson } from '@/utils/json'

export interface NovelEraseIntent {storyId:string;write:StoryEraseWrite;ack?:StoryEraseAcknowledgement}
export function isNovelEraseIntent(value:unknown):value is NovelEraseIntent {
    return isRecord(value)&&Object.keys(value).every((key)=>['storyId','write','ack'].includes(key))
        &&typeof value.storyId==='string'&&value.storyId.length>0&&value.storyId.length<=64&&value.storyId===value.storyId.trim()
        &&isStoryEraseWrite(value.write)&&(value.ack===undefined||verifyStoryEraseAcknowledgement(value.ack,value.storyId,value.write))
}
export const listEraseJournals=(scope:{userHash:string|null|undefined;workspaceId:string|null|undefined})=>
    listNovelMutations('erase',scope,isNovelEraseIntent,(value)=>({storyId:value.storyId,target:value.write.requestId}))

/** A delayed result never replaces newer input at this writer's journal key. */
export function keepEraseJournal(key:string|null,record:NovelJournalRecord<NovelEraseIntent>,next=record.write):boolean {
    if(!key)return false
    try{
        const raw=localStorage.getItem(key)
        if(raw){
            const current=JSON.parse(raw)
            if(current?.schema!==1||![record.write,next].some((value)=>canonicalJson(current.write)===canonicalJson(value)))return false
        }
        if(next===record.write)return adoptNovelMutation(key,record)
        return writeNovelMutation(key,next)
    }catch{return false}
}
