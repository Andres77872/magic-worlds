import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import type { AttestationKind } from '@/shared/types/attestation.types'
import { AttestationPrompt, type AttestationPromptProps } from './AttestationPrompt'

const BOTH: readonly AttestationKind[] = ['age_18_plus', 'terms_of_service']

function renderPrompt(props: Partial<AttestationPromptProps> = {}) {
    const onConfirm = vi.fn()
    const onDecline = vi.fn()
    render(
        <I18nextProvider i18n={i18n.cloneInstance({ lng: 'en' })}>
            <AttestationPrompt mode="login" kinds={BOTH} onConfirm={onConfirm} onDecline={onDecline} {...props} />
        </I18nextProvider>,
    )
    return { onConfirm, onDecline }
}

function tickAll() {
    fireEvent.click(screen.getByRole('checkbox', { name: 'I am 18 or older' }))
    fireEvent.click(screen.getByRole('checkbox', { name: /I agree to the Terms of Service/ }))
}

afterEach(cleanup)

describe('AttestationPrompt (R2-FE-01)', () => {
    it('shows the Terms version it asks for, outside the checkbox name', () => {
        renderPrompt({ termsVersion: 'tos-v1' })

        const caption = screen.getByTestId('attestation-terms-version')
        expect(caption).toHaveTextContent('Terms of Service, version tos-v1')
        const terms = screen.getByRole('checkbox', { name: /I agree to the Terms of Service/ })
        expect(terms).toHaveAttribute('aria-describedby', caption.id)
        expect(screen.queryByTestId('attestation-terms-unavailable')).not.toBeInTheDocument()
    })

    it('confirms with both boxes for a shipped version', () => {
        const { onConfirm } = renderPrompt({ termsVersion: 'tos-v1' })
        const confirm = screen.getByRole('button', { name: 'Confirm' })
        expect(confirm).toBeDisabled()

        tickAll()
        fireEvent.click(confirm)
        expect(onConfirm).toHaveBeenCalledWith(['age_18_plus', 'terms_of_service'])
    })

    it('cannot confirm a version the SPA does not ship, and says why', () => {
        const { onConfirm } = renderPrompt({ termsVersion: 'tos-v99', notice: 'ignored while unavailable' })

        expect(screen.getByTestId('attestation-terms-unavailable')).toHaveTextContent(
            'Updated terms are being published',
        )
        expect(screen.queryByTestId('attestation-terms-version')).not.toBeInTheDocument()
        expect(screen.queryByText('ignored while unavailable')).not.toBeInTheDocument()
        tickAll()
        const confirm = screen.getByRole('button', { name: 'Confirm' })
        expect(confirm).toBeDisabled()
        fireEvent.click(confirm)
        expect(onConfirm).not.toHaveBeenCalled()
    })

    it('does not block an age-only prompt on the Terms version', () => {
        const { onConfirm } = renderPrompt({ kinds: ['age_18_plus'], termsVersion: 'tos-v99' })

        expect(screen.queryByTestId('attestation-terms-unavailable')).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('checkbox', { name: 'I am 18 or older' }))
        fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
        expect(onConfirm).toHaveBeenCalledWith(['age_18_plus'])
    })

    it('shows why it asks again', () => {
        renderPrompt({ termsVersion: 'tos-v1', notice: 'The Terms of Service were updated.' })
        expect(screen.getByRole('status')).toHaveTextContent('The Terms of Service were updated.')
    })

    it('keeps the R0 prompt when no version is known', () => {
        renderPrompt()
        expect(screen.queryByTestId('attestation-terms-version')).not.toBeInTheDocument()
        expect(screen.queryByTestId('attestation-terms-unavailable')).not.toBeInTheDocument()
    })
})
