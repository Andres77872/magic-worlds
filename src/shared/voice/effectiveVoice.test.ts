import { describe, expect, it } from 'vitest'
import { isElevenLabsProjection, isSubstitutionReason, isVoiceBadgeKey, readEffectiveVoice } from './effectiveVoice'

const WIRE = {
    voice_key: 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f',
    display_name: 'Eldrin',
    provider_route: 'elevenlabs',
    substitution_reason: 'voice_removed',
    flags: ['pitch_dropped'],
    badges: ['replaced', 'review'],
}

describe('readEffectiveVoice (R1-FE-03, D35)', () => {
    it('reads a well-formed projection as is', () => {
        expect(readEffectiveVoice(WIRE)).toEqual(WIRE)
    })

    it('is null when absent or not a projection', () => {
        expect(readEffectiveVoice(undefined)).toBeNull()
        expect(readEffectiveVoice(null)).toBeNull()
        expect(readEffectiveVoice('elevenlabs')).toBeNull()
        expect(readEffectiveVoice([WIRE])).toBeNull()
        expect(readEffectiveVoice({ ...WIRE, provider_route: 'acme' })).toBeNull()
        expect(readEffectiveVoice({ ...WIRE, provider_route: 7 })).toBeNull()
    })

    it('reads a projection without a route as the ElevenLabs one', () => {
        const withoutRoute: Record<string, unknown> = { ...WIRE }
        delete withoutRoute.provider_route
        expect(readEffectiveVoice(withoutRoute)).toEqual(WIRE)
        expect(readEffectiveVoice({ ...WIRE, provider_route: undefined })).toEqual(WIRE)
        expect(readEffectiveVoice({ ...WIRE, provider_route: null })).toEqual(WIRE)
    })

    it('degrades malformed fields instead of failing', () => {
        expect(readEffectiveVoice({
            provider_route: 'elevenlabs',
            voice_key: 42,
            display_name: { name: 'x' },
            substitution_reason: 'meteor_strike',
            flags: ['speed_clamped', 7, null],
            badges: ['leaving', 'sparkles', 'leaving', 3],
        })).toEqual({
            voice_key: null,
            display_name: '',
            provider_route: 'elevenlabs',
            substitution_reason: null,
            flags: ['speed_clamped'],
            badges: ['leaving'],
        })
    })

    it('gates on a projection being present', () => {
        expect(isElevenLabsProjection(readEffectiveVoice(WIRE))).toBe(true)
        expect(isElevenLabsProjection(readEffectiveVoice({ ...WIRE, provider_route: undefined }))).toBe(true)
        expect(isElevenLabsProjection(readEffectiveVoice({ ...WIRE, provider_route: 'acme' }))).toBe(false)
        expect(isElevenLabsProjection(null)).toBe(false)
        expect(isElevenLabsProjection(undefined)).toBe(false)
    })

    it('knows the badge keys and substitution reasons', () => {
        expect(isVoiceBadgeKey('house_voice')).toBe(true)
        expect(isVoiceBadgeKey('daily_limit')).toBe(false)
        expect(isSubstitutionReason('tier_fallback')).toBe(true)
        expect(isSubstitutionReason('voice_v1_not_allowed')).toBe(false)
    })
})
