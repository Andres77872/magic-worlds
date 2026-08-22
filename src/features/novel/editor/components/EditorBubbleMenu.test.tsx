import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Editor } from '@tiptap/core'
import type { InlineAIPhase } from '../types'
import { EditorBubbleMenu } from './EditorBubbleMenu'

// The real BubbleMenu positions itself against a live ProseMirror selection,
// which jsdom cannot produce. The toolbar's own contract — the trigger, the
// open flag and dismissal — is what is under test here.
vi.mock('@tiptap/react/menus', () => ({
    BubbleMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

function fakeEditor() {
    const chain = {
        focus: () => chain,
        toggleBold: () => chain,
        toggleItalic: () => chain,
        toggleStrike: () => chain,
        toggleBlockquote: () => chain,
        run: vi.fn(),
    }
    return { isActive: () => false, chain: () => chain } as unknown as Editor
}

function renderToolbar(phase: InlineAIPhase = 'idle') {
    const spies = { onSelectionCommand: vi.fn(), onBeatOnSelection: vi.fn(), onAddToCodex: vi.fn() }
    const view = render(<EditorBubbleMenu editor={fakeEditor()} phase={phase} {...spies} />)
    return { ...spies, rerender: (next: InlineAIPhase) => view.rerender(<EditorBubbleMenu editor={fakeEditor()} phase={next} {...spies} />) }
}

describe('EditorBubbleMenu', () => {
    it('keeps the AI menu closed until the trigger is used', () => {
        renderToolbar()

        expect(screen.queryByTestId('bubble-ai-menu')).not.toBeInTheDocument()
        fireEvent.click(screen.getByTestId('bubble-ai-trigger'))
        expect(screen.getByTestId('bubble-ai-menu')).toBeInTheDocument()
    })

    it('owns dismissal for the menu it renders — Escape and outside click', () => {
        renderToolbar()

        fireEvent.click(screen.getByTestId('bubble-ai-trigger'))
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(screen.queryByTestId('bubble-ai-menu')).not.toBeInTheDocument()

        fireEvent.click(screen.getByTestId('bubble-ai-trigger'))
        expect(screen.getByTestId('bubble-ai-menu')).toBeInTheDocument()
        fireEvent.mouseDown(document.body)
        expect(screen.queryByTestId('bubble-ai-menu')).not.toBeInTheDocument()
    })

    it('does not close on a click inside itself — the wrapper covers trigger and menu', () => {
        renderToolbar()

        fireEvent.click(screen.getByTestId('bubble-ai-trigger'))
        fireEvent.mouseDown(screen.getByTestId('bubble-ai-menu'))

        expect(screen.getByTestId('bubble-ai-menu')).toBeInTheDocument()
    })

    it('routes Beat and the canned verbs, closing behind each', () => {
        const spies = renderToolbar()

        fireEvent.click(screen.getByTestId('bubble-ai-trigger'))
        fireEvent.click(screen.getByRole('menuitem', { name: 'Beat' }))
        expect(spies.onBeatOnSelection).toHaveBeenCalledTimes(1)
        expect(screen.queryByTestId('bubble-ai-menu')).not.toBeInTheDocument()

        fireEvent.click(screen.getByTestId('bubble-ai-trigger'))
        fireEvent.click(screen.getByRole('menuitem', { name: 'Rewrite' }))
        expect(spies.onSelectionCommand).toHaveBeenCalledWith('rewrite')
        expect(screen.queryByTestId('bubble-ai-menu')).not.toBeInTheDocument()
    })

    it('drops the open flag when a generation starts, so the menu cannot come back on a moved selection', () => {
        const { rerender } = renderToolbar('idle')

        fireEvent.click(screen.getByTestId('bubble-ai-trigger'))
        expect(screen.getByTestId('bubble-ai-menu')).toBeInTheDocument()

        rerender('pending')
        expect(screen.queryByTestId('bubble-ai-menu')).not.toBeInTheDocument()
        expect(screen.getByTestId('bubble-ai-trigger')).toBeDisabled()

        rerender('idle')
        expect(screen.queryByTestId('bubble-ai-menu')).not.toBeInTheDocument()
    })

    it('never lets a control steal the live selection', () => {
        renderToolbar()

        const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
        screen.getByTestId('bubble-ai-trigger').dispatchEvent(event)

        expect(event.defaultPrevented).toBe(true)
    })
})
