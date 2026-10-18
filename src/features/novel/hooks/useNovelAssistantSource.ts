import { useMemo } from 'react'
import { ApiError } from '@/infrastructure/api'
import type { LlmSelection } from '@/shared/types/llm.types'
import type { NovelAssistantRecord, NovelPresetSnapshot, NovelRefinementSource, NovelRefinementReference, StoryAssistantContextOptions } from '@/shared/types/storyAssistant.types'
import { presetReference } from '@/infrastructure/api/storyAssistantPresetContract'
import { refinementSourceReference,verifyNovelRefinementSource } from '@/infrastructure/api/variantRefinementContract'
import { isNovelRefinementReference } from '@/infrastructure/api/novelRefinementContract'
import { verifyStoryVariantRecord } from '@/infrastructure/api/storyVariantContract'
import { verifyNovelAssistantRecord } from '@/infrastructure/api/novelAssistantContract'
import { canonicalJson } from '@/utils/json'
import type { AssistantContextSource } from './useAssistantContextSource'
import type { StoryWorkspace } from './useStoryWorkspace'
import {readGenerationRefinement,readVariantRefinement} from './novelRefinementTarget'
import type {StoryVariantRecord} from '@/shared/types/storyVariant.types'
import type {StoryGeneration,StoryAnnotationSelection,StoryGenerationChangeset,StoryGenerationChangesetWrite} from '@/shared'

