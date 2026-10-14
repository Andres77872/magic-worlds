/** Spend and budget dashboard (11 §8.3, D37): each day's estimated cost against the daily budget, by surface and model. */
import { useTranslation } from 'react-i18next'
import type { SpendMetricsResponse } from '@/shared'
import { formatNumber, formatPercentValue, formatUsdMicros } from '../../format'
import { MetricsPanel, MetricsTable, Mono, ProcessMetricsPanel } from './MetricsTable'

const KNOWN_SURFACES = new Set(['narration', 'call', 'preview', 'admin'])

export function SpendMetricsView({ envelope, locale }: { envelope: SpendMetricsResponse; locale: string }) {
    const { t } = useTranslation()
    const db = envelope.db
    const budget = db?.daily_budget_chars ?? null
    const n = (value: number | null | undefined) => formatNumber(value, locale)

    return (
        <>
            <p className="font-ui text-sm text-parchment-200" data-testid="metrics-spend-budget">
                {typeof budget === 'number' ? t('admin.voices.metrics.spend.budget', { chars: n(budget) }) : t('admin.voices.metrics.spend.budgetUnset')}
            </p>

            <MetricsPanel title={t('admin.voices.metrics.spend.daysTitle')}>
                <MetricsTable
                    caption={t('admin.voices.metrics.spend.daysCaption')}
                    rows={db?.days ?? []}
                    rowKey={(row) => row.day}
                    columns={[
                        { key: 'day', header: t('admin.voices.metrics.columns.day'), rowHeader: true, cell: (row) => row.day },
                        { key: 'cost', header: t('admin.voices.metrics.spend.cost'), numeric: true, cell: (row) => formatUsdMicros(row.est_cost_usd_micros, locale) },
                        { key: 'flash', header: t('admin.voices.metrics.spend.flashChars'), numeric: true, cell: (row) => n(row.flash_equivalent_chars) },
                        { key: 'budget', header: t('admin.voices.metrics.spend.budgetUsed'), numeric: true, cell: (row) => formatPercentValue(row.budget_pct, locale) },
                    ]}
                />
            </MetricsPanel>

            <MetricsPanel title={t('admin.voices.metrics.spend.rowsTitle')}>
                <MetricsTable
                    caption={t('admin.voices.metrics.spend.rowsCaption')}
                    rows={db?.rows ?? []}
                    rowKey={(row, index) => `${row.day}-${row.surface}-${row.model_id}-${index}`}
                    columns={[
                        { key: 'day', header: t('admin.voices.metrics.columns.day'), rowHeader: true, cell: (row) => row.day },
                        {
                            key: 'surface',
                            header: t('admin.voices.metrics.columns.surface'),
                            cell: (row) => (KNOWN_SURFACES.has(row.surface) ? t(`admin.voices.limits.surfaces.${row.surface}`) : <Mono>{row.surface}</Mono>),
                        },
                        { key: 'model', header: t('admin.voices.metrics.spend.model'), cell: (row) => <Mono>{row.model_id}</Mono> },
                        { key: 'chars', header: t('admin.voices.metrics.spend.characters'), numeric: true, cell: (row) => n(row.chars) },
                        { key: 'cost', header: t('admin.voices.metrics.spend.cost'), numeric: true, cell: (row) => formatUsdMicros(row.est_cost_usd_micros, locale) },
                    ]}
                />
            </MetricsPanel>

            <ProcessMetricsPanel process={envelope.process} locale={locale} />
        </>
    )
}
