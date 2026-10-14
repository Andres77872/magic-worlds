/**
 * Compact metrics tables for the root Metrics module (11 §8.3): a titled
 * panel, a generic table, and the two panels every area shares (requests per
 * day and the live process metrics).
 */
import type { ReactNode } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import type { AdminVoiceProcessMetrics, DbRequestsPerDay, ProcessRequestsPerDay, ProcessWindow } from '@/shared'
import { SectionHeader, cx } from '@/ui/primitives'
import { formatDateTime, formatMs, formatNumber, formatShare } from '../../format'

interface MetricsPanelProps {
    title: string
    hint?: ReactNode
    right?: ReactNode
    children: ReactNode
}

/** One titled block of an area view. */
export function MetricsPanel({ title, hint, right, children }: MetricsPanelProps) {
    return (
        <section className="flex min-w-0 flex-col gap-2" aria-label={title}>
            <SectionHeader as="h3" title={title} right={right} />
            {hint && <p className="max-w-[80ch] font-ui text-caption text-fg-muted">{hint}</p>}
            {children}
        </section>
    )
}

export interface MetricsColumn<T> {
    key: string
    header: string
    cell: (row: T) => ReactNode
    /** Numbers align to the end. */
    numeric?: boolean
    /** The first column names the row (`<th scope="row">`). */
    rowHeader?: boolean
}

interface MetricsTableProps<T> {
    caption: string
    columns: readonly MetricsColumn<T>[]
    rows: readonly T[]
    rowKey: (row: T, index: number) => string
}

const HEAD = 'border-b border-line-faint pb-2 pr-3 font-semibold last:pr-0'
const CELL = 'border-b border-line-faint py-2 pr-3 last:pr-0'

