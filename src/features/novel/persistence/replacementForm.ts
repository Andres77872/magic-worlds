import { isNovelRequestId,isRecord,listNovelMutations } from '@/shared/novelMutationJournal'

export interface ReplacementForm {q:string;replacement:string;scope:string;status:string;caseSensitive:boolean;includeArchived:boolean}
export const emptyReplacementForm:ReplacementForm={q:'',replacement:'',scope:'novel',status:'',caseSensitive:false,includeArchived:false}
/** Keep unfinished input, including invalid queries; validation belongs to review. */
export function isReplacementForm(v:unknown):v is ReplacementForm {
    return isRecord(v)&&Object.keys(v).length===6&&typeof v.q==='string'&&v.q.length<=510&&typeof v.replacement==='string'&&v.replacement.length<=4000
        &&typeof v.scope==='string'&&/^(novel|(?:part|chapter|scene):[A-Za-z0-9._:-]{1,64})$/.test(v.scope)
        &&['','draft','revising','complete','archived'].includes(String(v.status))&&typeof v.caseSensitive==='boolean'&&typeof v.includeArchived==='boolean'
}
export interface ReplacementHistoryEntry {originRequestId:string;q:string;replacement:string;confirmedAt:number}
export interface ReplacementHistory {storyId:string;items:ReplacementHistoryEntry[]}
export function isReplacementHistory(v:unknown):v is ReplacementHistory {
    return isRecord(v)&&Object.keys(v).length===2&&typeof v.storyId==='string'&&/^[A-Za-z0-9._:-]{1,64}$/.test(v.storyId)&&Array.isArray(v.items)&&v.items.length<=20&&v.items.every((item)=>
        isRecord(item)&&Object.keys(item).length===4&&isNovelRequestId(item.originRequestId)&&typeof item.q==='string'&&item.q.length<=510&&typeof item.replacement==='string'&&item.replacement.length<=4000&&typeof item.confirmedAt==='number'&&Number.isFinite(item.confirmedAt))
        &&new Set(v.items.map((item)=>item.originRequestId)).size===v.items.length
}
export function listReplacementHistory(scope:{userHash:string|null|undefined;workspaceId:string|null|undefined},storyId:string):ReplacementHistoryEntry[] {
    const entries=listNovelMutations('manuscript-replace-history',scope,isReplacementHistory,(value)=>({storyId:value.storyId,target:'recent'}))
        .filter((record)=>record.write.storyId===storyId).flatMap((record)=>record.write.items).sort((a,b)=>b.confirmedAt-a.confirmedAt)
    const seen=new Set<string>()
    return entries.filter((item)=>{if(seen.has(item.originRequestId))return false;seen.add(item.originRequestId);return true}).slice(0,20)
}
