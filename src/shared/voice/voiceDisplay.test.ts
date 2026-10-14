import { describe, expect, it } from 'vitest'
import type { CharacterVoiceV2, EffectiveVoice } from '@/shared/types'
import { voiceDisplayName } from './voiceDisplay'

const V2: CharacterVoiceV2 = {
    schema_version: 2,
    provider: 'elevenlabs',
    voice_key: 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f',
    voice_name: 'Eldrin',
    preset_id: 'p1',
    preset_name: 'Old sage',
}

const effective = (display_name: string): EffectiveVoice => ({
    voice_key: 'vk_11111111111111111111111111111111',
    display_name,
    provider_route: 'elevenlabs',
    substitution_reason: 'voice_removed',
    badges: [],
})

describe('voiceDisplayName', () => {
    it('prefers the effective voice name (D35)', () => {
        expect(voiceDisplayName(V2, effective('Mira'))).toBe('Mira')
    })

    it('falls back to the voice_name, then the preset name', () => {
        expect(voiceDisplayName(V2)).toBe('Eldrin')
        expect(voiceDisplayName({ ...V2, voice_name: '  ' })).toBe('Old sage')
        expect(voiceDisplayName(V2, effective('   '))).toBe('Eldrin')
    })

    it('never returns a raw provider id', () => {
        expect(voiceDisplayName({ ...V2, voice_name: '', preset_name: null })).toBeNull()
    })

    it('is null without an assigned voice', () => {
        expect(voiceDisplayName(null)).toBeNull()
        expect(voiceDisplayName(undefined, effective('Mira'))).toBeNull()
        // An unrecognised stored object is no assigned voice, even with a projection.
        expect(voiceDisplayName({ voice_id: 'narrator-1' } as unknown as CharacterVoiceV2, effective('Mira'))).toBeNull()
    })
})
