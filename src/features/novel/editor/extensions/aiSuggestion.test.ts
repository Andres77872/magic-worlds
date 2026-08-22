import { describe, expect, it, vi } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import type { InlineAIPhase } from '../types'
import { AiSuggestion, findAiSuggestionRange } from './aiSuggestion'

function createEditor(content: string, options: Partial<Parameters<typeof AiSuggestion.configure>[0]> = {}) {
    return new Editor({
        element: document.createElement('div'),
        extensions: [StarterKit, Markdown, AiSuggestion.configure(options)],
        content,
        contentType: 'markdown',
    })
}

/** The whole generation, one transaction — there is no reveal to step through. */
function insert(editor: Editor, output: string, inline = false) {
    return editor.commands.aiInsertGeneration(editor.markdown!.parse(output), { inline })
}

/** Select `text` in a single-paragraph doc and return its document range. */
function rangeOf(editor: Editor, text: string) {
    const docText = editor.state.doc.textBetween(0, editor.state.doc.content.size, ' ')
    const from = docText.indexOf(text) + 1
    return { from, to: from + text.length }
}

describe('AiSuggestion lifecycle', () => {
    it('lands a continuation as marked text and accept strips the mark without markdown artifacts', () => {
        const phases: InlineAIPhase[] = []
        const editor = createEditor('The gate held.', { onPhaseChange: (phase) => phases.push(phase) })
        const end = editor.state.doc.content.size - 1

        editor.commands.aiStartPending(end)
        expect(editor.storage.aiSuggestionState.phase).toBe('pending')

        insert(editor, 'Then it broke.\n\nDust rose over the wall.')
        expect(editor.storage.aiSuggestionState.phase).toBe('reviewing')
        expect(findAiSuggestionRange(editor.state.doc)).not.toBeNull()

        editor.commands.aiAccept()
        expect(editor.storage.aiSuggestionState.phase).toBe('idle')
        expect(findAiSuggestionRange(editor.state.doc)).toBeNull()
        expect(editor.getMarkdown()).toBe('The gate held.\n\nThen it broke.\n\nDust rose over the wall.')
        // No 'revealing': the generation arrives in one transaction.
        expect(phases).toEqual(['pending', 'reviewing', 'idle'])
        editor.destroy()
    })

    it('the whole generation is a single history event, so one undo removes it', () => {
        const editor = createEditor('The gate held.')
        const end = editor.state.doc.content.size - 1

        editor.commands.aiStartPending(end)
        insert(editor, 'Then it broke.\n\nDust rose over the wall.')
        editor.commands.aiAccept()
        expect(editor.getMarkdown()).toBe('The gate held.\n\nThen it broke.\n\nDust rose over the wall.')

        editor.commands.undo()
        expect(editor.getMarkdown()).toBe('The gate held.')
        editor.destroy()
    })

    it('decline removes the generation and leaves the original body untouched', () => {
        const editor = createEditor('The gate held.')
        const end = editor.state.doc.content.size - 1

        editor.commands.aiStartPending(end)
        insert(editor, 'Then it broke.')
        editor.commands.aiReject()

        expect(editor.storage.aiSuggestionState.phase).toBe('idle')
        expect(editor.getMarkdown()).toBe('The gate held.')
        expect(findAiSuggestionRange(editor.state.doc)).toBeNull()
        editor.destroy()
    })

    it('replace-range generation flows inline and decline restores the original selection', () => {
        const editor = createEditor('The gate held strong.')
        const { from, to } = rangeOf(editor, 'held strong')

        editor.commands.aiStartPending(to, { from, to })
        insert(editor, 'shattered like glass', true)
        expect(editor.getMarkdown()).toBe('The gate shattered like glass.')

        editor.commands.aiReject()
        expect(editor.getMarkdown()).toBe('The gate held strong.')
        editor.destroy()
    })

    it('replace-range accept keeps the rewritten text', () => {
        const editor = createEditor('The gate held strong.')
        const { from, to } = rangeOf(editor, 'held strong')

        editor.commands.aiStartPending(to, { from, to })
        insert(editor, 'shattered like glass', true)
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
        insert(editor, 'Then it broke.')
        expect(onImplicitAccept).not.toHaveBeenCalled()

        editor.commands.insertContentAt(1, 'Hark! ')
        expect(onImplicitAccept).toHaveBeenCalledTimes(1)
        editor.destroy()
    })

    it('blocks generation entry points while a suggestion is active', () => {
        const editor = createEditor('The gate held.')
        const end = editor.state.doc.content.size - 1
        editor.commands.aiStartPending(end)
        insert(editor, 'Then it broke.')

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

    it('lands headings and complex blocks with the mark applied', () => {
        const editor = createEditor('Intro.')
        const end = editor.state.doc.content.size - 1
        editor.commands.aiStartPending(end)
        insert(editor, '## The Fall\n\n> A quote of ash.\n\nProse after.')
        // trim: StarterKit's TrailingNode appends an empty paragraph after
        // non-paragraph blocks, which serializes as trailing whitespace.
        expect(editor.getMarkdown().trim()).toBe('Intro.\n\n## The Fall\n\n> A quote of ash.\n\nProse after.')

        editor.commands.aiReject()
        // Exact, not trimmed: the tracked range takes the block split and the
        // trailing node with it.
        expect(editor.getMarkdown()).toBe('Intro.')
        editor.destroy()
    })
})

describe('AiSuggestion undo safety', () => {
    it('declining a rewrite leaves the undo history exactly as it was', () => {
        const editor = createEditor('The gate held strong.')
        // A writer edit first, so there is something real to undo afterwards.
        editor.commands.insertContentAt(editor.state.doc.content.size - 1, ' Dust rose.')
        expect(editor.getMarkdown()).toBe('The gate held strong. Dust rose.')

        const { from, to } = rangeOf(editor, 'held strong')
        editor.commands.aiStartPending(to, { from, to })
        insert(editor, 'shattered like glass', true)
        editor.commands.aiReject()
        expect(editor.getMarkdown()).toBe('The gate held strong. Dust rose.')

        // The declined take must not be resurrected, doubled, or left half-applied.
        editor.commands.undo()
        expect(editor.getMarkdown()).toBe('The gate held strong.')
        editor.destroy()
    })

    it('accepting a rewrite after regenerating does not duplicate the replaced passage', () => {
        const editor = createEditor('The gate held strong.')
        const { from, to } = rangeOf(editor, 'held strong')

        editor.commands.aiStartPending(to, { from, to })
        insert(editor, 'shattered like glass', true)
        editor.commands.aiRegenerate()
        insert(editor, 'cracked', true)
        editor.commands.aiAccept()
        expect(editor.getMarkdown()).toBe('The gate cracked.')

        // Whatever undo does here, it must never invent a second copy of the
        // writer's own words.
        editor.commands.undo()
        editor.commands.undo()
        expect(editor.getMarkdown()).not.toContain('held strongheld strong')
        editor.destroy()
    })

    it('declining a generation that ends in a rule removes the rule too', () => {
        const editor = createEditor('Intro.')
        const end = editor.state.doc.content.size - 1

        editor.commands.aiStartPending(end)
        insert(editor, 'The scene closes.\n\n---')
        editor.commands.aiReject()

        // No trim(): residue left behind by a short-measured range shows up here.
        expect(editor.getMarkdown()).toBe('Intro.')
        editor.destroy()
    })

    it('declining a generation that ends in a list removes the list too', () => {
        const editor = createEditor('Intro.')
        const end = editor.state.doc.content.size - 1

        editor.commands.aiStartPending(end)
        insert(editor, 'Beats to hit:\n\n- the bell\n- the door')
        editor.commands.aiReject()

        expect(editor.getMarkdown()).toBe('Intro.')
        editor.destroy()
    })
})

describe('AiSuggestion regenerate', () => {
    it('goes reviewing → pending without passing through idle', () => {
        const phases: InlineAIPhase[] = []
        const editor = createEditor('The gate held.', { onPhaseChange: (phase) => phases.push(phase) })
        const end = editor.state.doc.content.size - 1

        editor.commands.aiStartPending(end)
        insert(editor, 'Then it broke.')
        editor.commands.aiRegenerate()

        expect(editor.storage.aiSuggestionState.phase).toBe('pending')
        expect(phases).toEqual(['pending', 'reviewing', 'pending'])
        // The candidate is gone; the writer's own text is back.
        expect(editor.getMarkdown()).toBe('The gate held.')
        expect(findAiSuggestionRange(editor.state.doc)).toBeNull()
        editor.destroy()
    })

    it('re-arms the same replace range, so the second take can still be declined back to the original', () => {
        const editor = createEditor('The gate held strong.')
        const { from, to } = rangeOf(editor, 'held strong')

        editor.commands.aiStartPending(to, { from, to })
        insert(editor, 'shattered like glass', true)
        editor.commands.aiRegenerate()
        expect(editor.getMarkdown()).toBe('The gate held strong.')

        // The re-armed range means the replay lands in the same place…
        insert(editor, 'cracked', true)
        expect(editor.getMarkdown()).toBe('The gate cracked.')

        // …and the writer's own words are still what a decline restores.
        editor.commands.aiReject()
        expect(editor.getMarkdown()).toBe('The gate held strong.')
        editor.destroy()
    })

    it('repairs the block type when the generation opened with a heading', () => {
        const editor = createEditor('Intro.')
        const end = editor.state.doc.content.size - 1

        editor.commands.aiStartPending(end)
        insert(editor, '## The Fall\n\n> A quote of ash.')
        editor.commands.aiRegenerate()

        expect(editor.getMarkdown()).toBe('Intro.')
        expect(editor.storage.aiSuggestionState.phase).toBe('pending')
        editor.destroy()
    })

    it('is refused unless a generation is actually under review', () => {
        const editor = createEditor('The gate held.')
        expect(editor.commands.aiRegenerate()).toBe(false)
        editor.commands.aiStartPending(editor.state.doc.content.size - 1)
        expect(editor.commands.aiRegenerate()).toBe(false)
        editor.destroy()
    })
})
