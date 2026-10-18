import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { AiSuggestion } from '../extensions/aiSuggestion'
import { useInlineAI, type InlineAICallbacks } from './useInlineAI'
import type { StoryGeneration, StoryGenerationCommand, TextGenerationOptions } from '@/shared'

let editor: Editor
const source = 'The gate held.'
afterEach(() => editor?.destroy())
function setup() {
    editor = new Editor({ element: document.createElement('div'), extensions: [StarterKit, Markdown, AiSuggestion], content: source, contentType: 'markdown' })
    let options: TextGenerationOptions | undefined
    let complete!: (result: StoryGeneration) => void
    const callbacks: InlineAICallbacks = {
        onRequestSaveFlush: vi.fn(async () => true),
        onGenerate: vi.fn((_request, nextOptions) => { options = nextOptions; return new Promise<StoryGeneration>((resolve) => { complete = resolve }) }),
        onAcceptGeneration: vi.fn(async () => {}), onDiscardGeneration: vi.fn(async () => {}),
        onCritiqueResult: vi.fn(), onCritiquePreview: vi.fn(),
    }
    const hook = renderHook(() => useInlineAI(editor, callbacks))
    return { ...hook, callbacks, options: () => options, complete: (command: StoryGenerationCommand) => complete({ id: 'saved-1', chapterId: 'chapter-1', command, status: 'candidate', output: 'The gate opened.' } as StoryGeneration) }
}

describe('inline live generation', () => {
    it('remaps a replacement target after edits made while the save flush is pending', async () => {
        const test = setup()
        let saved!: (value: boolean) => void
        vi.mocked(test.callbacks.onRequestSaveFlush).mockImplementationOnce(() => new Promise((resolve) => { saved = resolve }))
        let pending!: Promise<void>
        act(() => { pending = test.result.current.submit('rewrite', undefined, {
            replaceRange: { from: 1, to: source.length + 1 },
            selection: { startOffset: 0, endOffset: source.length, text: source },
        }) })
        act(() => { editor.commands.insertContentAt(1, 'Before '); saved(true) })
        await waitFor(() => expect(test.callbacks.onGenerate).toHaveBeenCalled())
        expect(test.callbacks.onGenerate).toHaveBeenCalledWith(expect.objectContaining({
            selection: { startOffset: 7, endOffset: 7 + source.length, text: source },
            cursorOffset: 7 + source.length,
        }), expect.any(Object))
        act(() => test.complete('rewrite'))
        await act(async () => { await pending })
    })
    it.each<StoryGenerationCommand>(['continue', 'rewrite', 'expand', 'condense', 'custom', 'describe', 'critique'])('%s previews stay outside the manuscript until the saved result', async (command) => {
        const test = setup()
        const replaces = ['rewrite', 'expand', 'condense', 'custom'].includes(command)
        let pending!: Promise<void>
        act(() => { pending = test.result.current.submit(command, 'Open the gate', {
            anchorPos: editor.state.doc.content.size - 1,
            ...(replaces ? { replaceRange: { from: 1, to: source.length + 1 }, selection: { startOffset: 0, endOffset: source.length, text: source } } : {}),
        }) })
        await waitFor(() => expect(test.options()?.signal).toBeDefined())
        act(() => test.options()?.onEvent?.({ type: 'delta', delta: 'The gate ', request_id: 'req-1' }))
        if (command === 'critique') await waitFor(() => expect(test.callbacks.onCritiquePreview).toHaveBeenCalledWith('The gate ', 'generating'))
        else await waitFor(() => expect(test.result.current.rowMeta.preview).toBe('The gate '))
        expect(editor.getMarkdown()).toBe(source)
        expect(editor.storage.aiSuggestionState.phase).toBe('pending')
        act(() => test.complete(command))
        await act(async () => { await pending })
        if (command === 'critique') {
            expect(editor.getMarkdown()).toBe(source)
            expect(test.callbacks.onCritiqueResult).toHaveBeenCalledWith(expect.objectContaining({ id: 'saved-1' }))
        } else {
            expect(editor.storage.aiSuggestionState.phase).toBe('reviewing')
            expect(editor.getMarkdown()).toBe(source)
            await act(async () => { await test.result.current.reject() })
            expect(editor.getMarkdown()).toBe(source)
        }
    })

    it('Escape aborts the request and drops a late candidate', async () => {
        const test = setup()
        let pending!: Promise<void>
        act(() => { pending = test.result.current.submit('continue') })
        await waitFor(() => expect(test.options()?.signal).toBeDefined())
        act(() => test.result.current.abortPending())
        expect(test.options()?.signal?.aborted).toBe(true)
        act(() => test.options()?.onEvent?.({ type: 'delta', delta: 'Too late', request_id: 'req-1' }))
        act(() => test.complete('continue'))
        await act(async () => { await pending })
        expect(editor.getMarkdown()).toBe(source)
        expect(test.result.current.rowMeta.preview).toBeUndefined()
        expect(test.callbacks.onDiscardGeneration).toHaveBeenCalledWith('saved-1')
    })
    it('acceptance uses the atomic commit callback and retains failed prose for retry', async () => {
        const test = setup()
        let pending!: Promise<void>
        act(() => { pending = test.result.current.submit('continue') })
        await waitFor(() => expect(test.options()?.signal).toBeDefined())
        act(() => test.complete('continue'))
        await act(async () => { await pending })
        vi.mocked(test.callbacks.onAcceptGeneration).mockRejectedValueOnce(new Error('Save failed; device draft retained'))
        await act(async () => { await test.result.current.accept() })
        expect(test.callbacks.onRequestSaveFlush).toHaveBeenCalledTimes(1)
        expect(test.callbacks.onAcceptGeneration).toHaveBeenCalledWith('saved-1')
        expect(editor.getMarkdown()).toContain('The gate opened.')
        expect(test.result.current.error).toContain('device draft retained')
        editor.commands.undo()
        expect(editor.getMarkdown()).toBe(source)
    })

    it('undo during pending cancels and fences late output', async () => {
        const test = setup()
        let pending!: Promise<void>
        act(() => { pending = test.result.current.submit('continue') })
        await waitFor(() => expect(test.options()?.signal).toBeDefined())
        await act(async () => { await test.result.current.reject() })
        expect(test.options()?.signal?.aborted).toBe(true)
        act(() => test.complete('continue'))
        await act(async () => { await pending })
        expect(editor.getMarkdown()).toBe(source)
        expect(editor.storage.aiSuggestionState.phase).toBe('idle')
    })

})
