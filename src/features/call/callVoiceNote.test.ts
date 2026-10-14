import { describe, expect, it } from 'vitest'
import type { EffectiveVoice } from '@/shared/types'
import { callVoiceNote } from './callVoiceNote'

const voice = (overrides: Partial<EffectiveVoice> = {}): EffectiveVoice => ({
    voice_key: 'el:ava',
    display_name: 'Ava',
    provider_route: 'elevenlabs',
    substitution_reason: null,
    badges: [],
    ...overrides,
})

describe('callVoiceNote', () => {
    it('is null without an effective voice, whatever the reason', () => {
        expect(callVoiceNote(null, 'Mia', 'voice_removed')).toBeNull()
        expect(callVoiceNote(undefined, null)).toBeNull()
        expect(callVoiceNote(undefined, null, 'not_call_eligible', 'Other')).toBeNull()
    })

    it('names the call voice for not_call_eligible', () => {
        expect(callVoiceNote(voice({ substitution_reason: 'not_call_eligible' }), null)).toEqual({ kind: 'call_voice', name: 'Ava' })
    })

    it.each(['voice_removed', 'voice_blocked', 'voice_unavailable', 'language_unsupported'] as const)('reads %s as replaced', (reason) => {
        expect(callVoiceNote(voice({ substitution_reason: reason }), ' Mia ')).toEqual({ kind: 'replaced', name: 'Ava', original: 'Mia' })
    })

    it.each(['default_voice', 'distinct_voice', 'tier_fallback', null, 'future_reason'])('shows nothing for %s', (reason) => {
        expect(callVoiceNote(voice({ substitution_reason: reason as EffectiveVoice['substitution_reason'] }), 'Mia')).toBeNull()
    })

    it('prefers the reason the chunks carry', () => {
        expect(callVoiceNote(voice({ substitution_reason: null }), null, 'not_call_eligible')).toEqual({ kind: 'call_voice', name: 'Ava' })
        expect(callVoiceNote(voice({ substitution_reason: 'voice_removed' }), 'Mia', 'not_call_eligible')).toEqual({ kind: 'call_voice', name: 'Ava' })
    })

    it('names no voice after a mid-call swap (a replaced reason only the chunks carry)', () => {
        expect(callVoiceNote(voice({ substitution_reason: null }), null, 'voice_unavailable')).toEqual({ kind: 'replaced', name: null, original: 'Ava' })
        expect(callVoiceNote(voice({ substitution_reason: 'voice_removed' }), 'Mia', 'voice_unavailable')).toEqual({ kind: 'replaced', name: null, original: 'Mia' })
        expect(callVoiceNote(voice({ substitution_reason: 'not_call_eligible' }), null, 'voice_unavailable')).toEqual({ kind: 'replaced', name: null, original: 'Ava' })
    })

    it('names the substitute the chunks name after a mid-call swap (R1-BE-04)', () => {
        expect(callVoiceNote(voice({ substitution_reason: null }), null, 'voice_unavailable', ' Other ')).toEqual({ kind: 'replaced', name: 'Other', original: 'Ava' })
        expect(callVoiceNote(voice({ substitution_reason: 'voice_removed' }), 'Mia', 'voice_unavailable', 'Other')).toEqual({ kind: 'replaced', name: 'Other', original: 'Mia' })
        // A second swap with the announced reason still names the voice now speaking.
        expect(callVoiceNote(voice({ substitution_reason: 'voice_unavailable' }), 'Mia', 'voice_unavailable', 'Other')).toEqual({ kind: 'replaced', name: 'Other', original: 'Mia' })
        // A blank or non-string name keeps the unnamed note.
        expect(callVoiceNote(voice({ substitution_reason: null }), null, 'voice_unavailable', '  ')).toEqual({ kind: 'replaced', name: null, original: 'Ava' })
        expect(callVoiceNote(voice({ substitution_reason: null }), null, 'voice_unavailable', 42)).toEqual({ kind: 'replaced', name: null, original: 'Ava' })
    })

    it('ignores a chunk name without a chunk reason, without an effective voice, or for a call voice', () => {
        expect(callVoiceNote(voice({ substitution_reason: 'voice_removed' }), 'Mia', null, 'Other')).toEqual({ kind: 'replaced', name: 'Ava', original: 'Mia' })
        expect(callVoiceNote(voice({ substitution_reason: null }), null, null, 'Other')).toBeNull()
        expect(callVoiceNote(null, null, 'voice_unavailable', 'Other')).toBeNull()
        expect(callVoiceNote(voice({ substitution_reason: null }), null, 'not_call_eligible', 'Other')).toEqual({ kind: 'call_voice', name: 'Ava' })
    })

    it('keeps the announced voice when the chunks repeat its reason or carry none', () => {
        expect(callVoiceNote(voice({ substitution_reason: 'voice_removed' }), 'Mia', 'voice_removed')).toEqual({ kind: 'replaced', name: 'Ava', original: 'Mia' })
        expect(callVoiceNote(voice({ substitution_reason: 'voice_removed' }), 'Mia', null)).toEqual({ kind: 'replaced', name: 'Ava', original: 'Mia' })
        expect(callVoiceNote(voice({ substitution_reason: null }), null, null)).toBeNull()
    })

    it('keeps a missing name as null (the copy falls back)', () => {
        expect(callVoiceNote(voice({ display_name: '', substitution_reason: 'voice_removed' }), '')).toEqual({ kind: 'replaced', name: null, original: null })
    })
})
