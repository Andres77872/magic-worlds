/**
 * Static configuration for the root voice console (D20). Live account limits
 * (slots, ops, budgets) are never hard-coded here: they come from Job C.
 */
import type {
    AcceptanceScoreKey,
    AcceptanceScriptKind,
    LabModelAlias,
    LibrarySort,
    NarrationTier,
    RemixPromptStrength,
    VoiceAgeBucket,
    VoiceCatalogStatus,
    VoiceGender,
    VoiceSettingsV2,
    VoiceSourceKind,
    VoiceVisibility,
} from '@/shared'

// ---- Models (03 §5.4.1, §5.6) ----

/** Both narration tiers and previews use v4; calls use v4 Turbo. */
export const STANDARD_MODEL_ID = 'eleven_v4'
/** Expressive tier. */
export const EXPRESSIVE_MODEL_ID = 'eleven_v4'
/** One review covers both narration tiers, which now share v4. */
export const ACCEPTANCE_MODELS = [STANDARD_MODEL_ID] as const

// ---- Catalog enums, in display order ----

export const CATALOG_STATUSES: VoiceCatalogStatus[] = ['draft', 'active', 'hidden', 'deprecating', 'removed', 'blocked', 'failed']
export const CATALOG_VISIBILITIES: VoiceVisibility[] = ['admin', 'public', 'plan_gated']
export const SOURCE_KINDS: VoiceSourceKind[] = [
    'owned_reference', 'licensed_reference',
    'designed',
    'remixed',
    'ivc',
    'pvc_shared',
    'library_perpetual',
    'library_noticed',
    'premade_deprecated',
]
export const GENDERS: VoiceGender[] = ['female', 'male', 'neutral']
export const AGE_BUCKETS: VoiceAgeBucket[] = ['young', 'middle_aged', 'old']

/** Owned provider voices: deletable from the provider, remixable (D19, 05 §8.9). */
export const OWNED_SOURCE_KINDS: ReadonlySet<VoiceSourceKind> = new Set(['designed', 'remixed', 'ivc'])
export const LIBRARY_SOURCE_KINDS: ReadonlySet<VoiceSourceKind> = new Set(['library_perpetual', 'library_noticed'])
/** Defaults may only use these until L-2 and L-12 are answered (03 §5.11). */
export const DEFAULT_ELIGIBLE_SOURCE_KINDS: ReadonlySet<VoiceSourceKind> = new Set(['designed', 'remixed'])
/**
 * 04 §3.5 "hear" rule, as the BFF builds it (`HEARD_SOURCE_KINDS`): until L-2 every
 * voice users can hear through the catalog machinery is an owned design or remix.
 * Publishing and replacement targets use it; IVC waits for P-15 (`ivc_publish_blocked`).
 */
export const HEARD_SOURCE_KINDS: ReadonlySet<VoiceSourceKind> = new Set(['designed', 'remixed'])

/**
 * Legal gates that are still open (16, 05 §12). Flip only when the owner records
 * a written answer: L-2 (Library public use) and L-2/L-12/L-16 (Library remix).
 */
export const LIBRARY_PUBLIC_USE_CONFIRMED = false
export const LIBRARY_REMIX_RULE_CONFIRMED = false

export const CATALOG_PAGE_SIZE = 50
/** Page size used to build the in-memory catalog index (pickers, readiness, joins). */
export const CATALOG_INDEX_PAGE_SIZE = 100

// ---- Acceptance (D09, D16) ----

export const SCORE_KEYS: AcceptanceScoreKey[] = ['timbre', 'naturalness', 'emotion_tags', 'accent', 'artefacts', 'consistency_vs_v4']
export const SCORE_VALUES = [1, 2, 3, 4, 5] as const
export const SCRIPT_KINDS: AcceptanceScriptKind[] = ['narration', 'dialogue', 'thought', 'numbers']
export const LIGHT_SCRIPT_KINDS: AcceptanceScriptKind[] = ['narration', 'dialogue']
/**
 * Fixed acceptance scripts (14 §5.3). Light acceptance (D34 languages) sends the
 * same base version; the BFF renders N1 and D1 only and records `acc-v1-<lang>`.
 */
export const SCRIPT_VERSION = 'acc-v1'

/** Nominal loudness target: the quietest accepted voice (D16). */
export const TARGET_LUFS = -18
/** Voices that need more attenuation than this are flagged (D16, S-16). */
export const MAX_ATTENUATION_DB = -6
/** `call_eligible` requires a v4 pass and at least this consistency (D09). */
export const CALL_ELIGIBLE_MIN_CONSISTENCY = 4
/** Proposed: warn below this score; the owner sets formal thresholds. */
export const LOW_SCORE_WARNING = 3

/** R0 exit target (D09): ≥ 40 published voices, ≥ 16 per curated language. */
export const PUBLISH_TARGET_TOTAL = 40
export const PUBLISH_TARGET_PER_LANGUAGE = 16

// ---- Languages (D34) ----

/** Fully curated languages: narrator + fallback pool required at R0 exit. */
export const CURATED_LANGUAGES = ['en', 'es'] as const
/** Light languages: a narrator is required; light acceptance only. */
export const LIGHT_LANGUAGES = ['fr', 'de', 'pt', 'it'] as const
export const CONSOLE_LANGUAGES: string[] = [...CURATED_LANGUAGES, ...LIGHT_LANGUAGES]
export const FALLBACK_POOL_MIN = 4