/** Full profile/history preview remains credential-free and reads only saved sources. */
export function useNovelAssistantSource(source: AssistantContextSource | null, workspace: StoryWorkspace) {
    return useMemo(() => {
        if (!source) return null
        const client = () => {
            const api = source.isCurrent() && workspace.isCurrent() ? workspace.detachedApi() : null
            if (!api) throw new Error('Novel assistant scope changed')
            return api
        }
        return {
            ...source,
            async preview(conversationId: number, options: StoryAssistantContextOptions, selection: LlmSelection, signal: AbortSignal, refinement:NovelRefinementSource|null=null, preset:NovelPresetSnapshot|null=null) {
                const context = await source.prepare(structuredClone(options), signal)
                const api = client()
                const index = await api.getStoryStudioIndex(source.storyId, { signal })
                signal.throwIfAborted()
                if (!source.isCurrent() || index.sourceVersion !== context.sourceVersion) throw new ApiError(409, 'Saved sources changed. Review again.', { code: 'STORY_ASSISTANT_SOURCE_CHANGED', retryable: false })
                const result = await api.previewNovelAssistantTurn(conversationId, index, { message: context.request.message, source: context.request, expected_packet_hash: context.packetHash,
                    ...(refinement?{refinement:refinementSourceReference(refinement)}:{}),...(preset?{preset:presetReference(preset)}:{}) }, { llm: { selection: structuredClone(selection) }, signal })
                if(canonicalJson(result.refinement??null)!==canonicalJson(refinement))throw new ApiError(409,'The retained proposal changed. Review again.',{code:'NOVEL_REFINEMENT_PARENT_CHANGED',retryable:false})
                if(canonicalJson(result.preset??null)!==canonicalJson(preset))throw new ApiError(409,'The prompt preset changed. Review again.',{code:'STORY_ASSISTANT_PRESET_CHANGED',retryable:false})
                signal.throwIfAborted()
                if (!source.isCurrent()) throw new Error('Novel assistant scope changed')
                return result
            },
            getTurn: (conversationId: number, requestId: string, signal?: AbortSignal) => client().getAssistantTurn('novel', conversationId, requestId, { signal }),
            turnState: (conversationId: number, requestId: string, signal?: AbortSignal) => client().getNovelAssistantTurnState(source.storyId, conversationId, requestId, { signal }),
            stopTurn: (conversationId: number, requestId: string, signal?: AbortSignal) => client().stopNovelAssistantTurn(source.storyId, conversationId, requestId, { signal }),
            generation: (id: string, signal?: AbortSignal) => client().getStoryGenerationHistoryDetail(source.storyId, id, { signal }),
            refinement: (id:string,signal?:AbortSignal)=>client().getStoryRefinementParent(source.storyId,id,{signal}),
            refinementForGeneration:(generation:StoryGeneration,signal:AbortSignal,selection:StoryAnnotationSelection|null=null)=>readGenerationRefinement(
                {api:client(),storyId:source.storyId,isCurrent:()=>source.isCurrent()&&workspace.isCurrent()},structuredClone(generation),signal,selection),
            refinementForVariant:(record:StoryVariantRecord,signal:AbortSignal)=>readVariantRefinement(
                {api:client(),storyId:source.storyId,isCurrent:()=>source.isCurrent()&&workspace.isCurrent()},structuredClone(record),signal),
            async readRefinementSource(input:NovelRefinementReference,signal:AbortSignal):Promise<NovelRefinementSource> {
                const reference=structuredClone(input),api=client()
                const changed=()=>new ApiError(409,'The saved refinement source could not be verified.',{code:'NOVEL_REFINEMENT_PARENT_CHANGED',retryable:false})
                if(!isNovelRefinementReference(reference))throw changed()
                const parent=await api.getStoryRefinementParent(source.storyId,reference.generationId,{signal})
                signal.throwIfAborted();client()
                let value:NovelRefinementSource=parent
                if(reference.variant){
                    const record=await api.getStoryVariant(source.storyId,reference.variant.id,{signal})
                    signal.throwIfAborted();client()
                    if(!verifyStoryVariantRecord(record,source.storyId,reference.variant))throw changed()
                    value={...parent,variant:record.variant}
                }
                if(!verifyNovelRefinementSource(value,source.storyId)||canonicalJson(refinementSourceReference(value))!==canonicalJson(reference))throw changed()
                return structuredClone(value)
            },
            stash: (id: string) => client().stashStoryGeneration(source.storyId, id),
            sceneDocument: (sceneId: string) => client().getStorySceneDocument(source.storyId, sceneId),
            // Several reviewed suggestions accepted as one manuscript changeset, its recovery and its undo (R14).
            acceptTogether: (write: StoryGenerationChangesetWrite) => client().acceptStoryGenerationsTogether(source.storyId, write),
            recoverTogether: (write: StoryGenerationChangesetWrite) => client().getStoryGenerationChangeset(source.storyId, write),
            undoTogether: (changeset: StoryGenerationChangeset, requestId: string) => client().undoStoryGenerationChangeset(changeset, requestId),
            async reviewCandidate(record: NovelAssistantRecord, signal: AbortSignal) {
                const frozen = structuredClone(record), api = client()
                const changed = () => new ApiError(409, 'The saved sources changed.', { code: 'STORY_ASSISTANT_SOURCE_CHANGED', retryable: false })
                const candidateChanged=()=>new ApiError(409,'The saved suggestion changed.',{code:'STORY_PROPOSAL_CONFLICT',retryable:false})
                if (!verifyNovelAssistantRecord(frozen, source.storyId) || !frozen.result.proposal) throw candidateChanged()
                const proposal = frozen.result.proposal
                const [index, detail] = await Promise.all([api.getStoryStudioIndex(source.storyId, { signal }),
                    api.getStoryGenerationHistoryDetail(source.storyId, proposal.id, { signal })])
                signal.throwIfAborted();client()
                const generation = detail.generation
                const head = index.chapters.flatMap(chapter => chapter.scenes).find(scene => scene.id === proposal.sceneId)
                const passage = frozen.context.packet.sources[0].passages[0]
                const inputRange = proposal.operation === 'append_scene' ? null : proposal.operation === 'replace_selection'
                    ? { startOffset: proposal.selection!.startOffset, endOffset: proposal.selection!.endOffset, text: proposal.selection!.quote }
                    : { startOffset: 0, endOffset: passage?.endOffset ?? 0, text: passage?.quote ?? '' }
                if (detail.storyId !== source.storyId || detail.location !== 'active' || !['candidate', 'stashed'].includes(generation.status)
                    || generation.id !== proposal.id || generation.storyId !== source.storyId || generation.sceneId !== proposal.sceneId || generation.chapterId !== proposal.chapterId
                    || generation.baseRevision !== proposal.baseRevision || generation.output !== proposal.markdown || generation.instruction !== proposal.instruction
                    || generation.command !== (proposal.operation === 'append_scene' ? 'continue' : 'rewrite') || canonicalJson(generation.inputRange) !== canonicalJson(inputRange)) throw candidateChanged()
                if (index.sourceVersion !== frozen.context.sourceVersion || index.status === 'archived' || index.trashedAt
                    || !head || head.inheritance?.readOnly || head.trashedAt || head.revision !== proposal.baseRevision || head.contentHash !== proposal.baseContentHash)throw changed()
                return { index, detail }
            },
        }
    }, [source, workspace])
}
export type NovelAssistantSource = NonNullable<ReturnType<typeof useNovelAssistantSource>>
