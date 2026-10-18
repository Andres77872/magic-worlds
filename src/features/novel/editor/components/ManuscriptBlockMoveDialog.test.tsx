import { act, fireEvent, render, screen } from '@testing-library/react'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { identifyDocument } from '@/shared/storyDocument'
import { ManuscriptIdentity } from '../extensions/manuscriptIdentity'
import { captureBlockMove } from '../blockMovement'
import { ManuscriptBlockMoveDialog } from './ManuscriptBlockMoveDialog'
const editors: Editor[] = []
function setup() {
    const editor = new Editor({ element: document.createElement('div'), editorProps: { handleScrollToSelection: () => true }, extensions: [StarterKit, ManuscriptIdentity], content: identifyDocument({ type: 'doc', content: ['First', 'Second', 'Third'].map((text, index) => ({ type: 'paragraph', attrs: { nodeId: `p-${index}` }, content: [{ type: 'text', text }] })) }).content })
    editor.commands.setTextSelection(editor.state.doc.firstChild!.nodeSize + 1); editors.push(editor)
    return { editor, target: captureBlockMove(editor)! }
}
afterEach(() => editors.splice(0).forEach((editor) => editor.destroy()))
describe('ManuscriptBlockMoveDialog', () => {
    it('shows the whole block and attachment implications, then offers a click alternative to dragging', () => {
        const { editor, target } = setup(), moved = vi.fn(), close = vi.fn()
        render(<ManuscriptBlockMoveDialog target={target} blocked={false} canWrite={() => true} onMoved={moved} onClose={close} />)
        expect(screen.getByText(/Notes spanning a changed block boundary/)).toBeInTheDocument()
        expect(screen.getByText(/2 · Paragraph · Second/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Move up' }))
        expect(editor.state.doc.firstChild!.attrs.nodeId).toBe('p-1')
        expect(moved).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce()
    })
    it('retains its preview and disables commits when the document or selection changes', () => {
        const { editor, target } = setup(), moved = vi.fn()
        render(<ManuscriptBlockMoveDialog target={target} blocked={false} canWrite={() => true} onMoved={moved} onClose={vi.fn()} />)
        act(() => { editor.commands.setTextSelection(1) })
        expect(screen.getByRole('button', { name: 'Move blocks' })).toBeDisabled()
        expect(screen.getByRole('status')).toHaveTextContent('The document or selection changed.')
        expect(screen.getByText(/2 · Paragraph · Second/)).toBeInTheDocument()
        expect(moved).not.toHaveBeenCalled()
    })
    it('checks a late review/reader guard before any transaction', () => {
        const { editor, target } = setup(), before = editor.getJSON(); let allowed = true
        render(<ManuscriptBlockMoveDialog target={target} blocked={false} canWrite={() => allowed} onMoved={vi.fn()} onClose={vi.fn()} />)
        allowed = false; fireEvent.click(screen.getByRole('button', { name: 'Move down' }))
        expect(editor.getJSON()).toEqual(before)
        expect(screen.getByRole('alert')).toHaveTextContent('Finish the current AI review')
    })
})