// ---- Library (D09) ----

export const LIBRARY_MIN_NOTICE_DAYS = 365
export const LIBRARY_MIN_VOICE_OPS = 5
export const LIBRARY_PAGE_SIZE = 30
export const LIBRARY_SORTS: LibrarySort[] = ['created_date', 'usage_character_count_1y', 'trending', 'cloned_by_count']

// ---- Voice Design and Remix (05 §8.8, §8.9) ----

export const DESIGN_DESCRIPTION_MIN = 20
export const DESIGN_DESCRIPTION_MAX = 1000
export const DESIGN_TEXT_MIN = 100
export const DESIGN_TEXT_MAX = 1000
export const DESIGN_LOUDNESS_DEFAULT = 0.5
export const DESIGN_GUIDANCE_DEFAULT = 5
export const REMIX_GUIDANCE_DEFAULT = 2
export const DESIGN_QUALITY_DEFAULT = 0.9
export const REMIX_PROMPT_STRENGTHS: RemixPromptStrength[] = ['low', 'medium', 'high', 'max']
export const DEFAULT_PROMPT =
    'Warm, expressive fantasy narrator with a clear cadence, intimate delivery, and restrained dramatic color.'
/** Exactly 100 characters: the design minimum. */
export const DEFAULT_PREVIEW_TEXT =
    'The candle gutters low as the hidden door opens. Speak carefully; this room remembers every promise.'

// ---- Synth lab (05 §8.11, 03 §5.6) ----

export type LabSettingKey = keyof VoiceSettingsV2

export interface LabModelProfile {
    alias: LabModelAlias
    settings: LabSettingKey[]
    sendsLanguageCode: boolean
    /**
     * The tier this alias serves (03 §5.4.1: v4 serves both tiers),
     * whose `max_chars` `GET /voices/capabilities` lists (narration, or `admin_lab`
     * when listed); null for the lab-only models. Text limits come from the
     * server, never from this file.
     */
    tier: NarrationTier | null
    /** Model-native audio tags (`[sighs]`, `[short pause]`). */
    audioTags: boolean
    /** `<break time="…"/>` support. */
    breaks: boolean
    /** Inline IPA as `"/ipa/"` (v4 only). */
    inlineIpa: boolean
}

export const LAB_MODELS: LabModelProfile[] = [
    { alias: 'el_v4', settings: ['stability', 'similarity_boost'], sendsLanguageCode: true, tier: 'standard', audioTags: true, breaks: false, inlineIpa: true },
]

/**
 * The lab request cap of the BFF (`AdminLabSynthesisRequest.text`, 5,000 characters).
 * A lower model limit comes from `GET /voices/capabilities` (the model's tier) or
 * from a 422 `text_over_model_limit` answer's `max_chars`.
 */
export const LAB_TEXT_MAX = 5000

/** The MP3 outputs the BFF lab accepts (anything else is 422 `unsupported_output_format`). */
export const LAB_OUTPUT_FORMATS = ['mp3_44100_128', 'mp3_44100_64'] as const
export const LAB_DEFAULT_OUTPUT_FORMAT = 'mp3_44100_128'
/**
 * Every output the console can play and download (R1-FE-06, 05 §4 output formats):
 * MP3, WAV and raw PCM (s16le mono, played through a WAV header; `pcmAudio`). The
 * lab offers one only when the A4 model list names it for the model
 * (`useLabModels`); without A4 the lab keeps `LAB_OUTPUT_FORMATS`.
 */
export const LAB_OUTPUT_FORMATS_R1 = [
    'mp3_44100_128',
    'mp3_44100_64',
    'mp3_22050_32',
    'mp3_44100_192',
    'wav_44100',
    'wav_24000',
    'pcm_24000',
] as const
/** Text normalization modes the lab knows; without A4 only `auto` is sent. */
export const LAB_TEXT_NORMALIZATIONS = ['auto', 'on', 'off'] as const
export const LAB_COMPARE_MAX = 3
/** App speech markup v1 (D27): stored text syntax, translated per model by the pipeline. */
export const DEFAULT_LAB_TEXT =
    'The candle gutters low as the hidden door opens. <#0.4#> (sighs) Speak carefully; this room remembers every promise.'

export interface SettingRange {
    min: number
    max: number
    step: number
    defaultValue: number
}

export const SETTING_RANGES: Record<Exclude<LabSettingKey, 'use_speaker_boost'>, SettingRange> = {
    stability: { min: 0, max: 1, step: 0.05, defaultValue: 0.5 },
    similarity_boost: { min: 0, max: 1, step: 0.05, defaultValue: 0.75 },
    style: { min: 0, max: 1, step: 0.05, defaultValue: 0 },
    speed: { min: 0.7, max: 1.2, step: 0.05, defaultValue: 1 },
}

// ---- Limits (D37, 05 §8.13) ----

export const SLOT_ALERT_RATIO = 0.9
export const DAILY_BUDGET_SETTING_KEY = 'daily_budget_chars'
export const BUDGET_THRESHOLDS = { alert50: 0.5, alert80: 0.8, paused95: 0.95, stopped100: 1 } as const
