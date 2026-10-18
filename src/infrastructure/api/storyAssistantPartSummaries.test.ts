import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import fixture from '@/test/fixtures/storyAssistantContextPartSummaries.json'
import { metadataPatch, metadataSeed, readMetadataJournal } from '@/features/novel/persistence/metadataJournal'
import { novelMutationKey, writeNovelMutation } from '@/shared/novelMutationJournal'
import { partBases, summaryBases } from '@/shared/storySummaryBasis'
import type { NovelAssistantRecord, StoryAssistantContext, StoryAssistantContextRequest } from '@/shared/types/storyAssistant.types'
import type { StoryStudioIndex } from '@/shared/types/storyStudio.types'
import { canonicalJson } from '@/utils/json'
import { verifyNovelAssistantRecord } from './novelAssistantContract'
import { verifyAssistantContext, verifyFrozenAssistantContext } from './storyAssistantContextContract'

// Compiled by the BFF: Part One (Prologue, The Gate) has a current summary; Part Two holds the anchor's chapter.
type Case = { request: StoryAssistantContextRequest; result: StoryAssistantContext }
const wire = fixture as unknown as { index: StoryStudioIndex; context: Case; summary: Case; record: NovelAssistantRecord }
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

it('computes the same part basis as the Python compiler', () => {
    const story = index()
    expect(Object.fromEntries(partBases(story))).toEqual({ 'part-1': ['scene-0@1', 'scene-1@1'], 'part-2': ['scene-2@1', 'scene-3@1'] })
    expect(partBases(story).get('part-1')).toEqual(story.parts[0].details.summaryBasis)
    expect(summaryBases(story).book).toHaveLength(wire.summary.result.packet.bookScenes!)
})

it('verifies the Python part summaries and the part reasons, and refuses what the saved outline does not give', () => {
    for (const value of [wire.context, wire.summary]) {
        expect(verifyAssistantContext(value.result, wire.index, value.request)).toBe(true)
        expect(verifyFrozenAssistantContext(value.result, wire.index.id)).toBe(true)
    }
    const trace = wire.context.result.trace
    expect(wire.context.result.packet.partSummaries).toEqual([{ partId: 'part-1', title: 'Part One', text: 'About part-1.' }])
    expect(trace.chapterSummaryExclusions).toEqual([{ chapterId: 'chapter-0', reason: 'part' }])
    expect(trace.summaryExclusions).toEqual([{ sceneId: 'scene-0', reason: 'part' }])
    for (const edit of [
        (r: StoryAssistantContext) => { r.packet.partSummaries![0].text = 'Another part.' },
        (r: StoryAssistantContext) => { delete r.packet.partSummaries },
        (r: StoryAssistantContext) => { r.trace.chapterSummaryExclusions![0].reason = 'stale' },
        (r: StoryAssistantContext) => { r.trace.summaryExclusions![0].reason = 'chapter' },
    ]) expect(live(wire.context, edit)).toBe(false)
    // A part summary left out for room lets its chapter's summary in, exactly as the compiler does.
    expect(live(wire.context, r => { delete r.packet.partSummaries; r.trace.partSummaryExclusions = [{ partId: 'part-1', reason: 'budget' }]
        r.packet.chapterSummaries = [{ chapterId: 'chapter-0', title: 'Prologue', text: 'About chapter-0.' }]; delete r.trace.chapterSummaryExclusions
        r.trace.summaryExclusions = [{ sceneId: 'scene-0', reason: 'chapter' }] })).toBe(true)
    // Changed scenes make the part summary stale: the same packet no longer matches today's outline.
    const stale = index(); stale.parts[0].details.summaryBasis = ['scene-0@1']
    expect(verifyAssistantContext(wire.context.result, stale, wire.context.request)).toBe(false)
    for (const edit of [
        (r: StoryAssistantContext) => { r.packet.partSummaries!.push({ partId: 'part-2', title: 'Part Two', text: 'Read already.' }) },
        (r: StoryAssistantContext) => { r.trace.partSummaryExclusions = [{ partId: 'part-2', reason: 'stale' }] },
        (r: StoryAssistantContext) => { r.trace.partSummaryExclusions = [{ partId: 'part-3', reason: 'part' as never }] },
    ]) expect(frozen(wire.context, edit)).toBe(false)
})

