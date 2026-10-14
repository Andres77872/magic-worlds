/**
 * Moderation and abuse dashboard (11 §8.3, R0-OPS-07): outcomes on narration,
 * classifier latency, abuse counters. Drained call characters get their own
 * column, so they are never read as events (D26 6a).
 */
import { useTranslation } from 'react-i18next'
import type { AbuseCounterRow, ModerationMetricsResponse } from '@/shared'
import { formatMs, formatNumber, formatShare } from '../../format'
import { abuseCounterValues, hasCharacterCounters } from './abuseCounters'
import { MetricsPanel, MetricsTable, Mono, ProcessMetricsPanel, type MetricsColumn } from './MetricsTable'

export function ModerationMetricsView({ envelope, locale }: { envelope: ModerationMetricsResponse; locale: string }) {
    const { t } = useTranslation()
    const db = envelope.db
    const n = (value: number | null | undefined) => formatNumber(value, locale)
    const latency = (envelope.process?.histograms ?? []).filter((item) => item.metric === 'moderation_ms')
    const abuse = db?.abuse_counters ?? []
    const withChars = hasCharacterCounters(abuse)
    const abuseColumns: MetricsColumn<AbuseCounterRow>[] = [
        { key: 'day', header: t('admin.voices.metrics.columns.day'), rowHeader: true, cell: (row) => row.day },
        { key: 'kind', header: t('admin.voices.metrics.moderation.kind'), cell: (row) => <Mono>{row.kind}</Mono> },
        { key: 'events', header: t('admin.voices.metrics.moderation.events'), numeric: true, cell: (row) => n(abuseCounterValues(row).events) },
        ...(withChars
            ? [{ key: 'chars', header: t('admin.voices.metrics.moderation.chars'), numeric: true, cell: (row: AbuseCounterRow) => n(abuseCounterValues(row).chars) }]
            : []),
        { key: 'users', header: t('admin.voices.metrics.moderation.users'), numeric: true, cell: (row) => n(row.users) },
    ]

    return (
        <>
            <MetricsPanel title={t('admin.voices.metrics.moderation.jobsTitle')}>
                <MetricsTable
                    caption={t('admin.voices.metrics.moderation.jobsCaption')}
                    rows={db?.jobs ?? []}
                    rowKey={(row) => row.provider}
                    columns={[
                        { key: 'provider', header: t('admin.voices.metrics.columns.provider'), rowHeader: true, cell: (row) => row.provider },
                        { key: 'finished', header: t('admin.voices.metrics.moderation.finished'), numeric: true, cell: (row) => n(row.terminal_jobs) },
                        { key: 'blocked', header: t('admin.voices.metrics.moderation.blocked'), numeric: true, cell: (row) => n(row.content_blocked) },
                        { key: 'unavailable', header: t('admin.voices.metrics.moderation.unavailable'), numeric: true, cell: (row) => n(row.moderation_unavailable) },
                        {
                            key: 'share',
                            header: t('admin.voices.metrics.moderation.unavailableShare'),
                            numeric: true,
                            cell: (row) => formatShare(row.moderation_unavailable_share, locale),
                        },
                    ]}
                />
            </MetricsPanel>

            <MetricsPanel title={t('admin.voices.metrics.moderation.latencyTitle')}>
                <MetricsTable
                    caption={t('admin.voices.metrics.moderation.latencyCaption')}
                    rows={latency}
                    rowKey={(row, index) => `${row.provider}-${index}`}
                    columns={[
                        { key: 'provider', header: t('admin.voices.metrics.columns.provider'), rowHeader: true, cell: (row) => row.provider },
                        { key: 'verdicts', header: t('admin.voices.metrics.moderation.verdicts'), numeric: true, cell: (row) => n(row.count) },
                        { key: 'p50', header: t('admin.voices.metrics.columns.p50'), numeric: true, cell: (row) => formatMs(row.p50, locale) },
                        { key: 'p95', header: t('admin.voices.metrics.columns.p95'), numeric: true, cell: (row) => formatMs(row.p95, locale) },
                        { key: 'max', header: t('admin.voices.metrics.columns.max'), numeric: true, cell: (row) => formatMs(row.max, locale) },
                    ]}
                />
            </MetricsPanel>

            <MetricsPanel title={t('admin.voices.metrics.moderation.abuseTitle')} hint={withChars ? t('admin.voices.metrics.moderation.charsHint') : undefined}>
                <MetricsTable
                    caption={t('admin.voices.metrics.moderation.abuseCaption')}
                    rows={abuse}
                    rowKey={(row) => `${row.day}-${row.kind}`}
                    columns={abuseColumns}
                />
            </MetricsPanel>

            <ProcessMetricsPanel process={envelope.process} locale={locale} />
        </>
    )
}
