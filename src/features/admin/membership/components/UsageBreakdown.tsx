/**
 * Usage tab of the Membership & plans console: per-plan activity and credit
 * consumption (today + calendar month) and the month's per-operation totals.
 * Bars are proportional to the largest value in their column so the busiest
 * plan / operation reads at a glance.
 */
import { useTranslation } from 'react-i18next'
import { Activity, Gauge } from 'lucide-react'
import { useLanguage } from '@/app/hooks'
import type { MembershipOverviewResponse } from '@/shared'
import { Badge, SectionHeader, cx } from '@/ui/primitives'
import { formatMonth, formatNumber, operationName, percentOf } from './membershipFormat'

interface UsageBreakdownProps {
    overview: MembershipOverviewResponse | null
}

export function UsageBreakdown({ overview }: UsageBreakdownProps) {
    const { t } = useTranslation()
    const { intlLocale } = useLanguage()

    if (!overview) {
        return <p className="font-ui text-sm text-parchment-300">{t('admin.membership.usage.empty')}</p>
    }

    const maxMonth = Math.max(0, ...overview.plans.map((plan) => plan.credits_used_month))
    const maxOperation = Math.max(0, ...overview.operations_month.map((operation) => operation.credits_used))
    const monthLabel = formatMonth(overview.month, intlLocale)

    return (
        <div className="flex flex-col gap-8">
            <section className="flex flex-col gap-3" aria-labelledby="usage-plans-heading">
                <SectionHeader
                    icon={Gauge}
                    title={<span id="usage-plans-heading">{t('admin.membership.usage.title')}</span>}
                    right={<Badge tone="neutral">{monthLabel}</Badge>}
                />
                <p className="max-w-[72ch] font-ui text-[13px] leading-relaxed text-parchment-300">
                    {t('admin.membership.usage.description')}
                </p>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] border-collapse font-ui text-sm">
                        <thead>
                            <tr className="text-left font-ui text-[11px] uppercase tracking-[0.08em] text-parchment-400">
                                <th scope="col" className="border-b border-line-faint pb-2 pr-3 font-semibold">{t('admin.membership.usage.columns.plan')}</th>
                                <th scope="col" className="border-b border-line-faint pb-2 pr-3 text-right font-semibold">{t('admin.membership.usage.columns.members')}</th>
                                <th scope="col" className="border-b border-line-faint pb-2 pr-3 text-right font-semibold">{t('admin.membership.usage.columns.activeToday')}</th>
                                <th scope="col" className="border-b border-line-faint pb-2 pr-3 text-right font-semibold">{t('admin.membership.usage.columns.creditsToday')}</th>
                                <th scope="col" className="border-b border-line-faint pb-2 pr-3 text-right font-semibold">{t('admin.membership.usage.columns.activeMonth')}</th>
                                <th scope="col" className="border-b border-line-faint pb-2 pr-3 font-semibold">{t('admin.membership.usage.columns.creditsMonth')}</th>
                                <th scope="col" className="border-b border-line-faint pb-2 text-right font-semibold">{t('admin.membership.usage.columns.split')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {overview.plans.map((plan) => (
                                <tr key={plan.plan_code} className={cx(!plan.is_active && 'text-parchment-400')}>
                                    <th scope="row" className="border-b border-line-faint py-2.5 pr-3 text-left font-semibold text-parchment-50">
                                        <span className="block">{plan.display_name}</span>
                                        <span className="block font-mono text-[10px] font-normal text-parchment-500">{plan.plan_code}</span>
                                    </th>
                                    <td className="border-b border-line-faint py-2.5 pr-3 text-right tabular-nums">{formatNumber(plan.member_count, intlLocale)}</td>
                                    <td className="border-b border-line-faint py-2.5 pr-3 text-right tabular-nums">{formatNumber(plan.active_users_today, intlLocale)}</td>
                                    <td className="border-b border-line-faint py-2.5 pr-3 text-right tabular-nums">{formatNumber(plan.credits_used_today, intlLocale)}</td>
                                    <td className="border-b border-line-faint py-2.5 pr-3 text-right tabular-nums">{formatNumber(plan.active_users_month, intlLocale)}</td>
                                    <td className="border-b border-line-faint py-2.5 pr-3">
                                        <div className="flex items-center gap-2">
                                            <span className="w-16 shrink-0 text-right tabular-nums">{formatNumber(plan.credits_used_month, intlLocale)}</span>
                                            <div className="h-1.5 w-full min-w-[80px] overflow-hidden rounded-full bg-ink-600" aria-hidden>
                                                <div
                                                    className="h-full rounded-full bg-ember-500"
                                                    style={{ width: `${percentOf(plan.credits_used_month, maxMonth)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="border-b border-line-faint py-2.5 text-right tabular-nums text-parchment-300">
                                        {formatNumber(plan.included_credits_used_month, intlLocale)} / {formatNumber(plan.payg_credits_used_month, intlLocale)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="flex flex-col gap-3" aria-labelledby="usage-operations-heading">
                <SectionHeader icon={Activity} title={<span id="usage-operations-heading">{t('admin.membership.usage.operationsTitle')}</span>} />
                <p className="max-w-[72ch] font-ui text-[13px] leading-relaxed text-parchment-300">
                    {t('admin.membership.usage.operationsDescription')}
                </p>
                <ul className="flex flex-col divide-y divide-line-faint">
                    {overview.operations_month.map((operation) => (
                        <li key={operation.operation} className="grid grid-cols-[minmax(0,1fr)_minmax(120px,2fr)_auto] items-center gap-4 py-2.5">
                            <div className="min-w-0">
                                <span className="block truncate font-ui text-sm font-semibold text-parchment-100">{operationName(operation.operation, t)}</span>
                                <span className="block font-ui text-[11px] text-parchment-500">
                                    {t('admin.membership.usage.operationUsed', { count: operation.used })} ·{' '}
                                    {t('admin.membership.usage.operationUsers', { count: operation.active_users })}
                                </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-600" aria-hidden>
                                <div
                                    className="h-full rounded-full bg-arcane-500"
                                    style={{ width: `${percentOf(operation.credits_used, maxOperation)}%` }}
                                />
                            </div>
                            <span className="font-ui text-[13px] font-semibold tabular-nums text-parchment-100">
                                {t('admin.membership.usage.credits', { count: operation.credits_used })}
                            </span>
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    )
}
