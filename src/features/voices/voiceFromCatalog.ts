/**
 * A catalog pick as a stored voice (R1-FE-01, 03 §5.1.2): the canonical V2
 * shape new code builds. Settings and emotion start at the voice defaults
 * (null); the language is never user-chosen (D13), and a catalog pick has no
 * preset linkage.
 */
import type { CatalogVoice, CharacterVoiceV2, StoredCharacterVoice } from '@/shared'
import { isVoiceV2 } from '@/shared/voice'
import { storedVoiceLanguage } from '@/shared/voice/storedVoiceLanguage'
import { isVoiceEmotion } from './presetRowsV2'

export function voiceFromCatalog(item: Pick<CatalogVoice, 'voice_key' | 'display_name'>): CharacterVoiceV2 {
    return {
        schema_version: 2,
        provider: 'elevenlabs',
        voice_key: item.voice_key,
        voice_name: item.display_name,
        settings: null,
        emotion: null,
        language_code: null,
    }
}

/**
 * A card's stored voice switched to a leaving voice's catalog replacement (05
 * §7.8 "Switch to {replacement}"): a V2 voice keeps its settings, emotion and
 * language and drops its preset linkage (the preset still names the old
 * voice). A stored V1 voice has no V2 settings to keep, so it becomes the
 * replacement with voice defaults, its emotion when V2 accepts it, and the
 * language it names (`storedVoiceLanguage`).
 */
export function voiceWithReplacement(stored: StoredCharacterVoice | null | undefined, replacement: Pick<CatalogVoice, 'voice_key' | 'display_name'>): CharacterVoiceV2 {
    if (stored && isVoiceV2(stored)) {
        return { ...stored, voice_key: replacement.voice_key, voice_name: replacement.display_name, preset_id: null, preset_name: null }
    }
    const emotion = stored && isVoiceEmotion(stored.emotion) ? stored.emotion : null
    return { ...voiceFromCatalog(replacement), emotion, language_code: storedVoiceLanguage(stored) }
}
