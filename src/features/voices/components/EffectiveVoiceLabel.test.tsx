import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EFFECTIVE_BY_REASON, V1_VOICE, V2_VOICE, effectiveVoice } from '../fixtures'
import { EffectiveVoiceLabel, substitutedName } from './EffectiveVoiceLabel'

describe('EffectiveVoiceLabel (R1-FE-03, D35)', () => {
    it('is the plain name without a projection', () => {
        const { rerender } = render(<EffectiveVoiceLabel stored={V1_VOICE} />)
        expect(screen.getByText('Child girl')).toBeInTheDocument()
        expect(screen.queryByTestId('voice-badges')).not.toBeInTheDocument()

        rerender(<EffectiveVoiceLabel stored={V1_VOICE} effective={null} />)
        expect(screen.queryByTestId('voice-badges')).not.toBeInTheDocument()
        expect(screen.queryByText(/Plays as/)).not.toBeInTheDocument()
    })

    it('shows badges for a projection', () => {
        render(<EffectiveVoiceLabel stored={V2_VOICE} effective={effectiveVoice({ badges: ['leaving'] })} badgeContext={{ date: '2026-12-01T00:00:00Z' }} />)
        expect(screen.getByText('Eldrin')).toBeInTheDocument()
        expect(screen.getByText(/^Leaving on /)).toBeInTheDocument()
    })

    it('keeps the stored name and names the voice heard when substituted', () => {
        render(<EffectiveVoiceLabel stored={V1_VOICE} effective={EFFECTIVE_BY_REASON.unmapped_legacy} />)
        expect(screen.getByText('Child girl')).toBeInTheDocument()
        expect(screen.getByText('Plays as Maren')).toBeInTheDocument()
        expect(document.querySelector('[data-badge="replaced"]')).toHaveAttribute('title', 'Child girl isn’t available; using Maren')
    })

    it('uses the projection name when the stored voice has none, then the fallback', () => {
        const { rerender } = render(<EffectiveVoiceLabel stored={{ ...V2_VOICE, voice_name: '' }} effective={effectiveVoice({ display_name: 'Eldrin' })} />)
        expect(screen.getByText('Eldrin')).toBeInTheDocument()
        rerender(<EffectiveVoiceLabel stored={null} fallback="Default narrator" />)
        expect(screen.getByText('Default narrator')).toBeInTheDocument()
    })

    it('hides badges on request', () => {
        render(<EffectiveVoiceLabel stored={V2_VOICE} effective={effectiveVoice({ badges: ['review'] })} showBadges={false} />)
        expect(screen.queryByTestId('voice-badges')).not.toBeInTheDocument()
    })

    it('names a substitution only when another voice plays', () => {
        expect(substitutedName(V2_VOICE, effectiveVoice({ substitution_reason: 'tier_fallback', display_name: 'Eldrin' }))).toBeNull()
        expect(substitutedName(V2_VOICE, EFFECTIVE_BY_REASON.voice_removed)).toBe('Maren')
        expect(substitutedName(V2_VOICE, null)).toBeNull()
        expect(substitutedName(V2_VOICE, effectiveVoice({ display_name: 'Maren' }))).toBeNull()
    })
})