it('records what each summary from a Summary request covers, from sources and the summaries it sent', () => {
    const coverage = wire.summary.result.trace.summaryCoverage!
    expect(wire.summary.result.packet.parts).toEqual([{ partId: 'part-1', title: 'Part One', chapterIds: ['chapter-0', 'chapter-a'] },
        { partId: 'part-2', title: 'Part Two', chapterIds: ['chapter-1'] }])
    expect(coverage.book).toEqual({ scenes: 4, covered: ['scene-0@1', 'scene-1@1', 'scene-2@1', 'scene-3@1'] })
    for (const edit of [
        (r: StoryAssistantContext) => { delete r.trace.summaryCoverage },
        (r: StoryAssistantContext) => { r.trace.summaryCoverage!.book.covered.pop() },
        (r: StoryAssistantContext) => { r.trace.summaryCoverage!.parts![0].covered = ['scene-0@1'] },
        (r: StoryAssistantContext) => { r.packet.parts!.reverse() },
        (r: StoryAssistantContext) => { delete r.packet.parts; delete r.trace.summaryCoverage!.parts },
    ]) expect(live(wire.summary, edit)).toBe(false)
    for (const edit of [
        (r: StoryAssistantContext) => { delete r.trace.summaryCoverage },
        (r: StoryAssistantContext) => { r.trace.summaryCoverage!.book.covered.reverse() },
        (r: StoryAssistantContext) => { r.trace.summaryCoverage!.chapters[0].covered.shift() },
        (r: StoryAssistantContext) => { r.trace.summaryCoverage!.book.scenes = 3 },
        (r: StoryAssistantContext) => { r.packet.parts![1].chapterIds.push('chapter-0') },
        (r: StoryAssistantContext) => { r.packet.parts![1].chapterIds = ['chapter-9'] },
    ]) expect(frozen(wire.summary, edit)).toBe(false)
})

it('accepts reply part summaries only for parts listed and not sent, with what they covered', () => {
    expect(verifyNovelAssistantRecord(wire.record, wire.index.id)).toBe(true)
    expect(wire.record.result.partSummaries).toEqual([{ partId: 'part-2', basis: ['scene-2@1', 'scene-3@1'], complete: true, text: 'The sealed letter waits for Aria.' }])
    expect(wire.record.result.bookSummary).toMatchObject({ basis: ['scene-0@1', 'scene-1@1', 'scene-2@1', 'scene-3@1'], complete: true })
    for (const edit of [
        (r: NovelAssistantRecord['result']) => { r.partSummaries![0].complete = false },
        (r: NovelAssistantRecord['result']) => { r.partSummaries![0].basis = ['scene-2@1'] },
        (r: NovelAssistantRecord['result']) => { r.partSummaries![0].partId = 'part-1' },
        (r: NovelAssistantRecord['result']) => { r.partSummaries = [] },
        (r: NovelAssistantRecord['result']) => { r.bookSummary!.basis = ['scene-2@1'] },
    ]) {
        const value = structuredClone(wire.record); edit(value.result)
        expect(verifyNovelAssistantRecord(value, wire.index.id)).toBe(false)
    }
})

it('ties a hand-edited part summary to its scenes, and a pending tied write survives a reload of its journal', () => {
    const story = index(), part = story.parts[1], basis = partBases(story).get(part.id)!
    const draft = metadataSeed(part, 'part'); draft.form.details.summary = 'Written by hand.'
    const write = metadataPatch(draft, 'novel-details-part', basis)!
    expect(write.details).toMatchObject({ summary: 'Written by hand.', summaryBasis: ['scene-2@1', 'scene-3@1'] })
    // A pending write is read back only while it is exactly the patch of its own form; the tie it carries is part of that.
    for (const [kind, unit, pending] of [['part', part, write], ['chapter', story.chapters[0], null], ['novel', story, null]] as const) {
        const key = novelMutationKey('details', { userHash: 'details-author', workspaceId: 'work-one', storyId: story.id }, kind + ':' + unit.id)!
        const seed = metadataSeed(unit, kind); seed.form.details.summary = kind === 'chapter' ? null : 'Written by hand.'
        const today = kind === 'novel' ? summaryBases(story).book : kind === 'chapter' ? summaryBases(story).chapters.get(unit.id)! : basis
        const checkpoint = { ...seed, pending: pending ?? metadataPatch(seed, 'novel-details-' + kind, today) }
        expect(writeNovelMutation(key, checkpoint)).toBe(true)
        expect(readMetadataJournal(key, kind, unit.id)?.write.pending).toEqual(checkpoint.pending)
    }
    localStorage.clear()
})
