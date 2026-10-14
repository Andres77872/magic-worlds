import { describe, expect, it } from 'vitest'
import type { CharacterVoiceLegacyV1, CharacterVoiceV2, StoredCharacterVoice } from '@/shared/types'
import { LEGACY_V1_IDENTITY_PREFIX, LEGACY_V1_VOICE_ID } from '@/test/fixtures/legacyMinimax'
import { hasAssignedVoice, isSameVoice, voiceIdentity } from './voiceIdentity'

const KEY = 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f'

const v2 = (overrides: Partial<CharacterVoiceV2> = {}): CharacterVoiceV2 => ({
    schema_version: 2,
    provider: 'elevenlabs',
    voice_key: KEY,
    voice_name: 'Eldrin',
    ...overrides,
})

const v1 = (overrides: Partial<CharacterVoiceLegacyV1> = {}): CharacterVoiceLegacyV1 => ({
    voice_id: LEGACY_V1_VOICE_ID,
    ...overrides,
})

describe('hasAssignedVoice', () => {
    it('is true for V1 and V2 voices', () => {
        expect(hasAssignedVoice(v1())).toBe(true)
        expect(hasAssignedVoice(v2())).toBe(true)
    })

    it('is false for no voice and never throws on malformed values', () => {
        expect(hasAssignedVoice(null)).toBe(false)
        expect(hasAssignedVoice(undefined)).toBe(false)
        expect(hasAssignedVoice(v1({ voice_id: '' }))).toBe(false)
        expect(hasAssignedVoice(v2({ voice_key: '' }))).toBe(false)
        expect(hasAssignedVoice({} as StoredCharacterVoice)).toBe(false)
        expect(hasAssignedVoice({ schema_version: 2 } as StoredCharacterVoice)).toBe(false)
    })
})

describe('voiceIdentity', () => {
    it('is the voice_key for V2 and the legacy prefix plus voice_id for V1 (D35)', () => {
        expect(voiceIdentity(v2())).toBe(KEY)
        expect(voiceIdentity(v1())).toBe(`${LEGACY_V1_IDENTITY_PREFIX}${LEGACY_V1_VOICE_ID}`)
    })

    it('does not trim the V1 id', () => {
        expect(voiceIdentity(v1({ voice_id: ` ${LEGACY_V1_VOICE_ID} ` }))).toBe(`${LEGACY_V1_IDENTITY_PREFIX} ${LEGACY_V1_VOICE_ID} `)
    })

    it('ignores settings, emotion and preset linkage', () => {
        expect(voiceIdentity(v2({ settings: { stability: 0.2 }, emotion: 'sad', preset_id: 'p1', preset_name: 'Sad' }))).toBe(KEY)
        expect(voiceIdentity(v1({ speed: 1.2, pitch: 3, preset_id: 'p1' }))).toBe(`${LEGACY_V1_IDENTITY_PREFIX}${LEGACY_V1_VOICE_ID}`)
    })

    it('is null without an assigned voice', () => {
        expect(voiceIdentity(null)).toBeNull()
        expect(voiceIdentity(undefined)).toBeNull()
        expect(voiceIdentity(v1({ voice_id: '' }))).toBeNull()
    })
})

describe('isSameVoice', () => {
    it('matches within a shape regardless of settings', () => {
        expect(isSameVoice(v2(), v2({ settings: { speed: 1.1 }, voice_name: 'Renamed' }))).toBe(true)
        expect(isSameVoice(v1(), v1({ speed: 1.2, vol: 2 }))).toBe(true)
    })

    it('never matches across shapes, even with colliding ids', () => {
        expect(isSameVoice(v1({ voice_id: KEY }), v2())).toBe(false)
        expect(isSameVoice(v2(), v1({ voice_id: KEY }))).toBe(false)
    })

    it('distinguishes different voices', () => {
        expect(isSameVoice(v2(), v2({ voice_key: 'vk_00000000000000000000000000000000' }))).toBe(false)
        expect(isSameVoice(v1(), v1({ voice_id: 'English_magnetic_voiced_man' }))).toBe(false)
    })

    it('two unassigned voices are not the same voice', () => {
        expect(isSameVoice(null, null)).toBe(false)
        expect(isSameVoice(undefined, null)).toBe(false)
        expect(isSameVoice(v1(), null)).toBe(false)
        expect(isSameVoice(null, v2())).toBe(false)
    })
})
