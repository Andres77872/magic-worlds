import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { RefObject } from 'react'
import { novelAssistantReviewFixture } from '@/test/fixtures/novelAssistantReview'
import { manuscript, storyScene } from '@/test/fixtures/story'
import type { NovelEditorHandle } from '../editor/types'
import type { NovelAssistantSource } from './useNovelAssistantSource'
import { useStudioAssistantReview } from './useStudioAssistantReview'
import {ApiError} from '@/infrastructure/api'

function deferred<T>() { let resolve!: (value: T) => void; return { promise: new Promise<T>(done => { resolve = done }), resolve: (value: T) => resolve(value) } }
function setup() {
    const fixture = novelAssistantReviewFixture(), selected = deferred<boolean>()
    const origin = storyScene({ id: 'origin-scene', storyId: fixture.index.id, document: manuscript('Current author writing.') })
    let document = origin.document, token = {}, owned = true
    const editor = { getDocument: vi.fn(() => document), getInstanceToken: () => token, hasActiveSuggestion: vi.fn(() => false),
        reviewGeneration: vi.fn(() => true), focus: vi.fn() }
    const source: NovelAssistantSource = { key: 'author/workspace/book', storyId: fixture.index.id, isCurrent: () => owned,
        prepare: vi.fn(), preview: vi.fn(), getTurn: vi.fn(), turnState: vi.fn(), stopTurn: vi.fn(), generation: vi.fn(), stash: vi.fn(), sceneDocument: vi.fn(), acceptTogether: vi.fn(), recoverTogether: vi.fn(), undoTogether: vi.fn(),
        refinement: vi.fn(), refinementForGeneration:vi.fn(), refinementForVariant:vi.fn(), readRefinementSource:vi.fn(), reviewCandidate: vi.fn(async () => ({ index: fixture.index, detail: fixture.detail })) }
    let options: Parameters<typeof useStudioAssistantReview>[0] = { source, story: fixture.index, scene: origin, selectedUnit: origin.id,
        draft: { sceneId: origin.id, document: origin.document, saveState: 'saved', suspended: false, recovery: null, conflictServer: null, online: true, getRevision: () => 1 },
        editorRef: { current: editor } as unknown as RefObject<NovelEditorHandle | null>, readOnly: false, blocked: false, loadError: false,
        beforeReview: vi.fn(async () => true), selectScene: vi.fn(() => selected.promise), onStaged: vi.fn() }
    const view = renderHook(props => useStudioAssistantReview(props), { initialProps: options })
    const patch = (change: Partial<typeof options>) => { options = { ...options, ...change }; view.rerender(options) }
    function open(hydrated = true) {
        document = fixture.scene.document; token = {}
        patch({ scene: fixture.scene, selectedUnit: fixture.scene.id,
            ...(hydrated ? { draft: { ...options.draft, sceneId: fixture.scene.id, document, getRevision: () => fixture.scene.revision } } : {}) })
    }
    const hydrate = () => patch({ draft: { ...options.draft, sceneId: fixture.scene.id, document: fixture.scene.document } })
    return { ...fixture, ...view, editor, source, selected, patch, open, hydrate, options: () => options,
        retire: () => { owned = false }, edit: () => { document = manuscript('Changed while sources loaded.') } }
}

it('waits for the selected scene and draft, stages once, then returns focus to the manuscript', async () => {
    const test = setup(), controller = new AbortController()
    let pending!: Promise<boolean>
    act(() => { pending = test.result.current(test.record, controller.signal) })
    await waitFor(() => expect(test.options().selectScene).toHaveBeenCalledWith(test.scene.id, test.index, expect.any(AbortSignal)))
    act(() => { test.open(false); test.selected.resolve(true) })
    await waitFor(() => expect(test.source.reviewCandidate).toHaveBeenCalled())
    expect(test.editor.reviewGeneration).not.toHaveBeenCalled()
    act(() => test.hydrate())
    await waitFor(() => expect(test.editor.reviewGeneration).toHaveBeenCalledTimes(1))
    expect(await pending).toBe(true)
    expect(test.editor.reviewGeneration).toHaveBeenCalledWith({ generation: test.detail.generation, operation: test.record.result.proposal!.operation, document: test.scene.document })
    expect(test.options().onStaged).toHaveBeenCalledExactlyOnceWith(test.detail.generation, test.detail.chapterTitle + ' · ' + test.detail.sceneTitle)
    expect(test.editor.focus).toHaveBeenCalledOnce()
})

