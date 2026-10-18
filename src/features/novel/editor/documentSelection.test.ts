import { afterEach, describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { documentText } from '@/shared/storyDocument'
import { captureDocument } from './manuscript'
import { Markdown } from '@tiptap/markdown'
import { editorCursorOffset, editorSelection } from './documentSelection'
let editor: Editor
function create(body: string) {
    editor = new Editor({ element: document.createElement('div'), extensions: [StarterKit, Markdown], content: body, contentType: 'markdown' })
    return editor
}
afterEach(() => editor?.destroy())
describe('revision snapshot position mapping', () => {
    it('maps the second equal passage without first-match search', () => {
        const e = create('He waited.\n\nHe waited.')
        e.commands.setTextSelection({ from: 13, to: 23 })
        const result = editorSelection(e)
        expect(result).toEqual({ startOffset: 12, endOffset: 22, text: 'He waited.' })
        expect(documentText(captureDocument(e)).slice(result!.startOffset, result!.endOffset)).toBe(result!.text)
    })
    it('preserves UTF-16 positions after astral and combining characters', () => {
        const e = create('🌙 écho cat')
        e.commands.setTextSelection({ from: 10, to: 13 })
        const result = editorSelection(e)
        expect(result?.text).toBe('cat')
        expect(documentText(captureDocument(e)).slice(result!.startOffset, result!.endOffset)).toBe('cat')
    })
    it('maps mid-paragraph cursor context and leaves the editor unchanged', () => {
        const e = create('Before. After.')
        const before = e.getJSON()
        const offset = editorCursorOffset(e, 8)
        expect(offset).toBe(7)
        expect(documentText(captureDocument(e)).slice(0, offset!)).toBe('Before.')
        expect(e.getJSON()).toEqual(before)
    })
    it('does not count formatting delimiters in a rich-text selection',()=>{
        const e=create('**A gate** and a gate.')
        e.commands.setTextSelection({from:3,to:7})
        expect(editorSelection(e)).toEqual({startOffset:2,endOffset:6,text:'gate'})
    })
})
