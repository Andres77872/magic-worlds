import type { StoryChangesetStep, StoryChapterOutline, StoryOutline, StorySceneOutline, StoryStructureOperation } from '@/shared'
import type { NovelAssistantStructureChange } from '@/shared/types/storyAssistant.types'
import { chaptersFor } from './novelUtils'

/**
 * Where a proposed outline change stands against the current outline: ready to apply, already shown by the
 * outline, overtaken by a later edit of its scenes' prose, or no longer possible (a scene or chapter left, became
 * read-only, or the scenes to merge are no longer next to each other).
 */
export type StructureChangeState = 'ready' | 'done' | 'changed' | 'unavailable'

const open = (scene: StorySceneOutline | undefined): scene is StorySceneOutline =>
    Boolean(scene && !scene.trashedAt && scene.status !== 'archived' && !scene.inheritance?.readOnly)
const openChapter = (chapter: StoryChapterOutline | undefined): chapter is StoryChapterOutline =>
    Boolean(chapter && !chapter.trashedAt && chapter.status !== 'archived' && !chapter.inheritance?.readOnly)
const byOrder = <T extends { order: number }>(rows: T[]) => [...rows].sort((a, b) => a.order - b.order)

/** The saved content hash of each scene the reply read, so an undo that restores identical prose keeps a change usable. */
export type SavedSceneHash = (sceneId: string) => string | undefined
const unchanged = (scene: StorySceneOutline, revision: number, savedHash: SavedSceneHash) =>
    scene.revision === revision || Boolean(savedHash(scene.id) && scene.contentHash === savedHash(scene.id))

type ChapterLevelChange = Extract<NovelAssistantStructureChange, { kind: 'split_chapter' | 'merge_chapters' | 'move_chapter' | 'new_chapter' | 'new_part' }>
const chapterLevel = (change: NovelAssistantStructureChange): change is ChapterLevelChange =>
    ['split_chapter', 'merge_chapters', 'move_chapter', 'new_chapter', 'new_part'].includes(change.kind)
const partSiblings = (story: StoryOutline, partId: string | null) =>
    byOrder(chaptersFor(story).filter((chapter) => (chapter.partId ?? null) === partId))

/**
 * The chapters a new part takes from the current outline: its chapter and the ones after it in its part. Once the
 * part exists, the chapters it holds.
 */
export function newPartChapters(story: StoryOutline, change: Extract<NovelAssistantStructureChange, { kind: 'new_part' }>): StoryChapterOutline[] {
    const chapter = story.chapters.find((row) => row.id === change.chapterId)
    if (!chapter) return []
    const row = partSiblings(story, chapter.partId ?? null)
    const at = row.findIndex((item) => item.id === chapter.id)
    return at < 0 ? [] : row.slice(at)
}