it('reports a source conflict to the saved-evidence inspector without navigation or staging',async()=>{
    const test=setup(),failure=new ApiError(409,'Saved context changed',{code:'STORY_ASSISTANT_SOURCE_CHANGED'})
    vi.mocked(test.source.reviewCandidate).mockRejectedValueOnce(failure)
    let pending!:Promise<boolean>
    act(()=>{pending=test.result.current(test.record,new AbortController().signal)})
    await expect(pending).rejects.toBe(failure)
    expect(test.options().selectScene).not.toHaveBeenCalled()
    expect(test.editor.reviewGeneration).not.toHaveBeenCalled()
})

it('rejects overlapping handoffs and aborts an unhydrated review when its inspector closes', async () => {
    const test = setup(), abort = new AbortController()
    let pending!: Promise<boolean>
    act(() => { pending = test.result.current(test.record, abort.signal) })
    expect(await test.result.current(test.record, new AbortController().signal)).toBe(false)
    await waitFor(() => expect(test.options().selectScene).toHaveBeenCalled())
    act(() => { test.open(false); test.selected.resolve(true) })
    act(() => abort.abort())
    expect(await pending).toBe(false)
    expect(vi.mocked(test.options().selectScene).mock.calls[0][2]?.aborted).toBe(true)
    act(() => test.hydrate())
    expect(test.editor.reviewGeneration).not.toHaveBeenCalled()
    expect(test.options().onStaged).not.toHaveBeenCalled()
})

it('does not navigate if the author edits while source checks are pending', async () => {
    const test = setup(), read = deferred<Awaited<ReturnType<NovelAssistantSource['reviewCandidate']>>>()
    vi.mocked(test.source.reviewCandidate).mockReturnValueOnce(read.promise)
    let pending!: Promise<boolean>
    act(() => { pending = test.result.current(test.record, new AbortController().signal) })
    await waitFor(() => expect(test.source.reviewCandidate).toHaveBeenCalled())
    test.edit();read.resolve({ index: test.index, detail: test.detail })
    expect(await pending).toBe(false)
    expect(test.options().selectScene).not.toHaveBeenCalled()
    expect(test.editor.reviewGeneration).not.toHaveBeenCalled()
})

it.each(['owner', 'unmount'])('fences late selection after %s changes', async change => {
    const test = setup()
    let pending!: Promise<boolean>
    act(() => { pending = test.result.current(test.record, new AbortController().signal) })
    await waitFor(() => expect(test.options().selectScene).toHaveBeenCalled())
    act(() => { if (change === 'unmount') test.unmount(); else { test.retire(); test.patch({ source: null, story: null }) } })
    test.selected.resolve(true)
    expect(await pending).toBe(false)
    expect(test.editor.reviewGeneration).not.toHaveBeenCalled()
    expect(test.options().onStaged).not.toHaveBeenCalled()
})

it.each(['read_only', 'pending_operation', 'offline', 'failed_flush'])('blocks %s before any candidate read', async change => {
    const test = setup()
    act(() => {
        if (change === 'read_only') test.patch({ readOnly: true })
        if (change === 'pending_operation') test.patch({ blocked: true })
        if (change === 'offline') test.patch({ draft: { ...test.options().draft, online: false } })
        if (change === 'failed_flush') vi.mocked(test.options().beforeReview).mockResolvedValueOnce(false)
    })
    let pending!: Promise<boolean>
    act(() => { pending = test.result.current(test.record, new AbortController().signal) })
    expect(await pending).toBe(false)
    expect(test.source.reviewCandidate).not.toHaveBeenCalled()
})

it.each(['revision', 'hash', 'active_suggestion', 'read_only', 'selection_changed', 'source_version', 'context'])('blocks a later %s before staging', async change => {
    const test = setup()
    let pending!: Promise<boolean>
    act(() => { pending = test.result.current(test.record, new AbortController().signal) })
    await waitFor(() => expect(test.options().selectScene).toHaveBeenCalled())
    act(() => {
        test.open()
        if (change === 'revision') test.patch({ draft: { ...test.options().draft, getRevision: () => 99 } })
        if (change === 'hash') test.patch({ scene: { ...test.scene, contentHash: '0'.repeat(64) } })
        if (change === 'active_suggestion') test.editor.hasActiveSuggestion.mockReturnValue(true)
        if (change === 'read_only') test.patch({ readOnly: true })
        if (change === 'selection_changed') test.patch({ selectedUnit: 'other-scene' })
        if (change === 'source_version') { const changed = structuredClone(test.index); changed.sourceVersion = '0'.repeat(64); test.patch({ story: changed }) }
        if (change === 'context') test.patch({ story: { ...test.index, contextRevision: test.index.contextRevision + 1 } })
        test.selected.resolve(true)
    })
    await waitFor(() => expect(test.editor.reviewGeneration).not.toHaveBeenCalled())
    expect(await pending).toBe(false)
    expect(test.options().onStaged).not.toHaveBeenCalled()
})
