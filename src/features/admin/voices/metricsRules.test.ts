import { describe, expect, it } from 'vitest'
import type { AdminVoiceMetricsResponse, CallMetricsResponse, NarrationMetricsResponse, ProviderMetricsResponse, SpendMetricsResponse } from '@/shared'
import { callMetrics, emptyProcessMetrics, moderationMetrics, narrationMetrics, providerMetrics, spendMetrics } from './metricsFixtures'
import { alertFormat, isMetricsEnvelopeEmpty, METRICS_RULES, metricsRuleStatuses, type MetricsRuleStatus } from './metricsRules'

const states = (envelope: AdminVoiceMetricsResponse) => Object.fromEntries(metricsRuleStatuses(envelope).map((status) => [status.key, status.state]))
const status = (envelope: AdminVoiceMetricsResponse, key: string) => metricsRuleStatuses(envelope).find((item) => item.key === key) as MetricsRuleStatus

describe('metricsRuleStatuses (R0-OPS-07, D28 rules)', () => {
    it('marks the narration rules the server fired and keeps the others quiet', () => {
        expect(states(narrationMetrics)).toEqual({
            failureRate: 'firing',
            voiceUnavailable: 'firing',
            moderationUnavailable: 'quiet',
            jobP95: 'firing',
            substitution: 'quiet',
        })
        expect(status(narrationMetrics, 'failureRate').alerts.map((alert) => alert.value)).toEqual([0.073171])
    })

    it('uses the lower of 2% and 2× baseline for the failure-rate threshold', () => {
        const low: NarrationMetricsResponse = { ...narrationMetrics, alerts: [], baseline: { narration_failure_rate: 0.004, narration_p95_ms: 3000 } }
        expect(status(low, 'failureRate').threshold.limit).toBe(0.008)
        expect(status(low, 'jobP95').threshold.limit).toBe(6000)
        const none: NarrationMetricsResponse = { ...narrationMetrics, alerts: [], baseline: null }
        expect(status(none, 'failureRate').threshold.limit).toBe(0.02)
    })

    it('does not evaluate the × baseline p95 rule without a loaded baseline', () => {
        const none: NarrationMetricsResponse = { ...narrationMetrics, alerts: [], baseline: null }
        expect(status(none, 'jobP95')).toMatchObject({ state: 'not_evaluated', reason: 'baseline' })
        expect(status(none, 'jobP95').threshold.limit).toBeUndefined()
    })

    it('reports a small sample only when the window is the rules’ own last hour', () => {
        const small = { ...narrationMetrics.db.providers[0], terminal: 50 }
        const lastHour: NarrationMetricsResponse = {
            ...narrationMetrics,
            window: { ...narrationMetrics.window, hours: 1 },
            db: { ...narrationMetrics.db, providers: [small] },
            alerts: [],
        }
        expect(states(lastHour)).toMatchObject({ failureRate: 'low_sample', moderationUnavailable: 'low_sample', jobP95: 'low_sample', voiceUnavailable: 'quiet' })
        const day: NarrationMetricsResponse = { ...lastHour, window: narrationMetrics.window }
        expect(states(day)).toMatchObject({ failureRate: 'quiet', jobP95: 'quiet' })
    })

    it('says no data when nothing was recorded', () => {
        const empty: NarrationMetricsResponse = { ...narrationMetrics, db: { ...narrationMetrics.db, providers: [] }, alerts: [] }
        expect(states(empty)).toMatchObject({ failureRate: 'no_data', voiceUnavailable: 'no_data' })
    })

    it('reads first audio and the 429 share from the live windows, with their minimum samples', () => {
        expect(states(callMetrics)).toEqual({ callFailure: 'firing', firstAudio: 'firing' })
        const few: CallMetricsResponse = {
            ...callMetrics,
            alerts: [],
            process: emptyProcessMetrics({ windows: [{ ...callMetrics.process.windows[0], calls: 5 }] }),
        }
        expect(states(few)).toEqual({ callFailure: 'quiet', firstAudio: 'low_sample' })
        const none: CallMetricsResponse = { ...few, process: emptyProcessMetrics(), db: { ...callMetrics.db, providers: [] } }
        expect(states(none)).toEqual({ callFailure: 'no_data', firstAudio: 'no_data' })

        expect(states(providerMetrics)).toEqual({ throttleShare: 'firing', billingBreaker: 'quiet', configBreaker: 'firing', accountEvent: 'quiet' })
        const quiet: ProviderMetricsResponse = {
            ...providerMetrics,
            alerts: [],
            process: emptyProcessMetrics({ windows: [{ ...providerMetrics.process.windows[0], denominator: 10 }] }),
        }
        expect(states(quiet)).toEqual({ throttleShare: 'low_sample', billingBreaker: 'no_data', configBreaker: 'no_data', accountEvent: 'quiet' })
    })

    it('lists the account-event rule (RB-8, any event in the hour) and marks it firing per kind', () => {
        expect(status(providerMetrics, 'accountEvent')).toMatchObject({ state: 'quiet', reason: null, alerts: [], rule: { severity: 'page', runbook: 'RB-8', format: 'count' } })
        const ban = { alert: 'account_event', severity: 'page' as const, provider: 'elevenlabs', value: 1, threshold: 1, sample: 1, runbook: 'RB-8', detail: 'voice_ban' }
        const key = { ...ban, detail: 'key_disabled', value: 2, sample: 2 }
        const firing = metricsRuleStatuses({ ...providerMetrics, alerts: [...providerMetrics.alerts, ban, key] })
        expect(firing.find((item) => item.key === 'accountEvent')).toMatchObject({ state: 'firing', alerts: [ban, key] })
        expect(firing.some((item) => item.rule === null)).toBe(false)
        expect(alertFormat(ban, METRICS_RULES.provider.find((rule) => rule.id === 'accountEvent') ?? null)).toBe('count')
    })

    it('does not evaluate the spend bands without a daily budget', () => {
        expect(status(spendMetrics, 'spendBands')).toMatchObject({ state: 'firing' })
        const unset: SpendMetricsResponse = { ...spendMetrics, alerts: [], db: { ...spendMetrics.db, daily_budget_chars: null } }
        expect(status(unset, 'spendBands')).toMatchObject({ state: 'not_evaluated', reason: 'budget' })
    })

    it('has no moderation rules, and still lists an alert no rule knows', () => {
        expect(metricsRuleStatuses(moderationMetrics)).toEqual([])
        const extra = { alert: 'future_rule', severity: 'page' as const, provider: 'all', value: 1, threshold: 1, sample: 1, runbook: 'RB-99', detail: null }
        const statuses = metricsRuleStatuses({ ...moderationMetrics, alerts: [extra] })
        expect(statuses).toEqual([expect.objectContaining({ key: 'alert:future_rule', rule: null, alertName: 'future_rule', state: 'firing', alerts: [extra], current: [] })])
    })
})

