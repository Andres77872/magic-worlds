/**
 * Root voice metrics (R0-OPS-07; 11 §8.4, D28, 10 §7.1): the alert rules of
 * each metrics area and their state for one envelope.
 *
 * The BFF answers only the alerts that fire (`alerts`), so the console keeps
 * the rule list to show every rule with its threshold and state. The numbers
 * below mirror `src/services/speech/metrics.py` in the BFF (the D28 and 11 §8.4
 * thresholds); a firing alert always shows the server's own value and
 * threshold. An alert the list does not know is still shown, by name.
 *
 * States, strongest first:
 * - `firing`: the server sent at least one alert for the rule.
 * - `not_evaluated`: the rule needs something the server does not have
 *   (no daily budget set).
 * - `no_data`: nothing the rule reads was recorded.
 * - `low_sample`: below the rule's minimum sample, so only an absolute rule
 *   could fire. Known only where the envelope shows the rule's own window:
 *   the 1 h live windows, and narration when the window is the last hour.
 * - `quiet`: evaluated and not firing.
 *
 * `current` holds the value the rule reads now, where the envelope carries it
 * over the rule's own window: first audio (1 h) and the 429 share (5 min)
 * from the live windows, today's spend band, and the narration and call
 * database rules when the window is the last hour.
 */
import type { AdminVoiceMetricsAlert, AdminVoiceMetricsArea, AdminVoiceMetricsResponse, ProcessWindow } from '@/shared'

/** Mirrors the BFF constants (`metrics.py`); the server stays the source of truth. */
export const METRICS_THRESHOLDS = Object.freeze({
    narrationFailureRate: 0.02,
    voiceUnavailableShare: 0.005,
    voiceUnavailableCount: 5,
    moderationUnavailableShare: 0.01,
    substitutionShare: 0.01,
    minNarrationSample: 200,
    callFailureRate: 0.03,
    callFailureCount: 3,
    minCallSample: 20,
    firstAudioP50Ms: 400,
    provider429Warn: 0.05,
    provider429Page: 0.2,
    minProviderSample: 20,
    accountEventCount: 1,
})

/** How an alert's `value` and `threshold` read. */
export type MetricsValueFormat = 'share' | 'ms' | 'count' | 'percent' | 'open'

export type MetricsRuleId =
    | 'failureRate'
    | 'voiceUnavailable'
    | 'moderationUnavailable'
    | 'substitution'
    | 'callFailure'
    | 'firstAudio'
    | 'throttleShare'
    | 'billingBreaker'
    | 'configBreaker'
    | 'accountEvent'
    | 'spendBands'

export interface MetricsRule {
    id: MetricsRuleId
    /** The server alert names this rule covers. */
    alerts: readonly string[]
    /** `tiered`: the severity depends on the band (the firing alert says which). */
    severity: 'page' | 'warn' | 'info' | 'tiered'
    runbook: string
    format: MetricsValueFormat
}

export const METRICS_RULES: Readonly<Record<AdminVoiceMetricsArea, readonly MetricsRule[]>> = Object.freeze({
    narration: [
        { id: 'failureRate', alerts: ['narration_tts_failed_rate'], severity: 'page', runbook: 'RB-1', format: 'share' },
        { id: 'voiceUnavailable', alerts: ['narration_voice_unavailable', 'narration_voice_unavailable_count'], severity: 'page', runbook: 'RB-3', format: 'share' },
        { id: 'moderationUnavailable', alerts: ['narration_moderation_unavailable'], severity: 'page', runbook: 'RB-1', format: 'share' },
        { id: 'substitution', alerts: ['narration_voice_substitution'], severity: 'page', runbook: 'RB-3', format: 'share' },
    ],
    calls: [
        { id: 'callFailure', alerts: ['call_tts_failure_rate', 'call_tts_failure_count'], severity: 'page', runbook: 'RB-1', format: 'share' },
        { id: 'firstAudio', alerts: ['call_first_audio_p50'], severity: 'page', runbook: 'RB-1', format: 'ms' },
    ],
    provider: [
        { id: 'throttleShare', alerts: ['provider_429_share'], severity: 'tiered', runbook: 'RB-2', format: 'share' },
        { id: 'billingBreaker', alerts: ['billing_breaker_open'], severity: 'page', runbook: 'RB-9', format: 'open' },
        { id: 'configBreaker', alerts: ['config_breaker_open'], severity: 'page', runbook: 'RB-4', format: 'open' },
        // 08 §8.3 "account events: any → rollback": one alert per kind and provider; `detail` is the kind.
        { id: 'accountEvent', alerts: ['account_event'], severity: 'page', runbook: 'RB-8', format: 'count' },
    ],
    // Moderation unavailability is a narration rule (D28); the abuse thresholds notify root elsewhere (13).
    moderation: [],
    spend: [
        {
            id: 'spendBands',
            alerts: ['spend_circuit_50', 'spend_circuit_80', 'spend_circuit_95', 'spend_circuit_100'],
            severity: 'tiered',
            runbook: 'RB-7',
            format: 'percent',
        },
    ],
})

