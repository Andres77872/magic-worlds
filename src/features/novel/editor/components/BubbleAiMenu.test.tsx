import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BubbleAiMenu } from './BubbleAiMenu'

describe('BubbleAiMenu', () => {
    it('offers Beat first, then the canned verbs', () => {
        render(<BubbleAiMenu onBeat={vi.fn()} onSelectCommand={vi.fn()} />)

        const items = screen.getAllByTestId('bubble-ai-item')
        expect(items[0]).toHaveTextContent('Beat')
        expect(items.map((item) => item.textContent)).toEqual(['Beat', 'Rewrite', 'Expand', 'Condense', 'Describe'])
    })

    it('routes Beat and the verbs to their own handlers', () => {
        const onBeat = vi.fn()
        const onSelectCommand = vi.fn()
        render(<BubbleAiMenu onBeat={onBeat} onSelectCommand={onSelectCommand} />)

        fireEvent.click(screen.getByRole('menuitem', { name: 'Beat' }))
        expect(onBeat).toHaveBeenCalledTimes(1)

        fireEvent.click(screen.getByRole('menuitem', { name: 'Condense' }))
        expect(onSelectCommand).toHaveBeenCalledWith('condense')
    })

    it('keeps the live selection: mousedown never reaches the editor', () => {
        render(<BubbleAiMenu onBeat={vi.fn()} onSelectCommand={vi.fn()} />)

        const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
        screen.getByRole('menuitem', { name: 'Rewrite' }).dispatchEvent(event)

        expect(event.defaultPrevented).toBe(true)
    })

    it('owns no dismissal listener — the toolbar wrapping trigger and menu owns that', () => {
        const onBeat = vi.fn()
        render(<BubbleAiMenu onBeat={onBeat} onSelectCommand={vi.fn()} />)

        // A stray outside click must not be swallowed or acted on here; if this
        // component grew its own handler it would race the toolbar's and close
        // the menu on the click that opened it.
        fireEvent.mouseDown(document.body)
        fireEvent.keyDown(document, { key: 'Escape' })

        expect(screen.getByRole('menu')).toBeInTheDocument()
        expect(onBeat).not.toHaveBeenCalled()
    })
})
