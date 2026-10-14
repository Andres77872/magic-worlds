/**
 * Root voice console (D20): provider-neutral admin DTOs for the `/admin/voices/*`
 * routes listed in 08 §5.3 (paths are 08's names; 05 §8.2 mirrors them).
 *
 * Column names follow the canonical tables of 03 §5.2 (`voice_catalog`,
 * `voice_catalog_acceptance`, `voice_default`, `voice_legacy_mapping`,
 * `voice_runtime_setting`). Envelopes that 08 does not
 * spell out are this file's proposal and are marked "Proposal".
 *
 * FE proposals frozen for R0-BE-35/36 (2026-10-12; 03 §5.16). The BFF adopts
 * them as written or renegotiates them here first. Every proposal below says
 * what the console does when an optional field or the route is missing, and
 * names the fields the console requires ("Required by the console"):
 * - `AdminCatalogSummary` / `AdminCatalogPage.summary`: the publish progress counts.
 * - `AdminVoiceSyncResponse`: the `POST /admin/voices/sync` answer.
 * - `AdminCatalogDeleteChallenge` / `AdminCatalogDeleteResult`: the two-step
 *   provider delete with `?confirm_token=`.
 * - `AcceptanceRender` / `AcceptanceRenderResponse` (with `audio_url`) and
 *   `AcceptanceVerdictResponse`.
 * - `VoiceDefaultsResponse.last_resort_voice_key` and `VoiceDefaultsUpdateResponse`.
 * - `LegacyMappingRow.reference_count` and the `LegacyMappingCoverage` envelope.
 * - `AdminVoiceLimits` and the `X-Voice-*` lab headers (I-14).
 *
 * Identity rule (D11, D35): catalog voices are keyed by `voice_key`. Stored V1
 * ids only appear as `legacy_voice_id`; nothing here carries a bare V1 voice-id
 * field. Audio is a BFF media path, base64 or a Blob — never hex.
 */
import type { NarrationTier } from './auth.types'
import type { VoiceEmotion, VoicePreset, VoicePresetV2, VoiceSettingsV2 } from './voicePreset.types'

// The root metrics envelopes (`/admin/voices/metrics/*`) ride on this module's barrel export.
export * from './adminVoiceMetrics.types'

// ---- 03 §5.4.2 catalog enums ----

export type VoiceSourceKind =
    | 'designed'
    | 'remixed'
    | 'ivc'
    | 'pvc_shared'
    | 'library_perpetual'
    | 'library_noticed'
    | 'premade_deprecated'

export type VoiceCatalogStatus = 'draft' | 'active' | 'hidden' | 'deprecating' | 'removed' | 'blocked' | 'failed'

/** Who may pick the voice; playback is never gated (03 §5.2). */
export type VoiceVisibility = 'admin' | 'public' | 'plan_gated'

export type VoiceGender = 'male' | 'female' | 'neutral'
export type VoiceAgeBucket = 'young' | 'middle_aged' | 'old'

/** `voice_reference.ref_type` (03 §5.2). Persona-card references are excluded server-side (D38). */
export type VoiceReferenceType = 'card' | 'card_draft' | 'card_version' | 'preset' | 'template_cast' | 'session_snapshot'

// ---- Acceptance (03 §5.2 `voice_catalog_acceptance`, D09, D16) ----

export type AcceptanceScoreKey = 'timbre' | 'naturalness' | 'emotion_tags' | 'accent' | 'artefacts' | 'consistency_vs_v4'
/** Rubric scores, 1–5 each. */
export type AcceptanceScores = Record<AcceptanceScoreKey, number>
export type AcceptanceVerdict = 'pass' | 'fail'
/** The fixed acceptance scripts (D09, 05 §8.4 step 2). */
export type AcceptanceScriptKind = 'narration' | 'dialogue' | 'thought' | 'numbers'

export interface AdminCatalogAcceptance {
    /** Provider model id as stored (`eleven_flash_v2_5`, `eleven_v4`). */
    model_id: string
    language: string
    verdict: AcceptanceVerdict
    scores: AcceptanceScores
    integrated_lufs: number | null
    /** Attenuation only: always ≤ 0 (D16). */
    gain_db: number | null
    script_version: string
    reviewed_by_user_id: number | null
    reviewed_at: string | null
}

// ---- Catalog rows ----

