import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import type { StoryGenerationChangeset, StoryGenerationChangesetWrite } from '@/shared'
import { documentText } from '@/shared/storyDocument'
import { novelAssistantReviewFixture } from '@/test/fixtures/novelAssistantReview'
import type { NovelAssistantSource } from './useNovelAssistantSource'
import { useSuggestionsTogether } from './useSuggestionsTogether'

function setup() {
    const fixture = novelAssistantReviewFixture(), first = fixture.record
    const second = structuredClone(first)
    second.result.proposal = { ...second.result.proposal!, id: 'gen-other-scene', sceneId: 'scene-other' }
    const generations = new Map([[first.result.proposal!.id, fixture.detail.generation],
        [second.result.proposal!.id, { ...fixture.detail.generation, id: 'gen-other-scene', sceneId: 'scene-other' }]])
    const saved = { revision: first.result.proposal!.baseRevision, contentHash: first.result.proposal!.baseContentHash, document: fixture.scene.document }
    const source = {
        key: 'owner', storyId: fixture.index.id, isCurrent: () => true,
        reviewCandidate: vi.fn(async (record: typeof first) => ({ index: fixture.index, detail: { ...fixture.detail, generation: generations.get(record.result.proposal!.id)! } })),
        sceneDocument: vi.fn(async () => saved),
        acceptTogether: vi.fn(async (write: StoryGenerationChangesetWrite): Promise<StoryGenerationChangeset> => ({ kind: 'generation_changeset', storyId: fixture.index.id,
            requestId: write.requestId, scenes: write.items.map((item) => ({ ...fixture.scene, id: item.sceneId, revision: item.expectedRevision + 1, document: item.document,
                generationId: item.generationId, baseRevision: item.expectedRevision })) })),
        recoverTogether: vi.fn(async () => null),
        undoTogether: vi.fn(async (changeset: StoryGenerationChangeset) => ({ kind: 'generation_changeset_undo' as const, storyId: changeset.storyId, changesetId: changeset.requestId,
            scenes: [changeset.scenes[0]], kept: [{ sceneId: 'scene-other', reason: 'edited' as const }] })),
    } as unknown as NovelAssistantSource
    const options = { source, readOnly: false, beforeWrite: vi.fn(async () => true), refresh: vi.fn(async () => undefined), onAccepted: vi.fn(), onBusy: vi.fn() }
    return { fixture, records: [first, second], source, options }
}

describe('useSuggestionsTogether', () => {
    it('saves the open scene first, then sends each scene’s saved text with its suggestion applied as one request', async () => {
        const { records, source, options, fixture } = setup()
        const { result } = renderHook(() => useSuggestionsTogether(options))
        await act(async () => { expect(await result.current.accept(records)).toBe(true) })
        expect(options.beforeWrite).toHaveBeenCalledBefore(source.acceptTogether as never)
        const write = vi.mocked(source.acceptTogether).mock.calls[0][0]
        expect(write.items.map((item) => [item.sceneId, item.generationId, item.expectedRevision])).toEqual([
            [fixture.record.result.proposal!.sceneId, fixture.record.result.proposal!.id, fixture.record.result.proposal!.baseRevision],
            ['scene-other', 'gen-other-scene', fixture.record.result.proposal!.baseRevision]])
        expect(documentText(write.items[0].document)).not.toBe(documentText(fixture.scene.document))
        expect(options.onAccepted).toHaveBeenCalledWith([fixture.record.result.proposal!.id, 'gen-other-scene'])
        expect(options.onBusy.mock.calls.map((call) => call[0])).toEqual([true, false])
        expect(result.current.changeset?.requestId).toBe(write.requestId)
        await act(async () => { expect(await result.current.undo()).toBe(true) })
        expect(result.current.undoResult?.kept).toEqual([{ sceneId: 'scene-other', reason: 'edited' }])
        expect(options.refresh).toHaveBeenCalledTimes(2)
    })
    it('changes nothing when the open scene cannot be saved or a suggestion changed, and retries a lost response as the same request', async () => {
        const { records, source, options } = setup()
        options.beforeWrite.mockResolvedValueOnce(false)
        const { result } = renderHook(() => useSuggestionsTogether(options))
        await act(async () => { expect(await result.current.accept(records)).toBe(false) })
        expect(result.current.failure).toBe('blocked'); expect(source.reviewCandidate).not.toHaveBeenCalled()
        vi.mocked(source.reviewCandidate).mockRejectedValueOnce(new ApiError(409, 'changed', { code: 'STORY_ASSISTANT_SOURCE_CHANGED' }))
        await act(async () => { expect(await result.current.accept(records)).toBe(false) })
        expect(result.current.failure).toBe('changed'); expect(source.acceptTogether).not.toHaveBeenCalled()
        vi.mocked(source.acceptTogether).mockRejectedValueOnce(new TypeError('network'))
        await act(async () => { expect(await result.current.accept(records)).toBe(false) })
        expect(result.current.failure).toBe('failed'); expect(result.current.canRetry).toBe(true)
        await act(async () => { expect(await result.current.retry()).toBe(true) })
        const [lost, retried] = vi.mocked(source.acceptTogether).mock.calls.map((call) => call[0])
        expect(retried).toBe(lost)
    })
})
