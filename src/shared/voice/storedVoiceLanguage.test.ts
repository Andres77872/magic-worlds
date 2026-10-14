import { describe, expect, it } from 'vitest'
import type { CharacterVoiceV2 } from '@/shared/types'
import { LEGACY_V1_VOICE, legacyV1VoiceWithLanguage } from '@/test/fixtures/legacyMinimax'
import { storedVoiceLanguage } from './storedVoiceLanguage'

const V2_VOICE: CharacterVoiceV2 = {
    schema_version: 2,
    provider: 'elevenlabs',
    voice_key: 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f',
    voice_name: 'Eldrin',
    language_code: null,
}

describe('storedVoiceLanguage (05 §7.1, D17)', () => {
    it('reads a V2 voice’s base language code', () => {
        expect(storedVoiceLanguage({ ...V2_VOICE, language_code: 'es-MX' })).toBe('es')
        expect(storedVoiceLanguage({ ...V2_VOICE, language_code: 'EN' })).toBe('en')
        expect(storedVoiceLanguage(V2_VOICE)).toBeNull()
        expect(storedVoiceLanguage({ ...V2_VOICE, language_code: 'not a code' })).toBeNull()
    })

    it('reads the language a stored V1 voice’s boost names', () => {
        expect(storedVoiceLanguage(LEGACY_V1_VOICE)).toBe('en')
        expect(storedVoiceLanguage(legacyV1VoiceWithLanguage('Spanish'))).toBe('es')
        expect(storedVoiceLanguage(legacyV1VoiceWithLanguage(' Spanish '))).toBe('es')
        // `auto`, an uncurated language and a missing boost say nothing.
        expect(storedVoiceLanguage(legacyV1VoiceWithLanguage('auto'))).toBeNull()
        expect(storedVoiceLanguage(legacyV1VoiceWithLanguage('French'))).toBeNull()
        expect(storedVoiceLanguage(legacyV1VoiceWithLanguage(null))).toBeNull()
    })

    it('says nothing without a voice', () => {
        expect(storedVoiceLanguage(null)).toBeNull()
        expect(storedVoiceLanguage(undefined)).toBeNull()
    })
})