/** Where a chapter-level change stands: chapters merge and move within their part, and nothing here depends on prose. */
function chapterChangeState(story: StoryOutline, change: ChapterLevelChange): StructureChangeState {
    const chapters = chaptersFor(story)
    const find = (id: string) => story.chapters.find((chapter) => chapter.id === id)
    const siblings = (partId: string | null) => byOrder(chapters.filter((chapter) => (chapter.partId ?? null) === partId))
    const next = (chapter: StoryChapterOutline) => { const row = siblings(chapter.partId ?? null); return row[row.findIndex((item) => item.id === chapter.id) + 1] ?? null }
    const scenes = (chapter: StoryChapterOutline) => byOrder(chapter.scenes.filter((scene) => !scene.trashedAt))
    const chapter = find(change.chapterId)
    if (change.kind === 'merge_chapters') {
        const other = find(change.otherChapterId)
        if (other?.trashedAt && other.mergedInto === change.chapterId) return 'done'
        return openChapter(chapter) && openChapter(other) && next(chapter)?.id === other.id ? 'ready' : 'unavailable'
    }
    if (!openChapter(chapter)) return 'unavailable'
    if (change.kind === 'new_part') {
        // It starts from the chapter's part now, so parts proposed for several chapters apply in any order.
        const current = chapter.partId ?? null, part = story.parts?.find((row) => row.id === current)
        const first = siblings(current)[0]?.id === chapter.id
        if (part && part.id !== change.partId && part.title === change.title && first) return 'done'
        if (current !== null && (!part || part.trashedAt || part.status === 'archived' || first)) return 'unavailable'
        return newPartChapters(story, change).every(openChapter) ? 'ready' : 'unavailable'
    }
    if (change.kind === 'move_chapter') {
        const row = siblings(change.partId)
        const at = row.findIndex((item) => item.id === chapter.id)
        if (at >= 0 && (row[at + 1]?.id ?? null) === change.beforeChapterId) return 'done'
        if (change.partId !== null && !story.parts?.some((part) => part.id === change.partId && !part.trashedAt && part.status !== 'archived')) return 'unavailable'
        return change.beforeChapterId === null || row.some((item) => item.id === change.beforeChapterId) ? 'ready' : 'unavailable'
    }
    if (change.kind === 'new_chapter') {
        const after = next(chapter)
        if (after && after.title === change.title && scenes(after).map((scene) => scene.id).join() === change.sceneIds.join()) return 'done'
        const all = story.chapters.flatMap((row) => row.scenes)
        return change.sceneIds.every((id) => open(all.find((scene) => scene.id === id))) ? 'ready' : 'unavailable'
    }
    const own = scenes(chapter)
    const at = own.findIndex((scene) => scene.id === change.sceneId)
    if (at > 0 && open(own[at])) return 'ready'
    const moved = story.chapters.find((row) => !row.trashedAt && row.copiedFrom === change.chapterId && row.title === change.title)
    return moved && scenes(moved)[0]?.id === change.sceneId ? 'done' : 'unavailable'
}

export function structureChangeState(story: StoryOutline, change: NovelAssistantStructureChange, savedHash: SavedSceneHash = () => undefined): StructureChangeState {
    if (chapterLevel(change)) return chapterChangeState(story, change)
    const chapters = chaptersFor(story)
    const scenes = story.chapters.flatMap((chapter) => chapter.scenes)
    const find = (id: string) => scenes.find((scene) => scene.id === id)
    const active = (chapterId: string) => [...(chapters.find((chapter) => chapter.id === chapterId)?.scenes ?? [])]
        .filter((scene) => !scene.trashedAt).sort((a, b) => a.order - b.order)
    const scene = find(change.sceneId)
    if (change.kind === 'merge_scenes') {
        const other = find(change.otherSceneId)
        if (other?.trashedAt && other.mergedInto === change.sceneId) return 'done'
        if (!open(scene) || !open(other)) return 'unavailable'
        if (!unchanged(scene, change.revision, savedHash) || !unchanged(other, change.otherRevision, savedHash)) return 'changed'
        const siblings = active(scene.chapterId)
        return siblings[siblings.findIndex((row) => row.id === scene.id) + 1]?.id === other.id ? 'ready' : 'unavailable'
    }
    if (change.kind === 'split_scene') {
        if (scenes.some((row) => !row.trashedAt && row.copiedFrom === change.sceneId && (row.copiedFromRevision ?? 0) >= change.revision && row.title === change.title)) return 'done'
        if (!open(scene)) return 'unavailable'
        return unchanged(scene, change.revision, savedHash) ? 'ready' : 'changed'
    }
    const chapter = chapters.find((row) => row.id === change.chapterId)
    if (!open(scene) || !chapter || chapter.status === 'archived' || chapter.inheritance?.readOnly) return 'unavailable'
    const siblings = active(change.chapterId)
    const at = siblings.findIndex((row) => row.id === scene.id)
    if (at >= 0 && (siblings[at + 1]?.id ?? null) === change.beforeSceneId) return 'done'
    return change.beforeSceneId === null || siblings.some((row) => row.id === change.beforeSceneId) ? 'ready' : 'unavailable'
}

