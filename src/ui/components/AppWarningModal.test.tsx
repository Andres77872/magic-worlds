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
