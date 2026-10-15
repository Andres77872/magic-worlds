import type { PronunciationDictionary, VoicePerformanceCapabilities } from '@/shared'

export const PERFORMANCE_CAPABILITIES: VoicePerformanceCapabilities = {
    available: true, languages: ['en', 'es'], offset_unit: 'unicode_code_points', max_text_chars: 600, max_direction_chars: 300,
    deliveries: ['whisper', 'emphasis', 'soft', 'fast', 'slow', 'stress', 'forceful'],
    events: ['sigh', 'laugh', 'breath', 'gasp', 'pause_short', 'pause_long'], phoneme_languages: ['en'],
    free_previews_per_day: 3, credit_cost_after_free: 1,
}
export const PRONUNCIATION_FIXTURE: PronunciationDictionary = {
    dictionary_id: `pd_${'a'.repeat(32)}`, version_id: `pv_${'b'.repeat(32)}`, name: 'Harbour names', language: 'en',
    rules: [{ text: 'Aeloria', pronunciation: 'Ay LOR ee ah', kind: 'spoken', case_sensitive: false }], content_sha256: 'c'.repeat(64),
}
