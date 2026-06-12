import { describe, expect, it } from 'vitest'
import { Editor, type JSONContent } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import type { EditorCodexEntry } from '../types'
import { CODEX_MENTION_NAME, createCodexMention } from './codexMention'

const ENTRIES: EditorCodexEntry[] = [
    { id: 'ref-1', label: 'Aria', kind: 'character', enabled: true },
    { id: 'ref-2', label: 'Aria the Red', kind: 'character', enabled: true },
    { id: 'ref-3', label: 'Eldoria', kind: 'world', enabled: true },
]

function createEditor(content = '') {
    return new Editor({
        element: document.createElement('div'),
        extensions: [StarterKit, Markdown, createCodexMention(() => ENTRIES)],
        content,
        contentType: 'markdown',
    })
}

function findMentions(doc: JSONContent): JSONContent[] {
    const found: JSONContent[] = []
    const walk = (node: JSONContent) => {
        if (node.type === CODEX_MENTION_NAME) found.push(node)
        node.content?.forEach(walk)
    }
    walk(doc)
    return found
}

describe('createCodexMention markdown round-trip', () => {
    it('parses @Name into a mention node when the codex knows the name', () => {
        const editor = createEditor('Hello @Aria today.')
        const mentions = findMentions(editor.getJSON())
        expect(mentions).toHaveLength(1)
        expect(mentions[0].attrs).toMatchObject({ id: 'ref-1', label: 'Aria' })
        editor.destroy()
    })

    it('prefers the longest matching label', () => {
        const editor = createEditor('Hail @Aria the Red.')
        const mentions = findMentions(editor.getJSON())
        expect(mentions).toHaveLength(1)
        expect(mentions[0].attrs).toMatchObject({ id: 'ref-2', label: 'Aria the Red' })
        editor.destroy()
    })

    it('matches case-insensitively and respects word boundaries', () => {
        const matched = createEditor('Walking through @eldoria.')
        expect(findMentions(matched.getJSON())).toHaveLength(1)
        matched.destroy()

        const partial = createEditor('The @Ariadne thread.')
        expect(findMentions(partial.getJSON())).toHaveLength(0)
        partial.destroy()
    })

    it('leaves unknown names as plain text', () => {
        const editor = createEditor('Hello @Stranger.')
        expect(findMentions(editor.getJSON())).toHaveLength(0)
        expect(editor.getMarkdown()).toContain('@Stranger')
        editor.destroy()
    })

    it('serializes mention nodes back to plain @Name markdown', () => {
        const editor = createEditor('Hello @Aria today.')
        expect(editor.getMarkdown()).toBe('Hello @Aria today.')
        editor.destroy()
    })

    it('round-trips an inserted mention node', () => {
        const editor = createEditor('Start ')
        editor.commands.insertContent({ type: CODEX_MENTION_NAME, attrs: { id: 'ref-3', label: 'Eldoria' } })
        expect(editor.getMarkdown()).toContain('@Eldoria')
        editor.destroy()
    })
})
