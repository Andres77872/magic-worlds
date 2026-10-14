/**
 * Metrics envelopes for tests and stories (never imported by the application).
 * Shaped from what the BFF route answers (`admin_voice_metrics.py` over fake
 * cursors and fed in-process metrics), with fixed timestamps.
 */
import type {
    AdminVoiceMetricsByArea,
    AdminVoiceProcessMetrics,
    CallMetricsResponse,
    ModerationMetricsResponse,
    NarrationMetricsResponse,
    ProviderMetricsResponse,
    SpendMetricsResponse,
} from '@/shared'

const GENERATED_AT = '2026-10-12T10:00:00Z'
const DAY_WINDOW = { since: '2026-10-11T10:00:00Z', until: '2026-10-12T10:00:00Z', hours: 24 }
const PROCESS_SINCE = '2026-10-12T06:00:00Z'

export function emptyProcessMetrics(extra: Partial<AdminVoiceProcessMetrics> = {}): AdminVoiceProcessMetrics {
    return { since: PROCESS_SINCE, counters: [], gauges: [], histograms: [], ratios: [], windows: [], requests_per_day: [], ...extra }
}

export const narrationMetrics: NarrationMetricsResponse = {
    surface: 'narration',
    generated_at: GENERATED_AT,
    window: DAY_WINDOW,
    db: {
        providers: [
            {
                provider: 'elevenlabs',
                terminal: 205,
                completed: 190,
                failed: 15,
                voice_unavailable: 10,
                moderation_unavailable: 0,
                content_blocked: 7,
                quota_exceeded: 2,
                in_flight: 4,
                substituted: 0,
                replaced: 0,
                shared_replaced: 0,
                substitutions: {},
                latency: { completed: 190, p50_ms: 2000, p95_ms: 7000, max_ms: 11000, resolution_ms: 1000 },
                failure_rate: 0.073171,
                voice_unavailable_share: 0.04878,
                moderation_unavailable_share: 0,
                substitution_rate: 0,
                replaced_share: 0,
                shared_replaced_share: 0,
            },
        ],
        statuses: [
            { provider: 'elevenlabs', status: 'completed', error_category: null, substitution_reason: null, jobs: 190 },
            { provider: 'elevenlabs', status: 'failed', error_category: 'voice_unavailable', substitution_reason: null, jobs: 10 },
            { provider: 'elevenlabs', status: 'timeout', error_category: 'timeout', substitution_reason: null, jobs: 5 },
        ],
        turn_charges: [{ status: 'open', tier: 'standard', charges: 3, credits_reserved: 30, credits_final: 0, counted_chars: 0, stale_open: 1 }],
        stale_after_seconds: 900,
        requests_per_day: [{ day: '2026-10-11', surface: 'narration', provider: 'elevenlabs', requests: 205 }],
    },
    process: emptyProcessMetrics({
        counters: [
            { metric: 'narration_jobs_submitted', provider: 'elevenlabs', value: 1 },
            { metric: 'narration_jobs_terminal', provider: 'elevenlabs', value: 1 },
        ],
        histograms: [{ metric: 'narration_job_ms', provider: 'elevenlabs', count: 1, p50: 900, p95: 900, max: 900, mean: 900, window: 1 }],
        ratios: [{ metric: 'narration_tts_failed_rate', provider: 'elevenlabs', numerator: 0, denominator: 1, value: 0 }],
        requests_per_day: [{ day: '2026-10-12', surface: 'narration', provider: 'elevenlabs', requests: 1 }],
    }),
    alerts: [
        { alert: 'narration_tts_failed_rate', severity: 'page', provider: 'elevenlabs', value: 0.073171, threshold: 0.02, sample: 205, runbook: 'RB-1', detail: null },
        { alert: 'narration_voice_unavailable', severity: 'page', provider: 'elevenlabs', value: 0.04878, threshold: 0.005, sample: 205, runbook: 'RB-3', detail: null },
        { alert: 'narration_job_p95', severity: 'page', provider: 'elevenlabs', value: 7000, threshold: 6000, sample: 205, runbook: 'RB-1', detail: null },
    ],
    baseline: { narration_failure_rate: 0.01, narration_p95_ms: 3000 },
}