describe('current values (10 §7.4)', () => {
    const lastHour = (envelope: NarrationMetricsResponse): NarrationMetricsResponse => ({ ...envelope, window: { ...envelope.window, hours: 1 }, alerts: [] })

    it('reads the narration rules from the database rows only when the window is the last hour', () => {
        const hour = lastHour(narrationMetrics)
        expect(status(hour, 'failureRate').current).toEqual([{ value: 0.073171, sample: 205, provider: 'elevenlabs' }])
        expect(status(hour, 'voiceUnavailable').current).toEqual([{ value: 0.04878, sample: 205, provider: 'elevenlabs' }])
        expect(status(hour, 'moderationUnavailable').current).toEqual([{ value: 0, sample: 205, provider: 'elevenlabs' }])
        expect(status(hour, 'substitution').current).toEqual([{ value: 0, sample: 205, provider: 'elevenlabs' }])
        expect(status(hour, 'jobP95').current).toEqual([{ value: 7000, sample: 205, provider: 'elevenlabs' }])
        // D28 shared-card substitution (I-38) reads the shared share, as the BFF alert does, not every replaced voice.
        const [bucket] = hour.db!.providers
        const shared = { ...hour, db: { ...hour.db!, providers: [{ ...bucket, replaced: 20, replaced_share: 0.097561, shared_replaced: 1, shared_replaced_share: 0.004878 }] } }
        expect(status(shared, 'substitution').current).toEqual([{ value: 0.004878, sample: 205, provider: 'elevenlabs' }])
        // A longer window is not the rules' own: no current value.
        expect(status({ ...narrationMetrics, alerts: [] }, 'failureRate').current).toEqual([])
    })

    it('shows the voice-unavailable and call-failure counts below the minimum sample (the absolute rules)', () => {
        const small = lastHour({ ...narrationMetrics, db: { ...narrationMetrics.db, providers: [{ ...narrationMetrics.db.providers[0], terminal: 50, voice_unavailable: 3 }] } })
        expect(status(small, 'voiceUnavailable').current).toEqual([{ value: 3, sample: 50, provider: 'elevenlabs', format: 'count' }])
        expect(status(small, 'failureRate')).toMatchObject({ state: 'low_sample', current: [{ value: 0.073171, sample: 50 }] })

        const calls: CallMetricsResponse = { ...callMetrics, window: { ...callMetrics.window, hours: 1 }, alerts: [] }
        expect(status(calls, 'callFailure').current).toEqual([{ value: 0.08, sample: 25, provider: 'elevenlabs' }])
        const fewCalls: CallMetricsResponse = { ...calls, db: { ...calls.db, providers: [{ ...calls.db.providers[0], calls: 10 }] } }
        expect(status(fewCalls, 'callFailure').current).toEqual([{ value: 2, sample: 10, provider: 'elevenlabs', format: 'count' }])
        expect(status({ ...callMetrics, alerts: [] }, 'callFailure').current).toEqual([])
    })

    it('reads first audio and the 429 share from the live windows, whatever the window', () => {
        expect(status({ ...callMetrics, alerts: [] }, 'firstAudio').current).toEqual([{ value: 500, sample: 20, provider: 'elevenlabs' }])
        expect(status({ ...providerMetrics, alerts: [] }, 'throttleShare').current).toEqual([{ value: 0.3, sample: 30, provider: 'elevenlabs' }])
        expect(status(providerMetrics, 'accountEvent').current).toEqual([])
    })

    it('reads today’s budget share (UTC) for the spend bands, without a sample', () => {
        expect(status({ ...spendMetrics, alerts: [] }, 'spendBands').current).toEqual([{ value: 85, sample: null, provider: 'all' }])
        const yesterday: SpendMetricsResponse = { ...spendMetrics, alerts: [], window: { ...spendMetrics.window, until: '2026-10-13T00:05:00Z' } }
        expect(status(yesterday, 'spendBands').current).toEqual([])
    })
})

describe('isMetricsEnvelopeEmpty', () => {
    it('is false while either the database or the live process recorded something', () => {
        expect(isMetricsEnvelopeEmpty(narrationMetrics)).toBe(false)
        const dbOnly: SpendMetricsResponse = { ...spendMetrics, process: emptyProcessMetrics() }
        expect(isMetricsEnvelopeEmpty(dbOnly)).toBe(false)
    })

    it('is true when nothing at all was recorded', () => {
        const empty: ProviderMetricsResponse = {
            ...providerMetrics,
            db: { jobs: [], requests_per_day: [] },
            process: emptyProcessMetrics({ breakers: {} }),
            alerts: [],
        }
        expect(isMetricsEnvelopeEmpty(empty)).toBe(true)
        expect(isMetricsEnvelopeEmpty({ ...empty, process: emptyProcessMetrics({ breakers: { billing: 'closed' } }) })).toBe(false)
    })
})
