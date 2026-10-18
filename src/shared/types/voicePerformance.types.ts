/** Trusted metadata, separate from ordinary spoken text. Offsets are code points. */
export type VoiceDelivery = 'whisper' | 'emphasis' | 'soft' | 'fast' | 'slow' | 'stress' | 'forceful'
export type VoiceReaction = 'sigh' | 'laugh' | 'breath' | 'gasp' | 'pause_short' | 'pause_long'
export interface PronunciationReference { dictionary_id: string; version_id: string }
export interface VoicePerformance {
    version: 1
    direction?: string | null
    dictionary_refs: PronunciationReference[]
}
export interface UtterancePerformance extends VoicePerformance {
    offset_unit: 'unicode_code_points'
    spans: { start: number; end: number; delivery: VoiceDelivery }[]
    events: { at: number; event: VoiceReaction }[]
}
export interface PronunciationRule {
    text: string
    pronunciation: string
    kind: 'spoken' | 'cmu'
    case_sensitive: boolean
}
export interface PronunciationDictionary {
    dictionary_id: string
    version_id: string
    name: string
    language: 'en' | 'es'
    rules: PronunciationRule[]
    content_sha256: string
}
export interface PronunciationDictionaryWrite {
    name: string
    language: 'en' | 'es'
    rules: PronunciationRule[]
    expected_version_id?: string | null
}
export interface VoicePerformanceCapabilities {
    available: boolean
    languages: string[]
    deliveries: VoiceDelivery[]
    events: VoiceReaction[]
    phoneme_languages: string[]
    offset_unit: 'unicode_code_points'
    max_text_chars: number
    max_direction_chars: number
    free_previews_per_day: number
    credit_cost_after_free: number
}
export interface AuthoredVoicePreview {
    max_credit_cost?: 0 | 1
    voice_key: string
    model_id?: import('./voicePreset.types').FishSpeechModel
    text: string
    language: 'en' | 'es'
    kind: 'narration' | 'dialogue' | 'thought'
    emotion?: import('./voicePreset.types').VoiceEmotion | null
    performance: UtterancePerformance
}
