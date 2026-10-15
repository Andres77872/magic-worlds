import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import { en } from '@/app/i18n/locales/en'
import { es } from '@/app/i18n/locales/es'
import { CONSENT_COPY } from '@/features/legal/documents'
import { VoiceConsentModal } from './VoiceConsentModal'

describe('VoiceConsentModal', () => {
    it('shows the expanded Fish processing disclosure before accepting voice-v3', () => {
        render(<VoiceConsentModal open consentVersion="voice-v3" onAccept={vi.fn()} onDecline={vi.fn()} />)
        expect(screen.getByText(CONSENT_COPY['voice-v3'].en.processing)).toBeInTheDocument()
        expect(screen.getByText(/Fish Audio/)).toBeInTheDocument()
        expect(screen.getByTestId('voice-consent-draft')).toBeInTheDocument()
    })
    it('renders accessible voice, AI, provider, transcript, and raw-audio disclosures', () => {
        render(<VoiceConsentModal open onAccept={vi.fn()} onDecline={vi.fn()} />)

        const dialog = screen.getByRole('dialog', { name: 'Start a voice call' })
        expect(within(dialog).getByText(/AI character voice interaction/i)).toBeInTheDocument()
        expect(within(dialog).getByText(/microphone access/i)).toBeInTheDocument()
        expect(within(dialog).getByText(CONSENT_COPY['voice-v2'].en.processing)).toBeInTheDocument()
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

    it('disables both actions while the consent is being recorded', () => {
        const onAccept = vi.fn()
        render(<VoiceConsentModal open isAccepting onAccept={onAccept} onDecline={vi.fn()} />)

        const accept = screen.getByRole('button', { name: 'Starting…' })
        expect(accept).toBeDisabled()
        fireEvent.click(accept)
        expect(onAccept).not.toHaveBeenCalled()
        expect(screen.getByRole('button', { name: 'Not now' })).toBeDisabled()
    })

    it('does not render when closed', () => {
        render(<VoiceConsentModal open={false} onAccept={vi.fn()} onDecline={vi.fn()} />)

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    describe('consent version (I-68: voice-v2 for everyone)', () => {
        afterEach(async () => {
            await i18n.changeLanguage('en')
        })

        it('always renders the final voice-v2 processing copy, without a draft notice (I-71)', () => {
            expect(CONSENT_COPY['voice-v2'].status).toBe('final')
            render(<VoiceConsentModal open onAccept={vi.fn()} onDecline={vi.fn()} />)
            const dialog = screen.getByRole('dialog', { name: 'Start a voice call' })
            expect(within(dialog).getByText(CONSENT_COPY['voice-v2'].en.processing)).toBeInTheDocument()
            expect(within(dialog).getByText(/ElevenLabs/)).toBeInTheDocument()
            expect(within(dialog).queryByTestId('voice-consent-draft')).toBeNull()
            expect(within(dialog).queryByText('Draft — pending legal review')).toBeNull()
            // The other disclosures stay.
            expect(within(dialog).getByText(/microphone access/i)).toBeInTheDocument()
            expect(within(dialog).getAllByRole('listitem')).toHaveLength(6)
        })

        it('renders the same copy in the review state a consent_stale refusal opens', () => {
            render(<VoiceConsentModal open staleConsent onAccept={vi.fn()} onDecline={vi.fn()} />)
            const dialog = screen.getByRole('dialog', { name: 'Review voice consent' })
            expect(within(dialog).getByText(CONSENT_COPY['voice-v2'].en.processing)).toBeInTheDocument()
        })

        it('renders the Spanish v2 copy in Spanish, without a draft notice', async () => {
            await i18n.changeLanguage('es')
            render(<VoiceConsentModal open onAccept={vi.fn()} onDecline={vi.fn()} />)
            expect(screen.getByText(CONSENT_COPY['voice-v2'].es.processing)).toBeInTheDocument()
            expect(screen.queryByTestId('voice-consent-draft')).toBeNull()
        })
    })

    describe('what the modal says is kept (I-71)', () => {
        afterEach(async () => {
            await i18n.changeLanguage('en')
        })

        // A "transcript only" retention claim, in en or es.
        const TRANSCRIPT_ONLY = /\btranscripts?\s+only\b|\bonly\s+(the\s+)?transcripts?\b|\bsolo\s+(la\s+)?transcripci[oó]n|[uú]nicamente\s+(la\s+)?transcripci[oó]n/i
        // The final voice-v2 copy says the AI's spoken replies are saved with the chat.
        const SPOKEN_REPLIES_SAVED = { en: /spoken replies .*saved/i, es: /respuestas habladas .*se guardan/i }
        const LOCALES = { en, es }

        it('detects the retired "transcript only" badge wording', () => {
            expect('Transcript only').toMatch(TRANSCRIPT_ONLY)
            expect('Solo transcripción').toMatch(TRANSCRIPT_ONLY)
            expect(en.interaction.voiceConsent.disclosures.transcripts).not.toMatch(TRANSCRIPT_ONLY)
        })

        it.each(['en', 'es'] as const)('never claims "transcript only" next to the final copy that saves spoken replies (%s)', async (language) => {
            const copy = CONSENT_COPY['voice-v2']
            expect(copy.status).toBe('final')
            expect(copy[language].processing).toMatch(SPOKEN_REPLIES_SAVED[language])
            // No voice-consent string may say it, whether or not today's render shows it.
            for (const text of Object.values(LOCALES[language].interaction.voiceConsent).flatMap((v) => (typeof v === 'string' ? [v] : Object.values(v)))) {
                expect(text).not.toMatch(TRANSCRIPT_ONLY)
            }

            await i18n.changeLanguage(language)
            for (const staleConsent of [false, true]) {
                const { unmount } = render(<VoiceConsentModal open staleConsent={staleConsent} onAccept={vi.fn()} onDecline={vi.fn()} />)
                const dialog = screen.getByRole('dialog')
                expect(within(dialog).getByText(copy[language].processing)).toBeInTheDocument()
                expect(within(dialog).queryAllByText(TRANSCRIPT_ONLY)).toHaveLength(0)
                expect(dialog.textContent).not.toMatch(TRANSCRIPT_ONLY)
                expect(within(dialog).getByText(LOCALES[language].interaction.voiceConsent.badgeSavedWithChat)).toBeInTheDocument()
                unmount()
            }
        })
    })
})
