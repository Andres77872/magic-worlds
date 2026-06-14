import { render, screen, waitFor } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { NovelEditor } from './NovelEditor'
import type { NovelEditorProps } from './types'

const originalElementFromPoint = document.elementFromPoint

function props(overrides: Partial<NovelEditorProps> = {}): NovelEditorProps {
    return {
        chapterId: 'chapter-1',
        initialBody: '',
        codexEntries: [],
        onBodyChange: vi.fn(),
        onRequestSaveFlush: vi.fn(async () => {}),
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
    })

    afterAll(() => {
        document.elementFromPoint = originalElementFromPoint
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
