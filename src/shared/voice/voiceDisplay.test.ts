import { describe, expect, it } from 'vitest'
import type { CharacterVoiceLegacyV1, CharacterVoiceV2, EffectiveVoice } from '@/shared/types'
import { voiceDisplayName } from './voiceDisplay'

const V2: CharacterVoiceV2 = {
    schema_version: 2,
    provider: 'elevenlabs',
    voice_key: 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f',
    voice_name: 'Eldrin',
    preset_id: 'p1',
    preset_name: 'Old sage',
}

const V1_PRESET: CharacterVoiceLegacyV1 = { voice_id: 'English_radiant_girl', preset_id: 'p2', preset_name: 'Child girl' }
const V1_RAW: CharacterVoiceLegacyV1 = { voice_id: 'English_radiant_girl' }

const effective = (display_name: string): EffectiveVoice => ({
    voice_key: 'vk_11111111111111111111111111111111',
    display_name,
    provider_route: 'elevenlabs',
    substitution_reason: 'unmapped_legacy',
    flags: [],
    badges: [],
})

describe('voiceDisplayName', () => {
    it('prefers the effective voice name (D35)', () => {
        expect(voiceDisplayName(V1_RAW, effective('Mira'))).toBe('Mira')
        expect(voiceDisplayName(V2, effective('Mira'))).toBe('Mira')
    })

    it('falls back to the V2 voice_name, then the preset name', () => {
        expect(voiceDisplayName(V2)).toBe('Eldrin')
        expect(voiceDisplayName({ ...V2, voice_name: '  ' })).toBe('Old sage')
        expect(voiceDisplayName(V1_PRESET)).toBe('Child girl')
        expect(voiceDisplayName(V2, effective('   '))).toBe('Eldrin')
    })

    it('never returns a raw provider or legacy V1 id', () => {
        expect(voiceDisplayName(V1_RAW)).toBeNull()
        expect(voiceDisplayName({ ...V1_PRESET, preset_name: null })).toBeNull()
        expect(voiceDisplayName({ ...V2, voice_name: '', preset_name: null })).toBeNull()
    })

    it('is null without an assigned voice', () => {
        expect(voiceDisplayName(null)).toBeNull()
        expect(voiceDisplayName(undefined, effective('Mira'))).toBeNull()
    })
})
