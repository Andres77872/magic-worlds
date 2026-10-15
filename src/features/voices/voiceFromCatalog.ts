/**
 * A catalog pick as a stored voice (R1-FE-01, 03 §5.1.2): the canonical V2
 * shape new code builds. Settings and emotion start at the voice defaults
 * (null); the language is never user-chosen (D13), and a catalog pick has no
 * preset linkage.
 */
import type { CatalogVoice, StoredCharacterVoice } from '@/shared'
import { parseStoredVoice } from '@/shared/voice'

export function voiceFromCatalog(item: Pick<CatalogVoice, 'voice_key' | 'display_name' | 'provider'>): StoredCharacterVoice {
    return {
        ...(item.provider === 'fish_audio' ? { schema_version: 3 as const, provider: 'fish_audio' as const } : { schema_version: 2 as const, provider: 'elevenlabs' as const }),
        voice_key: item.voice_key,
        voice_name: item.display_name,
        settings: null,
        emotion: null,
        language_code: null,
    }
}

/**
 * A card's stored voice switched to a leaving voice's catalog replacement (05
 * §7.8 "Switch to {replacement}"): the voice keeps its settings, emotion and
 * language and drops its preset linkage (the preset still names the old
 * voice). Without a stored voice it is the replacement with voice defaults.
 */
export function voiceWithReplacement(stored: StoredCharacterVoice | null | undefined, replacement: Pick<CatalogVoice, 'voice_key' | 'display_name' | 'provider'>): StoredCharacterVoice {
    const voice = parseStoredVoice(stored)
    if (!voice || voice.provider !== (replacement.provider ?? 'elevenlabs')) return voiceFromCatalog(replacement)
    return { ...voice, voice_key: replacement.voice_key, voice_name: replacement.display_name, preset_id: null, preset_name: null }
}
