import { describe, expect, it } from 'vitest'
import type { CharacterVoiceV2, StoredCharacterVoice } from '@/shared/types'
import { hasAssignedVoice, isSameVoice, voiceIdentity } from './voiceIdentity'

const KEY = 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f'

const v2 = (overrides: Partial<CharacterVoiceV2> = {}): CharacterVoiceV2 => ({
    schema_version: 2,
    provider: 'elevenlabs',
    voice_key: KEY,
    voice_name: 'Eldrin',
    ...overrides,
})

/** A stored object without `schema_version: 2` (no recognised voice). */
const unversioned = { voice_id: 'narrator-1' } as unknown as StoredCharacterVoice

describe('hasAssignedVoice', () => {
    it('is true for a stored voice', () => {
        expect(hasAssignedVoice(v2())).toBe(true)
    })

    it('is false for no voice and never throws on malformed values', () => {
        expect(hasAssignedVoice(null)).toBe(false)
        expect(hasAssignedVoice(undefined)).toBe(false)
        expect(hasAssignedVoice(v2({ voice_key: '' }))).toBe(false)
        expect(hasAssignedVoice(unversioned)).toBe(false)
        expect(hasAssignedVoice({} as StoredCharacterVoice)).toBe(false)
        expect(hasAssignedVoice({ schema_version: 2 } as StoredCharacterVoice)).toBe(false)
    })
})

describe('voiceIdentity', () => {
    it('is the voice_key (D35)', () => {
        expect(voiceIdentity(v2())).toBe(KEY)
    })

    it('ignores settings, emotion and preset linkage', () => {
        expect(voiceIdentity(v2({ settings: { stability: 0.2 }, emotion: 'sad', preset_id: 'p1', preset_name: 'Sad' }))).toBe(KEY)
    })

    it('is null without an assigned voice', () => {
        expect(voiceIdentity(null)).toBeNull()
        expect(voiceIdentity(undefined)).toBeNull()
        expect(voiceIdentity(v2({ voice_key: '' }))).toBeNull()
        expect(voiceIdentity(unversioned)).toBeNull()
    })
})

describe('isSameVoice', () => {
    it('matches regardless of settings', () => {
        expect(isSameVoice(v2(), v2({ settings: { speed: 1.1 }, voice_name: 'Renamed' }))).toBe(true)
    })

    it('distinguishes different voices', () => {
        expect(isSameVoice(v2(), v2({ voice_key: 'vk_00000000000000000000000000000000' }))).toBe(false)
    })

    it('two unassigned voices are not the same voice', () => {
        expect(isSameVoice(null, null)).toBe(false)
        expect(isSameVoice(undefined, null)).toBe(false)
        expect(isSameVoice(unversioned, unversioned)).toBe(false)
        expect(isSameVoice(v2(), null)).toBe(false)
        expect(isSameVoice(null, v2())).toBe(false)
    })
})
