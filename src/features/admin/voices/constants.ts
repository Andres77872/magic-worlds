/**
 * Static configuration for the voice studio: input limits, seeded defaults, and
 * the MiniMax synthesis-control option lists used by the synthesis lab.
 */
import type { AdminVoiceConcreteType, AdminVoiceQueryType } from '@/shared'

/** A select option carrying an i18n key instead of resolved copy. */
export interface KeyedOption {
    value: string
    labelKey: string
    descriptionKey?: string
}

export const PREVIEW_TEXT_LIMIT = 500
export const TEST_TEXT_LIMIT = 1000
export const PROMPT_TEXT_LIMIT = 2000

// Clone source-audio constraints (MiniMax voice_clone).
export const CLONE_MAX_BYTES = 20 * 1024 * 1024
export const CLONE_MIN_SECONDS = 10
export const CLONE_MAX_SECONDS = 5 * 60
export const PROMPT_AUDIO_MAX_SECONDS = 8
export const CLONE_ACCEPT = 'audio/mpeg,audio/mp4,audio/wav,audio/x-wav,.mp3,.m4a,.wav'

export const DEFAULT_PROMPT =
    'Warm, expressive fantasy narrator with a clear cadence, intimate delivery, and restrained dramatic color.'
export const DEFAULT_PREVIEW_TEXT =
    'The candle gutters low as the hidden door opens. Speak carefully; this room remembers every promise.'
export const DEFAULT_TEST_TEXT =
    'The candle gutters low as the hidden door opens.<#0.4#> (sighs) Speak carefully; this room remembers every promise.'

// Synthesis-lab control defaults (match MiniMax T2A defaults; omitted from the
// request when left at these values so the call stays minimal).
export const DEFAULT_SPEED = 1
export const DEFAULT_VOL = 1
export const DEFAULT_PITCH = 0

export interface SynthSettings {
    model: string
    emotion: string // '' = Auto
    audioFormat: string
    sampleRate: string
    languageBoost: string
    speed: number
    vol: number
    pitch: number
}

export const DEFAULT_SYNTH_SETTINGS: SynthSettings = {
    model: 'speech-2.8-turbo',
    emotion: '',
    audioFormat: 'mp3',
    sampleRate: '32000',
    languageBoost: 'auto',
    speed: DEFAULT_SPEED,
    vol: DEFAULT_VOL,
    pitch: DEFAULT_PITCH,
}

export const MODEL_OPTIONS: KeyedOption[] = [
    { value: 'speech-2.8-hd', labelKey: 'admin.voices.synth.model.hd' },
    { value: 'speech-2.8-turbo', labelKey: 'admin.voices.synth.model.turbo' },
]

// Empty value = "Auto" (omitted from the request).
export const EMOTION_OPTIONS: KeyedOption[] = [
    { value: '', labelKey: 'admin.voices.synth.emotion.auto' },
    { value: 'calm', labelKey: 'admin.voices.synth.emotion.calm' },
    { value: 'happy', labelKey: 'admin.voices.synth.emotion.happy' },
    { value: 'sad', labelKey: 'admin.voices.synth.emotion.sad' },
    { value: 'angry', labelKey: 'admin.voices.synth.emotion.angry' },
    { value: 'fearful', labelKey: 'admin.voices.synth.emotion.fearful' },
    { value: 'disgusted', labelKey: 'admin.voices.synth.emotion.disgusted' },
    { value: 'surprised', labelKey: 'admin.voices.synth.emotion.surprised' },
]

export const FORMAT_OPTIONS: KeyedOption[] = [
    { value: 'mp3', labelKey: 'admin.voices.synth.format.mp3' },
    { value: 'wav', labelKey: 'admin.voices.synth.format.wav' },
    { value: 'flac', labelKey: 'admin.voices.synth.format.flac' },
]

