import { describe, expect, it } from 'vitest'
import type { CharacterVoiceV2 } from '@/shared/types'
import { storedVoiceLanguage } from './storedVoiceLanguage'

const V2_VOICE: CharacterVoiceV2 = {
    schema_version: 2,
    provider: 'elevenlabs',
    voice_key: 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f',
    voice_name: 'Eldrin',
    language_code: null,
}

describe('storedVoiceLanguage (05 §7.1, D17)', () => {
    it('reads the voice’s base language code', () => {
        expect(storedVoiceLanguage({ ...V2_VOICE, language_code: 'es-MX' })).toBe('es')
        expect(storedVoiceLanguage({ ...V2_VOICE, language_code: 'EN' })).toBe('en')
        expect(storedVoiceLanguage(V2_VOICE)).toBeNull()
        expect(storedVoiceLanguage({ ...V2_VOICE, language_code: 'not a code' })).toBeNull()
    })

    it('says nothing without a voice', () => {
        expect(storedVoiceLanguage(null)).toBeNull()
        expect(storedVoiceLanguage(undefined)).toBeNull()
    })
})