/** Value formats of the alerts with a count rather than a share. */
const ALERT_FORMATS: Readonly<Record<string, MetricsValueFormat>> = {
    narration_voice_unavailable_count: 'count',
    call_tts_failure_count: 'count',
    account_event: 'count',
}

export type MetricsRuleState = 'firing' | 'not_evaluated' | 'no_data' | 'low_sample' | 'quiet'
export type MetricsRuleReason = 'budget'

/** The value a rule reads now, for one provider. */
export interface MetricsRuleCurrent {
    value: number | null
    /** The rule's sample size; null when the rule has none (spend). */
    sample: number | null
    provider: string
    /** Overrides the rule's format (the absolute count fallbacks below the minimum sample). */
    format?: MetricsValueFormat
}

export interface MetricsRuleStatus {
    /** The rule id, or `alert:<name>` for an alert the rule list does not know. */
    key: string
    rule: MetricsRule | null
    /** The server alert name when `rule` is null. */
    alertName: string | null
    state: MetricsRuleState
    reason: MetricsRuleReason | null
    alerts: AdminVoiceMetricsAlert[]
    /** Threshold copy values, already numbers (the view formats them). */
    threshold: Record<string, number>
    /** The value the rule reads now, when the envelope carries it over the rule's own window. */
    current: MetricsRuleCurrent[]
}

/** The format of one firing alert's value and threshold. */
export function alertFormat(alert: AdminVoiceMetricsAlert, rule: MetricsRule | null): MetricsValueFormat | null {
    return ALERT_FORMATS[alert.alert] ?? rule?.format ?? null
}

function windowsOf(envelope: AdminVoiceMetricsResponse, metric: string): ProcessWindow[] {
    return (envelope.process?.windows ?? []).filter((item) => item.metric === metric)
}

/** `no_data` without rows, `low_sample` when every row is below `min`, else `quiet`. */
function sampleState(samples: number[], min: number): MetricsRuleState {
    if (samples.length === 0) return 'no_data'
    return samples.every((value) => value < min) ? 'low_sample' : 'quiet'
}

interface Evaluation {
    state: MetricsRuleState
    reason: MetricsRuleReason | null
    threshold: Record<string, number>
    current: MetricsRuleCurrent[]
}

/** The UTC day (`YYYY-MM-DD`) of an ISO timestamp, or null. */
function utcDay(iso: string | null | undefined): string | null {
    if (!iso) return null
    const at = new Date(iso)
    return Number.isNaN(at.getTime()) ? null : at.toISOString().slice(0, 10)
}

