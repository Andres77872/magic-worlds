import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import { IN_APP_COPY_DRAFTS, IN_APP_COPY_SWITCHES, releasedInAppCopy } from '@/features/legal/documents/consentCopy'
import { isShippable } from '@/features/legal/documents/legalPending'
import { AppWarningModal, APP_WARNING_ACCEPTANCE_KEY } from './AppWarningModal'

const flags = vi.hoisted(() => ({ voices: false, released: false }))

// The parent voice flag hides the bullet, independently of released legal copy.
vi.mock('@/shared/featureFlags', async (importOriginal) => ({
    ...await importOriginal<typeof import('@/shared/featureFlags')>(),
    isVoicesFeatureEnabled: () => flags.voices,
}))

// The modal reads the shipped switches, on since I-71 (13 §5.8: the Privacy page publishes the
// ElevenLabs variant); `flags.released` stands in for the rest of the release act: the draft marked final.
vi.mock('@/features/legal/documents/consentCopy', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/features/legal/documents/consentCopy')>()
    const finalDrafts = Object.fromEntries(
        Object.entries(actual.IN_APP_COPY_DRAFTS).map(([id, draft]) => [id, { ...draft, status: 'final' }]),
    ) as unknown as typeof actual.IN_APP_COPY_DRAFTS
    return {
        ...actual,
        releasedInAppCopy: (id: Parameters<typeof actual.releasedInAppCopy>[0], language: Parameters<typeof actual.releasedInAppCopy>[1]) =>
            flags.released ? actual.releasedInAppCopy(id, language, actual.IN_APP_COPY_SWITCHES, finalDrafts) : actual.releasedInAppCopy(id, language),
    }
})

/** Today's bullets, in order (the voice one last, behind its gate). */
const TODAY_KEYS = ['ageRequirement', 'contentSaved', 'localOnly', 'authRequired', 'wipe', 'nsfw', 'aiContent', 'noPersonalData', 'credits']

function bullets(): string[] {
    return within(screen.getByRole('dialog')).getAllByRole('listitem').map((item) => item.textContent ?? '')
}

describe('AppWarningModal', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('shows the warning when it has not been accepted', () => {
        render(<AppWarningModal />)

        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByRole('dialog')).toHaveFocus()
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

describe('AppWarningModal voice bullet (R2-FE-01; 13 §5.8, 09 §4.7)', () => {
    const today = (key: string, lng = 'en') => i18n.t(`warning.${key}`, { lng })
    const draft = IN_APP_COPY_DRAFTS.warningVoice

    beforeEach(() => {
        localStorage.clear()
    })

    afterEach(async () => {
        flags.voices = false
        flags.released = false
        await i18n.changeLanguage('en')
    })

    it('ships with the switch on but the draft unreleased (I-71)', () => {
        expect(isShippable(IN_APP_COPY_SWITCHES.privacy)).toBe(true)
        expect(releasedInAppCopy('warningVoice', 'en')).toBeNull()
        expect(draft.status).toBe('draft')
    })

    it('hides released voice copy when voices are disabled', () => {
        flags.released = true
        render(<AppWarningModal />)
        expect(bullets()).toEqual(TODAY_KEYS.map((key) => today(key)))
    })

    it('draft unreleased, voices off: today’s modal, no voice bullet', () => {
        render(<AppWarningModal />)
        expect(bullets()).toEqual(TODAY_KEYS.map((key) => today(key)))
        expect(screen.queryByText(draft.en.text)).toBeNull()
    })

    it('draft unreleased, voices on: today’s voice bullet, unchanged', () => {
        flags.voices = true
        render(<AppWarningModal />)
        expect(bullets()).toEqual([...TODAY_KEYS, 'voice'].map((key) => today(key)))
        expect(screen.queryByText(draft.en.text)).toBeNull()
    })

    it('once released, the rewritten bullet shows when voices are enabled', () => {
        flags.voices = true
        flags.released = true
        render(<AppWarningModal />)
        expect(bullets()).toEqual([...TODAY_KEYS.map((key) => today(key)), draft.en.text])
        expect(screen.queryByText(today('voice'))).toBeNull()
    })

    it('once released, the rewritten bullet replaces today’s with voices on, once, in the UI language', async () => {
        flags.released = true
        flags.voices = true
        const { unmount } = render(<AppWarningModal />)
        expect(bullets()).toEqual([...TODAY_KEYS.map((key) => today(key)), draft.en.text])
        unmount()

        await i18n.changeLanguage('es')
        expect(today('ageRequirement', 'es')).not.toBe(today('ageRequirement'))
        render(<AppWarningModal />)
        expect(bullets()).toEqual([...TODAY_KEYS.map((key) => today(key, 'es')), draft.es.text])
    })
})
