import {ApiError,type ApiService} from '@/infrastructure/api'
import {verifyNovelRefinement} from '@/infrastructure/api/novelRefinementContract'
import {verifyNovelRefinementSource} from '@/infrastructure/api/variantRefinementContract'
import {storyVariantReference,verifyStoryVariantRecord} from '@/infrastructure/api/storyVariantContract'
import {verifySceneRevision} from '@/infrastructure/api/storyRevisionContract'
import {isAnnotationSelection} from '@/infrastructure/api/storyAnnotationContract'
import type {StoryGeneration,StoryAnnotationSelection} from '@/shared'
import type {NovelRefinementSource} from '@/shared/types/storyAssistant.types'
import type {StoryVariantRecord} from '@/shared/types/storyVariant.types'
import {canonicalJson} from '@/utils/json'

export interface NovelGenerationRefinement {refinement:NovelRefinementSource;selection:StoryAnnotationSelection|null}
type Reader=Pick<ApiService,'getStoryRefinementParent'|'getStoryGenerationHistoryDetail'|'getStoryRevision'>

/** Retained writing is reread by ownership; old coordinates bind an immutable
 * checkpoint. A changed quote is never searched for or widened to a scene. */
export async function readGenerationRefinement({api,storyId,isCurrent}:{api:Reader;storyId:string;isCurrent:()=>boolean},
    input:StoryGeneration,signal:AbortSignal,selected:StoryAnnotationSelection|null=null):Promise<NovelGenerationRefinement> {
    const generation=structuredClone(input),currentSelection=structuredClone(selected)
    const changed=()=>new ApiError(409,'The retained writing or target changed.',{code:'NOVEL_REFINEMENT_PARENT_CHANGED',retryable:false})
    const fence=()=>{signal.throwIfAborted();if(!isCurrent())throw new Error('Novel refinement scope changed')}
    fence()
    if(generation.storyId!==storyId||generation.command==='critique'||!['candidate','stashed','accepted','rejected'].includes(generation.status))throw changed()
    const [value,detail]=await Promise.all([api.getStoryRefinementParent(storyId,generation.id,{signal}),
        api.getStoryGenerationHistoryDetail(storyId,generation.id,{signal})])
    fence()
    if(!verifyNovelRefinement(value,storyId,generation.sceneId))throw changed()
    const p=value.parent,g=detail.generation
    if(detail.storyId!==storyId||detail.location!=='active'||!['candidate','stashed','accepted','rejected'].includes(g.status)
        ||g.id!==generation.id||g.storyId!==storyId||g.sceneId!==generation.sceneId||g.chapterId!==generation.chapterId
        ||g.command!==generation.command||g.baseRevision!==generation.baseRevision||g.output!==generation.output
        ||(g.instruction??null)!==(generation.instruction??null)||canonicalJson(g.inputRange)!==canonicalJson(generation.inputRange)
        ||p.id!==g.id||p.chapterId!==g.chapterId||p.baseRevision!==g.baseRevision||p.command!==g.command
        ||p.output!==g.output||p.instruction!==(g.instruction??null)
        ||(p.range===null)!==(g.inputRange===null)||p.range&&g.inputRange&&(p.range.startOffset!==g.inputRange.startOffset||p.range.endOffset!==g.inputRange.endOffset))throw changed()
    let selection:StoryAnnotationSelection|null=null
    if(p.command!=='continue'&&g.inputRange){
        if(currentSelection&&currentSelection.sceneId!==p.sceneId)throw changed()
        if(currentSelection?.sceneId===p.sceneId){
            if(!isAnnotationSelection(currentSelection))throw changed()
            selection=structuredClone(currentSelection)
        }else{
            const base=await api.getStoryRevision(storyId,p.sceneId,p.baseRevision,undefined,{signal})
            fence()
            if(!verifySceneRevision(base,storyId,p.sceneId,p.baseRevision)
                ||base.plainText.slice(g.inputRange.startOffset,g.inputRange.endOffset)!==g.inputRange.text)throw changed()
            selection={sceneId:p.sceneId,expectedRevision:p.baseRevision,expectedContentHash:base.contentHash,
                startOffset:g.inputRange.startOffset,endOffset:g.inputRange.endOffset,quote:g.inputRange.text}
        }
    }
    if(selection&&(!isAnnotationSelection(selection)||selection.quote.length>20_000))throw changed()
    fence()
    return {refinement:structuredClone(value),selection}
}

/** A saved authored version is a whole-scene quotation. Its old selection and
 * application revision never become the new target's coordinates. */
export async function readVariantRefinement({api,storyId,isCurrent}:{api:Reader&Pick<ApiService,'getStoryVariant'>;storyId:string;isCurrent:()=>boolean},
    input:StoryVariantRecord,signal:AbortSignal):Promise<NovelGenerationRefinement> {
    const record=structuredClone(input)
    const changed=()=>new ApiError(409,'The saved authored version or its original source changed.',{code:'NOVEL_REFINEMENT_VARIANT_CHANGED',retryable:false})
    const fence=()=>{signal.throwIfAborted();if(!isCurrent())throw new Error('Novel refinement scope changed')}
    fence()
    if(!verifyStoryVariantRecord(record,storyId))throw changed()
    const original=record.variant.parent.parent
    const [saved,parent,detail]=await Promise.all([
        api.getStoryVariant(storyId,record.variant.id,{signal}),
        api.getStoryRefinementParent(storyId,original.id,{signal}),
        api.getStoryGenerationHistoryDetail(storyId,original.id,{signal}),
    ])
    fence()
    const g=detail.generation
    if(!verifyStoryVariantRecord(saved,storyId,storyVariantReference(record.variant))
        ||canonicalJson(saved.variant)!==canonicalJson(record.variant)||canonicalJson(parent)!==canonicalJson(record.variant.parent)
        ||detail.storyId!==storyId||detail.location!=='active'||!['candidate','stashed','accepted','rejected'].includes(g.status)
        ||g.id!==original.id||g.storyId!==storyId||g.sceneId!==original.sceneId||g.chapterId!==original.chapterId
        ||g.baseRevision!==original.baseRevision||g.command!==original.command||g.output!==original.output||g.instruction!==original.instruction
        ||(g.inputRange===null)!==(original.range===null)||g.inputRange&&original.range
            &&(g.inputRange.startOffset!==original.range.startOffset||g.inputRange.endOffset!==original.range.endOffset))throw changed()
    const refinement={...parent,variant:structuredClone(saved.variant)}
    if(!verifyNovelRefinementSource(refinement,storyId,original.sceneId))throw changed()
    return {refinement,selection:null}
}
