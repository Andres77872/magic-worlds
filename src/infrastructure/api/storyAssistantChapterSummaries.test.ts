import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import fixture from '@/test/fixtures/storyAssistantContextChapterSummaries.json'
import { metadataPatch, metadataSeed } from '@/features/novel/persistence/metadataJournal'
import { isStoryNovelDetails } from '@/shared/storyNovelDetails'
import { summaryBases } from '@/shared/storySummaryBasis'
import { isStoryUnitDetails } from '@/shared/storyUnitDetails'
import type { NovelAssistantRecord, StoryAssistantContext, StoryAssistantContextRequest } from '@/shared/types/storyAssistant.types'
import type { StoryStudioIndex } from '@/shared/types/storyStudio.types'
import { canonicalJson } from '@/utils/json'
import { verifyNovelAssistantRecord } from './novelAssistantContract'
import { verifyAssistantContext, verifyFrozenAssistantContext } from './storyAssistantContextContract'

type Case = { request: StoryAssistantContextRequest; result: StoryAssistantContext }
const wire = fixture as unknown as { index: StoryStudioIndex; anchor: Case; analysis: Case; summary: Case; record: NovelAssistantRecord }
const index = () => structuredClone(wire.index)
const signed = (value: Case, edit: (result: StoryAssistantContext) => void) => {
    const result = structuredClone(value.result); edit(result)
    result.messages[1].content = canonicalJson(result.packet)
    result.packetHash = createHash('sha256').update(canonicalJson(result.messages)).digest('hex')
    result.trace.inputEstimate = new TextEncoder().encode(canonicalJson(result.messages)).length + 64
    return result
}
const live = (value: Case, edit: (result: StoryAssistantContext) => void, story = index()) => verifyAssistantContext(signed(value, edit), story, value.request)
const frozen = (value: Case, edit: (result: StoryAssistantContext) => void) => verifyFrozenAssistantContext(signed(value, edit), wire.index.id)

it('computes the same basis as the Python compiler and keeps it exactly in chapter and novel details', () => {
    const story = index(), bases = summaryBases(story), prologue = story.chapters.find(chapter => chapter.id === 'chapter-0')!
    expect(bases.chapters.get('chapter-0')).toEqual(prologue.details.summaryBasis)
    expect(bases.book).toEqual(story.details.summaryBasis)
    expect(wire.summary.result.packet.chapters?.map(row => row.sceneIds)).toEqual([...bases.chapters.values()].map(basis => basis.map(entry => entry.split('@')[0])))
    expect(isStoryUnitDetails(prologue.details)).toBe(true); expect(isStoryNovelDetails(story.details)).toBe(true)
    for (const wrong of [['scene-0'], ['scene-0@0'], ['scene-0@1', 'scene-0@1'], 'scene-0@1', ['scene-0@1\n'], Array(1001).fill(0).map((_, n) => `s${n}@1`)]) {
        expect(isStoryUnitDetails({ summaryBasis: wrong })).toBe(false)
    }
    expect(isStoryNovelDetails({ summaryBasis: Array(1001).fill(0).map((_, n) => `s${n}@1`) })).toBe(true)
    expect(isStoryNovelDetails({ summaryBasis: Array(3001).fill(0).map((_, n) => `s${n}@1`) })).toBe(false)
})

it('verifies the Python chapter and book summaries and refuses rows the saved outline does not give', () => {
    for (const value of [wire.anchor, wire.analysis, wire.summary]) {
        expect(verifyAssistantContext(value.result, wire.index, value.request)).toBe(true)
        expect(verifyFrozenAssistantContext(value.result, wire.index.id)).toBe(true)
    }
    expect(wire.anchor.result.trace.summaryExclusions).toEqual([{ sceneId: 'scene-0', reason: 'chapter' }])
    for (const edit of [
        (r: StoryAssistantContext) => { r.packet.chapterSummaries![0].text = 'Aria is twelve.' },
        (r: StoryAssistantContext) => { r.packet.chapterSummaries![0].title = 'Another title' },
        (r: StoryAssistantContext) => { delete r.packet.chapterSummaries },
        (r: StoryAssistantContext) => { r.trace.summaryExclusions![0].reason = 'stale' },
        (r: StoryAssistantContext) => { r.packet.bookSummary = { text: 'Not through the anchor.' } },
    ]) expect(live(wire.anchor, edit)).toBe(false)
    // A chapter summary left out for room lets its scenes' summaries in, exactly as the compiler does.
    expect(live(wire.anchor, r => { delete r.packet.chapterSummaries; r.trace.chapterSummaryExclusions = [{ chapterId: 'chapter-0', reason: 'budget' }]
        r.packet.summaries = [{ sceneId: 'scene-0', title: 'Scene 0', revision: 1, text: 'Aria turns seventeen.' }]; delete r.trace.summaryExclusions })).toBe(true)
    // Changed scenes make the saved summary stale: the same packet no longer matches today's outline.
    const stale = index(); stale.chapters[0].details.summaryBasis = ['scene-0@1']
    expect(verifyAssistantContext(wire.anchor.result, stale, wire.anchor.request)).toBe(false)
    expect(live(wire.analysis, r => { r.packet.bookSummary!.text = 'Another book.' })).toBe(false)
    expect(live(wire.analysis, r => { delete r.packet.bookSummary; r.trace.bookSummaryOmitted = 'budget' })).toBe(true)
    expect(live(wire.analysis, r => { delete r.packet.bookSummary; r.trace.bookSummaryOmitted = 'stale' })).toBe(false)
    for (const edit of [
        (r: StoryAssistantContext) => { r.packet.chapters!.reverse() },
        (r: StoryAssistantContext) => { r.packet.chapters![0].sceneIds.pop() },
        (r: StoryAssistantContext) => { r.packet.bookScenes = 5 },
        (r: StoryAssistantContext) => { delete r.packet.chapters },
    ]) expect(live(wire.summary, edit)).toBe(false)
    for (const edit of [
        (r: StoryAssistantContext) => { r.packet.chapterSummaries![0].chapterId = 'chapter-1' },
        (r: StoryAssistantContext) => { r.packet.chapterSummaries = [] },
        (r: StoryAssistantContext) => { r.trace.chapterSummaryExclusions = [{ chapterId: 'chapter-0', reason: 'chapter' as never }] },
        (r: StoryAssistantContext) => { r.packet.bookSummary = { text: 'Not through the anchor.' } },
    ]) expect(frozen(wire.anchor, edit)).toBe(false)
    for (const edit of [
        (r: StoryAssistantContext) => { r.packet.chapters!.reverse() },
        (r: StoryAssistantContext) => { r.packet.chapters![0].sceneIds = [] },
        (r: StoryAssistantContext) => { r.packet.bookScenes = 1 },
    ]) expect(frozen(wire.summary, edit)).toBe(false)
})

