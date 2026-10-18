import type {StoryAnchorEdit,StoryManuscriptDocument} from '@/shared'
import {isStoryDocument} from '@/shared/storyDocument'
import {isStoryAnchorEdits} from '@/shared/storyAnchorEdits'
import {isNovelRequestId,isNovelRevision,isRecord} from '@/shared/novelMutationJournal'
import type { StoryVariantReference } from '@/shared/types/storyVariant.types'
import { isStoryVariantReference } from '@/infrastructure/api/storyVariantContract'

export const generationApplicationReasons=['sources_changed','writing_changed','candidate_changed','archived','trashed','unavailable','permission','invalid','rejected'] as const
export type GenerationApplicationReason=typeof generationApplicationReasons[number]
/** A definite rejection is separate from an uncertain write and ordinary typing. */
export interface GenerationApplicationRejection {
    reason:GenerationApplicationReason
    generationId:string
    variant?:StoryVariantReference
    write:{requestId:string;expectedRevision:number;document:StoryManuscriptDocument;anchorEdits?:StoryAnchorEdit[]}
}
const exact=(value:Record<string,unknown>,keys:string[])=>Object.keys(value).length===keys.length&&keys.every(key=>key in value)
export function isGenerationApplicationRejection(value:unknown):value is GenerationApplicationRejection {
    if(!isRecord(value)||!exact(value,['reason','generationId','write',...('variant'in value?['variant']:[])])||!generationApplicationReasons.includes(value.reason as GenerationApplicationReason)
        ||typeof value.generationId!=='string'||!/^[A-Za-z0-9._:-]{1,64}$/.test(value.generationId)||!isRecord(value.write))return false
    const w=value.write
    return exact(w,['requestId','expectedRevision','document',...('anchorEdits'in w?['anchorEdits']:[])])
        &&isNovelRequestId(w.requestId)&&isNovelRevision(w.expectedRevision)&&isStoryDocument(w.document)
        &&(!('anchorEdits'in w)||isStoryAnchorEdits(w.anchorEdits))
        &&(!('variant'in value)||isStoryVariantReference(value.variant)&&value.variant.id!==value.generationId
            &&![value.variant.id,value.generationId].includes(w.requestId))
}
export function generationApplicationReason(error:{status:number;code?:string;message?:string}):GenerationApplicationReason {
    const codes:Record<string,GenerationApplicationReason>={STORY_ASSISTANT_SOURCE_CHANGED:'sources_changed',
        STORY_REVISION_CONFLICT:'writing_changed',STORY_METADATA_CONFLICT:'writing_changed',STORY_PROPOSAL_CONFLICT:'candidate_changed',
        STORY_ARCHIVED:'archived',STORY_TARGET_ARCHIVED:'archived',WORKSPACE_ARCHIVED:'archived',STORY_TARGET_TRASHED:'trashed',
        STORY_GENERATION_NOT_FOUND:'unavailable',STORY_VARIANT_NOT_FOUND:'unavailable',
        STORY_VARIANT_BASE_CHANGED:'writing_changed',STORY_VARIANT_TARGET_CHANGED:'writing_changed',
        STORY_VARIANT_PARENT_CHANGED:'candidate_changed',STORY_VARIANT_DECISION_CHANGED:'candidate_changed',STORY_VARIANT_REVIEW_CHANGED:'candidate_changed',
        STORY_VARIANT_DOCUMENT_CHANGED:'candidate_changed',STORY_VARIANT_MAPPING_CHANGED:'candidate_changed',STORY_VARIANT_TARGET_UNAVAILABLE:'unavailable'}
    return codes[error.code??'']??codes[error.message??'']??(error.status===404?'unavailable':error.status===403||error.status===401?'permission':error.status===422?'invalid':'rejected')
}

/** These write_scene errors occur after matching-receipt recovery. Auth,
 * routing and DTO failures cannot prove an earlier uncertain request failed. */
export function confirmedGenerationApplicationRejection(error:{status:number;code?:string;message?:string}):GenerationApplicationReason|null {
    const afterReceipt=new Set(['STORY_ASSISTANT_SOURCE_CHANGED','STORY_REVISION_CONFLICT','STORY_METADATA_CONFLICT',
        'STORY_PROPOSAL_CONFLICT','STORY_ARCHIVED','STORY_TARGET_ARCHIVED','STORY_TARGET_TRASHED','STORY_GENERATION_NOT_FOUND',
        'STORY_VARIANT_NOT_FOUND','STORY_VARIANT_BASE_CHANGED','STORY_VARIANT_TARGET_CHANGED','STORY_VARIANT_PARENT_CHANGED',
        'STORY_VARIANT_DECISION_CHANGED','STORY_VARIANT_REVIEW_CHANGED','STORY_VARIANT_DOCUMENT_CHANGED','STORY_VARIANT_MAPPING_CHANGED','STORY_VARIANT_TARGET_UNAVAILABLE'])
    const code=afterReceipt.has(error.code??'')?error.code:error.message
    return afterReceipt.has(code??'')&&error.status===(code==='STORY_GENERATION_NOT_FOUND'||code==='STORY_VARIANT_NOT_FOUND'?404:409)?generationApplicationReason(error):null
}
