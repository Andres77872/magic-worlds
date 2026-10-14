/** Provider health dashboard (11 §8.3): breaker states and speech jobs by outcome. */
import { useTranslation } from 'react-i18next'
import type { ProviderMetricsResponse } from '@/shared'
import { Badge, type BadgeTone } from '@/ui/primitives'
import { formatNumber } from '../../format'
import { MetricsPanel, MetricsTable, Mono, ProcessMetricsPanel, RequestsPerDayPanel } from './MetricsTable'

const BREAKER_TONE: Record<string, BadgeTone> = { open: 'danger', half_open: 'warning', closed: 'live' }

export function ProviderMetricsView({ envelope, locale }: { envelope: ProviderMetricsResponse; locale: string }) {
    const { t } = useTranslation()
    const db = envelope.db
    const breakers = Object.entries(envelope.process?.breakers ?? {}).sort(([a], [b]) => a.localeCompare(b))

    return (
        <>
            <MetricsPanel title={t('admin.voices.metrics.provider.breakersTitle')}>
                {breakers.length === 0 ? (
                    <p className="font-ui text-sm text-fg-muted">{t('admin.voices.metrics.provider.noBreakers')}</p>
                ) : (
                    <MetricsTable
                        caption={t('admin.voices.metrics.provider.breakersCaption')}
                        rows={breakers}
                        rowKey={([name]) => name}
                        columns={[
                            { key: 'breaker', header: t('admin.voices.metrics.provider.breaker'), rowHeader: true, cell: ([name]) => name },
                            {
                                key: 'state',
                                header: t('admin.voices.metrics.provider.state'),
                                cell: ([, state]) => (
                                    <Badge tone={BREAKER_TONE[state] ?? 'neutral'}>{t(`admin.voices.metrics.provider.breakerStates.${state}`, { defaultValue: state })}</Badge>
                                ),
                            },
                        ]}
                    />
                )}
            </MetricsPanel>

            <MetricsPanel title={t('admin.voices.metrics.provider.jobsTitle')}>
                <MetricsTable
                    caption={t('admin.voices.metrics.provider.jobsCaption')}
                    rows={db?.jobs ?? []}
                    rowKey={(row, index) => `${row.source}-${row.provider}-${row.model_alias}-${row.status}-${row.error_category ?? ''}-${index}`}
                    columns={[
                        { key: 'source', header: t('admin.voices.metrics.provider.source'), rowHeader: true, cell: (row) => row.source },
                        { key: 'provider', header: t('admin.voices.metrics.columns.provider'), cell: (row) => <Mono>{row.provider}</Mono> },
                        { key: 'model', header: t('admin.voices.metrics.provider.model'), cell: (row) => <Mono>{row.model_alias || '—'}</Mono> },
                        { key: 'status', header: t('admin.voices.metrics.columns.status'), cell: (row) => <Mono>{row.status}</Mono> },
                        { key: 'category', header: t('admin.voices.metrics.columns.category'), cell: (row) => <Mono>{row.error_category ?? '—'}</Mono> },
                        { key: 'jobs', header: t('admin.voices.metrics.columns.jobs'), numeric: true, cell: (row) => formatNumber(row.jobs, locale) },
                    ]}
                />
            </MetricsPanel>

            <RequestsPerDayPanel rows={db?.requests_per_day ?? []} live={envelope.process?.requests_per_day ?? []} locale={locale} />
            <ProcessMetricsPanel process={envelope.process} locale={locale} />
        </>
    )
}