/**
 * The structure steps of one change; `offset` is the position of its first step in a changeset, so a new chapter's
 * scenes move into the chapter its own first step creates. Prose-bound changes name the scenes' current revisions,
 * which hold the reply's saved prose (the same revision, or identical content after an undo); the server refuses
 * the write if that prose changed since this outline was read.
 */
function structureChangeSteps(story: StoryOutline, change: NovelAssistantStructureChange, offset = 0): StoryChangesetStep[] {
    const revision = (id: string, saved: number) => story.chapters.flatMap((chapter) => chapter.scenes).find((scene) => scene.id === id)?.revision ?? saved
    if (change.kind === 'move_scene') return [{ op: 'move', kind: 'scene', id: change.sceneId, parentId: change.chapterId, ...(change.beforeSceneId ? { beforeId: change.beforeSceneId } : {}) }]
    if (change.kind === 'split_scene') return [{ op: 'split_scene', id: change.sceneId, textOffset: change.offset, expectedRevision: revision(change.sceneId, change.revision), title: change.title }]
    if (change.kind === 'merge_scenes') return [{ op: 'merge_scenes', id: change.sceneId, withId: change.otherSceneId, expectedRevision: revision(change.sceneId, change.revision),
        otherExpectedRevision: revision(change.otherSceneId, change.otherRevision), sceneBreak: true }]
    if (change.kind === 'split_chapter') return [{ op: 'split_chapter', id: change.chapterId, beforeSceneId: change.sceneId, title: change.title }]
    if (change.kind === 'merge_chapters') return [{ op: 'merge_chapters', id: change.chapterId, withId: change.otherChapterId }]
    if (change.kind === 'move_chapter') return [{ op: 'move', kind: 'chapter', id: change.chapterId, parentId: change.partId, ...(change.beforeChapterId ? { beforeId: change.beforeChapterId } : {}) }]
    if (change.kind === 'new_part') return [{ op: 'start_part', id: change.chapterId, title: change.title }]
    return [{ op: 'create', kind: 'chapter', parentId: change.partId, title: change.title, afterId: change.chapterId },
        { op: 'bulk_scenes', action: 'move', ids: change.sceneIds, parentId: { created: offset } }]
}

/** The one structure write that applies a ready change; a new chapter and its scenes, or a new part, are one changeset. */
export function structureChangeOperation(story: StoryOutline, change: NovelAssistantStructureChange): StoryStructureOperation {
    const steps = structureChangeSteps(story, change)
    return steps.length === 1 && steps[0].op !== 'start_part' ? steps[0] as StoryStructureOperation : { op: 'changeset', operations: steps }
}

/** The most steps one changeset holds; a reply's six changes take at most twelve. */
export const MAX_CHANGESET_STEPS = 12

/** Several ready changes, in the reply's order, as one changeset: one organization change with one undo. */
export function structureChangesetOperation(story: StoryOutline, changes: NovelAssistantStructureChange[]): StoryStructureOperation {
    const operations: StoryChangesetStep[] = []
    for (const change of changes) operations.push(...structureChangeSteps(story, change, operations.length))
    return { op: 'changeset', operations }
}

/** Why a structure write was refused, from the studio's last error code. */
export type StructureFailure = 'pendingProposal' | 'textChanged' | 'outlineChanged' | 'notTogether' | 'failed'
export function structureFailure(code: string | null | undefined, together = false): StructureFailure {
    if (code === 'STORY_PENDING_PROPOSAL') return 'pendingProposal'
    // Changes that each work alone can still clash when applied in one go (a merged chapter moved afterwards).
    if (together && code !== 'STORY_REVISION_CONFLICT' && code !== 'STORY_STRUCTURE_CONFLICT' && code !== 'conflict') return 'notTogether'
    if (code === 'STORY_REVISION_CONFLICT') return 'textChanged'
    return code === 'STORY_STRUCTURE_CONFLICT' || code === 'conflict' ? 'outlineChanged' : 'failed'
}