export const callMetrics: CallMetricsResponse = {
    surface: 'calls',
    generated_at: GENERATED_AT,
    window: DAY_WINDOW,
    db: {
        providers: [
            {
                provider: 'elevenlabs',
                calls: 25,
                by_status: { ended: 24, failed: 1 },
                consumed_seconds: 3600,
                calls_with_tts_failure: 2,
                tts_failed_turns: 3,
                failed_turns_by_category: { tts_timeout: 3 },
                tts_failure_rate: 0.08,
            },
        ],
        first_audio_source: 'events',
        requests_per_day: [{ day: '2026-10-11', surface: 'call', provider: 'elevenlabs', requests: 25 }],
    },
    process: emptyProcessMetrics({
        histograms: [{ metric: 'call_first_audio_ms', provider: 'elevenlabs', count: 20, p50: 500, p95: 500, max: 500, mean: 500, window: 20 }],
        windows: [{ metric: 'call_first_audio_ms', provider: 'elevenlabs', window_seconds: 3600, count: 20, calls: 20, p50: 500, p95: 500 }],
    }),
    alerts: [
        { alert: 'call_tts_failure_rate', severity: 'page', provider: 'elevenlabs', value: 0.08, threshold: 0.03, sample: 25, runbook: 'RB-1', detail: null },
        { alert: 'call_first_audio_p50', severity: 'page', provider: 'elevenlabs', value: 500, threshold: 400, sample: 20, runbook: 'RB-1', detail: null },
    ],
    baseline: null,
}

export const providerMetrics: ProviderMetricsResponse = {
    surface: 'provider',
    generated_at: GENERATED_AT,
    window: DAY_WINDOW,
    db: {
        jobs: [{ source: 'chat_tts_request', provider: 'elevenlabs', model_alias: 'eleven_flash_v2_5', status: 'completed', error_category: null, jobs: 9 }],
        requests_per_day: [],
    },
    process: emptyProcessMetrics({
        counters: [
            { metric: 'provider_429', provider: 'elevenlabs', value: 9 },
            { metric: 'provider_requests', provider: 'elevenlabs', value: 30 },
        ],
        gauges: [{ metric: 'breaker_open_config_narration', provider: 'elevenlabs', value: 1 }],
        windows: [{ metric: 'provider_429_share', provider: 'elevenlabs', window_seconds: 300, numerator: 9, denominator: 30, value: 0.3 }],
        breakers: { 'config:narration': 'open', billing: 'closed' },
    }),
    alerts: [
        { alert: 'provider_429_share', severity: 'page', provider: 'elevenlabs', value: 0.3, threshold: 0.2, sample: 30, runbook: 'RB-2', detail: null },
        { alert: 'config_breaker_open', severity: 'page', provider: 'elevenlabs', value: 1, threshold: 1, sample: 1, runbook: 'RB-4', detail: 'config:narration' },
    ],
    baseline: null,
}

export const moderationMetrics: ModerationMetricsResponse = {
    surface: 'moderation',
    generated_at: GENERATED_AT,
    window: DAY_WINDOW,
    db: {
        jobs: [{ provider: 'elevenlabs', terminal_jobs: 210, content_blocked: 7, moderation_unavailable: 1, moderation_unavailable_share: 0.004762 }],
        abuse_counters: [{ day: '2026-10-12', kind: 'burst', events: 4, users: 2 }],
    },
    process: emptyProcessMetrics({
        counters: [{ metric: 'moderation_pass', provider: 'elevenlabs', value: 1 }],
        histograms: [{ metric: 'moderation_ms', provider: 'elevenlabs', count: 1, p50: 120, p95: 120, max: 120, mean: 120, window: 1 }],
    }),
    alerts: [],
    baseline: null,
}

export const spendMetrics: SpendMetricsResponse = {
    surface: 'spend',
    generated_at: GENERATED_AT,
    window: { since: '2026-10-06T00:00:00Z', until: '2026-10-12T10:00:00Z', days: 7 },
    db: {
        daily_budget_chars: 1_000_000,
        days: [{ day: '2026-10-12', est_cost_usd_micros: 34_000_000, flash_equivalent_chars: 850_000, budget_pct: 85 }],
        rows: [{ day: '2026-10-12', surface: 'narration', model_id: 'flash', chars: 1, est_cost_usd_micros: 34_000_000 }],
    },
    process: emptyProcessMetrics({ gauges: [{ metric: 'spend_budget_pct', provider: 'all', value: 85 }] }),
    alerts: [{ alert: 'spend_circuit_80', severity: 'warn', provider: 'all', value: 85, threshold: 80, sample: 34_000_000, runbook: 'RB-7', detail: null }],
    baseline: null,
}

export const metricsByArea: AdminVoiceMetricsByArea = {
    narration: narrationMetrics,
    calls: callMetrics,
    provider: providerMetrics,
    moderation: moderationMetrics,
    spend: spendMetrics,
}
