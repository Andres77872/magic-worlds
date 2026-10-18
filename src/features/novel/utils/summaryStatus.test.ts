import { expect, it } from 'vitest'
import fixture from '@/test/fixtures/storyAssistantContextChapterSummaries.json'
import type { StoryOutline } from '@/shared'
import { isAssistantContextRequest } from '@/infrastructure/api/storyAssistantContextContract'
import { assistantSourceOptions, initialAssistantSettings } from '../persistence/assistantDraftJournal'
import { refreshScenes, summaryCounts, summaryRefreshSettings, summaryRows } from './summaryStatus'

const wire = fixture as unknown as { index: StoryOutline & { sourceVersion: string } }
const story = (edit: (value: StoryOutline) => void = () => {}) => { const value = structuredClone(wire.index); edit(value); return value }
const states = (value: StoryOutline) => Object.fromEntries(summaryRows(value).map((row) => [row.key, row.status]))

it('lists the book, each covered chapter and its scenes in reading order with today’s state', () => {
    const rows = summaryRows(story())
    expect(rows.map((row) => row.key)).toEqual(['book', 'chapter:chapter-0', 'scene:scene-0', 'scene:scene-1', 'chapter:chapter-1', 'scene:scene-2', 'scene:scene-3'])
    expect(states(story())).toEqual({ book: 'current', 'chapter:chapter-0': 'current', 'scene:scene-0': 'current', 'scene:scene-1': 'missing',
        'chapter:chapter-1': 'missing', 'scene:scene-2': 'missing', 'scene:scene-3': 'missing' })
    expect(summaryCounts(rows)).toEqual({ current: 3, stale: 0, unpinned: 0, missing: 4 })
    expect(rows[0]).toMatchObject({ sceneIds: ['scene-0', 'scene-1', 'scene-2', 'scene-3'], basis: ['scene-0@1', 'scene-1@1', 'scene-2@1', 'scene-3@1'], writable: true })
    expect(rows[2]).toMatchObject({ revision: 1, basis: null, chapterTitle: 'Prologue' })
})

it('marks a summary stale when a covered scene changes, and unpinned when it was never tied to its scenes', () => {
    // A later revision of Scene 1 leaves the Prologue's and the book's summaries behind; Scene 0's own summary still holds.
    expect(states(story((value) => { value.chapters[0].scenes[1].revision = 2 }))).toMatchObject({ book: 'stale', 'chapter:chapter-0': 'stale', 'scene:scene-0': 'current' })
    expect(states(story((value) => { value.chapters[0].scenes[0].revision = 3 }))).toMatchObject({ 'scene:scene-0': 'stale' })
    // Trashing a scene removes it from what the chapter and book summaries cover.
    const trashed = story((value) => { value.chapters[1].scenes[1].trashedAt = '2026-10-18T00:00:00Z' })
    expect(states(trashed)).toMatchObject({ book: 'stale', 'chapter:chapter-0': 'current' })
    expect(summaryRows(trashed).find((row) => row.key === 'chapter:chapter-1')?.sceneIds).toEqual(['scene-2'])
    const unpinned = story((value) => { value.chapters[1].details = { summary: 'Hand-written.' }; value.chapters[1].scenes[0].details = { summary: 'Old.' } })
    expect(states(unpinned)).toMatchObject({ 'chapter:chapter-1': 'unpinned', 'scene:scene-2': 'unpinned' })
    expect(states(story((value) => { value.chapters[0].scenes[0].details = { summary: '  ', summaryRevision: 1 } }))).toMatchObject({ 'scene:scene-0': 'missing' })
})

it('offers no change on a read-only or archived novel and nothing when no scene is read by the assistant', () => {
    expect(summaryRows(story(), true).every((row) => !row.writable)).toBe(true)
    // An archived or trashed novel makes every scene read-only, so the assistant reads none and no summary is listed.
    expect(summaryRows(story((value) => { value.status = 'archived' }))).toEqual([])
    expect(summaryRows(story((value) => { value.trashedAt = '2026-10-18T00:00:00Z' }))).toEqual([])
    expect(summaryRows(story((value) => { value.chapters.forEach((chapter) => { chapter.trashedAt = '2026-10-18T00:00:00Z' }) }))).toEqual([])
})

it('refreshes the chosen scenes, a chapter with all of its scenes, in reading order, as one valid Summary request', () => {
    const rows = summaryRows(story())
    expect(refreshScenes(rows, new Set(['chapter:chapter-1', 'scene:scene-0', 'book']))).toEqual(['scene-0', 'scene-2', 'scene-3'])
    expect(refreshScenes(rows, new Set(['scene:scene-3', 'scene:scene-1']))).toEqual(['scene-1', 'scene-3'])
    const base = initialAssistantSettings('scene-3', null), message = 'Write new summaries of these scenes.'
    const scenes = summaryRefreshSettings(base, ['scene-1', 'scene-3'], false)
    expect(scenes).toMatchObject({ task: 'ask', action: { kind: 'summary' }, anchorSceneId: 'scene-1', scope: 'scenes', sceneIds: ['scene-1', 'scene-3'],
        revealPolicy: 'author_analysis', selection: null, limits: { ...base.limits, maxSources: '2' } })
    const book = summaryRefreshSettings(base, rows[0].sceneIds, true)
    expect(book).toMatchObject({ scope: 'novel', sceneIds: [], anchorSceneId: 'scene-0', limits: { maxSources: '4' } })
    for (const settings of [scenes, book]) {
        expect(isAssistantContextRequest({ ...assistantSourceOptions(settings, message), sourceVersion: wire.index.sourceVersion })).toBe(true)
    }
})
