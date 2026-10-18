import { afterEach, describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { createCodexMention } from './extensions/codexMention'
import { buildDetectionMatchers, createDetection } from './extensions/detection'
import { referenceChoices, mentionChoices } from './referenceChoices'
import type { EditorCodexEntry } from './types'
import { createReferenceInspection } from './extensions/referenceInspection'
import { vi } from 'vitest'

const entries: EditorCodexEntry[] = [
    { id: 'keeper', label: 'Mira', kind: 'character', enabled: false, description: 'Lighthouse keeper', sourceId: 'keeper-source', sourceVersionId: 'keeper-v3', sourceVersionNumber: 3, aliases: ['Beacon'] },
    { id: 'physician', label: 'Mira', kind: 'character', enabled: true, description: 'Court physician', sourceId: 'physician-source', sourceVersionId: 'physician-v7', sourceVersionNumber: 7 },
]
const editors: Editor[] = []
function makeEditor() {
    const inspect = vi.fn()
    const matchers = buildDetectionMatchers(entries, [])
    const editor = new Editor({ element: document.createElement('div'), extensions: [StarterKit,
        createCodexMention(() => entries), createReferenceInspection(inspect),
        createDetection({ getMatchers: () => matchers, getPhase: () => 'idle', getLabels: () => ({ lore: () => '', codex: () => '' }), onOpenLore: vi.fn(), onOpenCodex: vi.fn(), onInspect: inspect }),
    ], content: { type: 'doc', content: [{ type: 'paragraph', content: [
        { type: 'codexMention', attrs: { id: 'retired-id', label: 'Old Mira' } }, { type: 'text', text: ' Mira waits.' },
    ] }] } })
    editors.push(editor)
    return { editor, inspect }
}
afterEach(() => { for (const editor of editors.splice(0)) editor.destroy() })
describe('manuscript reference inspection', () => {
    it('keeps the exact saved identity and old label when a pin is removed or renamed', () => {
        const { editor } = makeEditor(), before = editor.getJSON()
        editor.commands.setTextSelection(1)
        expect(referenceChoices(editor)).toEqual([{ key: 'codex:retired-id', id: 'retired-id', label: 'Old Mira', kind: 'saved' }])
        expect(editor.getJSON()).toEqual(before)
    })
    it('returns every equally named identity instead of choosing the first detected match', () => {
        const { editor } = makeEditor()
        expect(referenceChoices(editor, 4).map((item) => item.id)).toEqual(['keeper', 'physician'])
    })
    it('deduplicates repeated references across a selection without losing saved provenance', () => {
        const { editor } = makeEditor()
        editor.commands.selectAll()
        expect(referenceChoices(editor).map((item) => item.id)).toEqual(['retired-id', 'keeper', 'physician'])
    })
    it('opens by keyboard in a reader without a document edit', () => {
        const { editor, inspect } = makeEditor(), before = editor.getJSON()
        editor.setEditable(false)
        expect(editor.commands.keyboardShortcut('Alt-Enter')).toBe(true)
        expect(inspect).toHaveBeenCalledOnce()
        expect(editor.getJSON()).toEqual(before)
    })
    it('opens stored mention atoms by modified click and preserves ordinary caret clicks', () => {
        const { editor, inspect } = makeEditor(), node = editor.state.doc.nodeAt(1)!
        const click = (event: MouseEvent) => editor.view.someProp('handleClickOn', (handler) => handler(editor.view, 1, node, 1, event, true))
        expect(click(new MouseEvent('click'))).toBeUndefined()
        expect(inspect).not.toHaveBeenCalled()
        expect(click(new MouseEvent('click', { ctrlKey: true }))).toBe(true)
        expect(inspect).toHaveBeenCalledWith(1)
    })
    it('searches aliases, descriptions and provenance, and retains excluded candidates', () => {
        const { editor } = makeEditor()
        expect(mentionChoices(entries, editor.state.doc, 'Beacon').map((item) => item.id)).toEqual(['keeper'])
        expect(mentionChoices(entries, editor.state.doc, 'physician-source')[0].id).toBe('physician')
        expect(mentionChoices(entries, editor.state.doc, 'Lighthouse')[0].enabled).toBe(false)
        expect(mentionChoices(entries, editor.state.doc, '7')[0].id).toBe('physician')
        expect(mentionChoices([{ ...entries[0], removed: true }], editor.state.doc, '')).toEqual([])
    })
    it('ranks current manuscript references ahead of recent choices and keeps both duplicate names', () => {
        const { editor } = makeEditor()
        editor.commands.insertContent({ type: 'codexMention', attrs: { id: 'physician', label: 'Mira' } })
        expect(mentionChoices(entries, editor.state.doc, 'Mira', ['keeper']).map((item) => item.id)).toEqual(['physician', 'keeper'])
        expect(mentionChoices(entries, null, '', ['physician']).map((item) => item.id)).toEqual(['physician', 'keeper'])
    })
})
