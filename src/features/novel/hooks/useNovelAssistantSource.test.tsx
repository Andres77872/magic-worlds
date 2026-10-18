import { renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { ApiService } from '@/infrastructure/api'
import { novelAssistantReviewFixture } from '@/test/fixtures/novelAssistantReview'
import refined from '@/test/fixtures/novelAssistantRefinement.json'
import type {NovelAssistantTurnPreview,NovelRefinementContext,StoryAssistantContext} from '@/shared/types/storyAssistant.types'
import { useNovelAssistantSource } from './useNovelAssistantSource'

function setup() {
    const fixture = novelAssistantReviewFixture()
    let owned = true
    const api = { getStoryStudioIndex: vi.fn(async () => fixture.index), getStoryGenerationHistoryDetail: vi.fn(async () => fixture.detail), stashStoryGeneration: vi.fn(),
        previewNovelAssistantTurn:vi.fn<ApiService['previewNovelAssistantTurn']>(async()=>structuredClone(refined.preview) as unknown as NovelAssistantTurnPreview),getStoryRefinementParent:vi.fn(),getStoryRevision:vi.fn() }
    const source = { key: 'author/workspace/book', storyId: fixture.index.id, isCurrent: () => owned, prepare: vi.fn() }
    const workspace = { workspaceId: 'workspace', isCurrent: () => owned, detachedApi: () => api as unknown as ApiService }
    const view = renderHook(() => useNovelAssistantSource(source, workspace))
    return { ...fixture, ...view, api,source, retire: () => { owned = false } }
}

it('loads a history parent through the captured owner and forwards the saved current selection',async()=>{
    const test=setup(),parent=structuredClone(refined.parent) as unknown as NovelRefinementContext
    test.api.getStoryRefinementParent.mockResolvedValue(parent)
    const selection={sceneId:parent.parent.sceneId,expectedRevision:2,expectedContentHash:'a'.repeat(64),startOffset:0,endOffset:5,quote:'Other'},signal=new AbortController().signal
    expect(await test.result.current!.refinementForGeneration(test.detail.generation,signal,selection)).toEqual({refinement:parent,selection})
    expect(test.api.getStoryRefinementParent).toHaveBeenCalledWith(test.index.id,parent.parent.id,{signal})
    expect(test.api.getStoryRevision).not.toHaveBeenCalled()
    test.retire()
    expect(()=>test.result.current!.refinementForGeneration(test.detail.generation,signal,selection)).toThrow('Novel assistant scope changed')
})

it('reviews exact saved parent input while sending only its owned reference',async()=>{
    const test=setup(),context=refined.preview.context as unknown as StoryAssistantContext
    const parent=refined.parent as unknown as NovelRefinementContext,signal=new AbortController().signal
    test.source.prepare.mockResolvedValue(context)
    const result=await test.result.current!.preview(7,context.request,{mode:'inherit'},signal,parent)
    expect(result.refinement).toEqual(parent)
    expect(test.api.previewNovelAssistantTurn.mock.calls[0][2]).toMatchObject({refinement:{generationId:parent.parent.id,parentHash:parent.parentHash}})
    expect(test.api.previewNovelAssistantTurn.mock.calls[0][2]).not.toHaveProperty('parent')
})

it('rejects a preview that substitutes the displayed retained writing even with an unchanged reference',async()=>{
    const test=setup(),context=refined.preview.context as unknown as StoryAssistantContext
    test.source.prepare.mockResolvedValue(context)
    const altered=structuredClone(refined.parent) as unknown as NovelRefinementContext
    altered.parent.output+=' Unreviewed local change.'
    await expect(test.result.current!.preview(7,context.request,{mode:'inherit'},new AbortController().signal,altered))
        .rejects.toMatchObject({status:409,code:'NOVEL_REFINEMENT_PARENT_CHANGED'})
    expect(test.api.stashStoryGeneration).not.toHaveBeenCalled()
})

it.each(['candidate', 'stashed'] as const)('reads the exact owned %s before handing it to Studio', async status => {
    const test = setup(), signal = new AbortController().signal
    test.detail.generation.status = status
    expect(await test.result.current!.reviewCandidate(test.record, signal)).toEqual({ index: test.index, detail: test.detail })
    expect(test.api.getStoryStudioIndex).toHaveBeenCalledExactlyOnceWith(test.index.id, { signal })
    expect(test.api.getStoryGenerationHistoryDetail).toHaveBeenCalledExactlyOnceWith(test.index.id, test.record.result.proposal!.id, { signal })
    expect(test.api.stashStoryGeneration).not.toHaveBeenCalled()
})

it.each(['source', 'location', 'accepted', 'rejected', 'output', 'instruction', 'revision', 'scene', 'story', 'selection', 'read_only'])('blocks a changed %s read without a write', async change => {
    const test = setup(), generation = test.detail.generation
    if (change === 'source') test.index.sourceVersion = '0'.repeat(64)
    if (change === 'location') test.detail.location = 'archived'
    if (change === 'accepted' || change === 'rejected') generation.status = change
    if (change === 'output') generation.output += ' Altered'
    if (change === 'instruction') generation.instruction = 'Another instruction'
    if (change === 'revision') generation.baseRevision = 99
    if (change === 'scene') generation.sceneId = 'another-scene'
    if (change === 'story') generation.storyId = 'another-book'
    if (change === 'selection') generation.inputRange = null
    if (change === 'read_only') test.index.status = 'archived'
    await expect(test.result.current!.reviewCandidate(test.record, new AbortController().signal)).rejects.toMatchObject({ status: 409, code: ['source','read_only'].includes(change)?'STORY_ASSISTANT_SOURCE_CHANGED':'STORY_PROPOSAL_CONFLICT' })
    expect(test.api.stashStoryGeneration).not.toHaveBeenCalled()
})

it('fences an owner change after the reads and retains the original frozen record', async () => {
    const test = setup(), before = structuredClone(test.record)
    let finish!: () => void
    test.api.getStoryGenerationHistoryDetail.mockImplementationOnce(async () => {
        await new Promise<void>(resolve => { finish = resolve }); return test.detail
    })
    const pending = test.result.current!.reviewCandidate(test.record, new AbortController().signal)
    test.retire(); finish()
    await expect(pending).rejects.toThrow('Novel assistant scope changed')
    expect(test.record).toEqual(before)
})

it('fences a closed review even when a client resolves its reads after abort', async () => {
    const test = setup(), abort = new AbortController()
    const pending = test.result.current!.reviewCandidate(test.record, abort.signal)
    abort.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
})