/** `voice_catalog_language` plus the own showcase sample for that language (D10). */
export interface AdminCatalogLanguage {
    language: string
    locale: string | null
    accent: string | null
    /** Allow-listed provider models verified for this language. */
    model_ids: string[]
    /** BFF path of the own showcase sample, null until one is rendered. Fetched as an authed blob. */
    sample_url: string | null
}

/** Library owner terms recorded at add time (03 §5.2 `terms_at_add`). */
export interface LibraryTermsAtAdd {
    live_moderation_enabled: boolean | null
    free_users_allowed: boolean | null
    rate: number | null
    fiat_rate: number | null
    voice_mixing_allowed: boolean | null
}

/** One `voice_catalog` row as the root console reads it (`GET /admin/voices/catalog`). */
export interface AdminCatalogVoice {
    voice_key: string
    provider: string
    /** Root-only (05 §8.3): shown only through the copyable id in the detail drawer. */
    provider_voice_id: string
    source_kind: VoiceSourceKind
    provider_category: string | null
    library_voice_id: string | null
    public_owner_id: string | null
    parent_voice_key: string | null
    /** The provider's own name; it drifts, so the list shows it next to ours. */
    provider_name: string
    display_name: string
    description: string | null
    gender: VoiceGender | null
    age: VoiceAgeBucket | null
    accent: string | null
    primary_language: string | null
    tags: string[]
    default_settings: VoiceSettingsV2 | null
    notice_period_days: number | null
    disable_at: string | null
    terms_at_add: LibraryTermsAtAdd | null
    safety_control: string | null
    uses_custom_slot: boolean
    status: VoiceCatalogStatus
    suspect_since: string | null
    visibility: VoiceVisibility
    min_plan: string | null
    call_eligible: boolean
    replacement_voice_key: string | null
    sort_rank: number
    /** `voice_reference` rows for this voice (persona cards excluded, D38). */
    reference_count: number
    languages: AdminCatalogLanguage[]
    acceptance: AdminCatalogAcceptance[]
    created_at: string | null
    updated_at: string | null
    last_synced_at: string | null
}

/** Server filter for acceptance state (05 §8.3). */
export type AdminAcceptanceFilter = 'untested' | 'accepted' | 'failed'

export interface AdminCatalogQuery {
    status?: VoiceCatalogStatus
    visibility?: VoiceVisibility
    source_kind?: VoiceSourceKind
    primary_language?: string
    call_eligible?: boolean
    acceptance?: AdminAcceptanceFilter
    q?: string
    after?: string
    limit?: number
}

/**
 * Proposal (FE, frozen for R0-BE-35): progress towards the R0 exit target
 * (≥ 40 published, ≥ 16 per curated language; D09), counted over the whole
 * catalog, not the page.
 * - `published_total`: rows with `status = 'active'` and `visibility <> 'admin'`.
 * - `published_by_language`: the same rows counted once per language with a Flash
 *   (`eleven_flash_v2_5`) `pass` in `voice_catalog_acceptance`; keys are ISO 639-1.
 * Missing or null: the console counts the loaded rows itself (`publishProgress`).
 */
export interface AdminCatalogSummary {
    published_total: number
    published_by_language: Record<string, number>
}

export interface AdminCatalogPage {
    items: AdminCatalogVoice[]
    next_cursor: string | null
    /** Proposal: see `AdminCatalogSummary`. Optional; sent on the first page at least. Missing: counted from the loaded rows. */
    summary?: AdminCatalogSummary | null
}

/**
 * `PATCH /admin/voices/catalog/{voice_key}` (08 §5.3): display metadata, tags,
 * publish (`status=active` + `visibility`), hide/retire (`status=hidden`),
 * replacement, `visibility`, `min_plan` and `sort_rank`.
 */
export interface AdminCatalogUpdate {
    display_name?: string
    description?: string | null
    gender?: VoiceGender | null
    age?: VoiceAgeBucket | null
    accent?: string | null
    primary_language?: string | null
    tags?: string[]
    sort_rank?: number
    default_settings?: VoiceSettingsV2 | null
    status?: 'active' | 'hidden'
    visibility?: VoiceVisibility
    min_plan?: string | null
    replacement_voice_key?: string | null
}

