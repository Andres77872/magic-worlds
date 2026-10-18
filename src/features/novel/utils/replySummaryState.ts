import { studioInheritance } from '@/shared/storyStudioState'
import { MAX_CHAPTER_BASIS, partBases, sameBasis, summaryBases } from '@/shared/storySummaryBasis'
import type { NovelAssistantPartSummary, NovelAssistantSceneSummary } from '@/shared/types/storyAssistant.types'
import type { StoryOutline } from '@/shared/types/storyStudio.types'

/** Today's state of a summary a reply proposed, against the saved outline. */
export type ReplySummaryState = 'ready' | 'saved' | 'changed' | 'partial' | 'unavailable'
/** A reply's chapter summary, or its book summary with a null chapter. */
export interface WideRow { chapterId: string | null; basis: string[]; complete: boolean; text: string }

/** Today's state of one proposed summary: the scene must still be at the revision the reply read. */
export function summaryState(story: StoryOutline, row: NovelAssistantSceneSummary): ReplySummaryState {
    const scene = story.chapters.flatMap(chapter => chapter.trashedAt ? [] : chapter.scenes).find(scene => scene.id === row.sceneId && !scene.trashedAt)
    if (!scene || scene.inheritance?.readOnly) return 'unavailable'
    if (scene.revision !== row.revision || scene.contentHash !== row.contentHash) return 'changed'
    if (scene.details.summary === row.text && scene.details.summaryRevision === row.revision) return 'saved'
    return row.complete ? 'ready' : 'partial'
}

/** Today's state of one proposed chapter or book summary: it must have read every covered scene, and they must not have changed. */
export function wideState(story: StoryOutline, row: WideRow): ReplySummaryState {
    const bases = summaryBases(story)
    if (row.chapterId !== null) {
        const chapter = story.chapters.find(chapter => chapter.id === row.chapterId && !chapter.trashedAt && !chapter.mergedInto)
        if (!chapter || studioInheritance(story, chapter).readOnly) return 'unavailable'
        if (!row.complete) return 'partial'
        if (!sameBasis(row.basis, bases.chapters.get(chapter.id) ?? [])) return 'changed'
        return chapter.details.summary === row.text && sameBasis(chapter.details.summaryBasis, row.basis) ? 'saved' : 'ready'
    }
    if (story.status === 'archived' || story.trashedAt) return 'unavailable'
    if (!row.complete) return 'partial'
    if (!sameBasis(row.basis, bases.book)) return 'changed'
    return story.details.summary === row.text && sameBasis(story.details.summaryBasis, row.basis) ? 'saved' : 'ready'
}

/** A part can take a summary while it, and the novel, are writable, and its basis fits a unit's details. */
export function partWritable(story: StoryOutline, partId: string): boolean {
    const part = story.parts.find(part => part.id === partId && !part.trashedAt && !part.mergedInto)
    return Boolean(part) && part!.status !== 'archived' && story.status !== 'archived' && !story.trashedAt && (partBases(story).get(partId)?.length ?? 0) <= MAX_CHAPTER_BASIS
}

/** Today's state of one proposed part summary, as for a chapter's (rest of K09). */
export function partState(story: StoryOutline, row: NovelAssistantPartSummary): ReplySummaryState {
    if (!partWritable(story, row.partId)) return 'unavailable'
    if (!row.complete) return 'partial'
    if (!sameBasis(row.basis, partBases(story).get(row.partId) ?? [])) return 'changed'
    const part = story.parts.find(part => part.id === row.partId)!
    return part.details.summary === row.text && sameBasis(part.details.summaryBasis, row.basis) ? 'saved' : 'ready'
}
