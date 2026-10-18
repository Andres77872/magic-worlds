/**
 * Every saved summary of the novel against today's scenes (rest of K09): which are current, which turned stale,
 * which were never tied to their scenes, and which scenes, chapters or parts have none. Pure derivations over the
 * outline; a refresh is one reviewed assistant request over at most 20 scenes, or one built from current summaries,
 * never an automatic rewrite.
 */

import type { StoryOutline } from '@/shared'
import { studioInheritance } from '@/shared/storyStudioState'
import { isSummaryBasis, orderedParts, partBases, readingRows, sameBasis, summaryBases, MAX_BOOK_BASIS, MAX_CHAPTER_BASIS } from '@/shared/storySummaryBasis'
import { ASSISTANT_ACTION_TASKS, MAX_CONTEXT_CHAPTER_SUMMARIES, MAX_CONTEXT_PART_SUMMARIES, MAX_CONTEXT_SUMMARIES, MAX_SUMMARY_CHARS } from '@/infrastructure/api/storyAssistantContextContract'
import { partWritable } from './replySummaryState'
import { withoutAction, type AssistantSourceSettings } from '../persistence/assistantDraftJournal'

export type SummaryStatus = 'current' | 'stale' | 'unpinned' | 'missing'
export type SummaryKind = 'book' | 'part' | 'chapter' | 'scene'
/** One request reads at most this many scenes (the context request's scene limit). */
export const MAX_REFRESH_SCENES = 20

export interface SummaryRow {
    key: string
    kind: SummaryKind
    /** The part, chapter or scene; null for the book. */
    id: string | null
    chapterId: string | null
    /** The part a chapter or scene belongs to, or the part itself. */
    partId: string | null
    title: string
    chapterTitle: string | null
    status: SummaryStatus
    text: string | null
    /** The covered scenes a fresh summary must read in full, in reading order. */
    sceneIds: string[]
    /** What *Still accurate* ties the saved text to: today's prose revision, or today's basis. */
    revision: number | null
    basis: string[] | null
    writable: boolean
}

const statusOf = (text: string | null, pinned: boolean, current: boolean): SummaryStatus =>
    !text ? 'missing' : !pinned ? 'unpinned' : current ? 'current' : 'stale'
const savedText = (value: unknown) => typeof value === 'string' && value.trim() ? value : null
const idOf = (entry: string) => entry.slice(0, entry.lastIndexOf('@'))

/** The book, then each covered part, chapter and scene, each part and chapter followed by what it holds, in reading order. */
export function summaryRows(story: StoryOutline, readOnly = false): SummaryRow[] {
    const bases = summaryBases(story), parts = partBases(story), rows: SummaryRow[] = []
    if (!bases.book.length) return rows
    const scenes = new Map(readingRows(story).map(({ chapter, scene }) => [scene.id, { chapter, scene }]))
    const text = savedText(story.details.summary), basis = story.details.summaryBasis
    rows.push({ key: 'book', kind: 'book', id: null, chapterId: null, partId: null, title: story.title, chapterTitle: null, text,
        status: statusOf(text, isSummaryBasis(basis, MAX_BOOK_BASIS), sameBasis(basis, bases.book)),
        sceneIds: bases.book.map(idOf), revision: null, basis: bases.book,
        writable: !readOnly && story.status !== 'archived' && !story.trashedAt })
    const listed = new Set<string>()
    for (const [chapterId, entries] of bases.chapters) {
        const chapter = scenes.get(idOf(entries[0]))!.chapter, chapterText = savedText(chapter.details.summary)
        const partId = chapter.partId && parts.has(chapter.partId) ? chapter.partId : null
        if (partId && !listed.has(partId)) {
            listed.add(partId)
            const part = story.parts.find((part) => part.id === partId)!, partText = savedText(part.details.summary), entries = parts.get(partId)!
            rows.push({ key: 'part:' + partId, kind: 'part', id: partId, chapterId: null, partId, title: part.title, chapterTitle: null, text: partText,
                status: statusOf(partText, isSummaryBasis(part.details.summaryBasis, MAX_CHAPTER_BASIS), sameBasis(part.details.summaryBasis, entries)),
                sceneIds: entries.map(idOf), revision: null, basis: entries, writable: !readOnly && partWritable(story, partId) })
        }
        rows.push({ key: 'chapter:' + chapterId, kind: 'chapter', id: chapterId, chapterId, partId, title: chapter.title, chapterTitle: null, text: chapterText,
            status: statusOf(chapterText, isSummaryBasis(chapter.details.summaryBasis, MAX_CHAPTER_BASIS), sameBasis(chapter.details.summaryBasis, entries)),
            sceneIds: entries.map(idOf), revision: null, basis: entries,
            writable: !readOnly && !studioInheritance(story, chapter).readOnly })
        for (const entry of entries) {
            const { scene } = scenes.get(idOf(entry))!, sceneText = savedText(scene.details.summary), pinned = scene.details.summaryRevision
            rows.push({ key: 'scene:' + scene.id, kind: 'scene', id: scene.id, chapterId, partId, title: scene.title, chapterTitle: chapter.title, text: sceneText,
                status: statusOf(sceneText, typeof pinned === 'number', pinned === scene.revision),
                sceneIds: [scene.id], revision: scene.revision, basis: null, writable: !readOnly })
        }
    }
    return rows
}