/** Rule state when no alert fires, the threshold values the copy needs and the current values. */
function evaluate(rule: MetricsRule, envelope: AdminVoiceMetricsResponse): Evaluation {
    const T = METRICS_THRESHOLDS
    const quiet = (threshold: Record<string, number> = {}, current: MetricsRuleCurrent[] = []): Evaluation => ({ state: 'quiet', reason: null, threshold, current })
    // The database rules run over the last hour: only a one-hour window is their own (10 §7.1).
    const lastHour = envelope.window?.hours === 1
    switch (envelope.surface) {
        case 'narration': {
            const providers = envelope.db?.providers ?? []
            const read = (pick: (bucket: (typeof providers)[number]) => MetricsRuleCurrent): MetricsRuleCurrent[] => (lastHour ? providers.map(pick) : [])
            const share = (pick: (bucket: (typeof providers)[number]) => number | null) =>
                read((bucket) => ({ value: pick(bucket), sample: bucket.terminal, provider: bucket.provider }))
            const sample = (threshold: Record<string, number>, current: MetricsRuleCurrent[], absoluteFallback = false): Evaluation => {
                if (providers.length === 0) return { state: 'no_data', reason: null, threshold, current: [] }
                if (!absoluteFallback && lastHour && providers.every((bucket) => bucket.terminal < T.minNarrationSample)) {
                    return { state: 'low_sample', reason: null, threshold, current }
                }
                return quiet(threshold, current)
            }
            if (rule.id === 'failureRate') {
                return sample({ limit: T.narrationFailureRate, min: T.minNarrationSample }, share((bucket) => bucket.failure_rate))
            }
            if (rule.id === 'voiceUnavailable') {
                // Below the minimum sample the absolute count rule runs: show the count then.
                const current = read((bucket) =>
                    bucket.terminal < T.minNarrationSample
                        ? { value: bucket.voice_unavailable, sample: bucket.terminal, provider: bucket.provider, format: 'count' }
                        : { value: bucket.voice_unavailable_share, sample: bucket.terminal, provider: bucket.provider },
                )
                return sample({ limit: T.voiceUnavailableShare, count: T.voiceUnavailableCount, min: T.minNarrationSample }, current, true)
            }
            if (rule.id === 'moderationUnavailable') {
                return sample({ limit: T.moderationUnavailableShare, min: T.minNarrationSample }, share((bucket) => bucket.moderation_unavailable_share))
            }
            // D28 shared-card substitution (I-38): replaced voices on cards owned or authored by another
            // account, unknown owners included (the BFF's `shared_replaced` share, as its alert reads it).
            if (rule.id === 'substitution') return sample({ limit: T.substitutionShare, min: T.minNarrationSample }, share((bucket) => bucket.shared_replaced_share))
            return quiet()
        }
        case 'calls': {
            if (rule.id === 'callFailure') {
                const providers = envelope.db?.providers ?? []
                const threshold = { limit: T.callFailureRate, count: T.callFailureCount, min: T.minCallSample }
                if (providers.length === 0) return { state: 'no_data', reason: null, threshold, current: [] }
                // Below the minimum sample the absolute count rule runs: show the count then.
                const current: MetricsRuleCurrent[] = lastHour
                    ? providers.map((bucket) =>
                          bucket.calls < T.minCallSample
                              ? { value: bucket.calls_with_tts_failure, sample: bucket.calls, provider: bucket.provider, format: 'count' }
                              : { value: bucket.tts_failure_rate, sample: bucket.calls, provider: bucket.provider },
                      )
                    : []
                return quiet(threshold, current)
            }
            if (rule.id === 'firstAudio') {
                const threshold = { limit: T.firstAudioP50Ms, min: T.minCallSample }
                const windows = windowsOf(envelope, 'call_first_audio_ms')
                const current = windows.map((item) => ({ value: item.p50 ?? null, sample: item.calls ?? 0, provider: item.provider }))
                return { state: sampleState(windows.map((item) => item.calls ?? 0), T.minCallSample), reason: null, threshold, current }
            }
            return quiet()
        }
        case 'provider': {
            const breakers = envelope.process?.breakers ?? {}
            if (rule.id === 'throttleShare') {
                const threshold = { warn: T.provider429Warn, page: T.provider429Page, min: T.minProviderSample }
                const windows = windowsOf(envelope, 'provider_429_share')
                const current = windows.map((item) => ({ value: item.value ?? null, sample: item.denominator ?? 0, provider: item.provider }))
                return { state: sampleState(windows.map((item) => item.denominator ?? 0), T.minProviderSample), reason: null, threshold, current }
            }
            if (rule.id === 'billingBreaker') {
                return 'billing' in breakers ? quiet() : { state: 'no_data', reason: null, threshold: {}, current: [] }
            }
            if (rule.id === 'configBreaker') {
                return Object.keys(breakers).some((name) => name.startsWith('config:')) ? quiet() : { state: 'no_data', reason: null, threshold: {}, current: [] }
            }
            // No minimum sample, and the server lists only kinds with an event: no window is zero events.
            if (rule.id === 'accountEvent') return quiet({ count: T.accountEventCount })
            return quiet()
        }
        case 'spend': {
            if (rule.id === 'spendBands') {
                const budget = envelope.db?.daily_budget_chars
                if (typeof budget !== 'number') return { state: 'not_evaluated', reason: 'budget', threshold: {}, current: [] }
                // The bands read today (UTC) only, whatever the window.
                const today = utcDay(envelope.window?.until)
                const row = today ? (envelope.db?.days ?? []).find((day) => day.day === today) : undefined
                return quiet({}, row ? [{ value: row.budget_pct, sample: null, provider: 'all' }] : [])
            }
            return quiet()
        }
        default:
            return quiet()
    }
}