/**
 * Query options of `PATCH /admin/voices/catalog/{voice_key}` (03 §5.16 I-29/I-34).
 * `repoint_dependents_to`: when the change would make this voice ineligible as
 * other voices' replacement (409 `voice_is_replacement`), move those voices to
 * this voice key in the same transaction. An invalid target is 422
 * `repoint_target_invalid` with `{voice_key, reason}` naming the first dependent
 * it does not fit.
 */
export interface AdminCatalogUpdateOptions {
    repointDependentsTo?: string | null
}

/**
 * The 409 `voice_is_replacement` body (I-34): the dependents the change would
 * invalidate and, per dependent key, the `replacement_problem` code it would hit.
 */
export interface VoiceIsReplacementDetail {
    code: 'voice_is_replacement'
    message?: string
    dependent_voice_keys: string[]
    reasons: Record<string, string>
}

/** The 422 `repoint_target_invalid` body (I-34). `voice_key` is absent when the target is not a voice key. */
export interface RepointTargetInvalidDetail {
    code: 'repoint_target_invalid'
    message?: string
    voice_key?: string
    reason: string
}

export interface AdminCatalogImpactExample {
    ref_type: VoiceReferenceType
    ref_id: string
    owner_user_id: number | null
    /** Optional human label (card or preset name) for the example list. */
    label: string | null
}

/** `GET /admin/voices/catalog/{voice_key}/impact` (D19, D20, 08 §5.3). */
export interface AdminCatalogImpact {
    voice_key: string
    reference_counts: Partial<Record<VoiceReferenceType, number>>
    total_references: number
    distinct_owners: number
    /** Up to 20 example references. */
    examples: AdminCatalogImpactExample[]
    /** D33 collisions the change would cause (computed for the stored replacement, 05 §8.2 A6 fallback). */
    collision_count: number
    replacement_voice_key: string | null
}

export type VoiceSyncJob = 'A' | 'B' | 'C'

export interface AdminVoiceSyncRequest {
    job: VoiceSyncJob
    /** Job B only; 1–100 keys. */
    voice_keys?: string[]
    /**
     * Root's override of a Job B `mass_removal` abort (D19 item 7, I-29/I-34):
     * needs `job: 'B'` and explicit `voice_keys` (422 otherwise). Each voice is
     * re-read on its own and only a confirmed provider 404 removes it. 409
     * `no_mass_removal_abort` when Job B's last run did not abort on mass removal.
     */
    confirm_removal?: boolean
}

/**
 * Proposal (FE, frozen for R0-BE-35): response of `POST /admin/voices/sync`
 * (202 or 200). Jobs run in the background; the console only toasts the status
 * and reads finished runs from `AdminVoiceLimits.sync_runs`.
 * - `run_id`: the sync-run row id, null when the job was not started.
 * - `status`: `queued` or `running` when accepted; `completed` when it ran inline;
 *   `aborted` (mass-miss guard) or `failed` otherwise.
 * - `detail`: an optional operator-facing reason. The `confirm_removal` override
 *   answers `completed` with `"removed=<n> present=<n> errors=<n> skipped=<n>
 *   replacement_orphans=<n>"`, or `running` with `lease_held` when another sync
 *   holds the lease. Job C answers its skip reason.
 * Missing fields: the console toasts the queued job and reloads the limits, so
 * any 2xx body works. Missing route: an error toast.
 */
export interface AdminVoiceSyncResponse {
    job: VoiceSyncJob
    run_id: string | null
    status: 'queued' | 'running' | 'completed' | 'aborted' | 'failed'
    detail?: string | null
}

/**
 * Proposal (FE, frozen for R0-BE-35): the two-step confirm token of
 * `DELETE /admin/voices/catalog/{voice_key}` (D19 "confirm twice").
 * 1. `DELETE …/{voice_key}` with no query: 200 with this challenge. Nothing is deleted.
 * 2. `DELETE …/{voice_key}?confirm_token=<token>`: the provider delete, answered by
 *    `AdminCatalogDeleteResult`.
 * The token is single-use and bound to the root user and `voice_key`. An expired
 * or unknown token is 409 `confirm_token_invalid`. The D19 blockers (not owned,
 * references > 0, `deprecating`/`removed`) are 409 with their reason at either step.
 * Required by the console: `status` picks the step and `confirm_token` is sent back.
 * Missing route: the dialog shows the error and nothing is deleted.
 */
export interface AdminCatalogDeleteChallenge {
    status: 'confirmation_required'
    confirm_token: string
    /** ISO 8601; null means the server gives no deadline. */
    expires_at: string | null
}

