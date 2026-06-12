import { describe, expect, it, vi } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import type { InlineAIPhase } from '../types'
import { AiSuggestion, findAiSuggestionRange } from './aiSuggestion'
import { buildRevealPlan } from './revealPlan'

function createEditor(content: string, options: Partial<Parameters<typeof AiSuggestion.configure>[0]> = {}) {
    return new Editor({
        element: document.createElement('div'),
        extensions: [StarterKit, Markdown, AiSuggestion.configure(options)],
        content,
        contentType: 'markdown',
    })
}

function revealAll(editor: Editor, output: string, inlineFirstBlock = false) {
    const json = editor.markdown!.parse(output)
    const steps = buildRevealPlan(json, { inlineFirstBlock })
    editor.commands.aiBeginReveal()
    for (const step of steps) editor.commands.aiInsertStep(step)
    editor.commands.aiFinishReveal()
}

describe('AiSuggestion lifecycle', () => {
    it('reveals a continuation as marked text and accept strips the mark without markdown artifacts', () => {
        const phases: InlineAIPhase[] = []
        const editor = createEditor('The gate held.', { onPhaseChange: (phase) => phases.push(phase) })
        const end = editor.state.doc.content.size - 1

        editor.commands.aiStartPending(end)
        expect(editor.storage.aiSuggestionState.phase).toBe('pending')

        revealAll(editor, 'Then it broke.\n\nDust rose over the wall.')
        expect(editor.storage.aiSuggestionState.phase).toBe('reviewing')
        expect(findAiSuggestionRange(editor.state.doc)).not.toBeNull()

        editor.commands.aiAccept()
        expect(editor.storage.aiSuggestionState.phase).toBe('idle')
        expect(findAiSuggestionRange(editor.state.doc)).toBeNull()
        expect(editor.getMarkdown()).toBe('The gate held.\n\nThen it broke.\n\nDust rose over the wall.')
        expect(phases).toEqual(['pending', 'revealing', 'reviewing', 'idle'])
        editor.destroy()
    })

    it('reject removes the suggestion and leaves the original body untouched', () => {
        const editor = createEditor('The gate held.')
        const end = editor.state.doc.content.size - 1

        editor.commands.aiStartPending(end)
        revealAll(editor, 'Then it broke.')
        editor.commands.aiReject()

        expect(editor.storage.aiSuggestionState.phase).toBe('idle')
        expect(editor.getMarkdown()).toBe('The gate held.')
        expect(findAiSuggestionRange(editor.state.doc)).toBeNull()
        editor.destroy()
    })

    it('replace-range reveal restores the original selection on reject', () => {
        const editor = createEditor('The gate held strong.')
        // Select "held strong" (markdown == doc text here).
        const text = 'held strong'
        const docText = editor.state.doc.textBetween(0, editor.state.doc.content.size, ' ')
        const offset = docText.indexOf(text)
        const from = offset + 1
        const to = from + text.length

        editor.commands.aiStartPending(to, { from, to })
        revealAll(editor, 'shattered like glass', true)
        expect(editor.getMarkdown()).toBe('The gate shattered like glass.')

        editor.commands.aiReject()
        expect(editor.getMarkdown()).toBe('The gate held strong.')
        editor.destroy()
    })

    it('replace-range accept keeps the rewritten text', () => {
        const editor = createEditor('The gate held strong.')
        const docText = editor.state.doc.textBetween(0, editor.state.doc.content.size, ' ')
        const offset = docText.indexOf('held strong')
        const from = offset + 1
        const to = from + 'held strong'.length

        editor.commands.aiStartPending(to, { from, to })
        revealAll(editor, 'shattered like glass', true)
        editor.commands.aiAccept()

        expect(editor.getMarkdown()).toBe('The gate shattered like glass.')
        expect(findAiSuggestionRange(editor.state.doc)).toBeNull()
        editor.destroy()
    })

    it('fires onImplicitAccept when the user edits during review but not for AI transactions', () => {
        const onImplicitAccept = vi.fn()
        const editor = createEditor('The gate held.', { onImplicitAccept })
        const end = editor.state.doc.content.size - 1

        editor.commands.aiStartPending(end)
        revealAll(editor, 'Then it broke.')
        expect(onImplicitAccept).not.toHaveBeenCalled()

        editor.commands.insertContentAt(1, 'Hark! ')
        expect(onImplicitAccept).toHaveBeenCalledTimes(1)
        editor.destroy()
    })

    it('blocks generation entry points while a suggestion is active', () => {
        const editor = createEditor('The gate held.')
        const end = editor.state.doc.content.size - 1
        editor.commands.aiStartPending(end)
        revealAll(editor, 'Then it broke.')

        // A second pending cannot start while reviewing.
        expect(editor.commands.aiStartPending(end)).toBe(false)
        editor.destroy()
    })

    it('cancelling a pending request leaves the doc and phase clean', () => {
        const editor = createEditor('The gate held.')
        const end = editor.state.doc.content.size - 1
        editor.commands.aiStartPending(end)
        editor.commands.aiCancelPending()

        expect(editor.storage.aiSuggestionState.phase).toBe('idle')
        expect(editor.getMarkdown()).toBe('The gate held.')
        editor.destroy()
    })

    it('reveals headings and complex blocks with the mark applied', () => {
        const editor = createEditor('Intro.')
        const end = editor.state.doc.content.size - 1
        editor.commands.aiStartPending(end)
        revealAll(editor, '## The Fall\n\n> A quote of ash.\n\nProse after.')
        // trim: StarterKit's TrailingNode appends an empty paragraph after
        // non-paragraph blocks, which serializes as trailing whitespace.
        expect(editor.getMarkdown().trim()).toBe('Intro.\n\n## The Fall\n\n> A quote of ash.\n\nProse after.')

        editor.commands.aiReject()
        expect(editor.getMarkdown().trim()).toBe('Intro.')
        editor.destroy()
    })
})
