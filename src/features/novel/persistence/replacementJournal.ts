import type { StoryReplacementAck,StoryReplacementMatch,StoryReplacementPreview,StoryReplacementWrite } from '@/shared/types/storyReplacement.types'
import { isRecord,isNovelRevision,listNovelMutations,type NovelJournalRecord } from '@/shared/novelMutationJournal'
import { isReplacementWrite,verifyReplacementAck } from '@/infrastructure/api/storyReplacementContract'
import { canonicalJson } from '@/utils/json'

export interface ReplacementIntent {
    storyId:string;write:StoryReplacementWrite
    heads:Array<{sceneId:string;revision:number;contentHash:string;targetHash:string;changed:number}>
    matches:StoryReplacementMatch[];ack?:StoryReplacementAck
}
const id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9._:-]{1,64}$/.test(v)
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
export function replacementIntent(review:StoryReplacementPreview,requestId:string):ReplacementIntent {
    return {storyId:review.storyId,write:{requestId,previewHash:review.previewHash,operation:review.operation},
        heads:review.scenes.filter((item)=>item.changed>0).map(({sceneId,revision,contentHash,targetHash,changed})=>({sceneId,revision,contentHash,targetHash,changed})),
        matches:review.operation.op==='replace'?review.changes.filter((item)=>item.reason===null).map(({sceneId,position,startOffset,endOffset,quote})=>({sceneId,position,startOffset,endOffset,quote})):[]}
}
export function matchesReplacementIntent(value:ReplacementIntent,ack:unknown):ack is StoryReplacementAck {
    return verifyReplacementAck(ack,value.storyId,value.write)&&ack.scenes.length===value.heads.length&&ack.scenes.every((scene)=>{
        const head=value.heads.find((item)=>item.sceneId===scene.sceneId)
        return head&&scene.fromRevision===head.revision&&scene.fromHash===head.contentHash&&scene.revision===head.revision+1&&scene.contentHash===head.targetHash&&scene.changed===head.changed
    })&&canonicalJson(ack.matches)===canonicalJson(value.matches)
}
export function isReplacementIntent(v:unknown):v is ReplacementIntent {
    if(!isRecord(v)||Object.keys(v).some((key)=>!['storyId','write','heads','matches','ack'].includes(key))||!id(v.storyId)||!isReplacementWrite(v.write)
        ||!Array.isArray(v.heads)||!v.heads.length||v.heads.length>100||!v.heads.every((head)=>isRecord(head)&&Object.keys(head).length===5&&id(head.sceneId)&&isNovelRevision(head.revision)&&hash(head.contentHash)&&hash(head.targetHash)&&Number.isInteger(head.changed)&&Number(head.changed)>0&&Number(head.changed)<=100)
        ||new Set(v.heads.map((item)=>item.sceneId)).size!==v.heads.length||!Array.isArray(v.matches)||v.matches.length>100)return false
    // Reuse the complete receipt guard to validate original match identities,
    // exact Unicode spans, counts, and selected targets without a fake document.
    const candidate=v as unknown as ReplacementIntent
    const synthetic={kind:'manuscript_replace',algorithm:'canonical-inline-literal-v1',storyId:candidate.storyId,write:candidate.write,
        originRequestId:candidate.write.operation.op==='replace'?candidate.write.requestId:candidate.write.operation.originRequestId,
        matches:candidate.matches,scenes:candidate.heads.map((head)=>({sceneId:head.sceneId,fromRevision:head.revision,fromHash:head.contentHash,revision:head.revision+1,contentHash:head.targetHash,changed:head.changed}))}
    return matchesReplacementIntent(candidate,synthetic)&&(v.ack===undefined||matchesReplacementIntent(candidate,v.ack))
}
export const listReplacementJournals=(scope:{userHash:string|null|undefined;workspaceId:string|null|undefined}):NovelJournalRecord<ReplacementIntent>[]=>
    listNovelMutations('manuscript-replace',scope,isReplacementIntent,(value)=>({storyId:value.storyId,target:value.write.requestId}))