/**
 * Proposal (FE, frozen for R0-BE-35): step 2 of the provider delete.
 * Required by the console: `voice` replaces the catalog row.
 */
export interface AdminCatalogDeleteResult {
    status: 'deleted'
    /** The row is kept with its new status; catalog rows are never hard-deleted. */
    voice: AdminCatalogVoice
}

export type AdminCatalogDeleteResponse = AdminCatalogDeleteChallenge | AdminCatalogDeleteResult

// ---- Acceptance routes ----

/** `POST /admin/voices/acceptance/renders` (08 §5.3). */
export interface AcceptanceRenderRequest {
    voice_key: string
    model_ids: string[]
    languages: string[]
    script_version: string
}

/**
 * Proposal (FE, frozen for R0-BE-36): one rendered acceptance script, one per
 * (model, language, script kind). Renders are `voice_sample_asset` rows of kind
 * `acceptance`. Required by the console: the ids, `language`, `script_kind`,
 * `audio_url` and `status`. Missing `integrated_lufs`: the rubric starts empty.
 */
export interface AcceptanceRender {
    render_id: string
    voice_key: string
    model_id: string
    language: string
    script_kind: AcceptanceScriptKind
    /**
     * The script version recorded for this item (`acc-v1`, or `acc-v1-<lang>` for a
     * D34 light language, I-4); a mixed batch differs per item. Missing or null:
     * the console shows the response's `script_version`.
     */
    script_version?: string | null
    /** The script text, shown next to the player as its transcript. */
    text: string | null
    /**
     * BFF path of the rendered MP3 under an authed media prefix (for example
     * `/admin/voices/samples/{sample_asset_id}.mp3`), fetched as an authed blob.
     * Null when `status = 'failed'`. Never a provider URL, never hex.
     */
    audio_url: string | null
    duration_ms: number | null
    /**
     * Optional. I-15 measures loudness offline, so the BFF normally sends null or
     * omits it; when it is a finite number, the rubric pre-fills it (root still
     * confirms the value). Missing, null or non-finite: the rubric starts empty.
     */
    integrated_lufs?: number | null
    status: 'ready' | 'failed'
    /** Why a `failed` item has no audio, e.g. `acceptance_scripts_missing` for a language without curated scripts. */
    error_code?: string | null
}

/**
 * Proposal (FE, frozen for R0-BE-36): the answer of
 * `POST /admin/voices/acceptance/renders`. `script_version` echoes the stored
 * version (`acc-v1`, or `acc-v1-<lang>` for D34 light languages, I-4).
 * Required by the console: `items`. Missing route: the queue lists the error per voice.
 */
export interface AcceptanceRenderResponse {
    voice_key: string
    script_version: string
    items: AcceptanceRender[]
}

/**
 * `PUT /admin/voices/acceptance/{voice_key}/{model_id}/{language}` body (08 §5.3, I-15).
 * - `integrated_lufs`: from an offline loudness meter (BS.1770), entered by root.
 *   The console sends it with every `pass` (and with a `fail` when entered).
 * - The BFF stores `gain_db = min(0, −18 − integrated_lufs)` (attenuation only)
 *   and refuses a `pass` whose `gain_db < −6` with 422 `gain_out_of_range` (D16).
 *   The console blocks that case before sending, with the same reason.
 * - Rounding: the refusal compares the unrounded gain (a pass needs
 *   `integrated_lufs ≤ −12`), so the BFF must check before it rounds the stored
 *   `gain_db`; the console shows the limit in LUFS for the same reason.
 */
export interface AcceptanceVerdictRequest {
    verdict: AcceptanceVerdict
    scores: AcceptanceScores
    integrated_lufs?: number | null
}

/**
 * Proposal (FE, frozen for R0-BE-36): the stored row (with the server's
 * `gain_db`) plus the updated catalog row (`call_eligible`, `languages[].sample_url`).
 * Required by the console: `voice` replaces the catalog row; `acceptance` is not read yet.
 */
export interface AcceptanceVerdictResponse {
    acceptance: AdminCatalogAcceptance
    voice: AdminCatalogVoice
}

/** `POST /admin/voices/catalog/{voice_key}/samples` (showcase re-render). */
export interface CatalogSampleRenderRequest {
    languages?: string[]
    model_ids?: string[]
}

