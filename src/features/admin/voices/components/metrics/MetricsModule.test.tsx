import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { ApiError } from '@/infrastructure/api'
import type { NarrationMetricsResponse, ProviderMetricsResponse } from '@/shared'
import { emptyProcessMetrics, narrationMetrics, providerMetrics } from '../../metricsFixtures'
import { chooseOption, consoleApiMock, renderInConsole, type ConsoleApiMock } from '../../testUtils'
import { MetricsModule } from './MetricsModule'

const api = vi.hoisted(() => ({}) as Record<string, unknown>)
vi.mock('@/infrastructure/api', async (importOriginal) => ({ ...(await importOriginal<object>()), apiService: api }))
const mock = () => api as unknown as ConsoleApiMock

function ruleRow(table: HTMLElement, label: string) {
    const header = within(table).getByRole('rowheader', { name: new RegExp(`^${label}`) })
    return header.closest('tr') as HTMLElement
}

async function openArea(name: string) {
    renderInConsole(<MetricsModule />, 'metrics')
    await screen.findByRole('table', { name: 'Alert rules: Narration' })
    fireEvent.click(screen.getByRole('tab', { name }))
}

describe('MetricsModule (R0-OPS-07)', () => {
    beforeEach(() => {
        for (const key of Object.keys(api)) delete api[key]
        Object.assign(api, consoleApiMock())
    })

    describe('narration', () => {
        it('loads the last 24 hours and shows every rule with its threshold and state', async () => {
            renderInConsole(<MetricsModule />, 'metrics')
            const rules = await screen.findByRole('table', { name: 'Alert rules: Narration' })
            expect(mock().getAdminVoiceMetrics).toHaveBeenCalledWith('narration', { hours: 24 }, expect.any(AbortSignal))

            const failure = ruleRow(rules, 'Narration failure rate')
            expect(failure).toHaveAttribute('data-state', 'firing')
            expect(within(failure).getByText('Firing')).toBeInTheDocument()
            expect(within(failure).getByText('Above 2% of finished segments (2%, or 2× baseline when lower); at least 200 segments')).toBeInTheDocument()
            expect(within(failure).getByText('7.32% (threshold 2%, sample 205)')).toBeInTheDocument()
            expect(within(failure).getByText('elevenlabs')).toBeInTheDocument()
            expect(within(failure).getByText('RB-1')).toBeInTheDocument()

            const p95 = ruleRow(rules, 'Narration job p95')
            expect(within(p95).getByText('Above 6,000 ms (2× the baseline p95); at least 200 segments')).toBeInTheDocument()
            expect(within(p95).getByText('7,000 ms (threshold 6,000 ms, sample 205)')).toBeInTheDocument()

            const moderation = ruleRow(rules, 'Moderation unavailable')
            expect(moderation).toHaveAttribute('data-state', 'quiet')
            expect(within(moderation).getByText('Not firing')).toBeInTheDocument()
            expect(screen.getByTestId('metrics-firing-count')).toHaveTextContent('3 rules firing')
        })

        it('shows segments per provider, outcomes, turn charges, the baseline and the live process metrics', async () => {
            renderInConsole(<MetricsModule />, 'metrics')
            const providers = await screen.findByRole('table', { name: 'Narration segments by provider' })
            const row = within(providers).getByRole('row', { name: /elevenlabs/ })
            expect(row).toHaveTextContent('205')
            expect(row).toHaveTextContent('7.32%')
            expect(row).toHaveTextContent('10 · 4.88%')
            expect(row).toHaveTextContent('7,000 ms')
            expect(screen.getByTestId('metrics-baseline')).toHaveTextContent('Failure rate 1% · job p95 3,000 ms')
            expect(within(screen.getByRole('table', { name: 'Narration segment outcomes' })).getByRole('row', { name: /timeout/ })).toHaveTextContent('5')
            expect(within(screen.getByRole('table', { name: 'Narration turn charges by status and tier' })).getByRole('row', { name: /^open standard/ })).toHaveTextContent('30')
            expect(screen.getByText('Open charges older than 15 minutes count as stale.')).toBeInTheDocument()
            const live = screen.getByRole('table', { name: 'Live process metrics' })
            expect(within(live).getByRole('row', { name: /narration_job_ms/ })).toHaveTextContent('p50 900 ms · p95 900 ms · max 900 ms · n 1')
            expect(within(screen.getByRole('table', { name: 'Requests per day by surface and provider' })).getByRole('row', { name: /2026-10-11/ })).toHaveTextContent('205')
            const liveRequests = within(screen.getByRole('table', { name: 'Live requests per day by surface and provider' })).getByRole('row', { name: /2026-10-12/ })
            expect(liveRequests).toHaveTextContent('narration')
            expect(liveRequests).toHaveTextContent('1')
        })

        it('shows the current last-hour value of a rule that does not fire', async () => {
            const quietHour: NarrationMetricsResponse = { ...narrationMetrics, window: { ...narrationMetrics.window, hours: 1 }, alerts: [] }
            mock().getAdminVoiceMetrics.mockResolvedValue(quietHour)
            renderInConsole(<MetricsModule />, 'metrics')
            const rules = await screen.findByRole('table', { name: 'Alert rules: Narration' })
            const moderation = ruleRow(rules, 'Moderation unavailable')
            expect(moderation).toHaveAttribute('data-state', 'quiet')
            expect(within(moderation).getByText('0% (sample 205)')).toBeInTheDocument()
            expect(within(moderation).getByText('elevenlabs')).toBeInTheDocument()
            expect(within(ruleRow(rules, 'Narration job p95')).getByText('7,000 ms (sample 205)')).toBeInTheDocument()
        })

        it('does not evaluate the × baseline rule without a baseline, and says so', async () => {
            const withoutBaseline: NarrationMetricsResponse = { ...narrationMetrics, baseline: null, alerts: narrationMetrics.alerts.filter((alert) => alert.alert !== 'narration_job_p95') }
            mock().getAdminVoiceMetrics.mockResolvedValue(withoutBaseline)
            renderInConsole(<MetricsModule />, 'metrics')
            const rules = await screen.findByRole('table', { name: 'Alert rules: Narration' })
            const p95 = ruleRow(rules, 'Narration job p95')
            expect(within(p95).getByText('Not evaluated')).toBeInTheDocument()
            expect(within(p95).getByText('No baseline is loaded.')).toBeInTheDocument()
            expect(within(p95).getByText('Above 2× the baseline p95; at least 200 segments')).toBeInTheDocument()
            expect(screen.getByTestId('metrics-baseline')).toHaveTextContent('No baseline is loaded, so the × baseline rules are not evaluated.')
        })

        it('refetches for a new window and reports a small last-hour sample', async () => {
            renderInConsole(<MetricsModule />, 'metrics')
            await screen.findByRole('table', { name: 'Alert rules: Narration' })
            const small: NarrationMetricsResponse = {
                ...narrationMetrics,
                window: { ...narrationMetrics.window, hours: 1 },
                db: { ...narrationMetrics.db, providers: [{ ...narrationMetrics.db.providers[0], terminal: 40 }] },
                alerts: [],
            }
            mock().getAdminVoiceMetrics.mockResolvedValue(small)
            chooseOption('Window', 'Last hour')
            await waitFor(() => expect(mock().getAdminVoiceMetrics).toHaveBeenLastCalledWith('narration', { hours: 1 }, expect.any(AbortSignal)))
            const rules = await screen.findByRole('table', { name: 'Alert rules: Narration' })
            await waitFor(() => expect(ruleRow(rules, 'Narration failure rate')).toHaveAttribute('data-state', 'low_sample'))
            expect(within(ruleRow(rules, 'Narration failure rate')).getByText('Sample too small')).toBeInTheDocument()
            expect(screen.getByTestId('metrics-firing-count')).toHaveTextContent('No rule firing')
        })

        it('refreshes on demand', async () => {
            renderInConsole(<MetricsModule />, 'metrics')
            await screen.findByRole('table', { name: 'Alert rules: Narration' })
            expect(mock().getAdminVoiceMetrics).toHaveBeenCalledTimes(1)
            fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
            await waitFor(() => expect(mock().getAdminVoiceMetrics).toHaveBeenCalledTimes(2))
        })
    })

    it('calls: shows the call failure rate and first audio over the last hour', async () => {
        await openArea('Calls')
        await waitFor(() => expect(mock().getAdminVoiceMetrics).toHaveBeenLastCalledWith('calls', { hours: 24 }, expect.any(AbortSignal)))
        const rules = await screen.findByRole('table', { name: 'Alert rules: Calls' })
        expect(within(ruleRow(rules, 'Call TTS failure')).getByText('8% (threshold 3%, sample 25)')).toBeInTheDocument()
        const firstAudioRule = ruleRow(rules, 'Call first audio p50')
        expect(within(firstAudioRule).getByText('500 ms (threshold 400 ms, sample 20)')).toBeInTheDocument()
        expect(within(firstAudioRule).getByText('elevenlabs')).toBeInTheDocument()
        const calls = screen.getByRole('table', { name: 'Calls by provider' })
        const row = within(calls).getByRole('row', { name: /elevenlabs/ })
        expect(row).toHaveTextContent('ended 24 · failed 1')
        expect(row).toHaveTextContent('60')
        expect(row).toHaveTextContent('tts_timeout 3')
        const firstAudio = screen.getByRole('table', { name: 'Call first audio over the last hour' })
        expect(within(firstAudio).getByRole('row', { name: /elevenlabs/ })).toHaveTextContent('500 ms')
    })

    it('provider: shows breaker states and the firing provider rules', async () => {
        await openArea('Provider health')
        const rules = await screen.findByRole('table', { name: 'Alert rules: Provider health' })
        const throttle = ruleRow(rules, 'Rate-limited share')
        expect(within(throttle).getByText('30% (threshold 20%, sample 30)')).toBeInTheDocument()
        expect(within(throttle).getByText('Above 5% over 5 minutes warns, above 20% pages; at least 20 requests')).toBeInTheDocument()
        const config = ruleRow(rules, 'Configuration breaker')
        expect(within(config).getByText('Open')).toBeInTheDocument()
        expect(within(config).getByText('elevenlabs · config:narration')).toBeInTheDocument()
        expect(ruleRow(rules, 'Billing breaker')).toHaveAttribute('data-state', 'quiet')
        const breakers = screen.getByRole('table', { name: 'Breaker states' })
        expect(within(breakers).getByRole('row', { name: /config:narration/ })).toHaveTextContent('Open')
        expect(within(breakers).getByRole('row', { name: /billing/ })).toHaveTextContent('Closed')
        // The cohort rollout is gone (I-68): no stored rollout settings panel.
        expect(screen.queryByText('Rollout settings')).not.toBeInTheDocument()
        expect(ruleRow(rules, 'Provider account event')).toHaveAttribute('data-state', 'quiet')
    })

    it('provider: pages on an account event, with its kind and runbook', async () => {
        const ban = { alert: 'account_event', severity: 'page' as const, provider: 'elevenlabs', value: 1, threshold: 1, sample: 1, runbook: 'RB-8', detail: 'voice_ban' }
        const withEvents: ProviderMetricsResponse = {
            ...providerMetrics,
            process: {
                ...providerMetrics.process,
                windows: [
                    ...providerMetrics.process.windows,
                    { metric: 'provider_account_events', provider: 'elevenlabs', kind: 'key_disabled', window_seconds: 3600, count: 2 },
                    { metric: 'provider_account_events', provider: 'elevenlabs', kind: 'voice_ban', window_seconds: 3600, count: 1 },
                ],
            },
            alerts: [...providerMetrics.alerts, ban],
        }
        mock().getAdminVoiceMetrics.mockImplementation((area: string) => Promise.resolve(area === 'provider' ? withEvents : narrationMetrics))
        const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
        try {
            await openArea('Provider health')
            const rules = await screen.findByRole('table', { name: 'Alert rules: Provider health' })
            const account = ruleRow(rules, 'Provider account event')
            expect(account).toHaveAttribute('data-state', 'firing')
            expect(within(account).getByText('1 (threshold 1, sample 1)')).toBeInTheDocument()
            expect(within(account).getByText('elevenlabs · voice_ban')).toBeInTheDocument()
            expect(within(account).getByText('RB-8')).toBeInTheDocument()
            expect(within(account).getByText('Any event in the last hour (key disabled, voice ban, enforcement email, workspace restriction, policy rejection); no minimum sample')).toBeInTheDocument()
            expect(within(rules).queryByText(/^Other alert/)).not.toBeInTheDocument()
            expect(screen.getByTestId('metrics-firing-count')).toHaveTextContent('3 rules firing')

            const live = screen.getByRole('table', { name: 'Live process metrics' })
            const events = within(live).getAllByRole('row', { name: /provider_account_events/ })
            expect(events.map((row) => row.textContent)).toEqual([expect.stringContaining('key_disabled: 2 in 3,600 s'), expect.stringContaining('voice_ban: 1 in 3,600 s')])
            expect(errors.mock.calls.some((call) => String(call[0]).includes('same key'))).toBe(false)
        } finally {
            errors.mockRestore()
        }
    })

    it('provider: shows the current 5-minute rate-limited share while it does not fire', async () => {
        const quiet: ProviderMetricsResponse = {
            ...providerMetrics,
            process: { ...providerMetrics.process, windows: [{ ...providerMetrics.process.windows[0], numerator: 1, value: 0.033333 }] },
            alerts: [],
        }
        mock().getAdminVoiceMetrics.mockImplementation((area: string) => Promise.resolve(area === 'provider' ? quiet : narrationMetrics))
        await openArea('Provider health')
        const throttle = ruleRow(await screen.findByRole('table', { name: 'Alert rules: Provider health' }), 'Rate-limited share')
        expect(throttle).toHaveAttribute('data-state', 'quiet')
        expect(within(throttle).getByText('3.33% (sample 30)')).toBeInTheDocument()
        expect(within(throttle).getByText('elevenlabs')).toBeInTheDocument()
    })

    it('moderation: shows outcomes, classifier latency and abuse counters, with no rules of its own', async () => {
        await openArea('Moderation and abuse')
        expect(await screen.findByText('This area has no alert rules of its own. Moderation unavailability is a narration rule.')).toBeInTheDocument()
        expect(screen.queryByTestId('metrics-firing-count')).not.toBeInTheDocument()
        expect(within(screen.getByRole('table', { name: 'Moderation outcomes on narration jobs by provider' })).getByRole('row', { name: /elevenlabs/ })).toHaveTextContent('0.48%')
        expect(within(screen.getByRole('table', { name: 'Moderation latency' })).getByRole('row', { name: /elevenlabs/ })).toHaveTextContent('120 ms')
        expect(within(screen.getByRole('table', { name: 'Abuse counters by day and kind' })).getByRole('row', { name: /2026-10-12/ })).toHaveTextContent('burst')
    })

    it('spend: asks for days and shows the band reached against the budget', async () => {
        await openArea('Spend and budget')
        await waitFor(() => expect(mock().getAdminVoiceMetrics).toHaveBeenLastCalledWith('spend', { days: 7 }, expect.any(AbortSignal)))
        const rules = await screen.findByRole('table', { name: 'Alert rules: Spend and budget' })
        const bands = ruleRow(rules, 'Spend circuit')
        expect(within(bands).getByText('Warn')).toBeInTheDocument()
        expect(within(bands).getByText('85% (threshold 80%)')).toBeInTheDocument()
        expect(screen.getByTestId('metrics-spend-budget')).toHaveTextContent('Daily budget: 1,000,000 characters')
        const days = screen.getByRole('table', { name: 'Estimated spend by day' })
        expect(within(days).getByRole('row', { name: /2026-10-12/ })).toHaveTextContent('$34.00')
        expect(within(days).getByRole('row', { name: /2026-10-12/ })).toHaveTextContent('850,000')
        expect(within(screen.getByRole('table', { name: 'Estimated spend by day, surface and model' })).getByRole('row', { name: /2026-10-12/ })).toHaveTextContent('Narration')
        chooseOption('Window', 'Last 30 days')
        await waitFor(() => expect(mock().getAdminVoiceMetrics).toHaveBeenLastCalledWith('spend', { days: 30 }, expect.any(AbortSignal)))
    })

    it('says plainly when the metrics are unavailable, and retries', async () => {
        mock().getAdminVoiceMetrics.mockRejectedValueOnce(new ApiError(503, 'Voice metrics are unavailable.'))
        renderInConsole(<MetricsModule />, 'metrics')
        const alert = await screen.findByText('Metrics are unavailable right now. Try again shortly.')
        fireEvent.click(within(alert.closest('[role="alert"]') as HTMLElement).getByRole('button', { name: 'Retry' }))
        expect(await screen.findByRole('table', { name: 'Alert rules: Narration' })).toBeInTheDocument()
        expect(mock().getAdminVoiceMetrics).toHaveBeenCalledTimes(2)
    })

    it('shows an empty state when nothing was recorded, and keeps the rules', async () => {
        const empty: ProviderMetricsResponse = {
            ...providerMetrics,
            db: { jobs: [], requests_per_day: [] },
            process: emptyProcessMetrics({ breakers: {} }),
            alerts: [],
        }
        mock().getAdminVoiceMetrics.mockImplementation((area: string) => Promise.resolve(area === 'provider' ? empty : narrationMetrics))
        await openArea('Provider health')
        expect(await screen.findByText('Nothing recorded in this window')).toBeInTheDocument()
        const rules = screen.getByRole('table', { name: 'Alert rules: Provider health' })
        expect(ruleRow(rules, 'Billing breaker')).toHaveAttribute('data-state', 'no_data')
        expect(screen.queryByRole('table', { name: 'Breaker states' })).not.toBeInTheDocument()
    })

    it('lists a firing alert no rule knows, by name', async () => {
        const extra = { alert: 'future_rule', severity: 'page' as const, provider: 'all', value: 1, threshold: 1, sample: 1, runbook: 'RB-99', detail: null }
        mock().getAdminVoiceMetrics.mockResolvedValue({ ...narrationMetrics, alerts: [...narrationMetrics.alerts, extra] })
        renderInConsole(<MetricsModule />, 'metrics')
        const rules = await screen.findByRole('table', { name: 'Alert rules: Narration' })
        const row = ruleRow(rules, 'Other alert: future_rule')
        expect(row).toHaveAttribute('data-state', 'firing')
        expect(within(row).getByText('RB-99')).toBeInTheDocument()
    })
})