/** A dense, horizontally scrolling table; says so when the window has no rows. */
export function MetricsTable<T>({ caption, columns, rows, rowKey }: MetricsTableProps<T>) {
    const { t } = useTranslation()
    if (rows.length === 0) return <p className="font-ui text-sm text-fg-muted">{t('admin.voices.metrics.emptyTable')}</p>
    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse font-ui text-sm">
                <caption className="sr-only">{caption}</caption>
                <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-parchment-400">
                        {columns.map((column) => (
                            <th key={column.key} scope="col" className={cx(HEAD, column.numeric && 'text-right')}>
                                {column.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, index) => (
                        <tr key={rowKey(row, index)}>
                            {columns.map((column) =>
                                column.rowHeader ? (
                                    <th key={column.key} scope="row" className={cx(CELL, 'text-left font-mono text-xs font-normal text-parchment-100')}>
                                        {column.cell(row)}
                                    </th>
                                ) : (
                                    <td key={column.key} className={cx(CELL, column.numeric ? 'text-right tabular-nums text-parchment-200' : 'text-parchment-200')}>
                                        {column.cell(row)}
                                    </td>
                                ),
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

/** A labelled data value (provider and metric names): shown as-is, in mono. */
export function Mono({ children }: { children: ReactNode }) {
    return <span className="font-mono text-xs text-parchment-100">{children}</span>
}

interface RequestsPerDayPanelProps {
    rows: readonly DbRequestsPerDay[]
    /** The serving process's own requests per day, since it started (a live view, not the record). */
    live?: readonly ProcessRequestsPerDay[]
    locale: string
}

/** Requests per UTC day (narration jobs, calls, recipe previews): the database record, then the live process view. */
export function RequestsPerDayPanel({ rows, live, locale }: RequestsPerDayPanelProps) {
    const { t } = useTranslation()
    return (
        <MetricsPanel title={t('admin.voices.metrics.requestsPerDay.title')}>
            <MetricsTable
                caption={t('admin.voices.metrics.requestsPerDay.caption')}
                rows={rows}
                rowKey={(row) => `${row.day}-${row.surface}-${row.provider}`}
                columns={[
                    { key: 'day', header: t('admin.voices.metrics.columns.day'), rowHeader: true, cell: (row) => row.day },
                    { key: 'surface', header: t('admin.voices.metrics.columns.surface'), cell: (row) => <Mono>{row.surface}</Mono> },
                    { key: 'provider', header: t('admin.voices.metrics.columns.provider'), cell: (row) => <Mono>{row.provider}</Mono> },
                    { key: 'requests', header: t('admin.voices.metrics.columns.requests'), numeric: true, cell: (row) => formatNumber(row.requests, locale) },
                ]}
            />
            {live && (
                <>
                    <p className="mt-2 font-ui text-caption text-fg-muted">{t('admin.voices.metrics.requestsPerDay.liveHint')}</p>
                    <MetricsTable
                        caption={t('admin.voices.metrics.requestsPerDay.liveCaption')}
                        rows={live}
                        rowKey={(row, index) => `${row.day}-${row.surface}-${row.provider}-${index}`}
                        columns={[
                            { key: 'day', header: t('admin.voices.metrics.columns.day'), rowHeader: true, cell: (row) => row.day },
                            { key: 'surface', header: t('admin.voices.metrics.columns.surface'), cell: (row) => <Mono>{row.surface}</Mono> },
                            { key: 'provider', header: t('admin.voices.metrics.columns.provider'), cell: (row) => <Mono>{row.provider}</Mono> },
                            { key: 'requests', header: t('admin.voices.metrics.columns.requests'), numeric: true, cell: (row) => formatNumber(row.requests, locale) },
                        ]}
                    />
                </>
            )}
        </MetricsPanel>
    )
}

interface ProcessRow {
    id: string
    kind: 'counter' | 'gauge' | 'ratio' | 'histogram' | 'window'
    metric: string
    provider: string
    value: string
}

const SHARE_METRICS = /(_rate|_share)$/

/** One recent window: a share (429s), event counts per kind (account events) or latency percentiles (first audio). */
function windowValue(item: ProcessWindow, t: TFunction, locale: string): string {
    const n = (value: number | null | undefined) => formatNumber(value, locale, 2)
    if (SHARE_METRICS.test(item.metric) || item.denominator !== undefined) {
        return t('admin.voices.metrics.process.windowShare', {
            value: formatShare(item.value ?? null, locale),
            numerator: n(item.numerator),
            denominator: n(item.denominator),
            seconds: n(item.window_seconds),
        })
    }
    if (item.p50 === undefined && item.count !== undefined) {
        return t('admin.voices.metrics.process.windowCount', { events: n(item.count), kind: item.kind ?? '—', seconds: n(item.window_seconds) })
    }
    return t('admin.voices.metrics.process.windowLatency', {
        p50: formatMs(item.p50 ?? null, locale),
        p95: formatMs(item.p95 ?? null, locale),
        calls: n(item.calls),
        seconds: n(item.window_seconds),
    })
}

/** Every live metric of the envelope as one row each (counters, gauges, ratios, histograms, recent windows). */
function processRows(process: AdminVoiceProcessMetrics | null | undefined, t: TFunction, locale: string): ProcessRow[] {
    if (!process) return []
    const n = (value: number | null | undefined) => formatNumber(value, locale, 2)
    const rows: ProcessRow[] = []
    for (const item of process.counters ?? []) {
        rows.push({ id: `c:${item.metric}:${item.provider}`, kind: 'counter', metric: item.metric, provider: item.provider, value: n(item.value) })
    }
    for (const item of process.gauges ?? []) {
        rows.push({ id: `g:${item.metric}:${item.provider}`, kind: 'gauge', metric: item.metric, provider: item.provider, value: n(item.value) })
    }
    for (const item of process.ratios ?? []) {
        rows.push({
            id: `r:${item.metric}:${item.provider}`,
            kind: 'ratio',
            metric: item.metric,
            provider: item.provider,
            value: t('admin.voices.metrics.process.ratioValue', { value: formatShare(item.value, locale), numerator: n(item.numerator), denominator: n(item.denominator) }),
        })
    }
    for (const item of process.histograms ?? []) {
        rows.push({
            id: `h:${item.metric}:${item.provider}`,
            kind: 'histogram',
            metric: item.metric,
            provider: item.provider,
            value: t('admin.voices.metrics.process.histogramValue', {
                p50: formatMs(item.p50, locale),
                p95: formatMs(item.p95, locale),
                max: formatMs(item.max, locale),
                samples: n(item.count),
            }),
        })
    }
    for (const item of process.windows ?? []) {
        rows.push({
            id: `w:${item.metric}:${item.provider}:${item.kind ?? ''}`,
            kind: 'window',
            metric: item.metric,
            provider: item.provider,
            value: windowValue(item, t, locale),
        })
    }
    return rows
}

/** The serving process's own metrics since it started: a live view, never the record. */
export function ProcessMetricsPanel({ process, locale }: { process: AdminVoiceProcessMetrics | null | undefined; locale: string }) {
    const { t } = useTranslation()
    const rows = processRows(process, t, locale)
    return (
        <MetricsPanel
            title={t('admin.voices.metrics.process.title')}
            hint={process?.since ? t('admin.voices.metrics.process.hint', { since: formatDateTime(process.since, locale) }) : undefined}
        >
            <MetricsTable
                caption={t('admin.voices.metrics.process.caption')}
                rows={rows}
                rowKey={(row) => row.id}
                columns={[
                    { key: 'metric', header: t('admin.voices.metrics.columns.metric'), rowHeader: true, cell: (row) => row.metric },
                    { key: 'kind', header: t('admin.voices.metrics.columns.kind'), cell: (row) => t(`admin.voices.metrics.process.kinds.${row.kind}`) },
                    { key: 'provider', header: t('admin.voices.metrics.columns.provider'), cell: (row) => <Mono>{row.provider}</Mono> },
                    { key: 'value', header: t('admin.voices.metrics.columns.value'), numeric: true, cell: (row) => row.value },
                ]}
            />
        </MetricsPanel>
    )
}