export interface CatalogSample {
    sample_asset_id: string
    language: string
    model_id: string
    kind: 'showcase' | 'design_preview' | 'acceptance'
    url: string
}

export interface CatalogSampleRenderResponse {
    voice_key: string
    items: CatalogSample[]
}

// ---- Defaults (03 §5.11, D31) ----

export type VoiceDefaultRole = 'narrator' | 'character_fallback'

export interface VoiceDefaultRow {
    role: VoiceDefaultRole
    language: string
    rank: number
    voice_key: string
    updated_by_user_id: number | null
    updated_at: string | null
}

/** `GET /admin/voices/defaults`: every `voice_default` row (03 §5.11). */
export interface VoiceDefaultsResponse {
    items: VoiceDefaultRow[]
    /**
     * Proposal (FE, frozen for R0-BE-31/35): the parsed `VOICE_LAST_RESORT_VOICE_KEY`
     * env value, shown read-only. Null (or absent) when the env is unset or names
     * no catalog voice; the console then shows "Not set".
     */
    last_resort_voice_key: string | null
}

/**
 * Proposal (FE, frozen for R0-BE-35): answer of `PUT /admin/voices/defaults/{role}/{language}`,
 * the stored rows of the edited (role, language) cell ordered by `rank`. A failed
 * §5.11 eligibility check is 422 with the failing check as the message.
 * Required by the console: `items` replaces the edited cell.
 */
export interface VoiceDefaultsUpdateResponse {
    items: VoiceDefaultRow[]
}

// ---- Legacy mapping (03 §5.2, D21, D33) ----

export type LegacyMappingStatus = 'proposed' | 'approved' | 'retired'

export interface LegacyMappingRow {
    legacy_voice_id: string
    /** null = explicitly unmapped. */
    voice_key: string | null
    /** Ordered candidates for the D33 distinct-voice rule. */
    alternate_voice_keys: string[]
    settings_override: VoiceSettingsV2 | null
    legacy_language: string | null
    status: LegacyMappingStatus
    reviewed_by_user_id: number | null
    reviewed_at: string | null
    notes: string | null
    /**
     * Proposal (FE, frozen for R0-BE-35): live `voice_reference`-style references
     * to this legacy id across cards, drafts, versions, presets, template casts and
     * session snapshots, persona cards excluded (D38). The R0-DATA-04 coverage
     * query (C-1) is the source. 0 when unreferenced. Missing: the console shows —.
     */
    reference_count?: number
}

export interface LegacyMappingListResponse {
    items: LegacyMappingRow[]
}

/** `PUT /admin/voices/legacy-mapping/{legacy_voice_id}` body. */
export interface LegacyMappingUpdate {
    voice_key: string | null
    alternate_voice_keys: string[]
    settings_override: VoiceSettingsV2 | null
    legacy_language: string | null
    status: LegacyMappingStatus
    notes: string | null
}

export interface LegacyCoverageCount {
    total: number
    mapped: number
}

export interface LegacyTargetMetric {
    voice_key: string
    /** Distinct legacy ids mapped to this target. */
    legacy_ids: number
    /** Legacy ids mapped here that co-occur in the same casts (D33). */
    co_occurring_ids: number
    alternates: number
}

/**
 * Proposal (FE, frozen for R0-BE-35): `GET /admin/voices/legacy-mapping/coverage`,
 * built from the R0-DATA-04 queries (C-1 referenced ids, C-4 legacy ids per
 * target). `unmapped_ids` lists referenced ids without an
 * approved mapping, most referenced first. Required by the console: every field.
 * Missing route: the module shows its load error with a retry, and the mapping
 * table still works.
 */
export interface LegacyMappingCoverage {
    referenced: LegacyCoverageCount
    unmapped_ids: string[]
    legacy_ids_per_target: LegacyTargetMetric[]
    generated_at: string | null
}

// ---- Library browser (D09, D19) ----

export type LibrarySort = 'created_date' | 'usage_character_count_1y' | 'trending' | 'cloned_by_count'

/** Root filters only: the BFF always adds the enforced D09 filters. */
export interface LibraryVoiceQuery {
    language?: string
    locale?: string
    gender?: string
    age?: string
    accent?: string
    use_case?: string
    search?: string
    sort?: LibrarySort
    page?: number
    page_size?: number
}

export interface LibraryVerifiedLanguage {
    language: string
    locale: string | null
    accent: string | null
    model_ids: string[]
}

