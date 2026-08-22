import { createRef, useRef, useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BeatComposer } from './BeatComposer'

function renderComposer(overrides: { optionsOpen?: boolean; instruction?: string } = {}) {
    const spies = {
        onToggleOptions: vi.fn(),
        onInstructionChange: vi.fn(),
        onLengthChange: vi.fn(),
        onSubmit: vi.fn(),
        onCancel: vi.fn(),
    }
    const containerRef = createRef<HTMLElement>() as { current: HTMLElement | null }
    containerRef.current = document.createElement('div')
    render(
        <BeatComposer
            anchor={{ left: 40, top: 120, caretTop: 100 }}
            containerRef={containerRef}
            instruction={overrides.instruction ?? ''}
            length="medium"
            contextLine="after “…he agreed.”"
            contextCount={6}
            targetsSelection={false}
            optionsOpen={overrides.optionsOpen ?? false}
            {...spies}
        />,
    )
    return spies
}

describe('BeatComposer', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('opens as one instruction box, with the options folded away', () => {
        renderComposer()

        expect(screen.getByTestId('beat-instruction')).toBeInTheDocument()
        expect(screen.queryByTestId('beat-options')).not.toBeInTheDocument()
        expect(screen.queryByTestId('beat-length-medium')).not.toBeInTheDocument()
    })

    it('names the current length while folded, so collapsing never hides state', () => {
        renderComposer({ optionsOpen: false })

        const toggle = screen.getByTestId('beat-options-toggle')
        expect(toggle).toHaveAttribute('aria-expanded', 'false')
        expect(toggle).toHaveTextContent('Medium')
    })

    it('reveals length and context when expanded', () => {
        renderComposer({ optionsOpen: true })

        expect(screen.getByTestId('beat-options')).toBeInTheDocument()
        expect(screen.getByTestId('beat-length-medium')).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByText('Context: 6 codex entries · this chapter')).toBeInTheDocument()
        // Expanded, the toggle is just "Options" — the chips carry the state.
        expect(screen.getByTestId('beat-options-toggle')).toHaveTextContent('Options')
    })

    it('toggles the disclosure without touching the instruction', () => {
        const spies = renderComposer()

        fireEvent.click(screen.getByTestId('beat-options-toggle'))

        expect(spies.onToggleOptions).toHaveBeenCalledTimes(1)
        expect(spies.onInstructionChange).not.toHaveBeenCalled()
    })

    it('leaves focus in the instruction box when the options were restored open', () => {
        // Mounted already-open comes from storage, not from a click.
        renderComposer({ optionsOpen: true })

        expect(screen.getByTestId('beat-instruction')).toHaveFocus()
    })

    it('moves focus into the options when the writer opens them', () => {
        function Harness() {
            const [optionsOpen, setOptionsOpen] = useState(false)
            const containerRef = useRef<HTMLElement | null>(document.createElement('div'))
            return (
                <BeatComposer
                    anchor={{ left: 40, top: 120, caretTop: 100 }}
                    containerRef={containerRef}
                    instruction=""
                    length="medium"
                    contextLine="after “…he agreed.”"
                    contextCount={6}
                    targetsSelection={false}
                    optionsOpen={optionsOpen}
                    onToggleOptions={() => setOptionsOpen((value) => !value)}
                    onInstructionChange={vi.fn()}
                    onLengthChange={vi.fn()}
                    onSubmit={vi.fn()}
                    onCancel={vi.fn()}
                />
            )
        }
        render(<Harness />)

        fireEvent.click(screen.getByTestId('beat-options-toggle'))

        expect(screen.getByTestId('beat-length-short')).toHaveFocus()
    })

    it('writes on Enter and takes a newline on Shift+Enter', () => {
        const spies = renderComposer({ instruction: 'she follows him' })
        const textarea = screen.getByTestId('beat-instruction')

        fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
        expect(spies.onSubmit).not.toHaveBeenCalled()

        fireEvent.keyDown(textarea, { key: 'Enter' })
        expect(spies.onSubmit).toHaveBeenCalledTimes(1)
    })

    it('cancels on Escape even when focus has left the textarea', () => {
        const spies = renderComposer({ optionsOpen: true })

        screen.getByTestId('beat-length-short').focus()
        fireEvent.keyDown(document, { key: 'Escape' })

        expect(spies.onCancel).toHaveBeenCalledTimes(1)
    })

    it('cancels on an outside click but not on a click inside', () => {
        const spies = renderComposer({ optionsOpen: true })

        fireEvent.mouseDown(screen.getByTestId('beat-length-long'))
        expect(spies.onCancel).not.toHaveBeenCalled()

        fireEvent.mouseDown(document.body)
        expect(spies.onCancel).toHaveBeenCalledTimes(1)
    })
})
