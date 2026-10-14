/** Narration dashboard (11 §8.3): segments per provider, outcomes, turn charges and the baseline. */
import { useTranslation } from 'react-i18next'
import type { NarrationMetricsResponse } from '@/shared'
import { formatMs, formatNumber, formatShare } from '../../format'
import { MetricsPanel, MetricsTable, Mono, ProcessMetricsPanel, RequestsPerDayPanel } from './MetricsTable'

export function NarrationMetricsView({ envelope, locale }: { envelope: NarrationMetricsResponse; locale: string }) {
    const { t } = useTranslation()
    const db = envelope.db
    const n = (value: number | null | undefined) => formatNumber(value, locale)
    const share = (value: number | null | undefined) => formatShare(value, locale)
    const countAndShare = (count: number, value: number | null) => `${n(count)} · ${share(value)}`
    const baseline = envelope.baseline
    const hasBaseline = baseline !== null && (baseline.narration_failure_rate !== null || baseline.narration_p95_ms !== null)

    return (
        <>
            <MetricsPanel title={t('admin.voices.metrics.narration.providersTitle')} hint={t('admin.voices.metrics.narration.providersHint')}>
                <MetricsTable
                    caption={t('admin.voices.metrics.narration.providersCaption')}
                    rows={db?.providers ?? []}
                    rowKey={(row) => row.provider}
                    columns={[
                        { key: 'provider', header: t('admin.voices.metrics.columns.provider'), rowHeader: true, cell: (row) => row.provider },
                        { key: 'finished', header: t('admin.voices.metrics.narration.finished'), numeric: true, cell: (row) => n(row.terminal) },
                        { key: 'failed', header: t('admin.voices.metrics.narration.failed'), numeric: true, cell: (row) => n(row.failed) },
                        { key: 'failureRate', header: t('admin.voices.metrics.narration.failureRate'), numeric: true, cell: (row) => share(row.failure_rate) },
                        {
                            key: 'voiceUnavailable',
                            header: t('admin.voices.metrics.narration.voiceUnavailable'),
                            numeric: true,
                            cell: (row) => countAndShare(row.voice_unavailable, row.voice_unavailable_share),
                        },
                        {
                            key: 'moderationUnavailable',
                            header: t('admin.voices.metrics.narration.moderationUnavailable'),
                            numeric: true,
                            cell: (row) => countAndShare(row.moderation_unavailable, row.moderation_unavailable_share),
                        },
                        { key: 'replaced', header: t('admin.voices.metrics.narration.replaced'), numeric: true, cell: (row) => countAndShare(row.replaced, row.replaced_share) },
                        { key: 'blocked', header: t('admin.voices.metrics.narration.blocked'), numeric: true, cell: (row) => n(row.content_blocked) },
                        { key: 'quota', header: t('admin.voices.metrics.narration.quota'), numeric: true, cell: (row) => n(row.quota_exceeded) },
                        { key: 'inFlight', header: t('admin.voices.metrics.narration.inFlight'), numeric: true, cell: (row) => n(row.in_flight) },
                        { key: 'p50', header: t('admin.voices.metrics.narration.p50'), numeric: true, cell: (row) => formatMs(row.latency?.p50_ms, locale) },
                        { key: 'p95', header: t('admin.voices.metrics.narration.p95'), numeric: true, cell: (row) => formatMs(row.latency?.p95_ms, locale) },
                    ]}
                />
            </MetricsPanel>

            <MetricsPanel title={t('admin.voices.metrics.narration.baselineTitle')}>
                <p className="font-ui text-sm text-parchment-200" data-testid="metrics-baseline">
                    {hasBaseline
                        ? t('admin.voices.metrics.narration.baselineValue', {
                              rate: share(baseline?.narration_failure_rate),
                              p95: formatMs(baseline?.narration_p95_ms, locale),
                          })
                        : t('admin.voices.metrics.narration.baselineMissing')}
                </p>
            </MetricsPanel>

            <MetricsPanel title={t('admin.voices.metrics.narration.outcomesTitle')}>
                <MetricsTable
                    caption={t('admin.voices.metrics.narration.outcomesCaption')}
                    rows={db?.statuses ?? []}
                    rowKey={(row, index) => `${row.provider}-${row.status}-${row.error_category ?? ''}-${row.substitution_reason ?? ''}-${index}`}
                    columns={[
                        { key: 'provider', header: t('admin.voices.metrics.columns.provider'), rowHeader: true, cell: (row) => row.provider },
                        { key: 'status', header: t('admin.voices.metrics.columns.status'), cell: (row) => <Mono>{row.status}</Mono> },
                        { key: 'category', header: t('admin.voices.metrics.columns.category'), cell: (row) => <Mono>{row.error_category ?? '—'}</Mono> },
                        { key: 'substitution', header: t('admin.voices.metrics.narration.substitution'), cell: (row) => <Mono>{row.substitution_reason ?? '—'}</Mono> },
                        { key: 'jobs', header: t('admin.voices.metrics.columns.jobs'), numeric: true, cell: (row) => n(row.jobs) },
                    ]}
                />
            </MetricsPanel>

            <MetricsPanel
                title={t('admin.voices.metrics.narration.chargesTitle')}
                hint={t('admin.voices.metrics.narration.chargesHint', { minutes: n(Math.round((db?.stale_after_seconds ?? 0) / 60)) })}
            >
                <MetricsTable
                    caption={t('admin.voices.metrics.narration.chargesCaption')}
                    rows={db?.turn_charges ?? []}
                    rowKey={(row) => `${row.status}-${row.tier}`}
                    columns={[
                        { key: 'status', header: t('admin.voices.metrics.columns.status'), rowHeader: true, cell: (row) => row.status },
                        { key: 'tier', header: t('admin.voices.metrics.narration.tier'), cell: (row) => <Mono>{row.tier}</Mono> },
                        { key: 'charges', header: t('admin.voices.metrics.narration.charges'), numeric: true, cell: (row) => n(row.charges) },
                        { key: 'reserved', header: t('admin.voices.metrics.narration.reserved'), numeric: true, cell: (row) => n(row.credits_reserved) },
                        { key: 'final', header: t('admin.voices.metrics.narration.final'), numeric: true, cell: (row) => n(row.credits_final) },
                        { key: 'counted', header: t('admin.voices.metrics.narration.countedChars'), numeric: true, cell: (row) => n(row.counted_chars) },
                        { key: 'stale', header: t('admin.voices.metrics.narration.staleOpen'), numeric: true, cell: (row) => n(row.stale_open) },
                    ]}
                />
            </MetricsPanel>

            <RequestsPerDayPanel rows={db?.requests_per_day ?? []} live={envelope.process?.requests_per_day ?? []} locale={locale} />
            <ProcessMetricsPanel process={envelope.process} locale={locale} />
        </>
    )
}
