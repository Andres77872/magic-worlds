import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { NodeSelection } from '@tiptap/pm/state'
import { afterEach, describe, expect, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { identifyDocument, documentText, documentMarkdown, isStoryDocument, normalizeEditorDocument } from '@/shared/storyDocument'
import type { StoryDocumentNode } from '@/shared'
import { capturePosition } from './manuscript'
import { ManuscriptIdentity } from './extensions/manuscriptIdentity'
import { createCodexMention } from './extensions/codexMention'
import { createBlockMovement } from './extensions/blockMovement'
import { AiBeat } from './extensions/aiBeat'
import { transactionAnchorEdits } from './anchorEdits'
import { applyStoryAnchorEdits } from '@/shared/storyAnchorEdits'
import { applyBlockMove, captureBlockMove, moveBlockAdjacent } from './blockMovement'

const editors: Editor[] = []
const p = (text: string, nodeId: string): StoryDocumentNode => ({ type: 'paragraph', attrs: { nodeId }, content: text ? [{ type: 'text', text }] : [] })
const richBlocks: StoryDocumentNode[] = [
    p('Repeated passage.', 'first'),
    { type: 'paragraph', attrs: { nodeId: 'traveller' }, content: [
        { type: 'text', text: '🌒 Mira ', marks: [{ type: 'bold' }, { type: 'italic' }] },
        { type: 'codexMention', attrs: { id: 'keeper-ref', label: 'Mira', mentionSuggestionChar: '@' } },
        { type: 'hardBreak' }, { type: 'text', text: 'Field notes', marks: [{ type: 'link', attrs: { href: 'https://example.com/notes', title: 'Original notes', target: '_blank', rel: 'noopener noreferrer nofollow', class: null } }] },
    ] },
    p('Repeated passage.', 'last'),
]
function setup(blocks = richBlocks) {
    const traces: Array<ReturnType<typeof transactionAnchorEdits>> = []
    const editor = new Editor({ element: globalThis.document.createElement('div'), extensions: [StarterKit.configure({ codeBlock: false, code: false, underline: false, trailingNode: false }), ManuscriptIdentity, AiBeat, createCodexMention(() => []), createBlockMovement(() => {})], content: identifyDocument({ type: 'doc', content: blocks }).content, editorProps: { handleScrollToSelection: () => true },
        onTransaction: ({ transaction, appendedTransactions }) => { if (transaction.docChanged) traces.push(transactionAnchorEdits([transaction, ...appendedTransactions])) },
    })
    editors.push(editor)
    const at = (id: string, offset = 0) => {
        let found = -1
        editor.state.doc.descendants((node, pos) => { if (node.attrs.nodeId === id) found = pos + 1 + offset })
        if (found < 0) throw new Error('Missing fixture block: ' + id)
        return found
    }
    const document = () => ({ schemaVersion: 1 as const, content: normalizeEditorDocument(editor.getJSON()) })
    return { editor, at, document, traces }
}
afterEach(() => { for (const editor of editors.splice(0)) editor.destroy() })
describe('canonical block movement', () => {
    it('moves rich nodes by identity, keeps reversed selection and exports actual move/undo/redo wire', () => {
        const { editor, at, document, traces } = setup()
        editor.commands.setTextSelection({ from: at('traveller', 7), to: at('traveller', 3) })
        const before = document(), point = capturePosition(editor), target = captureBlockMove(editor)!
        expect(target.selected.map((item) => item.id)).toEqual(['traveller'])
        expect(applyBlockMove(target, 'last', 'after', () => true)).toBe('moved')
        const moved = document(), moveEdits = traces[traces.length - 1]
        expect(moved.content.content!.map((node) => node.attrs!.nodeId)).toEqual(['first', 'last', 'traveller'])
        expect(moved.content.content![2]).toEqual(before.content.content![1])
        expect(capturePosition(editor)).toEqual(point)
        if (moveEdits) expect(applyStoryAnchorEdits(documentText(before), moveEdits)).toBe(documentText(moved))
        expect(editor.commands.undo()).toBe(true)
        const undone = document(), undoEdits = traces[traces.length - 1]
        expect(undone).toEqual(before); expect(capturePosition(editor)).toEqual(point)
        expect(editor.commands.redo()).toBe(true)
        const redone = document(), redoEdits = traces[traces.length - 1]
        expect(redone).toEqual(moved)
        for (const value of [before, moved, undone, redone]) expect(isStoryDocument(value)).toBe(true)
        if (process.env.NOVEL_BLOCK_MOVE_WIRE_OUT) writeFileSync(process.env.NOVEL_BLOCK_MOVE_WIRE_OUT, JSON.stringify({ before, moved, undone, redone, edits: { moved: moveEdits, undone: undoEdits, redone: redoEdits }, plain: { before: documentText(before), moved: documentText(moved) }, markdown: { before: documentMarkdown(before), moved: documentMarkdown(moved) } }), { mode: 0o600 })
    })
    it('moves the selected repeated paragraph instead of a textually equal neighbour', () => {
        const { editor, at } = setup()
        editor.commands.setTextSelection(at('last', 5))
        expect(applyBlockMove(captureBlockMove(editor)!, 'first', 'before', () => true)).toBe('moved')
        expect(editor.state.doc.firstChild!.attrs.nodeId).toBe('last')
        expect(capturePosition(editor)?.anchor).toEqual({ nodeId: 'last', offset: 5 })
    })
    it('keeps a multi-block selection and its endpoint blocks together', () => {
        const { editor, at, document } = setup([p('A', 'a'), p('B', 'b'), p('C', 'c'), p('D', 'd')])
        editor.commands.setTextSelection({ from: at('c', 1), to: at('b') })
        const selected = capturePosition(editor), original = document()
        expect(applyBlockMove(captureBlockMove(editor)!, 'a', 'before', () => true)).toBe('moved')
        expect(document().content.content).toEqual([original.content.content![1], original.content.content![2], original.content.content![0], original.content.content![3]])
        expect(capturePosition(editor)).toEqual(selected)
    })
    it('moves whole list items with nested lists and retains ordered-list start values', () => {
        const { editor, at, document } = setup([{ type: 'orderedList', attrs: { nodeId: 'ordered', start: 5 }, content: [
            { type: 'listItem', attrs: { nodeId: 'item-a' }, content: [p('A', 'a'), { type: 'bulletList', attrs: { nodeId: 'nested' }, content: [{ type: 'listItem', attrs: { nodeId: 'nested-item' }, content: [p('Child', 'child')] }] }, p('Continuation', 'continuation')] },
            { type: 'listItem', attrs: { nodeId: 'item-b' }, content: [p('B', 'b')] },
        ] }])
        editor.commands.setTextSelection(at('continuation', 3))
        const before = document(), point = capturePosition(editor), target = captureBlockMove(editor)!
        expect(target.parentKind).toBe('orderedList'); expect(target.selected[0].id).toBe('item-a')
        expect(moveBlockAdjacent(target, 'down', () => true)).toBe('moved')
        expect(document().content.content![0].attrs!.start).toBe(5)
        expect(document().content.content![0].content).toEqual([...before.content.content![0].content!].reverse())
        expect(capturePosition(editor)).toEqual(point)
        expect(isStoryDocument(document())).toBe(true)
        const moved = document(); editor.commands.undo(); const undone = document(); expect(undone).toEqual(before)
        editor.commands.redo(); const redone = document(); expect(redone).toEqual(moved)
        if (process.env.NOVEL_BLOCK_MOVE_WIRE_OUT) writeFileSync('/tmp/novel-block-nested-wire.json', JSON.stringify({ before, moved, undone, redone }), { mode: 0o600 })
    })
    it('reorders inner list items without promoting their outer item or changing the surrounding document', () => {
        const { editor, at, document } = setup([{ type: 'bulletList', attrs: { nodeId: 'outer' }, content: [
            { type: 'listItem', attrs: { nodeId: 'outer-item' }, content: [p('Outer', 'outer-text'), { type: 'orderedList', attrs: { nodeId: 'inner', start: 3 }, content: [
                { type: 'listItem', attrs: { nodeId: 'inner-a' }, content: [p('A', 'a')] }, { type: 'listItem', attrs: { nodeId: 'inner-b' }, content: [p('B', 'b')] },
            ] }] },
        ] }])
        editor.commands.setTextSelection(at('a'))
        const target = captureBlockMove(editor)!
        expect(target.parentKind).toBe('orderedList'); expect(target.selected[0].id).toBe('inner-a')
        expect(moveBlockAdjacent(target, 'down', () => true)).toBe('moved')
        expect(document().content.content![0].content![0].attrs!.nodeId).toBe('outer-item')
        expect(document().content.content![0].content![0].content![1].content!.map((node) => node.attrs!.nodeId)).toEqual(['inner-b', 'inner-a'])
    })
    it('moves paragraphs within a quotation and whole selected containers within the scene', () => {
        const { editor, at, document } = setup([{ type: 'blockquote', attrs: { nodeId: 'quote' }, content: [p('A', 'a'), p('B', 'b')] }, p('After', 'after')])
        editor.commands.setTextSelection(at('b'))
        expect(captureBlockMove(editor)!.parentKind).toBe('blockquote')
        expect(moveBlockAdjacent(captureBlockMove(editor)!, 'up', () => true)).toBe('moved')
        editor.commands.setNodeSelection(0)
        expect(moveBlockAdjacent(captureBlockMove(editor)!, 'down', () => true)).toBe('moved')
        expect(document().content.content!.map((node) => node.attrs!.nodeId)).toEqual(['after', 'quote'])
        expect(editor.state.selection).toBeInstanceOf(NodeSelection)
        expect((editor.state.selection as NodeSelection).node.attrs.nodeId).toBe('quote')
    })
    it('retains an inline atom selection while its containing paragraph moves', () => {
        const { editor, at } = setup()
        editor.commands.setNodeSelection(at('traveller', 8))
        expect((editor.state.selection as NodeSelection).node.type.name).toBe('codexMention')
        expect(moveBlockAdjacent(captureBlockMove(editor)!, 'down', () => true)).toBe('moved')
        expect((editor.state.selection as NodeSelection).node.attrs.id).toBe('keeper-ref')
    })
    it('isolates moves from previous typing, later typing and successive moves in undo history', () => {
        const { editor, at, document } = setup([p('A', 'a'), p('B', 'b'), p('C', 'c')])
        editor.commands.setTextSelection(at('b', 1)); editor.commands.insertContent('x')
        const typed = document()
        expect(moveBlockAdjacent(captureBlockMove(editor)!, 'down', () => true)).toBe('moved')
        const moved = document(); editor.commands.insertContent('y')
        editor.commands.undo(); expect(document()).toEqual(moved)
        editor.commands.undo(); expect(document()).toEqual(typed)
        editor.commands.undo(); expect(documentText(document())).toBe('A\n\nB\n\nC')
        editor.commands.redo(); editor.commands.redo(); editor.commands.redo()
        expect(documentText(document())).toBe('A\n\nC\n\nBxy')
        const beforeRepeatedMoves = document()
        moveBlockAdjacent(captureBlockMove(editor)!, 'up', () => true)
        const firstMove = document()
        moveBlockAdjacent(captureBlockMove(editor)!, 'up', () => true)
        editor.commands.undo(); expect(document()).toEqual(firstMove)
        editor.commands.undo(); expect(document()).toEqual(beforeRepeatedMoves)
    })
    it('rejects stale documents, changed selections, readers, blocked reviews, foreign destinations and boundary no-ops', () => {
        const { editor, at, document } = setup()
        editor.commands.setTextSelection(at('traveller')); const target = captureBlockMove(editor)!, before = document()
        expect(applyBlockMove(target, 'missing', 'before', () => true)).toBe('invalid')
        expect(applyBlockMove(target, 'first', 'after', () => true)).toBe('boundary')
        expect(applyBlockMove(target, 'first', 'before', () => false)).toBe('blocked')
        editor.setEditable(false)
        expect(applyBlockMove(target, 'first', 'before', () => true)).toBe('blocked')
        editor.setEditable(true); editor.commands.setTextSelection(at('last'))
        expect(applyBlockMove(target, 'first', 'before', () => true)).toBe('stale')
        editor.commands.insertContent('changed'); const changed = document()
        expect(applyBlockMove(target, 'first', 'before', () => true)).toBe('stale')
        expect(document()).toEqual(changed); expect(before).not.toEqual(changed)
    })
    it('handles empty blocks, scene breaks and beat notes without inventing new identities', () => {
        const { editor, document } = setup([p('', 'empty'), { type: 'horizontalRule', attrs: { nodeId: 'break' } }, { type: 'aiBeat', attrs: { nodeId: 'beat', prompt: 'The gate opens.' } }, p('End', 'end')])
        editor.commands.setNodeSelection(editor.state.doc.firstChild!.nodeSize)
        const before = document()
        expect(applyBlockMove(captureBlockMove(editor)!, 'end', 'after', () => true)).toBe('moved')
        expect(document().content.content!.slice(-1)[0]).toEqual(before.content.content![1])
        expect(captureBlockMove(editor)!.next).toBeNull()
    })
    it('moves a selected range in a thousand-block scene without dropping or regenerating identities', () => {
        const { editor, at, document } = setup(Array.from({ length: 1000 }, (_, index) => p(`Passage ${index} 🌒`, `large-${index}`)))
        editor.commands.setTextSelection({ from: at('large-500', 2), to: at('large-699', 3) })
        const before = document(), point = capturePosition(editor)
        const started = performance.now()
        expect(applyBlockMove(captureBlockMove(editor)!, 'large-10', 'before', () => true)).toBe('moved')
        const elapsedMs = performance.now() - started
        const expected = [...before.content.content!]
        const moved = expected.splice(500, 200); expected.splice(10, 0, ...moved)
        expect(document().content.content).toEqual(expected)
        expect(capturePosition(editor)).toEqual(point)
        if (process.env.NOVEL_BLOCK_MOVE_WIRE_OUT) writeFileSync('/tmp/novel-block-move-size-check.json', JSON.stringify({ blocks: 1000, moved: 200, elapsedMs, identitiesPreserved: true }), { mode: 0o600 })
    })
    it('normalizes only the neutral native ordered-list default and refuses meaningful unsupported marker types', () => {
        const source = { type: 'doc', content: [{ type: 'orderedList', attrs: { nodeId: 'list', start: 5, type: null }, content: [{ type: 'listItem', attrs: { nodeId: 'item' }, content: [p('A', 'a')] }] }] }
        const normalized = identifyDocument(source)
        expect(source.content[0].attrs).toHaveProperty('type', null)
        expect(normalized.content.content![0].attrs).toEqual({ nodeId: 'list', start: 5 })
        expect(isStoryDocument(normalized)).toBe(true)
        expect(isStoryDocument(identifyDocument({ ...source, content: [{ ...source.content[0], attrs: { ...source.content[0].attrs, type: 'A' } }] }))).toBe(false)
    })
})
