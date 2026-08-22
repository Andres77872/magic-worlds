import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { EditorView } from '@tiptap/pm/view'

// The editor opens detected lore/codex references in floating windows.
vi.mock('@/app/hooks', () => ({
    useFloatingWindows: () => ({ openWindow: vi.fn(), closeWindow: vi.fn(), closeAll: vi.fn(), focusWindow: vi.fn(), windows: [] }),
}))

import { NovelEditor } from './NovelEditor'
import type { NovelEditorProps } from './types'

const originalElementFromPoint = document.elementFromPoint

function props(overrides: Partial<NovelEditorProps> = {}): NovelEditorProps {
    return {
        initialBody: '',
        codexEntries: [],
        onBodyChange: vi.fn(),
        onRequestSaveFlush: vi.fn(async () => true),
        onGenerate: vi.fn(),
        onAcceptGeneration: vi.fn(async () => {}),
        onDiscardGeneration: vi.fn(async () => {}),
        onCritiqueResult: vi.fn(),
        ...overrides,
    }
}

describe('NovelEditor', () => {
    beforeAll(() => {
        document.elementFromPoint = vi.fn(() => document.body)
        // jsdom has no layout, and the beat composer refuses to open without
        // caret coordinates.
        vi.spyOn(EditorView.prototype, 'coordsAtPos').mockReturnValue({ left: 40, right: 42, top: 80, bottom: 98 })
    })

    afterAll(() => {
        document.elementFromPoint = originalElementFromPoint
        vi.restoreAllMocks()
    })

    afterEach(() => {
        window.localStorage.clear()
    })

    it('renders a single flex-filling manuscript surface', async () => {
        render(<NovelEditor {...props()} />)

        const shell = screen.getByTestId('novel-editor')
        expect(shell).toHaveClass('flex', 'flex-col')

        const prose = await screen.findByLabelText('Chapter body')
        expect(prose).toHaveClass('story-editor-prose')

        await waitFor(() => expect(prose.parentElement).toHaveClass('flex', 'min-h-0', 'flex-1', 'flex-col'))
    })
})

describe('NovelEditor keyboard ownership', () => {
    beforeAll(() => {
        document.elementFromPoint = vi.fn(() => document.body)
        vi.spyOn(EditorView.prototype, 'coordsAtPos').mockReturnValue({ left: 40, right: 42, top: 80, bottom: 98 })
    })

    afterAll(() => {
        document.elementFromPoint = originalElementFromPoint
        vi.restoreAllMocks()
    })

    async function openComposer() {
        render(<NovelEditor {...props({ initialBody: 'The gate held.' })} />)
        const shell = screen.getByTestId('novel-editor')
        fireEvent.keyDown(shell, { key: 'Enter', ctrlKey: true })
        return await screen.findByTestId('beat-instruction')
    }

    it('opens the beat composer at the caret with Mod-Enter', async () => {
        await openComposer()
        expect(screen.getByTestId('beat-composer')).toBeInTheDocument()
    })

    it('does not re-open (and wipe) itself when Mod-Enter fires from its own controls', async () => {
        const textarea = await openComposer()
        fireEvent.change(textarea, { target: { value: 'she follows him' } })
        expect(textarea).toHaveValue('she follows him')

        // The composer lives inside the scrollport, so its controls bubble to
        // the shell's shortcut handler.
        fireEvent.keyDown(screen.getByTestId('beat-options-toggle'), { key: 'Enter', ctrlKey: true, bubbles: true })

        expect(screen.getByTestId('beat-instruction')).toHaveValue('she follows him')
    })

    it('does not bury the composer under the find panel when Mod-F fires inside it', async () => {
        const textarea = await openComposer()

        fireEvent.keyDown(textarea, { key: 'f', ctrlKey: true, bubbles: true })

        expect(screen.queryByRole('search')).not.toBeInTheDocument()
        expect(screen.getByTestId('beat-composer')).toBeInTheDocument()
    })
})
