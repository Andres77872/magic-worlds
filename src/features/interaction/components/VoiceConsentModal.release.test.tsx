/**
 * R2-FE-01 (13 §5.8 "With voice-v2"): the consent `noRecordings` line becomes
 * the drafted line next to the `voice-v2` copy (the only version, I-68), once
 * that copy and the line are final. The copy is final since I-71; the line is
 * still a draft, so today's locale line stays.
 */
import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import { en } from '@/app/i18n/locales/en'
import { CONSENT_COPY, IN_APP_COPY_DRAFTS } from '@/features/legal/documents'
import { VoiceConsentModal } from './VoiceConsentModal'

const release = vi.hoisted(() => ({ flipped: false }))

// The modal reads the shipped switches (both on since I-71); `release.flipped` stands in for
// the rest of the release act: the drafts marked final.
vi.mock('@/features/legal/documents', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/features/legal/documents')>()
    const finalDrafts = Object.fromEntries(
        Object.entries(actual.IN_APP_COPY_DRAFTS).map(([id, draft]) => [id, { ...draft, status: 'final' }]),
    ) as unknown as typeof actual.IN_APP_COPY_DRAFTS
    return {
        ...actual,
        releasedInAppCopy: (id: Parameters<typeof actual.releasedInAppCopy>[0], language: Parameters<typeof actual.releasedInAppCopy>[1]) =>
            release.flipped ? actual.releasedInAppCopy(id, language, actual.IN_APP_COPY_SWITCHES, finalDrafts) : actual.releasedInAppCopy(id, language),
    }
})

const TODAY_EN = en.interaction.voiceConsent.disclosures.noRecordings
const DRAFT = IN_APP_COPY_DRAFTS.consentNoRecordings

afterEach(async () => {
    release.flipped = false
    await i18n.changeLanguage('en')
})

describe('VoiceConsentModal noRecordings line (R2-FE-01)', () => {
    it('keeps today’s line while the line is a draft, next to the final voice-v2 copy', () => {
        render(<VoiceConsentModal open onAccept={vi.fn()} onDecline={vi.fn()} />)
        const dialog = screen.getByRole('dialog')
        expect(within(dialog).getByText(TODAY_EN)).toBeInTheDocument()
        expect(within(dialog).queryByText(DRAFT.en.text)).toBeNull()
        expect(within(dialog).getByText(CONSENT_COPY['voice-v2'].en.processing)).toBeInTheDocument()
        expect(DRAFT.status).toBe('draft')
    })

    it('shows the drafted line once it is final, in the UI language', async () => {
        release.flipped = true
        const { unmount } = render(<VoiceConsentModal open onAccept={vi.fn()} onDecline={vi.fn()} />)
        expect(within(screen.getByRole('dialog')).getByText(DRAFT.en.text)).toBeInTheDocument()
        expect(screen.queryByText(TODAY_EN)).toBeNull()
        unmount()

        await i18n.changeLanguage('es')
        render(<VoiceConsentModal open onAccept={vi.fn()} onDecline={vi.fn()} />)
        expect(within(screen.getByRole('dialog')).getByText(DRAFT.es.text)).toBeInTheDocument()
    })
})
