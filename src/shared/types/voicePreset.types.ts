/**
 * Voice preset domain types. A preset is a named recipe (base MiniMax system
 * voice + speed/vol/pitch/emotion/language_boost). A `CharacterVoice` is the
 * denormalized recipe copied onto a character card when a voice is assigned.
 */
import type { AdminVoiceEmotion } from './adminVoice.types'

export interface CharacterVoice {
    voice_id: string
    speed?: number
    vol?: number
    pitch?: number
    emotion?: AdminVoiceEmotion
    language_boost?: string
    /** Linkage to the preset this was copied from (display only). */
    preset_id?: string
    preset_name?: string
}

export interface VoicePreset {
    preset_id: string
    name: string
    description?: string | null
    base_voice_id: string
    base_voice_name?: string | null
    speed: number
    volume: number
    pitch: number
    emotion?: AdminVoiceEmotion | null
    language_boost?: string | null
    /** Seeded read-only default available to every user. */
    is_global: boolean
    metadata?: Record<string, unknown>
    created_at?: string | null
    updated_at?: string | null
}

export interface VoicePresetCreatePayload {
    name: string
    description?: string | null
    base_voice_id: string
    base_voice_name?: string | null
    speed?: number
    volume?: number
    pitch?: number
    emotion?: AdminVoiceEmotion | null
    language_boost?: string | null
}

export type VoicePresetUpdatePayload = Partial<VoicePresetCreatePayload>

export interface VoicePresetPreviewRequest {
    voice_id: string
    text: string
    speed?: number
    vol?: number
    pitch?: number
    emotion?: AdminVoiceEmotion
    language_boost?: string
}
