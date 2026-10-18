import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { expect, it } from 'vitest'
import { AiBeat } from './extensions/aiBeat'
import { createCodexMention } from './extensions/codexMention'
import { ManuscriptIdentity } from './extensions/manuscriptIdentity'
import { captureDocument, documentMarkdown, documentRange, documentText, identifyDocument, splitCursor,capturePosition,restorePosition } from './manuscript'

const doc = identifyDocument({ type: 'doc', content: [
    { type: 'paragraph', content: [
        { type: 'text', text: 'A 🙂 gate ', marks: [{ type: 'bold' }] },
        { type: 'codexMention', attrs: { id: 'mira-2', label: 'Mira' } },
        { type: 'text', text: ' holds.' },
    ] },
    { type: 'aiBeat', attrs: { prompt: 'Open the gate next' } },
    { type: 'paragraph', content: [{ type: 'text', text: 'Map', marks: [{ type: 'link', attrs: { href: 'https://example.com/map' } }] }] },
] })
const makeEditor = () => new Editor({ element: document.createElement('div'), extensions: [StarterKit, Markdown, AiBeat, createCodexMention(() => []), ManuscriptIdentity], content: doc.content })

it('keeps stable same-name mention identities and exact rich JSON after reopen', () => {
    const first = makeEditor()
    const saved = captureDocument(first)
    const reopened = new Editor({ element: document.createElement('div'), extensions: [StarterKit, Markdown, AiBeat, createCodexMention(() => [{ id: 'mira-1', label: 'Mira', kind: 'character', enabled: true }]), ManuscriptIdentity], content: saved.content })
    expect(captureDocument(reopened)).toEqual(saved)
    expect(captureDocument(reopened).content.content?.[0].content?.[1].attrs?.id).toBe('mira-2')
    expect(documentText(saved)).not.toContain('Open the gate next')
    expect(documentMarkdown(saved)).toContain('[Map](https://example.com/map)')
    reopened.destroy(); first.destroy()
})
it('maps UTF-16 selections in the canonical text without formatting offsets', () => {
    const editor = makeEditor()
    expect(documentRange(editor, 3, 5)).toEqual({ startOffset: 2, endOffset: 4, text: '🙂' })
    editor.commands.setTextSelection(6)
    expect(splitCursor(editor)).toEqual({ nodeId: doc.content.content?.[0].attrs?.nodeId, offset: 5 })
    editor.destroy()
})
it('preserves old block IDs and assigns distinct IDs to inserted and pasted copies', () => {
    const editor = makeEditor()
    const original = captureDocument(editor).content.content?.[0].attrs?.nodeId
    editor.commands.insertContentAt(editor.state.doc.content.size, doc.content.content![0])
    const blocks = captureDocument(editor).content.content!
    expect(blocks[0].attrs?.nodeId).toBe(original)
    expect(blocks[blocks.length - 1].attrs?.nodeId).not.toBe(original)
    editor.destroy()
})

it('restores a backward selection using stable block positions',()=>{
    const editor=makeEditor()
    const nodeId=String(doc.content.content![0].attrs!.nodeId)
    restorePosition(editor,{anchor:{nodeId,offset:9},head:{nodeId,offset:2},scrollTop:30})
    expect(editor.state.selection.anchor).toBe(10)
    expect(editor.state.selection.head).toBe(3)
    expect(capturePosition(editor,30)).toEqual({anchor:{nodeId,offset:9},head:{nodeId,offset:2},scrollTop:30})
    editor.destroy()
})

it('rejects vanished blocks, partial mentions and surrogate halves without changing the current selection or document', () => {
    const editor = makeEditor()
    const nodeId = String(doc.content.content![0].attrs!.nodeId)
    editor.commands.setTextSelection(2)
    const before = editor.state.selection.toJSON()
    const document = editor.getJSON()
    for (const anchor of [{ nodeId: 'vanished-block', offset: 2 }, { nodeId, offset: 3 }, { nodeId, offset: 12 }]) {
        expect(restorePosition(editor, { anchor, head: { nodeId, offset: 0 }, scrollTop: 999 })).toBe(false)
        expect(editor.state.selection.toJSON()).toEqual(before)
        expect(editor.getJSON()).toEqual(document)
    }
    editor.destroy()
})
