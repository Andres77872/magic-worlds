/**
 * Voice domain types. A `StoredCharacterVoice` is the denormalized ElevenLabs
 * voice copied onto a card, snapshot cast entry or narrator slot when a voice
 * is assigned (03 §5.1). A preset is a named recipe; `VoicePresetV2` is the
 * row every read returns and every write creates (09 §1.3).
 *
 * Read stored voices through `@/shared/voice` (`parseStoredVoice`,
 * `hasAssignedVoice`, `voiceIdentity`, `isSameVoice`, `voiceDisplayName`).
 */
import type { NarrationTier } from './auth.types'
import type { EffectiveVoice } from './voiceCatalog.types'

// ---- CharacterVoice v2: canonical, verbatim from 03 §5.1.2 ----

export type VoiceEmotion =
  | 'happy' | 'sad' | 'angry' | 'fearful' | 'disgusted' | 'surprised' | 'calm';

export interface VoiceSettingsV2 {
  stability?: number | null;        // 0..1
  similarity_boost?: number | null; // 0..1
  style?: number | null;            // 0..1
  use_speaker_boost?: boolean | null;
  speed?: number | null;            // 0.7..1.2
}

export interface CharacterVoiceV2 {
  schema_version: 2;
  provider: 'elevenlabs';
  voice_key: string;                // /^vk_[0-9a-f]{32}$/
  voice_name: string;               // 1..255
  settings?: VoiceSettingsV2 | null;
  emotion?: VoiceEmotion | null;
  language_code?: string | null;    // /^[a-z]{2,3}$/
  preset_id?: string | null;        // ≤64
  preset_name?: string | null;      // ≤255
}

/** A stored voice: always the ElevenLabs shape above. */
export type StoredCharacterVoice = CharacterVoiceV2

// ---- end of 03 §5.1.2 ----

/** ElevenLabs preset read DTO (03 §5.3, verbatim from 09 §1.3). */
export interface VoicePresetV2 {
    preset_id: string; name: string; description: string | null
    voice_key: string; voice_name: string
    settings: VoiceSettingsV2 | null; emotion: VoiceEmotion | null; language_code: string | null
    is_global: boolean; schema_version: 2; provider: 'elevenlabs'
    effective_voice?: EffectiveVoice           // read-only (D35)
}

/**
 * EP-3 body of `POST /voice-presets` and `PUT /voice-presets/{id}`: the only
 * preset write. `settings` takes stability, similarity_boost and speed only
 * (`style` / `use_speaker_boost` are 422).
 */
export type VoicePresetV2Write = Pick<VoicePresetV2, 'name' | 'description' | 'voice_key' | 'settings' | 'emotion'>

/** The fixed recipe-preview texts (D18): one narration, dialogue and thought line per language. */
export type PreviewTextId = 'narration' | 'dialogue' | 'thought'

/** `GET /voices/preview-texts?language=` item (08 §5.1). Account scope. */
export interface PreviewTextItem {
    text_id: PreviewTextId
    kind: PreviewTextId
    text: string
}

export interface PreviewTextsResponse {
    items: PreviewTextItem[]
}

/**
 * EP-6 body of `POST /voice-presets/preview` (D18, 08 §5.2): a fixed `text_id`,
 * never free text. Exactly these keys (extra=forbid).
 */
export interface VoicePresetPreviewRequestV2 {
    voice_key: string
    settings: VoiceSettingsV2 | null
    emotion: VoiceEmotion | null
    text_id: PreviewTextId
    language: string
    tier: NarrationTier
}

/** Metered preview result; the audio is `GET /voice-presets/preview/{cache_key}.mp3` (authed blob). */
export interface VoicePresetPreviewResponse {
    cache_key: string
    url?: string | null
    cached?: boolean
    previews_left?: number | null
    /** Catalog attenuation (D16), when the server sends it. */
    gain_db?: number | null
    /** The fixed text that was rendered (05 §6.6 proposal), when the server sends it; null for a sample. */
    text?: string | null
    /** EP-6: the tier that rendered; differs from the requested tier on a Standard fallback. */
    tier_used?: NarrationTier | null
    /** EP-6: a fresh render or the voice's catalog sample. */
    source?: 'render' | 'sample'
    /**
     * AC-P5 (05 §6.3): free renders left today, never above `previews_left`.
     * 0 with previews left means the next render costs 1 credit.
     */
    free_previews_left?: number | null
}