export const SAMPLE_RATE_OPTIONS: KeyedOption[] = [
    { value: '32000', labelKey: 'admin.voices.synth.sampleRate.32000' },
    { value: '8000', labelKey: 'admin.voices.synth.sampleRate.8000' },
    { value: '16000', labelKey: 'admin.voices.synth.sampleRate.16000' },
    { value: '22050', labelKey: 'admin.voices.synth.sampleRate.22050' },
    { value: '24000', labelKey: 'admin.voices.synth.sampleRate.24000' },
    { value: '44100', labelKey: 'admin.voices.synth.sampleRate.44100' },
]

export const LANGUAGE_BOOST_OPTIONS: KeyedOption[] = [
    { value: 'auto', labelKey: 'admin.voices.synth.languageBoost.auto' },
    { value: 'English', labelKey: 'admin.voices.synth.languageBoost.English' },
    { value: 'Chinese', labelKey: 'admin.voices.synth.languageBoost.Chinese' },
    { value: 'Japanese', labelKey: 'admin.voices.synth.languageBoost.Japanese' },
    { value: 'Korean', labelKey: 'admin.voices.synth.languageBoost.Korean' },
    { value: 'Spanish', labelKey: 'admin.voices.synth.languageBoost.Spanish' },
    { value: 'French', labelKey: 'admin.voices.synth.languageBoost.French' },
    { value: 'German', labelKey: 'admin.voices.synth.languageBoost.German' },
    { value: 'Portuguese', labelKey: 'admin.voices.synth.languageBoost.Portuguese' },
    { value: 'Italian', labelKey: 'admin.voices.synth.languageBoost.Italian' },
    { value: 'Russian', labelKey: 'admin.voices.synth.languageBoost.Russian' },
    { value: 'Arabic', labelKey: 'admin.voices.synth.languageBoost.Arabic' },
]

// Content artifacts the toolbar can splice into the synthesis text.
export const INTERJECTION_TAGS = ['(sighs)', '(laughs)', '(gasps)', '(inhale)', '(exhale)', '(humming)'] as const

// Languages MiniMax encodes as the leading token of a system voice_id
// (e.g. `English_…`, `Chinese (Mandarin)_…`). Used to bucket the library's
// language filter; anything else falls into "Other". Superset of LANGUAGE_BOOST_OPTIONS.
export const KNOWN_VOICE_LANGUAGES: ReadonlySet<string> = new Set([
    'English',
    'Chinese',
    'Japanese',
    'Korean',
    'Spanish',
    'French',
    'German',
    'Portuguese',
    'Italian',
    'Russian',
    'Arabic',
    'Indonesian',
    'Vietnamese',
    'Dutch',
    'Turkish',
    'Thai',
    'Ukrainian',
    'Polish',
    'Romanian',
    'Greek',
    'Czech',
    'Finnish',
    'Hindi',
])

// System voices shown per page in the library browser.
export const SYSTEM_VOICE_PAGE_SIZE = 10

export const VOICE_TYPE_META: Record<AdminVoiceConcreteType, { labelKey: string; descriptionKey: string }> = {
    system: {
        labelKey: 'admin.voices.library.types.system.label',
        descriptionKey: 'admin.voices.library.types.system.description',
    },
    voice_cloning: {
        labelKey: 'admin.voices.library.types.cloned.label',
        descriptionKey: 'admin.voices.library.types.cloned.description',
    },
    voice_generation: {
        labelKey: 'admin.voices.library.types.designed.label',
        descriptionKey: 'admin.voices.library.types.designed.description',
    },
}

export const LIBRARY_FILTERS: Array<{ value: AdminVoiceQueryType; labelKey: string }> = [
    { value: 'all', labelKey: 'admin.voices.library.filters.all' },
    { value: 'system', labelKey: 'admin.voices.library.filters.system' },
    { value: 'voice_cloning', labelKey: 'admin.voices.library.filters.cloned' },
    { value: 'voice_generation', labelKey: 'admin.voices.library.filters.designed' },
]
