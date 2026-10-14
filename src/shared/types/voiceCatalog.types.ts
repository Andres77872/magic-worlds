/**
 * Read-only voice projections the BFF attaches next to stored voices (D35,
 * 03 §5.12; FE mirror from 09 §1.2). They are never written back: every write
 * path removes them first (`stripVoiceProjections` in `@/shared/voice`).
 *
 * Sibling keys: `effective_voice` next to a card / preset / cast entry /
 * character-chat `voice`; `effective_narrator_voice` next to an adventure
 * snapshot's `narrator_voice` (Proposal, 09 §1.2).
 */

import type { NarrationTier } from './auth.types'

/** 03 §5.4.2 — values verbatim. */
export type VoiceSubstitutionReason =
    | 'unmapped_legacy' | 'voice_removed' | 'voice_unavailable' | 'voice_blocked'
    | 'not_call_eligible' | 'default_voice' | 'distinct_voice' | 'language_unsupported' | 'tier_fallback'

/** 03 §5.12 badge inventory keys (badge-type entries only; `daily_limit`, `previews_left` and the notices are
 *  rendered from other fields). 03 does not enumerate which keys `effective_voice.badges[]` carries versus which the
 *  SPA derives from catalog fields (`locked`, `house_voice`, `not_tested_language`); [08] fixes that split. */
export type VoiceBadgeKey =
    | 'leaving' | 'needs_reselect' | 'review' | 'retired' | 'replaced' | 'call_voice'
    | 'locked' | 'expressive_only' | 'standard_fallback' | 'not_tested_language' | 'house_voice'

export interface EffectiveVoice {
    voice_key: string | null
    display_name: string
    /** Always `elevenlabs`; `readEffectiveVoice` reads a missing route as it. */
    provider_route: 'elevenlabs'
    substitution_reason: VoiceSubstitutionReason | null
    flags: string[]          // e.g. 'pitch_dropped' | 'vol_dropped' | 'speed_clamped' | 'needs_review'
    badges: VoiceBadgeKey[]  // unknown values are ignored by the UI (forward compatible)
}

// ---------------------------------------------------------------------------
// Effective-voice lookup and review flags (R1-FE-03; BFF `voices_effective.py`).
// Every authenticated caller is served; the API maps a review-flag 404 (feature
// unavailable) to an empty list.
// ---------------------------------------------------------------------------

/** `ref_type` of `GET /voices/effective` (`RefType` in the BFF). */
export type EffectiveVoiceRefType = 'preset' | 'card' | 'card_draft' | 'card_version' | 'session'

/** `GET /voices/effective?ref_type=&ref_id=`: what the caller hears for each voice path of one document (D35). */
export interface EffectiveVoiceResponse {
    ref_type: EffectiveVoiceRefType
    ref_id: string
    voices: { json_path: string; effective_voice: EffectiveVoice }[]
}

/** Document kinds a D15 review flag points at. */
export type VoiceReviewFlagRefType = 'card' | 'card_draft' | 'preset' | 'template_cast'

/** Known D15 flag values; `VoiceReviewFlag.flags` stays `string[]` so unknown values pass through. */
export type VoiceReviewFlagKey = 'pitch_dropped' | 'vol_dropped' | 'speed_clamped' | 'needs_review'

/** One undismissed D15 review flag of the caller (`GET /voices/review-flags` item). */
export interface VoiceReviewFlag {
    flag_id: number
    ref_type: VoiceReviewFlagRefType
    ref_id: string
    json_path: string
    flags: string[]
    /** The BFF model allows null (`ReviewFlagItem.created_at: str | None`). */
    created_at: string | null
    /** Card items carry their workspace; presets are account level (null). */
    organization: { workspace_id: string } | null
}

export interface VoiceReviewFlagList {
    items: VoiceReviewFlag[]
}

// ---------------------------------------------------------------------------
// User catalog (D35, 03 §5.12; FE mirror of 09 §1.4). Dormant in R0: only
// `apiService.listVoiceCatalog` / `getVoiceCatalogByKeys` and their tests use it.
// ---------------------------------------------------------------------------

/** Lifecycle of a catalog voice (03 §5.4.2). Non-active values appear only in `?keys=` lookups. */
export type CatalogVoiceStatus = 'active' | 'hidden' | 'deprecating' | 'removed' | 'blocked'

