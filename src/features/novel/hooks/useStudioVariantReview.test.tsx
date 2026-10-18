import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { RefObject } from 'react'
import { controlledAuthorVariants } from '@/test/fixtures/controlledAuthorVariants'
import { manuscript } from '@/test/fixtures/story'
import type { NovelEditorHandle } from '../editor/types'
import { useStudioVariantReview } from './useStudioVariantReview'

function setup() {
    const f = controlledAuthorVariants(), source = f.source
    let document = f.scene.document, token = {}
    const editor = { getDocument: vi.fn(() => document), getInstanceToken: () => token, hasActiveSuggestion: vi.fn(() => false),
        reviewGeneration: vi.fn(() => true), focus: vi.fn() }
    const options: Parameters<typeof useStudioVariantReview>[0] = { source, story: f.index, scene: f.scene, selectedUnit: f.scene.id,
        draft: { sceneId: f.scene.id, document, saveState: 'saved', suspended: false, recovery: null, conflictServer: null, online: true, getRevision: () => f.scene.revision },
        editorRef: { current: editor } as unknown as RefObject<NovelEditorHandle | null>, readOnly: false, blocked: false, loadError: false,
        beforeReview: vi.fn(async () => true), selectScene: vi.fn(async () => true), onStaged: vi.fn() }
    const view = renderHook(value => useStudioVariantReview(value), { initialProps: options })
    return { ...f, ...view, editor, options, edit: () => { document = manuscript('Later writing.') }, remountEditor: () => { token = {} } }
}
it('hands the complete immutable version to the existing editor decoration and returns focus without applying it', async () => {
    const test = setup(); let pending!: Promise<boolean>
    act(() => { pending = test.result.current(test.record, new AbortController().signal) })
    await waitFor(() => expect(test.editor.reviewGeneration).toHaveBeenCalledOnce())
    expect(await pending).toBe(true)
    expect(test.editor.reviewGeneration).toHaveBeenCalledWith({ generation: test.generation, operation: 'replace_scene', document: test.scene.document, variant: test.snapshot })
    expect(test.options.onStaged).toHaveBeenCalledOnce(); expect(test.editor.focus).toHaveBeenCalledOnce()
    expect(test.scene.document).toEqual(test.snapshot.baseDocument)
})
it.each(['typing', 'editor', 'abort', 'readOnly', 'owner'])('blocks a late %s handoff without staging or canonical edits', async kind => {
    const test = setup(); let finish!: (value: Awaited<ReturnType<typeof test.source.review>>) => void
    const original = test.source.review.bind(test.source)
    vi.spyOn(test.source, 'review').mockImplementationOnce(async (record, signal) => { const value = await original(record, signal); return new Promise(done => { finish = () => done(value) }) })
    const controller = new AbortController(); let pending!: Promise<boolean>
    act(() => { pending = test.result.current(test.record, controller.signal) })
    await waitFor(() => expect(finish).toBeDefined())
    if (kind === 'typing') test.edit()
    if (kind === 'editor') test.remountEditor()
    if (kind === 'abort') act(() => controller.abort())
    if (kind === 'readOnly') test.rerender({ ...test.options, readOnly: true })
    if (kind === 'owner') test.retire()
    await act(async () => { finish({} as never); expect(await pending).toBe(false) })
    expect(test.editor.reviewGeneration).not.toHaveBeenCalled(); expect(test.options.onStaged).not.toHaveBeenCalled()
})
it.each(['revision', 'hash', 'draft', 'offline', 'active_suggestion', 'blocked'])('refuses %s mismatch at the final editor boundary', async kind => {
    const test = setup(), options = { ...test.options, draft: { ...test.options.draft }, scene: { ...test.scene } }
    if (kind === 'revision') options.draft.getRevision = () => 99
    if (kind === 'hash') options.scene.contentHash = 'c'.repeat(64)
    if (kind === 'draft') options.draft.document = manuscript('Other local writing.')
    if (kind === 'offline') options.draft.online = false
    if (kind === 'active_suggestion') test.editor.hasActiveSuggestion.mockReturnValue(true)
    if (kind === 'blocked') options.blocked = true
    test.rerender(options); let pending!: Promise<boolean>
    await act(async () => { pending = test.result.current(test.record, new AbortController().signal) })
    expect(await pending).toBe(false); expect(test.editor.reviewGeneration).not.toHaveBeenCalled()
})
