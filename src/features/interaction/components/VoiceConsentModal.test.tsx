import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VoiceConsentModal } from './VoiceConsentModal'

describe('VoiceConsentModal', () => {
    it('renders accessible voice, AI, provider, transcript, and raw-audio disclosures', () => {
        render(<VoiceConsentModal open onAccept={vi.fn()} onDecline={vi.fn()} />)

        const dialog = screen.getByRole('dialog', { name: 'Start a voice call' })
        expect(within(dialog).getByText(/AI character voice interaction/i)).toBeInTheDocument()
        expect(within(dialog).getByText(/microphone access/i)).toBeInTheDocument()
        expect(within(dialog).getByText(/Groq speech-to-text/i)).toBeInTheDocument()
        expect(within(dialog).getByText(/MiniMax text-to-speech/i)).toBeInTheDocument()
        expect(within(dialog).getByText(/Final transcripts and call metadata/i)).toBeInTheDocument()
        expect(within(dialog).getByText(/Raw microphone audio and full call recordings are not stored/i)).toBeInTheDocument()
    })

    it('accepts or declines consent from the modal controls', () => {
        const onAccept = vi.fn()
        const onDecline = vi.fn()
        render(<VoiceConsentModal open onAccept={onAccept} onDecline={onDecline} />)

        fireEvent.click(screen.getByRole('button', { name: 'I consent and start call' }))
        expect(onAccept).toHaveBeenCalledTimes(1)

        fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
        expect(onDecline).toHaveBeenCalledTimes(1)
    })

    it('surfaces stale consent as a required review state', () => {
        render(<VoiceConsentModal open staleConsent onAccept={vi.fn()} onDecline={vi.fn()} />)

        const dialog = screen.getByRole('dialog', { name: 'Review voice consent' })
        expect(within(dialog).getByText('Consent update required')).toBeInTheDocument()
        expect(within(dialog).getByText(/changed since your last call/i)).toBeInTheDocument()
    })

    it('does not render when closed', () => {
        render(<VoiceConsentModal open={false} onAccept={vi.fn()} onDecline={vi.fn()} />)

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
})
