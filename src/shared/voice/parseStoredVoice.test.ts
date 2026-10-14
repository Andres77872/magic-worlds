import { describe, expect, it } from 'vitest'
import type { CharacterVoiceLegacyV1, CharacterVoiceV2 } from '@/shared/types'
import { LEGACY_V1_VOICE } from '@/test/fixtures/legacyMinimax'
import { keepStoredVoice, parseStoredVoice } from './parseStoredVoice'

const V2: CharacterVoiceV2 = {
    schema_version: 2,
    provider: 'elevenlabs',
    voice_key: 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f',
    voice_name: 'Eldrin',
    settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed: 1 },
    emotion: 'calm',
    language_code: 'es',
    preset_id: null,
    preset_name: null,
}

const V1: CharacterVoiceLegacyV1 = {
    ...LEGACY_V1_VOICE,
    voice_id: ' English_magnetic_voiced_man ',
    preset_id: 'preset-1',
    preset_name: 'Warm narrator',
}

describe('parseStoredVoice', () => {
    it('returns the same V2 object (no copy, no whitelist)', () => {
        const raw = { ...V2, future_field: { nested: true } }
        const parsed = parseStoredVoice(raw)
        expect(parsed).toBe(raw)
        expect(JSON.stringify(parsed)).toBe(JSON.stringify(raw))
    })

    it('returns the same V1 object and never trims the id', () => {
        const raw = { ...V1 }
        const parsed = parseStoredVoice(raw)
        expect(parsed).toBe(raw)
        expect((parsed as CharacterVoiceLegacyV1).voice_id).toBe(' English_magnetic_voiced_man ')
        expect(JSON.stringify(parsed)).toBe(JSON.stringify(V1))
    })

    it('keeps a whitespace-only V1 id (shape is the BFF’s call, not the parser’s)', () => {
        const raw = { voice_id: '   ' }
        expect(parseStoredVoice(raw)).toBe(raw)
    })

    it('returns null for no voice or an unrecognised shape', () => {
        expect(parseStoredVoice(null)).toBeNull()
        expect(parseStoredVoice(undefined)).toBeNull()
        expect(parseStoredVoice('English_radiant_girl')).toBeNull()
        expect(parseStoredVoice({})).toBeNull()
        expect(parseStoredVoice({ voice_id: '' })).toBeNull()
        expect(parseStoredVoice({ voice_id: 42 })).toBeNull()
        expect(parseStoredVoice({ schema_version: 2, provider: 'elevenlabs', voice_key: '', voice_name: 'x' })).toBeNull()
        // A V2 discriminator wins: a stray voice_id never makes it V1.
        expect(parseStoredVoice({ schema_version: 2, voice_id: 'English_radiant_girl' })).toBeNull()
    })

    it('does not mutate its input', () => {
        const raw = { ...V2 }
        const frozen = Object.freeze(raw)
        expect(() => parseStoredVoice(frozen)).not.toThrow()
        expect(raw).toEqual(V2)
    })
})

describe('keepStoredVoice', () => {
    it('keeps any stored object as the same object, recognised or not', () => {
        const v1 = { ...V1 }
        const unknown = { provider: 'acme', id: 7 }
        expect(keepStoredVoice(v1)).toBe(v1)
        expect(keepStoredVoice(unknown)).toBe(unknown)
        expect(keepStoredVoice(null)).toBeUndefined()
        expect(keepStoredVoice([V2])).toBeUndefined()
        expect(keepStoredVoice('English_radiant_girl')).toBeUndefined()
    })
})