it('keeps summary replies saved before chapter rows existed valid, but a live preview must carry them', () => {
    // Such replies also predate the coverage record that part summaries added.
    const old = signed(wire.summary, r => { delete r.packet.chapters; delete r.packet.bookScenes; delete r.trace.summaryCoverage })
    expect(verifyFrozenAssistantContext(old, wire.index.id)).toBe(true)
    expect(verifyAssistantContext(old, wire.index, wire.summary.request)).toBe(false)
    expect(frozen(wire.summary, r => { delete r.packet.bookScenes })).toBe(false)
    const result = structuredClone(wire.record.result); delete result.chapterSummaries; delete result.bookSummary
    expect(verifyNovelAssistantRecord({ context: old, result: { ...result, packetHash: old.packetHash } }, wire.index.id)).toBe(true)
    expect(verifyNovelAssistantRecord({ context: old, result: { ...wire.record.result, packetHash: old.packetHash } }, wire.index.id)).toBe(false)
})

it('accepts reply chapter and book summaries only with the basis and completeness they read', () => {
    expect(verifyNovelAssistantRecord(wire.record, wire.index.id)).toBe(true)
    const tampered = (edit: (result: NovelAssistantRecord['result']) => void, record = wire.record) => {
        const value = structuredClone(record); edit(value.result); return verifyNovelAssistantRecord(value, wire.index.id)
    }
    for (const edit of [
        (r: NovelAssistantRecord['result']) => { r.chapterSummaries![0].complete = false },
        (r: NovelAssistantRecord['result']) => { r.chapterSummaries![0].basis = r.chapterSummaries![0].basis.slice(1) },
        (r: NovelAssistantRecord['result']) => { r.chapterSummaries![0].text = ' padded ' },
        (r: NovelAssistantRecord['result']) => { r.chapterSummaries![1].chapterId = 'chapter-0' },
        (r: NovelAssistantRecord['result']) => { r.chapterSummaries![0].chapterId = 'chapter-9' },
        (r: NovelAssistantRecord['result']) => { r.chapterSummaries = [] },
        (r: NovelAssistantRecord['result']) => { r.bookSummary!.complete = false },
        (r: NovelAssistantRecord['result']) => { r.bookSummary!.basis = [] },
        (r: NovelAssistantRecord['result']) => { (r.bookSummary as unknown as Record<string, unknown>).saved = true },
    ]) expect(tampered(edit)).toBe(false)
    // A packet without the summary action has no chapter rows, so it cannot carry chapter or book summaries.
    const other = { context: wire.anchor.result, result: { ...structuredClone(wire.record.result), packetHash: wire.anchor.result.packetHash, sourceVersion: wire.anchor.result.sourceVersion } }
    expect(tampered(r => { delete r.chapterSummaries }, other)).toBe(false)
    expect(tampered(r => { delete r.chapterSummaries; delete r.bookSummary }, other)).toBe(true)
})

it('ties a hand-edited chapter or book summary to today’s covered scenes, and clears the tie with the summary', () => {
    const story = index(), chapter = story.chapters[0], bases = summaryBases(story)
    const draft = metadataSeed(chapter, 'chapter'); draft.form.details.summary = 'Written by hand.'
    expect(metadataPatch(draft, 'hand', bases.chapters.get(chapter.id))?.details).toMatchObject({ summary: 'Written by hand.', summaryBasis: bases.chapters.get(chapter.id) })
    draft.form.details.summary = null
    expect(metadataPatch(draft, 'cleared', bases.chapters.get(chapter.id))?.details).toMatchObject({ summary: null, summaryBasis: null })
    const novel = metadataSeed(story, 'novel'); novel.form.details.genre = 'Fable'
    expect(metadataPatch(novel, 'genre', bases.book)?.details).toMatchObject({ genre: 'Fable', summaryBasis: story.details.summaryBasis })
    novel.form.details.summary = 'A new book summary.'
    expect(metadataPatch(novel, 'book', ['scene-9@2'])?.details).toMatchObject({ summary: 'A new book summary.', summaryBasis: ['scene-9@2'] })
})
