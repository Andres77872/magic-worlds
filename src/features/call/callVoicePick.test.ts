import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CharacterVoiceV2, CharacterVoiceV3 } from '@/shared/types'
import { readCallVoicePick, saveCallVoicePick } from './callVoicePick'

const ELEVEN: CharacterVoiceV2 = {
    schema_version: 2,
    provider: 'elevenlabs',
    voice_key: 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f',
    voice_name: 'Eldrin',
    settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed: 1 },
    emotion: null,
    language_code: 'en',
    preset_id: null,
    preset_name: null,
}

const FISH: CharacterVoiceV3 = {
    schema_version: 3,
    provider: 'fish_audio',
    voice_key: 'vk_0a1b2c3d4e5f60718293a4b5c6d7e8f9',
    voice_name: 'Marisol',
    settings: null,
    language_code: 'es',
    preset_id: null,
    preset_name: null,
}

afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
})

describe('callVoicePick', () => {
    it('remembers the pick per account and character', () => {
        saveCallVoicePick('user-a', 'char-1', ELEVEN)
        saveCallVoicePick('user-a', 'char-2', FISH)

        expect(readCallVoicePick('user-a', 'char-1')).toEqual(ELEVEN)
        expect(readCallVoicePick('user-a', 'char-2')).toEqual(FISH)
        expect(readCallVoicePick('user-b', 'char-1')).toBeNull()
        expect(readCallVoicePick('user-a', 'char-3')).toBeNull()
    })

    it('forgets the pick on null (back to the chat voice)', () => {
        saveCallVoicePick('user-a', 'char-1', ELEVEN)
        saveCallVoicePick('user-a', 'char-1', null)
        expect(readCallVoicePick('user-a', 'char-1')).toBeNull()
        expect(localStorage.length).toBe(0)
    })

    it('needs an account and a character', () => {
        saveCallVoicePick(null, 'char-1', ELEVEN)
        saveCallVoicePick('user-a', undefined, ELEVEN)
        expect(localStorage.length).toBe(0)
        expect(readCallVoicePick(null, 'char-1')).toBeNull()
        expect(readCallVoicePick('user-a', null)).toBeNull()
    })

    it('reads an unreadable or foreign value as no pick', () => {
        saveCallVoicePick('user-a', 'char-1', ELEVEN)
        const key = localStorage.key(0)!
        localStorage.setItem(key, '{not json')
        expect(readCallVoicePick('user-a', 'char-1')).toBeNull()
        localStorage.setItem(key, JSON.stringify({ voice_id: 'narrator-1' }))
        expect(readCallVoicePick('user-a', 'char-1')).toBeNull()
    })

    it('never throws when storage is blocked', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
        expect(() => saveCallVoicePick('user-a', 'char-1', ELEVEN)).not.toThrow()
        expect(readCallVoicePick('user-a', 'char-1')).toBeNull()
    })
})
