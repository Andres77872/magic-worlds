import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { SEARCH_PLUGIN_KEY, SearchReplace } from './searchReplace'

function makeEditor(content: string) {
    return new Editor({
        element: document.createElement('div'),
        extensions: [StarterKit, Markdown, SearchReplace],
        content,
        contentType: 'markdown',
    })
}

function search(editor: Editor) {
    const state = SEARCH_PLUGIN_KEY.getState(editor.state)
    if (!state) throw new Error('search state missing')
    return state
}

describe('SearchReplace', () => {
    it('counts every match of the query', () => {
        const editor = makeEditor('the cat sat on the mat with the hat')
        editor.commands.setSearchTerm('the', false)
        expect(search(editor).matches).toHaveLength(3)
        editor.destroy()
    })

    it('respects case sensitivity', () => {
        const editor = makeEditor('The the THE')
        editor.commands.setSearchTerm('the', true)
        expect(search(editor).matches).toHaveLength(1)
        editor.destroy()
    })

    it('advances the active match with findNext', () => {
        const editor = makeEditor('foo foo foo')
        editor.commands.setSearchTerm('foo', false)
        expect(search(editor).activeIndex).toBe(0)
        editor.commands.findNext()
        expect(search(editor).activeIndex).toBe(1)
        editor.destroy()
    })

    it('replaces the active match and rescans', () => {
        const editor = makeEditor('foo bar foo')
        editor.commands.setSearchTerm('foo', false)
        editor.commands.replaceCurrent('baz')
        expect(editor.getText()).toBe('baz bar foo')
        expect(search(editor).matches).toHaveLength(1)
        editor.destroy()
    })

    it('replaces every match with replaceAll', () => {
        const editor = makeEditor('foo bar foo baz foo')
        editor.commands.setSearchTerm('foo', false)
        editor.commands.replaceAll('X')
        expect(editor.getText()).toBe('X bar X baz X')
        editor.destroy()
    })

    it('clears the search', () => {
        const editor = makeEditor('foo foo')
        editor.commands.setSearchTerm('foo', false)
        expect(search(editor).matches).toHaveLength(2)
        editor.commands.clearSearch()
        expect(search(editor).matches).toHaveLength(0)
        editor.destroy()
    })
})
