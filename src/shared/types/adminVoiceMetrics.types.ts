/**
 * Root voice metrics (R0-BE-37, R0-OPS-07; 08 §8.3, 10 §7, 11 §8.3): the
 * envelopes of `GET /admin/voices/metrics/{narration,calls,provider,moderation,spend}`
 * as the BFF builds them (`src/routes/admin_voice_metrics.py`,
 * `src/services/speech/metrics.py`). Root only (403 otherwise); no workspace
 * selector; read only. Never text, secrets or user lists.
 *
 * - `db`: the window's database aggregates, split by provider. This is the record.
 * - `process`: the serving process's in-memory metrics since it started,
 *   keyed (metric, provider). A live view, not the record.
 * - `alerts`: only the rules that fire now. Narration and call rules run over
 *   the last hour whatever the window, the 429 share over 5 minutes, spend
 *   over today (UTC). The console shows the full rule list beside them.
 * - `baseline`: the frozen R0 baseline loaded at startup, or null; the
 *   × baseline rules are not evaluated without it.
 *
 * Window: `hours` (1–720, default 24) on every area but `spend`, which takes
 * `days` (1–90, default 7). A database error is 503 with a plain `detail`.
 */

export type AdminVoiceMetricsArea = 'narration' | 'calls' | 'provider' | 'moderation' | 'spend'

export interface AdminVoiceMetricsQuery {
    /** 1–720; every area but `spend`. */
    hours?: number
    /** 1–90; `spend` only. */
    days?: number
}

export interface AdminVoiceMetricsWindow {
    since: string
    until: string
    /** Every area but `spend`. */
    hours?: number
    /** `spend` only. */
    days?: number
}

/** `page` and `warn` follow 11 §8.4; `info` is the 50% spend band. */
export type AdminVoiceAlertSeverity = 'page' | 'warn' | 'info'

/** One firing rule (`SpeechAlert.as_dict`). */
export interface AdminVoiceMetricsAlert {
    alert: string
    severity: AdminVoiceAlertSeverity
    /** Provider label, or `all` for spend. */
    provider: string
    value: number | null
    threshold: number
    sample: number
    /** 11 §7 runbook id, e.g. `RB-1`. */
    runbook: string
    /** What exactly tripped, e.g. the breaker name (`config:narration`). */
    detail: string | null
}

/** The frozen R0 baseline (10 §7.2); any field may be unknown. */
export interface AdminVoiceMetricsBaseline {
    narration_failure_rate: number | null
    narration_p95_ms: number | null
}

// ---- process (live, this server process) ----

export interface ProcessMetricLabels {
    metric: string
    provider: string
}

export interface ProcessMetricValue extends ProcessMetricLabels {
    value: number
}

export interface ProcessHistogram extends ProcessMetricLabels {
    count: number
    p50: number | null
    p95: number | null
    max: number | null
    mean: number | null
    /** How many newest samples the percentiles cover. */
    window: number
}

export interface ProcessRatio extends ProcessMetricLabels {
    numerator: number
    denominator: number
    value: number | null
}

/**
 * The recent windows the alert rules read: `call_first_audio_ms` over 1 h
 * (`count`, distinct `calls`, `p50`, `p95`), `provider_429_share` over
 * 5 min (`numerator`, `denominator`, `value`) and `provider_account_events`
 * over 1 h, one per `kind` with any event (`kind`, `count`).
 */
export interface ProcessWindow extends ProcessMetricLabels {
    window_seconds: number
    /** `provider_account_events` only: the event kind (`voice_ban`, `key_disabled`, …, or `unspecified`). */
    kind?: string
    count?: number
    calls?: number
    p50?: number | null
    p95?: number | null
    numerator?: number
    denominator?: number
    value?: number | null
}

export interface ProcessRequestsPerDay {
    day: string
    surface: string
    provider: string
    requests: number
}

export interface AdminVoiceProcessMetrics {
    since: string
    counters: ProcessMetricValue[]
    gauges: ProcessMetricValue[]
    histograms: ProcessHistogram[]
    ratios: ProcessRatio[]
    windows: ProcessWindow[]
    requests_per_day: ProcessRequestsPerDay[]
    /** `provider` only: breaker name → state (`open`, `closed`, `half_open`). Empty when none is configured. */
    breakers?: Record<string, string>
}

/** Requests per UTC day per surface and provider (narration jobs, calls, recipe previews). */
export interface DbRequestsPerDay {
    day: string
    surface: string
    provider: string
    requests: number
}

// ---- narration ----

export interface NarrationLatency {
    completed: number
    p50_ms: number | null
    p95_ms: number | null
    max_ms: number | null
    /** The DB columns have one-second resolution. */
    resolution_ms: number
}

