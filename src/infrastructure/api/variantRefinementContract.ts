import { isRecord } from '@/shared/novelMutationJournal'
import type { NovelRefinementSource,NovelRefinementReference } from '@/shared/types/storyAssistant.types'
import { canonicalJson } from '@/utils/json'
import { refinementReference,verifyNovelRefinement } from './novelRefinementContract'
import { storyVariantReference,verifyStoryVariantSnapshot } from './storyVariantContract'

/** Authored input cannot silently fall back to its original model result. */
export function verifyNovelRefinementSource(v:unknown,storyId:string,sceneId?:string):v is NovelRefinementSource {
    if(!isRecord(v)||!('variant'in v))return verifyNovelRefinement(v,storyId,sceneId)
    if(Object.keys(v).length!==4||!verifyStoryVariantSnapshot(v.variant,storyId))return false
    const {variant,...base}=v
    return verifyNovelRefinement(base,storyId,sceneId)&&canonicalJson(base)===canonicalJson(variant.parent)
}

export function refinementSourceReference(v:NovelRefinementSource):NovelRefinementReference {
    return {...refinementReference(v),...('variant'in v?{variant:storyVariantReference(v.variant)}:{})}
}
