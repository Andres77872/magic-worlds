/** Calls dashboard (11 §8.3): calls per provider with the TTS failure rate, and first audio over the last hour. */
import { useTranslation } from 'react-i18next'
import type { CallMetricsResponse } from '@/shared'
import { formatMs, formatNumber, formatShare } from '../../format'
import { MetricsPanel, MetricsTable, Mono, ProcessMetricsPanel, RequestsPerDayPanel } from './MetricsTable'

function joinCounts(counts: Record<string, number> | null | undefined, locale: string): string {
    const entries = Object.entries(counts ?? {})
    return entries.length === 0 ? '—' : entries.map(([name, value]) => `${name} ${formatNumber(value, locale)}`).join(' · ')
}

export function CallMetricsView({ envelope, locale }: { envelope: CallMetricsResponse; locale: string }) {
    const { t } = useTranslation()
    const db = envelope.db
    const n = (value: number | null | undefined) => formatNumber(value, locale)
    const firstAudio = (envelope.process?.windows ?? []).filter((item) => item.metric === 'call_first_audio_ms')

    return (
        <>
            <MetricsPanel title={t('admin.voices.metrics.calls.providersTitle')}>
                <MetricsTable
                    caption={t('admin.voices.metrics.calls.providersCaption')}
                    rows={db?.providers ?? []}
                    rowKey={(row) => row.provider}
                    columns={[
                        { key: 'provider', header: t('admin.voices.metrics.columns.provider'), rowHeader: true, cell: (row) => row.provider },
                        { key: 'calls', header: t('admin.voices.metrics.calls.calls'), numeric: true, cell: (row) => n(row.calls) },
                        { key: 'outcomes', header: t('admin.voices.metrics.calls.outcomes'), cell: (row) => <Mono>{joinCounts(row.by_status, locale)}</Mono> },
                        { key: 'minutes', header: t('admin.voices.metrics.calls.minutes'), numeric: true, cell: (row) => formatNumber(row.consumed_seconds / 60, locale, 1) },
                        { key: 'withFailure', header: t('admin.voices.metrics.calls.withFailure'), numeric: true, cell: (row) => n(row.calls_with_tts_failure) },
                        { key: 'failureRate', header: t('admin.voices.metrics.calls.failureRate'), numeric: true, cell: (row) => formatShare(row.tts_failure_rate, locale) },
                        { key: 'failedTurns', header: t('admin.voices.metrics.calls.failedTurns'), cell: (row) => <Mono>{joinCounts(row.failed_turns_by_category, locale)}</Mono> },
                    ]}
                />
            </MetricsPanel>

            <MetricsPanel title={t('admin.voices.metrics.calls.firstAudioTitle')} hint={t('admin.voices.metrics.calls.firstAudioHint')}>
                <MetricsTable
                    caption={t('admin.voices.metrics.calls.firstAudioCaption')}
                    rows={firstAudio}
                    rowKey={(row, index) => `${row.provider}-${index}`}
                    columns={[
                        { key: 'provider', header: t('admin.voices.metrics.columns.provider'), rowHeader: true, cell: (row) => row.provider },
                        { key: 'calls', header: t('admin.voices.metrics.calls.distinctCalls'), numeric: true, cell: (row) => n(row.calls) },
                        { key: 'turns', header: t('admin.voices.metrics.calls.turns'), numeric: true, cell: (row) => n(row.count) },
                        { key: 'p50', header: t('admin.voices.metrics.columns.p50'), numeric: true, cell: (row) => formatMs(row.p50 ?? null, locale) },
                        { key: 'p95', header: t('admin.voices.metrics.columns.p95'), numeric: true, cell: (row) => formatMs(row.p95 ?? null, locale) },
                    ]}
                />
            </MetricsPanel>

            <RequestsPerDayPanel rows={db?.requests_per_day ?? []} live={envelope.process?.requests_per_day ?? []} locale={locale} />
            <ProcessMetricsPanel process={envelope.process} locale={locale} />
        </>
    )
}
