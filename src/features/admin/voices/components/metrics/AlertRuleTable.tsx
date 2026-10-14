/**
 * Alert rules of one metrics area (11 §8.4, D28): every rule with its
 * threshold, its state and, when it fires, the server's own value, threshold,
 * sample, provider and detail; otherwise the value it reads now, when
 * the envelope carries it over the rule's own window (10 §7.4). The state is spoken as text, never only
 * by colour (05 §10).
 */
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import type { AdminVoiceMetricsAlert } from '@/shared'
import { Badge, type BadgeTone } from '@/ui/primitives'
import { formatMs, formatNumber, formatPercentValue, formatShare } from '../../format'
import { alertFormat, type MetricsRule, type MetricsRuleCurrent, type MetricsRuleState, type MetricsRuleStatus, type MetricsValueFormat } from '../../metricsRules'

const STATE_TONE: Record<MetricsRuleState, BadgeTone> = {
    firing: 'danger',
    not_evaluated: 'neutral',
    no_data: 'neutral',
    low_sample: 'warning',
    quiet: 'live',
}

const SEVERITY_TONE: Record<string, BadgeTone> = {
    page: 'danger',
    warn: 'warning',
    info: 'neutral',
    tiered: 'neutral',
}

const HEAD = 'border-b border-line-faint pb-2 pr-3 font-semibold last:pr-0'
const CELL = 'border-b border-line-faint py-2 pr-3 align-top last:pr-0'

function formatValue(value: number | null, format: MetricsValueFormat, locale: string): string {
    switch (format) {
        case 'share':
            return formatShare(value, locale)
        case 'ms':
            return formatMs(value, locale)
        case 'percent':
            return formatPercentValue(value, locale)
        default:
            return formatNumber(value, locale, 2)
    }
}

function thresholdText(status: MetricsRuleStatus, t: TFunction, locale: string): string {
    const rule = status.rule
    if (!rule) return '—'
    const values: Record<string, string> = {}
    for (const [name, value] of Object.entries(status.threshold)) {
        values[name] = name === 'limit' || name === 'warn' || name === 'page' ? formatValue(value, rule.format, locale) : formatNumber(value, locale)
    }
    if (rule.id === 'jobP95' && status.threshold.limit === undefined) {
        return t('admin.voices.metrics.rules.items.jobP95.thresholdNoBaseline', values)
    }
    return t(`admin.voices.metrics.rules.items.${rule.id}.threshold`, values)
}

function alertText(alert: AdminVoiceMetricsAlert, rule: MetricsRule | null, t: TFunction, locale: string): string {
    const format = alertFormat(alert, rule) ?? 'count'
    if (format === 'open') return t('admin.voices.metrics.rules.open')
    const value = formatValue(alert.value, format, locale)
    const threshold = formatValue(alert.threshold, format, locale)
    // The spend bands carry the day's cost in micros as their sample: not a sample size.
    if (format === 'percent') return t('admin.voices.metrics.rules.alertValueNoSample', { value, threshold })
    return t('admin.voices.metrics.rules.alertValue', { value, threshold, sample: formatNumber(alert.sample, locale) })
}

function currentText(current: MetricsRuleCurrent, rule: MetricsRule | null, t: TFunction, locale: string): string {
    const value = formatValue(current.value, current.format ?? rule?.format ?? 'count', locale)
    if (current.sample === null) return value
    return t('admin.voices.metrics.rules.currentValue', { value, sample: formatNumber(current.sample, locale) })
}

/** Provider and detail of a value, as raw data. */
function labelsText(parts: readonly (string | null | undefined)[]): string {
    return parts.filter((part) => part !== null && part !== undefined && part !== '').join(' · ')
}

interface AlertRuleTableProps {
    /** Accessible table name, e.g. "Alert rules: Narration". */
    caption: string
    statuses: readonly MetricsRuleStatus[]
    locale: string
}

export function AlertRuleTable({ caption, statuses, locale }: AlertRuleTableProps) {
    const { t } = useTranslation()
    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse font-ui text-sm">
                <caption className="sr-only">{caption}</caption>
                <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-parchment-400">
                        <th scope="col" className={HEAD}>{t('admin.voices.metrics.rules.columns.rule')}</th>
                        <th scope="col" className={HEAD}>{t('admin.voices.metrics.rules.columns.threshold')}</th>
                        <th scope="col" className={HEAD}>{t('admin.voices.metrics.rules.columns.state')}</th>
                        <th scope="col" className={HEAD}>{t('admin.voices.metrics.rules.columns.current')}</th>
                        <th scope="col" className={HEAD}>{t('admin.voices.metrics.rules.columns.runbook')}</th>
                    </tr>
                </thead>
                <tbody>
                    {statuses.map((status) => {
                        const rule = status.rule
                        const runbooks = [...new Set([rule?.runbook, ...status.alerts.map((alert) => alert.runbook)].filter(Boolean))]
                        return (
                            <tr key={status.key} data-state={status.state}>
                                <th scope="row" className={`${CELL} text-left font-normal`}>
                                    <span className="block text-parchment-100">
                                        {rule ? t(`admin.voices.metrics.rules.items.${rule.id}.label`) : t('admin.voices.metrics.rules.unknown', { name: status.alertName })}
                                    </span>
                                    {rule && (
                                        <Badge tone={SEVERITY_TONE[rule.severity] ?? 'neutral'} className="mt-1">
                                            {t(`admin.voices.metrics.rules.severities.${rule.severity}`)}
                                        </Badge>
                                    )}
                                </th>
                                <td className={`${CELL} max-w-[34ch] text-caption text-parchment-300`}>{thresholdText(status, t, locale)}</td>
                                <td className={CELL}>
                                    <Badge tone={STATE_TONE[status.state]}>{t(`admin.voices.metrics.rules.states.${status.state}`)}</Badge>
                                    {status.reason && <span className="mt-1 block text-caption text-fg-muted">{t(`admin.voices.metrics.rules.reasons.${status.reason}`)}</span>}
                                </td>
                                <td className={CELL}>
                                    {status.alerts.length === 0 && status.current.length === 0 ? (
                                        <span className="text-fg-muted">—</span>
                                    ) : status.alerts.length === 0 ? (
                                        <ul className="flex flex-col gap-1.5">
                                            {status.current.map((current, index) => (
                                                <li key={`${current.provider}-${index}`} className="flex flex-col gap-0.5">
                                                    <span className="tabular-nums text-parchment-200">{currentText(current, rule, t, locale)}</span>
                                                    <span className="font-mono text-xs text-fg-muted">{labelsText([current.provider])}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <ul className="flex flex-col gap-1.5">
                                            {status.alerts.map((alert, index) => (
                                                <li key={`${alert.alert}-${alert.provider}-${alert.detail ?? ''}-${index}`} className="flex flex-col gap-0.5">
                                                    <span className="flex flex-wrap items-center gap-1.5">
                                                        <Badge tone={SEVERITY_TONE[alert.severity] ?? 'neutral'}>
                                                            {t(`admin.voices.metrics.rules.severities.${alert.severity}`, { defaultValue: alert.severity })}
                                                        </Badge>
                                                        <span className="tabular-nums text-parchment-100">{alertText(alert, rule, t, locale)}</span>
                                                    </span>
                                                    <span className="font-mono text-xs text-fg-muted">{labelsText([alert.provider, alert.detail])}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </td>
                                <td className={`${CELL} font-mono text-xs text-parchment-200`}>{runbooks.join(', ') || '—'}</td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
