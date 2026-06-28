import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppWarningModal, APP_WARNING_ACCEPTANCE_KEY } from './AppWarningModal'

describe('AppWarningModal', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('shows the warning when it has not been accepted', () => {
        render(<AppWarningModal />)

        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText('Before you continue')).toBeInTheDocument()
        expect(screen.getByText(/zero-retention mode/i)).toBeInTheDocument()
        expect(screen.getByText(/18 or older/i)).toBeInTheDocument()
    })

    it('links to the legal pages from the warning', () => {
        render(<AppWarningModal />)

        expect(screen.getByRole('link', { name: /disclaimer/i })).toHaveAttribute('href', '#/disclaimer')
        expect(screen.getByRole('link', { name: /privacy/i })).toHaveAttribute('href', '#/privacy')
    })

    it('keeps long warning content scrollable while the accept action remains in the footer', () => {
        render(<AppWarningModal />)

        const dialog = screen.getByRole('dialog')
        const content = dialog.querySelector('.overflow-y-auto')
        const acceptButton = screen.getByRole('button', { name: /i understand and accept/i })
        const footer = acceptButton.parentElement

        expect(content).not.toBeNull()
        expect(content!).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto', 'overscroll-contain')
        expect(content!).toContainElement(screen.getByText(/zero-retention mode/i))
        expect(content!).not.toContainElement(acceptButton)
        expect(footer).toHaveClass('flex-col', 'items-stretch', 'sm:flex-row', 'sm:justify-end')
        expect(acceptButton).toHaveClass('w-full', 'sm:w-auto')
    })

    it('stores acceptance and dismisses the warning', () => {
        render(<AppWarningModal />)

        fireEvent.click(screen.getByRole('button', { name: /i understand and accept/i }))

        expect(localStorage.getItem(APP_WARNING_ACCEPTANCE_KEY)).toBe('accepted')
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('does not show the warning after it has been accepted', () => {
        localStorage.setItem(APP_WARNING_ACCEPTANCE_KEY, 'accepted')

        render(<AppWarningModal />)

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('cannot be dismissed by the scrim or a close button', () => {
        render(<AppWarningModal />)

        expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument()

        const scrim = screen.getByRole('dialog').parentElement
        expect(scrim).not.toBeNull()
        fireEvent.click(scrim!)

        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(localStorage.getItem(APP_WARNING_ACCEPTANCE_KEY)).toBeNull()
    })
})
