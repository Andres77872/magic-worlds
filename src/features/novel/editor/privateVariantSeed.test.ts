import { afterEach, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { undoDepth } from '@tiptap/pm/history'
import { authorVariantFixture } from '@/test/fixtures/authorVariants'
import { identifyDocument, documentText } from '@/shared/storyDocument'
import type { AuthorVariantContext } from '../persistence/authorVariantJournal'
import { ManuscriptIdentity } from './extensions/manuscriptIdentity'
import { createCodexMention } from './extensions/codexMention'
import { captureDocument } from './manuscript'
import { privateVariantSeed } from './privateVariantSeed'
const editors: Editor[] = []
afterEach(() => { editors.forEach(editor => editor.destroy()); editors.length = 0 })
function setup(context: AuthorVariantContext) {
    const editor = new Editor({ element: document.createElement('div'), extensions: [StarterKit.configure({ trailingNode: false }), Markdown, ManuscriptIdentity, createCodexMention(() => [])], content: context.baseDocument.content })
    editors.push(editor); return editor
}
it('builds a separate whole-scene starting version without changing prose, history or block identities in the source editor', () => {
    const f = authorVariantFixture(), editor = setup(f.context), before = captureDocument(editor)
    const result = privateVariantSeed(editor, f.context)
    expect(documentText(result!)).toBe(f.generation.output)
    expect(captureDocument(editor)).toEqual(before); expect(undoDepth(editor.state)).toBe(0)
})
it.each(['rewrite', 'expand', 'condense', 'custom'] as const)('replaces only an exact %s passage and preserves surrounding rich text and saved mention IDs', command => {
    const context = authorVariantFixture().context
    context.baseDocument = identifyDocument({ type: 'doc', content: [{ type: 'paragraph', content: [
        { type: 'text', text: 'Before 🌙 letter after ', marks: [{ type: 'bold' }] }, { type: 'codexMention', attrs: { id: 'pin', label: 'Aria', mentionSuggestionChar: '@' } },
    ] }] })
    const text = documentText(context.baseDocument), at = text.indexOf('letter')
    context.parent.parent.command = command; context.parent.parent.output = '*reply*'
    context.inputRange = { startOffset: at, endOffset: at + 6, text: 'letter' }
    const editor = setup(context), before = captureDocument(editor)
    expect(before).toEqual(context.baseDocument)
    const result = privateVariantSeed(editor, context)!
    expect(documentText(result)).toBe('Before 🌙 reply after @Aria')
    expect(result.content.content![0].attrs!.nodeId).toBe(before.content.content![0].attrs!.nodeId)
    expect(result.content.content![0].content!.some(node => node.type === 'codexMention' && node.attrs?.id === 'pin')).toBe(true)
    expect(captureDocument(editor)).toEqual(before); expect(undoDepth(editor.state)).toBe(0)
})
it.each(['wrong_quote', 'surrogate_half', 'missing_point'])('keeps unverified %s targets explicit without widening or editing the original', kind => {
    const context = authorVariantFixture().context, text = documentText(context.baseDocument)
    context.parent.parent.command = kind === 'missing_point' ? 'describe' : 'rewrite'
    context.inputRange = kind === 'missing_point' ? null : { startOffset: 0, endOffset: 2, text: 'wrong' }
    if (kind === 'surrogate_half') { const at = text.indexOf('🌙'); context.inputRange = { startOffset: at + 1, endOffset: at + 2, text: text.slice(at + 1, at + 2) } }
    const editor = setup(context), before = captureDocument(editor)
    expect(privateVariantSeed(editor, context)).toBeNull(); expect(captureDocument(editor)).toEqual(before)
})
it('refuses to silently seed a source whose saved mention JSON changes when the editor adds a default',()=>{
    const context=authorVariantFixture().context
    context.baseDocument=identifyDocument({type:'doc',content:[{type:'paragraph',content:[{type:'codexMention',attrs:{id:'pin',label:'Aria'}}]}]})
    const editor=setup(context),before=captureDocument(editor)
    expect(before).not.toEqual(context.baseDocument)
    expect(privateVariantSeed(editor,context)).toBeNull()
    expect(captureDocument(editor)).toEqual(before);expect(undoDepth(editor.state)).toBe(0)
})