export interface LibraryVoice {
    public_owner_id: string
    library_voice_id: string
    name: string
    description: string | null
    labels: Record<string, string>
    category: string | null
    notice_period_days: number | null
    rate: number | null
    fiat_rate: number | null
    free_users_allowed: boolean | null
    live_moderation_enabled: boolean | null
    safety_control: string | null
    voice_mixing_allowed: boolean | null
    verified_languages: LibraryVerifiedLanguage[]
    /** Upstream preview: root-only, never re-served to users (D10). */
    preview_url: string | null
    /** The catalog voice when this Library voice is already in our account. */
    catalog_voice_key: string | null
}

export interface LibraryVoicePage {
    items: LibraryVoice[]
    page: number
    has_more: boolean
}

/** `POST /admin/voices/library/add` (both root attestations are required, 05 §8.7). */
export interface LibraryAddRequest {
    public_owner_id: string
    library_voice_id: string
    new_name: string
    attest_not_child_like: boolean
    attest_no_public_figure: boolean
}

// ---- Voice Design and Remix (D20) ----

export interface VoiceDesignRequest {
    voice_description: string
    /** 100–1,000 characters, or null with `auto_generate_text`. */
    text: string | null
    auto_generate_text: boolean
    loudness?: number
    seed?: number | null
    guidance_scale?: number
    quality?: number | null
    should_enhance?: boolean
}

export interface VoiceDesignPreview {
    generated_voice_id: string
    audio_base_64: string
    media_type: string
    duration_secs: number | null
    language: string | null
}

export interface VoiceDesignResponse {
    previews: VoiceDesignPreview[]
    text: string | null
}

export type RemixPromptStrength = 'low' | 'medium' | 'high' | 'max'

/** `POST /admin/voices/catalog/{voice_key}/remix` body. */
export interface VoiceRemixRequest {
    voice_description: string
    text: string | null
    auto_generate_text: boolean
    guidance_scale?: number
    prompt_strength?: RemixPromptStrength
    loudness?: number
    seed?: number | null
}

export interface VoiceDesignLabels {
    language: string
    accent: string | null
    gender: VoiceGender | null
    age: VoiceAgeBucket | null
}

/** `POST /admin/voices/design/save` (05 §8.8; remix saves pass `parent_voice_key`, 05 §8.9). */
export interface VoiceDesignSaveRequest {
    generated_voice_id: string
    voice_name: string
    voice_description: string
    labels: VoiceDesignLabels
    played_not_selected_voice_ids: string[]
    parent_voice_key?: string | null
}

// ---- Synth lab (`admin_lab` surface, 05 §8.11) ----

/**
 * The four aliases the console knows (R0), widened so a model listed only by
 * `GET /admin/voices/test/models` (A4) is still selectable (R1-FE-06).
 */
export type LabModelAlias = 'el_flash_v2_5' | 'el_v4' | 'el_multilingual_v2' | 'el_v3' | (string & {})
export type LabMarkupMode = 'app' | 'native'
export type LabTextNormalization = 'auto' | 'on' | 'off'

/**
 * `POST /admin/voices/test` body (the ElevenLabs lab reuses the path from R0); returns `audio/mpeg`.
 * As built (R0 console-api): `text` is at most 5,000 characters, and the text after app
 * markup must fit the model profile's `max_chars` (422 `text_over_model_limit` with
 * `max_chars`); `output_format` is `mp3_44100_128` or `mp3_44100_64` (422
 * `unsupported_output_format`); `apply_text_normalization` is `auto` only (422
 * `unsupported_text_normalization`); an unknown alias is 422 `model_not_allowed`.
 */
export interface AdminLabSynthesisRequest {
    voice_key: string
    model_alias: LabModelAlias
    text: string
    markup_mode: LabMarkupMode
    output_format: string
    language_code: string | null
    seed: number | null
    apply_text_normalization: LabTextNormalization
    voice_settings: VoiceSettingsV2
}

/**
 * An `audio/*` answer of the lab (`POST /admin/voices/test`). I-14: the BFF sends the
 * provider-neutral headers below and lists them in CORS `expose_headers`; the
 * provider's own header names never leave the ElevenLabs adapter.
 */
export interface AdminLabSynthesisResult {
    blob: Blob
    content_type: string
    /** `X-Voice-Request-Id` response header, when present. */
    request_id: string | null
    /** `X-Voice-Character-Cost` response header (a non-negative integer), when present (S-17). */
    character_cost: number | null
}

