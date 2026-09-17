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
            expect(editor.getMarkdown()).toContain('The gate opened.')
            if (replaces) expect(editor.getMarkdown()).not.toContain(source)
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
})
