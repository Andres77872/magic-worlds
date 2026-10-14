import { describe, expect, it } from 'vitest'
import { isVoiceV2 } from '@/shared'
import { CATALOG_ELDRIN, V1_VOICE, V2_VOICE, VOICE_KEY_ELDRIN, VOICE_KEY_MAREN } from './fixtures'
import { voiceFromCatalog, voiceWithReplacement } from './voiceFromCatalog'

describe('voiceFromCatalog (R1-FE-01)', () => {
    it('builds the exact V2 shape, with no preset linkage', () => {
        const voice = voiceFromCatalog(CATALOG_ELDRIN)
        expect(voice).toEqual({
            schema_version: 2,
            provider: 'elevenlabs',
            voice_key: VOICE_KEY_ELDRIN,
            voice_name: 'Eldrin',
            settings: null,
            emotion: null,
            language_code: null,
        })
        expect(voice).not.toHaveProperty('preset_id')
        expect(isVoiceV2(voice)).toBe(true)
    })
})

describe('voiceWithReplacement (05 §7.8 "Switch to {replacement}")', () => {
    const MAREN = { voice_key: VOICE_KEY_MAREN, display_name: 'Maren' }

    it('keeps a V2 voice’s settings, emotion and language, and drops its preset linkage', () => {
        const stored = { ...V2_VOICE, emotion: 'calm' as const, language_code: 'es', preset_id: 'user-v2', preset_name: 'Harbour master' }
        expect(voiceWithReplacement(stored, MAREN)).toEqual({
            ...V2_VOICE,
            voice_key: VOICE_KEY_MAREN,
            voice_name: 'Maren',
            emotion: 'calm',
            language_code: 'es',
            preset_id: null,
            preset_name: null,
        })
    })

    it('turns a V1 voice into the replacement with voice defaults, its emotion and its language', () => {
        expect(voiceWithReplacement(V1_VOICE, MAREN)).toEqual({
            schema_version: 2,
            provider: 'elevenlabs',
            voice_key: VOICE_KEY_MAREN,
            voice_name: 'Maren',
            settings: null,
            emotion: 'happy',
            language_code: 'en',
        })
        expect(voiceWithReplacement(null, MAREN)).toEqual(voiceFromCatalog(MAREN))
    })
})
