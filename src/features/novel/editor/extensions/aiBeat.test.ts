import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { AiBeat, decodeBeatPrompt, encodeBeatPrompt } from './aiBeat'
import { AiSuggestion } from './aiSuggestion'

function createEditor(content = '') {
    return new Editor({
        element: document.createElement('div'),
        extensions: [StarterKit, Markdown, AiBeat, AiSuggestion.configure({})],
        content,
        contentType: 'markdown',
    })
}

function insert(editor: Editor, output: string, prompt?: string, inline = false) {
    return editor.commands.aiInsertGeneration(editor.markdown!.parse(output), { inline, prompt })
}

describe('beat prompt encoding', () => {
    it('round-trips the awkward characters a free-text prompt can hold', () => {
        for (const prompt of [
            'she follows him to the saltworks',
            'two lines\nof instruction',
            'do not stop --> keep going',
            'a backslash \\ and a \\n that is literal',
        ]) {
            expect(decodeBeatPrompt(encodeBeatPrompt(prompt))).toBe(prompt)
        }
    })

    it('never lets a prompt close the comment early', () => {
        expect(encodeBeatPrompt('stop --> here')).not.toContain('-->')
    })
})

describe('AiBeat in the manuscript', () => {
    it('leads the generated run, and survives accept in the saved markdown', () => {
        const editor = createEditor('The gate held.')
        editor.commands.aiStartPending(editor.state.doc.content.size - 1)
        insert(editor, 'Then it broke.', 'make the gate fail')
        editor.commands.aiAccept()

        const markdown = editor.getMarkdown()
        // The prompt is in the body that autosave persists — this is the whole
        // point: after accepting, the prose alone is not the record.
        expect(markdown).toContain('<!-- beat: make the gate fail -->')
        expect(markdown).toContain('Then it broke.')
        editor.destroy()
    })

    it('is taken away with the prose when the beat is declined', () => {
        const editor = createEditor('The gate held.')
        editor.commands.aiStartPending(editor.state.doc.content.size - 1)
        insert(editor, 'Then it broke.', 'make the gate fail')
        expect(editor.getMarkdown()).toContain('<!-- beat:')

        editor.commands.aiReject()

        expect(editor.getMarkdown()).toBe('The gate held.')
        editor.destroy()
    })

    it('is taken away by a regenerate, so only the surviving take leaves a note', () => {
        const editor = createEditor('The gate held.')
        editor.commands.aiStartPending(editor.state.doc.content.size - 1)
        insert(editor, 'Then it broke.', 'make the gate fail')
        editor.commands.aiRegenerate()

        expect(editor.getMarkdown()).toBe('The gate held.')
        editor.destroy()
    })

    it('adds no note for a command that had no prompt', () => {
        const editor = createEditor('The gate held.')
        editor.commands.aiStartPending(editor.state.doc.content.size - 1)
        insert(editor, 'Then it broke.')
        editor.commands.aiAccept()

        expect(editor.getMarkdown()).not.toContain('<!-- beat:')
        editor.destroy()
    })

    it('reads back from a stored chapter body', () => {
        const editor = createEditor('The gate held.\n\n<!-- beat: make the gate fail -->\n\nThen it broke.')

        const beats: string[] = []
        editor.state.doc.descendants((node) => {
            if (node.type.name === 'aiBeat') beats.push(String(node.attrs.prompt))
            return true
        })

        expect(beats).toEqual(['make the gate fail'])
        // And it goes back out the way it came in, so a reload is not lossy.
        expect(editor.getMarkdown()).toContain('<!-- beat: make the gate fail -->')
        editor.destroy()
    })

    it('survives a body that never had a beat in it', () => {
        const editor = createEditor('Just prose.\n\n<!-- an unrelated comment -->')
        expect(editor.getMarkdown()).toContain('Just prose.')
        editor.destroy()
    })
})