export interface CatalogVoiceLanguage {
    language: string
    native: boolean
    accent: string | null
    /** Tier names (`standard` / `expressive`), never provider model ids (03 §5.12). */
    accepted_models: NarrationTier[]
    /** Relative BFF path of the own sample; fetched as an authed blob, never hotlinked (D10). */
    sample_url: string
}

export interface CatalogVoice {
    voice_key: string
    display_name: string
    description: string | null
    gender: string | null
    age: string | null
    accent: string | null
    primary_language: string
    languages: CatalogVoiceLanguage[]
    tags: string[]
    /** `source_kind` in designed | remixed | ivc. */
    house_voice: boolean
    call_eligible: boolean
    status: CatalogVoiceStatus
    disable_at: string | null
    /** Plan-gated and the caller is below `min_plan`. */
    locked: boolean
    min_plan: 'plus' | 'pro' | string | null
    /** Set when the voice is deprecating, removed or blocked. */
    replacement: { voice_key: string; display_name: string } | null
}

/** `GET /voices/catalog` filters, verbatim from 03 §5.12. `after` is passed separately as the cursor. */
export interface CatalogQuery {
    language?: string
    accent?: string
    gender?: string
    age?: string
    tags?: string[]
    use_case?: string
    works_in_calls?: boolean
    q?: string
    /** A card id. An owned card needs its workspace client (08 §5.1: 422 without, 404 elsewhere). */
    recommended_for?: string
    include_locked?: boolean
    /** At most 50 (08 §5.1). */
    limit?: number
}

/** Page envelope (08 §5.1). The `?keys=` batch answers `{ items }` only. */
export interface CatalogPage {
    items: CatalogVoice[]
    next_cursor: string | null
}

// ---------------------------------------------------------------------------
// Capabilities (D13; 09 §1.5 view model). The wire shape (08 §5.6) is mapped
// into this model by one adapter, `toVoiceCapabilities` in `@/shared/voice`.
// ---------------------------------------------------------------------------

/** 03 §5.4.1 surfaces. */
export type VoiceSurface = 'narration' | 'call' | 'preview' | 'admin_lab'

/** Editable recipe controls. Emotion is not a control: `supports_emotion` says whether it applies. */
export type VoiceControlKey = 'stability' | 'similarity_boost' | 'style' | 'use_speaker_boost' | 'speed'

export interface VoiceControlSpec {
    key: VoiceControlKey
    min?: number
    max?: number
    step?: number
    default: number | boolean
    /** `style` and `use_speaker_boost` are never user-editable (D13). */
    user_editable: boolean
}

export interface VoiceSurfaceCapabilities {
    surface: VoiceSurface
    /** Null when the surface has no tiers on the wire. */
    tier: NarrationTier | null
    controls: VoiceControlSpec[]
    supports_emotion: boolean
    supports_speed: boolean
    max_chars: number | null
    /** Per-turn narration cap (03 §5.8 `not_narrated`), when the server sends one. */
    max_turn_chars: number | null
    /** `false` on Expressive means turns fall back to Standard (D05). Absent on the wire reads as healthy. */
    healthy: boolean
}

/**
 * Companion-safety switches (EP-11). The BFF always sends `safeguards`;
 * `readSafeguards` in `@/shared/voice` defaults a missing one to all-off.
 */
export interface VoiceCapabilitySafeguards {
    retention_guard: boolean
    self_harm_pause: boolean
    break_nudge_minutes: number | null
    paused_until: string | null
}

/** Kill switches and the budget circuit (D28, D37). Fail open when the server does not report them. */
export interface VoiceCapabilityStatus {
    narration_available: boolean
    calls_available: boolean
    auto_narration_paused: boolean
}

export interface VoiceCapabilities {
    surfaces: VoiceSurfaceCapabilities[]
    // Client switches: a proposal of 09 §1.5, not in 08 yet. Null / empty / fail-open defaults
    // when the server does not send them.
    /**
     * Always `elevenlabs` (I-68): the BFF keeps the key as a constant for one
     * release and the adapter pins it. No code branches on it.
     */
    provider_route: 'elevenlabs'
    /** Plan-clamped tiers (D05); empty when not reported. */
    tiers_allowed: NarrationTier[]
    /** `user_preferences.narration_tier` (D05); null when not reported. */
    narration_tier: NarrationTier | null
    /** Required consent copy version (D25): always `voice-v2` (I-68), whatever the wire says. */
    consent_version_required: 'voice-v2'
    status: VoiceCapabilityStatus
    /** EP-11; always sent by the BFF, optional on read (all-off when missing). */
    safeguards?: VoiceCapabilitySafeguards
}
