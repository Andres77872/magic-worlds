import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Modal } from './Modal'

function open(onClose = vi.fn()) {
    render(
        <Modal open onClose={onClose} title="Rename world">
            <p data-testid="body">Pick a new name for this world.</p>
        </Modal>,
    )
    return onClose
}

describe('Modal scrim dismissal', () => {
    it('closes on a click that both starts and ends on the scrim', () => {
        const onClose = open()
        const scrim = screen.getByRole('dialog').parentElement!
        fireEvent.pointerDown(scrim, { target: scrim })
        fireEvent.click(scrim)
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('does not close when a drag starts inside the panel and ends on the scrim', () => {
        // Selecting text in the dialog and releasing outside it used to dismiss the
        // dialog and lose the edit: the click event's target is the common ancestor
        // (the scrim), so a plain onClick={onClose} fired.
        const onClose = open()
        const scrim = screen.getByRole('dialog').parentElement!
        fireEvent.pointerDown(screen.getByTestId('body'))
        fireEvent.click(scrim)
        expect(onClose).not.toHaveBeenCalled()
    })

    it('does not close on a click inside the panel', () => {
        const onClose = open()
        fireEvent.pointerDown(screen.getByTestId('body'))
        fireEvent.click(screen.getByTestId('body'))
        expect(onClose).not.toHaveBeenCalled()
    })

    it('closes on Escape', () => {
        const onClose = open()
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(onClose).toHaveBeenCalledTimes(1)
    })
})

describe('stacked layers', () => {
    it('Escape closes only the frontmost dialog', () => {
        const closeOuter = vi.fn()
        const closeInner = vi.fn()
        render(
            <>
                <Modal open onClose={closeOuter} title="Outer">
                    <p>outer</p>
                </Modal>
                <Modal open onClose={closeInner} title="Inner">
                    <p>inner</p>
                </Modal>
            </>,
        )
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(closeInner).toHaveBeenCalledTimes(1)
        expect(closeOuter).not.toHaveBeenCalled()
    })
})
