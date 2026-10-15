/**
 * Preset → stored voice copy (05 §4.3, 09 §3.2). A preset is copied by value
 * onto the card as a stored voice, keeping its preset linkage.
 */
import type { StoredCharacterVoice, VoicePreset } from '@/shared'
import { isSameVoice } from '@/shared/voice'

export function voiceFromPreset(preset: VoicePreset): StoredCharacterVoice {
    const common = {
        voice_key: preset.voice_key,
        voice_name: preset.voice_name,
        emotion: preset.emotion ?? null,
        language_code: preset.language_code ?? null,
        preset_id: preset.preset_id,
        preset_name: preset.name,
    }
    return preset.provider === 'fish_audio'
        ? { ...common, schema_version: 3, provider: 'fish_audio', settings: preset.settings ?? null,
            ...(preset.performance ? { performance: preset.performance } : {}) }
        : { ...common, schema_version: 2, provider: 'elevenlabs', settings: preset.settings ?? null }
}

/** A preset is the current voice if its preset linkage matches, or — when the
 * voice was stored without preset linkage — it is the same voice. */
export function presetMatchesVoice(preset: VoicePreset, voice?: StoredCharacterVoice | null): boolean {
    if (!voice) return false
    if (voice.preset_id) return voice.preset_id === preset.preset_id
    return isSameVoice(voice, voiceFromPreset(preset))
}