export function summaryCounts(rows: SummaryRow[]): Record<SummaryStatus, number> {
    const counts = { current: 0, stale: 0, unpinned: 0, missing: 0 }
    for (const row of rows) counts[row.status]++
    return counts
}

/** The scenes one refresh of the chosen rows reads, in reading order; a part or chapter brings all its covered scenes. */
export function refreshScenes(rows: SummaryRow[], chosen: ReadonlySet<string>): string[] {
    const wanted = new Set(rows.filter((row) => chosen.has(row.key) && row.kind !== 'book').flatMap((row) => row.sceneIds))
    return rows.find((row) => row.kind === 'book')?.sceneIds.filter((id) => wanted.has(id)) ?? []
}

/**
 * The *Summary* action over exactly these scenes, read with author analysis so later scenes are not cut at the anchor.
 * The whole book uses the novel scope, so its reply can also carry the book's summary.
 */
export function summaryRefreshSettings(base: AssistantSourceSettings, sceneIds: string[], book: boolean): AssistantSourceSettings {
    return { ...withoutAction(base), task: ASSISTANT_ACTION_TASKS.summary, action: { kind: 'summary' }, anchorSceneId: sceneIds[0], selection: null,
        scope: book ? 'novel' : 'scenes', sceneIds: book ? [] : sceneIds, revealPolicy: 'author_analysis', includeArchived: false,
        limits: { ...base.limits, maxSources: String(Math.min(MAX_REFRESH_SCENES, sceneIds.length)) } }
}

/** The scene a whole-book refresh from summaries reads, or how many scenes no current summary covers yet. */
export type BookFromSummaries = { anchorSceneId: string; uncovered: 0 } | { anchorSceneId: null; uncovered: number }

const current = (text: unknown, ok: boolean) => typeof text === 'string' && text.length > 0 && Array.from(text).length <= MAX_SUMMARY_CHARS && ok

/**
 * Whether one whole-novel Summary request reading a single scene could cover every other scene through current
 * summaries, exactly as the compiler would send them (rest of K09): a part's in place of its chapters', a chapter's in
 * place of its scenes', within each kind's count limit. The anchor's own part and chapter are read, so their summaries
 * are not sent; the anchor's chapter needs current scene summaries for its other scenes. Room in the context is
 * not known here; the prepared prompt shows what was covered.
 */
export function bookFromSummaries(story: StoryOutline): BookFromSummaries {
    const bases = summaryBases(story), parts = partBases(story)
    const chapters = new Map(story.chapters.map((chapter) => [chapter.id, chapter]))
    const rows = readingRows(story), scenes = new Map(rows.map((row) => [row.scene.id, row]))
    const sceneCurrent = (id: string) => { const scene = scenes.get(id)!.scene; return current(scene.details.summary, scene.details.summaryRevision === scene.revision) }
    const uncovered = (anchor: string) => {
        const read = scenes.get(anchor)!.chapter, coveredParts = new Set<string>(), coveredChapters = new Set<string>()
        for (const part of orderedParts(story.parts)) {
            const basis = parts.get(part.id)
            if (!basis || part.id === read.partId || coveredParts.size >= MAX_CONTEXT_PART_SUMMARIES) continue
            if (current(part.details.summary, sameBasis(part.details.summaryBasis, basis))) coveredParts.add(part.id)
        }
        for (const [chapterId, basis] of bases.chapters) {
            const chapter = chapters.get(chapterId)!
            if (chapterId === read.id || chapter.partId && coveredParts.has(chapter.partId) || coveredChapters.size >= MAX_CONTEXT_CHAPTER_SUMMARIES) continue
            if (current(chapter.details.summary, sameBasis(chapter.details.summaryBasis, basis))) coveredChapters.add(chapterId)
        }
        let sent = 0, missing = 0
        for (const entry of bases.book) {
            const id = idOf(entry), chapter = scenes.get(id)!.chapter
            if (id === anchor || coveredChapters.has(chapter.id) || chapter.partId && coveredParts.has(chapter.partId)) continue
            if (sceneCurrent(id) && sent < MAX_CONTEXT_SUMMARIES) sent++
            else missing++
        }
        return missing
    }
    let best = Number.POSITIVE_INFINITY
    // Only a scene whose chapter's other scenes have current summaries can be the one read; try one per chapter.
    for (const basis of bases.chapters.values()) {
        const ids = basis.map(idOf), lacking = ids.filter((id) => !sceneCurrent(id))
        const anchor = lacking.length <= 1 ? lacking[0] ?? ids[0] : ids[0]
        const missing = uncovered(anchor)
        if (missing === 0) return { anchorSceneId: anchor, uncovered: 0 }
        best = Math.min(best, missing)
    }
    return { anchorSceneId: null, uncovered: Number.isFinite(best) ? best : bases.book.length }
}