export interface NarrationProviderMetrics {
    provider: string
    /** Finished segments in the failure-rate denominator (policy and quota outcomes excluded). */
    terminal: number
    completed: number
    failed: number
    voice_unavailable: number
    moderation_unavailable: number
    content_blocked: number
    quota_exceeded: number
    in_flight: number
    substituted: number
    replaced: number
    /**
     * Replaced voices on jobs whose card belongs to another account (`tts_job.shared_card` = 1)
     * or whose owner is unknown (null): the D28 shared-card substitution rule (I-38).
     */
    shared_replaced: number
    substitutions: Record<string, number>
    latency: NarrationLatency
    failure_rate: number | null
    voice_unavailable_share: number | null
    moderation_unavailable_share: number | null
    substitution_rate: number | null
    replaced_share: number | null
    shared_replaced_share: number | null
}

export interface NarrationStatusRow {
    provider: string
    status: string
    error_category: string | null
    substitution_reason: string | null
    jobs: number
}

export interface NarrationTurnChargeRow {
    status: string
    tier: string
    charges: number
    credits_reserved: number
    credits_final: number
    counted_chars: number
    /** Open charges older than `stale_after_seconds`. */
    stale_open: number
}

export interface NarrationDbMetrics {
    providers: NarrationProviderMetrics[]
    statuses: NarrationStatusRow[]
    turn_charges: NarrationTurnChargeRow[]
    stale_after_seconds: number
    requests_per_day: DbRequestsPerDay[]
}

// ---- calls ----

export interface CallProviderMetrics {
    provider: string
    calls: number
    by_status: Record<string, number>
    consumed_seconds: number
    calls_with_tts_failure: number
    tts_failed_turns: number
    failed_turns_by_category: Record<string, number>
    tts_failure_rate: number | null
}

export interface CallDbMetrics {
    providers: CallProviderMetrics[]
    /** `events`: first audio is not in the database; it comes from the live process windows. */
    first_audio_source: string
    requests_per_day: DbRequestsPerDay[]
}

// ---- provider ----

export interface ProviderJobRow {
    source: string
    provider: string
    model_alias: string
    status: string
    error_category: string | null
    jobs: number
}

export interface ProviderDbMetrics {
    jobs: ProviderJobRow[]
    requests_per_day: DbRequestsPerDay[]
}

// ---- moderation ----

export interface ModerationJobRow {
    provider: string
    terminal_jobs: number
    content_blocked: number
    moderation_unavailable: number
    moderation_unavailable_share: number | null
}

/** Counts per day and kind only, never user ids (11 §8.3). */
export interface AbuseCounterRow {
    day: string
    kind: string
    /**
     * Events that day. For `drained_call_chars` it is the 20,000-character
     * steps that day's drains took each user's rolling 7-day total across,
     * summed over users (the abuse score's unit, D26 6a), never characters:
     * those are in `chars`.
     */
    events: number
    users: number
    /**
     * `drained_call_chars` only: the drained call characters that day, summed
     * over its users (BFF `moderation_aggregates`). Absent on every other kind,
     * and from a BFF that predates the split, whose `events` for that kind
     * still holds characters.
     */
    chars?: number | null
}

export interface ModerationDbMetrics {
    jobs: ModerationJobRow[]
    abuse_counters: AbuseCounterRow[]
}

// ---- spend ----

export interface SpendDayRow {
    day: string
    est_cost_usd_micros: number
    flash_equivalent_chars: number
    /** Share of the daily budget in percent; null when no budget is set. */
    budget_pct: number | null
}

export interface SpendRow {
    day: string
    surface: string
    model_id: string
    chars: number
    est_cost_usd_micros: number
}

export interface SpendDbMetrics {
    daily_budget_chars: number | null
    days: SpendDayRow[]
    rows: SpendRow[]
}

// ---- envelopes ----

interface AdminVoiceMetricsEnvelopeBase<S extends AdminVoiceMetricsArea, D> {
    surface: S
    generated_at: string
    window: AdminVoiceMetricsWindow
    db: D
    process: AdminVoiceProcessMetrics
    alerts: AdminVoiceMetricsAlert[]
    /** Every area sends the key; only narration reads a loaded baseline today. */
    baseline: AdminVoiceMetricsBaseline | null
}

export type NarrationMetricsResponse = AdminVoiceMetricsEnvelopeBase<'narration', NarrationDbMetrics>
export type CallMetricsResponse = AdminVoiceMetricsEnvelopeBase<'calls', CallDbMetrics>
export type ProviderMetricsResponse = AdminVoiceMetricsEnvelopeBase<'provider', ProviderDbMetrics>
export type ModerationMetricsResponse = AdminVoiceMetricsEnvelopeBase<'moderation', ModerationDbMetrics>
export type SpendMetricsResponse = AdminVoiceMetricsEnvelopeBase<'spend', SpendDbMetrics>

export interface AdminVoiceMetricsByArea {
    narration: NarrationMetricsResponse
    calls: CallMetricsResponse
    provider: ProviderMetricsResponse
    moderation: ModerationMetricsResponse
    spend: SpendMetricsResponse
}

export type AdminVoiceMetricsResponse = AdminVoiceMetricsByArea[AdminVoiceMetricsArea]