/** Every rule of the envelope's area with its state, then any alert no rule covers. */
export function metricsRuleStatuses(envelope: AdminVoiceMetricsResponse): MetricsRuleStatus[] {
    const rules = METRICS_RULES[envelope.surface] ?? []
    const alerts = Array.isArray(envelope.alerts) ? envelope.alerts : []
    const covered = new Set(rules.flatMap((rule) => rule.alerts))
    const statuses: MetricsRuleStatus[] = rules.map((rule) => {
        const firing = alerts.filter((alert) => rule.alerts.includes(alert.alert))
        const evaluated = evaluate(rule, envelope)
        return {
            key: rule.id,
            rule,
            alertName: null,
            state: firing.length > 0 ? 'firing' : evaluated.state,
            reason: firing.length > 0 ? null : evaluated.reason,
            alerts: firing,
            threshold: evaluated.threshold,
            current: evaluated.current,
        }
    })
    const unknown = [...new Set(alerts.filter((alert) => !covered.has(alert.alert)).map((alert) => alert.alert))]
    for (const name of unknown) {
        statuses.push({
            key: `alert:${name}`,
            rule: null,
            alertName: name,
            state: 'firing',
            reason: null,
            alerts: alerts.filter((alert) => alert.alert === name),
            threshold: {},
            current: [],
        })
    }
    return statuses
}

/** True when the envelope recorded nothing at all (database or live). */
export function isMetricsEnvelopeEmpty(envelope: AdminVoiceMetricsResponse): boolean {
    const process = envelope.process
    const processEmpty =
        !process ||
        ((process.counters ?? []).length === 0 &&
            (process.gauges ?? []).length === 0 &&
            (process.histograms ?? []).length === 0 &&
            (process.ratios ?? []).length === 0 &&
            (process.windows ?? []).length === 0 &&
            (process.requests_per_day ?? []).length === 0 &&
            Object.keys(process.breakers ?? {}).length === 0)
    if (!processEmpty) return false
    switch (envelope.surface) {
        case 'narration':
            return (envelope.db?.providers ?? []).length === 0 && (envelope.db?.turn_charges ?? []).length === 0 && (envelope.db?.requests_per_day ?? []).length === 0
        case 'calls':
            return (envelope.db?.providers ?? []).length === 0 && (envelope.db?.requests_per_day ?? []).length === 0
        case 'provider':
            return (envelope.db?.jobs ?? []).length === 0 && (envelope.db?.requests_per_day ?? []).length === 0
        case 'moderation':
            return (envelope.db?.jobs ?? []).length === 0 && (envelope.db?.abuse_counters ?? []).length === 0
        case 'spend':
            return (envelope.db?.days ?? []).length === 0 && (envelope.db?.rows ?? []).length === 0
        default:
            return true
    }
}
