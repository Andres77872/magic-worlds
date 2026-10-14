/**
 * Legacy stored-row fixtures (D23): the values MiniMax-era rows still carry in
 * the database after the voice purge (I-68). Tests import these instead of
 * re-typing the literals, so the grep gate allow-lists exactly one file.
 *
 * Nothing here is a live provider path: the SPA never sends these shapes. They
 * are read-only data (stored V1 card voices, V1 preset rows, old call and
 * narration rows) that the permanent V1 reader must keep displaying.
 */
import type { CharacterVoiceLegacyV1, VoicePreset } from '@/shared/types'

/** `tts_job.provider` of a stored MiniMax narration job. */
export const LEGACY_TTS_PROVIDER = 'minimax' as const

/** `voice_session.tts_provider` / call-turn `metadata.voice.tts_provider` of a stored MiniMax call. */
export const LEGACY_CALL_TTS_PROVIDER = 'minimax_streaming' as const

/** The stored V1 voice id of the fixtures below. */
export const LEGACY_V1_VOICE_ID = 'English_radiant_girl'

/** A stored V1 (MiniMax) card voice, every optional field set. */
export const LEGACY_V1_VOICE: CharacterVoiceLegacyV1 = {
    voice_id: LEGACY_V1_VOICE_ID,
    speed: 1.05,
    vol: 1,
    pitch: 0,
    emotion: 'happy',
    language_boost: 'English',
}

/** {@link LEGACY_V1_VOICE} with another stored language hint (`null` clears it). */
export function legacyV1VoiceWithLanguage(language: string | null): CharacterVoiceLegacyV1 {
    return { ...LEGACY_V1_VOICE, language_boost: language }
}

/** The D35 identity prefix of a stored V1 voice: `voiceIdentity` returns this plus the raw `voice_id`. */
export const LEGACY_V1_IDENTITY_PREFIX = 'minimax:' as const

/** A stored V1 preset row as `GET /voice-presets` still serves it (read-only, D12). */
export const LEGACY_V1_PRESET: VoicePreset = {
    preset_id: 'preset-v1',
    name: 'Radiant',
    description: null,
    base_voice_id: LEGACY_V1_VOICE_ID,
    base_voice_name: 'Radiant Girl',
    speed: 1,
    volume: 1,
    pitch: 0,
    emotion: null,
    language_boost: 'English',
    is_global: false,
}
