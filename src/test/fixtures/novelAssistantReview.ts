import wire from './novelAssistantTurn.json'
import type { NovelAssistantRecord } from '@/shared/types/storyAssistant.types'
import type { StoryStudioIndex, StoryGenerationDetail } from '@/shared/types/storyStudio.types'
import { verifyNovelAssistantRecord } from '@/infrastructure/api/novelAssistantContract'
import { manuscript, storyGeneration, storyScene } from './story'

/** Fictional Python-compiled evidence adapted to its saved candidate read. */
export function novelAssistantReviewFixture() {
    const record = structuredClone(wire.records.suggest) as unknown as NovelAssistantRecord
    const index = structuredClone(wire.index) as unknown as StoryStudioIndex
    if (!verifyNovelAssistantRecord(record, index.id) || !record.result.proposal) throw new Error('Invalid fictional suggestion')
    const proposal = record.result.proposal, source = record.context.packet.sources[0], passage = source.passages[0]
    const inputRange = proposal.operation === 'append_scene' ? null : proposal.operation === 'replace_selection'
        ? { startOffset: proposal.selection!.startOffset, endOffset: proposal.selection!.endOffset, text: proposal.selection!.quote }
        : { startOffset: 0, endOffset: passage?.endOffset ?? 0, text: passage?.quote ?? '' }
    const generation = storyGeneration({ id: proposal.id, storyId: proposal.storyId, sceneId: proposal.sceneId,
        chapterId: proposal.chapterId, baseRevision: proposal.baseRevision, command: proposal.operation === 'append_scene' ? 'continue' : 'rewrite',
        inputRange, output: proposal.markdown, instruction: proposal.instruction })
    const detail: StoryGenerationDetail = { schemaVersion: 1, storyId: index.id, generation, chapterTitle: source.chapterTitle, sceneTitle: source.title, location: 'active' }
    const head = index.chapters.flatMap(chapter => chapter.scenes).find(scene => scene.id === proposal.sceneId)!
    const scene = storyScene({ ...head, document: manuscript(passage?.quote ?? '', passage?.anchor?.start.nodeId ?? 'fictional-source-block') })
    return { record, index, detail, scene }
}
