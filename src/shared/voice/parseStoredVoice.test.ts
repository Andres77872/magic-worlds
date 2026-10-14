import { describe, expect, it } from 'vitest'
import type { CharacterVoiceV2 } from '@/shared/types'
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

describe('parseStoredVoice', () => {
    it('returns the same object (no copy, no whitelist)', () => {
        const raw = { ...V2, future_field: { nested: true } }
        const parsed = parseStoredVoice(raw)
        expect(parsed).toBe(raw)
        expect(JSON.stringify(parsed)).toBe(JSON.stringify(raw))
    })

    it('returns null for no voice or an unrecognised shape', () => {
        expect(parseStoredVoice(null)).toBeNull()
        expect(parseStoredVoice(undefined)).toBeNull()
        expect(parseStoredVoice('narrator-1')).toBeNull()
        expect(parseStoredVoice({})).toBeNull()
        expect(parseStoredVoice({ schema_version: 2, provider: 'elevenlabs', voice_key: '', voice_name: 'x' })).toBeNull()
        expect(parseStoredVoice({ schema_version: 2, voice_key: 42 })).toBeNull()
        // Without `schema_version: 2` nothing is a voice, whatever else the object carries.
        expect(parseStoredVoice({ voice_id: 'narrator-1' })).toBeNull()
        expect(parseStoredVoice({ ...V2, schema_version: 1 })).toBeNull()
        expect(parseStoredVoice({ schema_version: 2, voice_id: 'narrator-1' })).toBeNull()
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
        const voice = { ...V2 }
        const unknown = { provider: 'acme', id: 7 }
        expect(keepStoredVoice(voice)).toBe(voice)
        expect(keepStoredVoice(unknown)).toBe(unknown)
        expect(keepStoredVoice(null)).toBeUndefined()
        expect(keepStoredVoice([V2])).toBeUndefined()
        expect(keepStoredVoice('narrator-1')).toBeUndefined()
    })
})
