import { describe, expect, it } from 'vitest'
import type { VoicePresetV2 } from '@/shared'
import { presetMatchesVoice, voiceFromPreset } from './voiceFromPreset'

const V2_PRESET: VoicePresetV2 = {
    preset_id: 'p-sage',
    name: 'Old sage',
    description: null,
    voice_key: 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f',
    voice_name: 'Eldrin',
    settings: { stability: 0.4, similarity_boost: 0.8, speed: 0.95 },
    emotion: 'calm',
    language_code: 'es',
    is_global: false,
    schema_version: 2,
    provider: 'elevenlabs',
    effective_voice: {
        voice_key: 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f',
        display_name: 'Eldrin',
        provider_route: 'elevenlabs',
        substitution_reason: null,
        badges: [],
    },
}

describe('voiceFromPreset', () => {
    it('builds a V2 voice with every V2 field from a V2 preset (05 §4.3), never the projection', () => {
        const voice = voiceFromPreset(V2_PRESET)
        expect(voice).toEqual({
            schema_version: 2,
            provider: 'elevenlabs',
            voice_key: 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f',
            voice_name: 'Eldrin',
            settings: { stability: 0.4, similarity_boost: 0.8, speed: 0.95 },
            emotion: 'calm',
            language_code: 'es',
            preset_id: 'p-sage',
            preset_name: 'Old sage',
        })
        expect(voice).not.toHaveProperty('effective_voice')
    })

    it('defaults absent V2 preset fields to null', () => {
        const voice = voiceFromPreset({ ...V2_PRESET, settings: null, emotion: null, language_code: null })
        expect(voice).toMatchObject({ settings: null, emotion: null, language_code: null })
    })
})

describe('presetMatchesVoice', () => {
    it('matches by preset linkage first', () => {
        expect(presetMatchesVoice(V2_PRESET, { schema_version: 2, provider: 'elevenlabs', voice_key: 'vk_x', voice_name: 'X', preset_id: 'p-sage' })).toBe(true)
        expect(presetMatchesVoice(V2_PRESET, { schema_version: 2, provider: 'elevenlabs', voice_key: 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f', voice_name: 'Eldrin', preset_id: 'other' })).toBe(false)
    })

    it('without linkage, compares the voice', () => {
        expect(presetMatchesVoice(V2_PRESET, { schema_version: 2, provider: 'elevenlabs', voice_key: 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f', voice_name: 'Eldrin' })).toBe(true)
        expect(presetMatchesVoice(V2_PRESET, { schema_version: 2, provider: 'elevenlabs', voice_key: 'vk_x', voice_name: 'X' })).toBe(false)
    })

    it('never matches without a voice', () => {
        expect(presetMatchesVoice(V2_PRESET, null)).toBe(false)
        expect(presetMatchesVoice(V2_PRESET, undefined)).toBe(false)
    })
})