// ---- Limits widget and runtime settings (05 §8.13, D37) ----

/**
 * Job C snapshot of `GET /v1/user/subscription`; live values, never hard-coded.
 * Every count may be null (the BFF types them `int | None`) when the provider did
 * not report it: the console then shows "Unknown" instead of a meter value.
 */
export interface VoiceSubscriptionSnapshot {
    voice_slots_used: number | null
    voice_limit: number | null
    voice_add_edit_counter: number | null
    max_voice_add_edits: number | null
    character_count: number | null
    character_limit: number | null
    next_character_count_reset_at: string | null
    fetched_at: string | null
}

export type VoiceSpendSurface = 'narration' | 'call' | 'preview' | 'admin'

export interface VoiceSpendToday {
    surface: VoiceSpendSurface
    chars: number
}

/** Per-key usage against its `character_limit`; the unit stays unknown until S-28. */
export interface VoiceKeyUsage {
    key_name: string
    usage: number | null
    limit: number | null
    unit: string | null
}

export interface VoiceSyncRun {
    job: VoiceSyncJob
    status: 'ok' | 'running' | 'failed' | 'aborted'
    started_at: string | null
    finished_at: string | null
    /** True for every guard abort: `mass_miss`, `mass_removal`, `mass_voice_denial`, `empty_listing`. */
    mass_miss_abort: boolean
    /**
     * The run's reason code. Job B `aborted` with `mass_removal` is the abort root
     * may override per voice (`AdminVoiceSyncRequest.confirm_removal`).
     */
    detail: string | null
}

/**
 * Proposal (FE, frozen for R0-BE-35): `GET /admin/voices/limits`. `subscription`
 * is null until Job C has run; lists are empty, never absent (required by the
 * console). Missing route: the widget shows its load error with a retry.
 */
export interface AdminVoiceLimits {
    subscription: VoiceSubscriptionSnapshot | null
    spend_today: VoiceSpendToday[]
    daily_budget_chars: number | null
    per_key: VoiceKeyUsage[]
    sync_runs: VoiceSyncRun[]
}

/**
 * One `voice_runtime_setting` row (08 §3.5). I-12: `tts_engine_enabled` and
 * `voice_mode_enabled` are ANDed with the env boot gates (`TTS_ENGINE_ENABLED`,
 * `VOICE_MODE_ENABLED`), so a row can only turn a surface off. The console
 * writes only `daily_budget_chars` (D37).
 */
export interface VoiceRuntimeSetting {
    setting_key: string
    value_json: unknown
    updated_by_user_id: number | null
    updated_at: string | null
}

export interface VoiceRuntimeSettingsResponse {
    items: VoiceRuntimeSetting[]
}

/**
 * One row of `GET /admin/voices/test/models` (A4, 05 §8.2): the per-model lab
 * capabilities. The route does not exist yet (R1-FE-06 BFF side): a 404 or 501
 * keeps the R0 lab (`LAB_MODELS`, two mp3 formats, normalization `auto`, 5,000 chars).
 */
export interface AdminLabModel {
    model_alias: LabModelAlias
    label: string
    tier: NarrationTier | null
    available: boolean
    unavailable_reason: string | null
    max_chars: number
    output_formats: string[]
    text_normalization: LabTextNormalization[]
    supports_language_code: boolean
    supports_seed: boolean
    audio_tags: boolean
    breaks: boolean
    inline_ipa: boolean
    settings: string[]
}

// ---- Global voice presets (`/admin/voice-presets/global`, EP-5) ----

/** `POST /admin/voice-presets/global` body; `PUT /{preset_id}` takes any subset. */
export interface AdminGlobalPresetInput {
    name: string
    description: string | null
    voice_key: string
    settings: VoiceSettingsV2 | null
    emotion: VoiceEmotion | null
    language_code: string | null
}

/**
 * One admin global-preset row: a V2 or V1 preset DTO plus the admin fields.
 * V1 rows (`schema_version` absent) are read-only legacy rows (D12).
 * `voice_public` is null for V1 rows.
 */
export type AdminGlobalPresetRow = (VoicePresetV2 | VoicePreset) & {
    legacy_hidden: boolean
    voice_public: boolean | null
    seed_key: string | null
}

export interface AdminGlobalPresetList {
    items: AdminGlobalPresetRow[]
}
