/**
 * KPI tiles for the Membership & plans console: accounts, activity today,
 * calendar-month credit usage, and PAYG wallet balances. Read-only glance
 * surface; the Usage tab carries the per-plan breakdown.
 */
import { useTranslation } from 'react-i18next'
import { CalendarRange, Coins, Sparkles, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useLanguage } from '@/app/hooks'
import type { MembershipOverviewResponse } from '@/shared'
import { Icon, cx } from '@/ui/primitives'
import { formatDate, formatNumber } from './membershipFormat'

interface MembershipOverviewTilesProps {
    overview: MembershipOverviewResponse | null
    loading?: boolean
}

interface Tile {
    key: string
    icon: LucideIcon
    accent: string
    label: string
    value: string
    hint: string
    detail?: string
}

export function MembershipOverviewTiles({ overview, loading = false }: MembershipOverviewTilesProps) {
    const { t } = useTranslation()
    const { intlLocale } = useLanguage()
    const totals = overview?.totals
    const n = (value: number | undefined) => (value == null ? '—' : formatNumber(value, intlLocale))

    const tiles: Tile[] = [
        {
            key: 'members',
            icon: Users,
            accent: 'text-ember-300',
            label: t('admin.membership.overview.members'),
            value: n(totals?.users),
            hint: t('admin.membership.overview.membersHint', { count: totals?.plans ?? 0 }),
            detail: t('admin.membership.overview.customPlans', { count: totals?.custom_plans ?? 0 }),
        },
        {
            key: 'today',
            icon: Sparkles,
            accent: 'text-verdant-500',
            label: t('admin.membership.overview.activeToday'),
            value: n(totals?.active_users_today),
            hint: t('admin.membership.overview.activeTodayHint', { credits: n(totals?.credits_used_today) }),
        },
        {
            key: 'month',
            icon: CalendarRange,
            accent: 'text-arcane-300',
            label: t('admin.membership.overview.month'),
            value: n(totals?.credits_used_month),
            hint: t('admin.membership.overview.monthHint', {
                included: n(totals?.included_credits_used_month),
                payg: n(totals?.payg_credits_used_month),
            }),
            detail: t('admin.membership.overview.monthUsers', { count: totals?.active_users_month ?? 0 }),
        },
        {
            key: 'wallets',
            icon: Coins,
            accent: 'text-amber-500',
            label: t('admin.membership.overview.wallets'),
            value: n(totals == null ? undefined : totals.payg_free_balance + totals.payg_billed_balance),
            hint: t('admin.membership.overview.walletsHint', {
                free: n(totals?.payg_free_balance),
                billed: n(totals?.payg_billed_balance),
            }),
            detail: t('admin.membership.overview.walletsCount', { count: totals?.payg_wallets ?? 0 }),
        },
    ]

    const asOf = overview ? formatDate(overview.usage_date, intlLocale) : null

    return (
        <div className="flex flex-col gap-2" aria-busy={loading || undefined}>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {tiles.map((tile) => (
                    <div
                        key={tile.key}
                        className={cx(
                            'flex flex-col gap-1 rounded-lg border border-parchment-50/[.08] bg-ink-800/70 px-3.5 py-3',
                            loading && 'animate-pulse',
                        )}
                    >
                        <span className="flex items-center gap-1.5 font-ui text-[12px] text-parchment-400">
                            <Icon icon={tile.icon} size={13} className={tile.accent} />
                            {tile.label}
                        </span>
                        <span className={cx('font-display text-xl font-semibold', tile.accent)}>{tile.value}</span>
                        <span className="font-ui text-[11px] text-parchment-500">{tile.hint}</span>
                        {tile.detail && <span className="font-ui text-[11px] text-parchment-500">{tile.detail}</span>}
                    </div>
                ))}
            </div>
            {asOf && (
                <span className="font-ui text-[11px] text-parchment-500">{t('admin.membership.overview.asOf', { date: asOf })}</span>
            )}
        </div>
    )
}
