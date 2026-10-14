import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { i18n } from '@/app/i18n'
import type { VoiceBadgeKey } from '@/shared'
import { BADGE_TONES, VoiceBadges, voiceBadgeCopy } from './VoiceBadges'

const ALL: VoiceBadgeKey[] = [
    'leaving', 'needs_reselect', 'review', 'retired', 'replaced', 'call_voice',
    'locked', 'expressive_only', 'standard_fallback', 'not_tested_language', 'house_voice',
]

describe('VoiceBadges (R1-FE-03, 09 §8)', () => {
    it.each(['en', 'es'])('resolves every badge key to copy in %s', (lng) => {
        const t = i18n.getFixedT(lng) as TFunction
        for (const badge of ALL) {
            const copy = voiceBadgeCopy(badge, { date: '2026-12-01T00:00:00Z', language: 'fr', name: 'Maren', original: 'Eldrin' }, t, lng)
            expect(copy.text, badge).not.toMatch(/voices\.badge|\{\{/)
            if (copy.hint) expect(copy.hint, badge).not.toMatch(/voices\.badge|\{\{/)
        }
    })

    it('renders known badges in a fixed order, as text, and ignores unknown keys', () => {
        render(<VoiceBadges badges={['house_voice', 'sparkles', 'review', 'leaving', 42]} context={{ date: '2026-12-01T00:00:00Z' }} />)
        const group = screen.getByTestId('voice-badges')
        const shown = Array.from(group.querySelectorAll('[data-badge]')).map((node) => node.getAttribute('data-badge'))
        expect(shown).toEqual(['review', 'leaving', 'house_voice'])
        expect(within(group).getByText('Review this voice: some settings changed')).toBeInTheDocument()
        expect(within(group).getByText(/^Leaving on /)).toBeInTheDocument()
        expect(within(group).queryByText(/sparkles/)).not.toBeInTheDocument()
    })

    it('renders nothing without known badges', () => {
        const { container } = render(<VoiceBadges badges={['nope']} />)
        expect(container).toBeEmptyDOMElement()
        render(<VoiceBadges badges={null} />)
        expect(screen.queryByTestId('voice-badges')).not.toBeInTheDocument()
    })

    it('exposes hints as a focusable title (never colour alone)', () => {
        render(<VoiceBadges badges={['locked', 'replaced']} context={{ original: 'Eldrin', name: 'Maren' }} />)
        const locked = document.querySelector('[data-badge="locked"]') as HTMLElement
        expect(locked).toHaveTextContent('Locked')
        expect(locked).toHaveAttribute('title', 'Upgrade to pick this voice')
        expect(locked).toHaveAttribute('tabindex', '0')
        const replaced = document.querySelector('[data-badge="replaced"]') as HTMLElement
        expect(replaced).toHaveAttribute('title', 'Eldrin isn’t available; using Maren')
    })

    it('names the plan on a lock, with the reason for screen readers (03 §5.12)', () => {
        render(<VoiceBadges badges={['locked']} context={{ minPlan: 'plus' }} />)
        const lock = document.querySelector('[data-badge="locked"]') as HTMLElement
        expect(within(lock).getByText('Plus')).toHaveAttribute('aria-hidden', 'true')
        expect(within(lock).getByText('Locked: requires Plus')).toHaveClass('sr-only')
        expect(lock).toHaveAttribute('title', 'Upgrade to pick this voice')
    })

    it.each([
        ['pro', 'en', 'Pro', 'Locked: requires Pro'],
        ['PRO', 'es', 'Pro', 'Bloqueada: requiere Pro'],
        ['plus', 'es', 'Plus', 'Bloqueada: requiere Plus'],
    ])('labels min_plan %s in %s', (minPlan, lng, text, srText) => {
        const t = i18n.getFixedT(lng) as TFunction
        expect(voiceBadgeCopy('locked', { minPlan }, t, lng)).toMatchObject({ text, srText })
    })

    it('keeps the generic lock for an unknown or missing plan', () => {
        const t = i18n.getFixedT('en') as TFunction
        expect(voiceBadgeCopy('locked', { minPlan: 'patron_tier_2' }, t, 'en')).toEqual({ text: 'Locked', hint: 'Upgrade to pick this voice' })
        expect(voiceBadgeCopy('locked', {}, t, 'en').text).toBe('Locked')
    })

    it('falls back when context is missing', () => {
        render(<VoiceBadges badges={['leaving', 'replaced', 'call_voice']} />)
        expect(screen.getByText('Leaving soon')).toBeInTheDocument()
        expect(document.querySelector('[data-badge="replaced"]')).toHaveAttribute('title', 'The chosen voice isn’t available, so a similar voice is used.')
        expect(screen.getByText('Call voice: Voice')).toBeInTheDocument()
    })

    it('renders Spanish copy', () => {
        render(
            <I18nextProvider i18n={i18n.cloneInstance({ lng: 'es' })}>
                <VoiceBadges badges={['house_voice', 'not_tested_language']} context={{ language: 'fr' }} />
            </I18nextProvider>,
        )
        expect(screen.getByText('Voz de la casa')).toBeInTheDocument()
        expect(screen.getByText(/^Sin probar en /)).toBeInTheDocument()
    })

    it('maps every key to a tone', () => {
        for (const badge of ALL) expect(BADGE_TONES[badge]).toBeTruthy()
    })
})
