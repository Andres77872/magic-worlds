/**
 * Profile usage monitor. Daily usage remains a quota view; monthly usage is an
 * accumulated, month-to-date activity view and intentionally has no limit bars.
 */
import { Gauge } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useLanguage } from '@/app/hooks'
import type {
    Membership,
    MembershipMonthlyOperationUsage,
    MembershipMonthlyUsage,
    MembershipOperationLimit,
    UserProfile,
} from '@/shared'
import { Badge, Card, Eyebrow, SectionHeader } from '@/ui/primitives'
import { cx } from '@/ui/primitives/cx'
import { formatNumber, operationLabel, orderedLimitEntries } from './membership.helpers'

interface UsageSectionProps {
    profile: UserProfile
}

export function UsageSection({ profile }: UsageSectionProps) {
    const { t } = useTranslation()
    const { intlLocale } = useLanguage()
    const membership = profile.membership
    if (!membership) {
        return null
    }

    const operations = orderedLimitEntries(membership.limits ?? {})
    const monthly = membership.monthly_usage
    const monthlyOperations = monthly ? orderedLimitEntries(monthly.operations ?? {}) : []

    return (
        <section className="flex flex-col gap-4" aria-labelledby="usage-heading">
            <SectionHeader
                icon={Gauge}
                title={<span id="usage-heading">{t('usage.title')}</span>}
                right={monthly ? <Badge tone="neutral">{t('usage.toDate', { month: formatMonthLabel(monthly, intlLocale, t) })}</Badge> : undefined}
            />
            <Card>
                <div className={cx('grid', monthly && 'lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]')}>
                    <DailyUsagePanel membership={membership} operations={operations} t={t} locale={intlLocale} />
                    {monthly && <MonthlyUsagePanel monthly={monthly} operations={monthlyOperations} t={t} locale={intlLocale} />}
                </div>
            </Card>
        </section>
    )
}

function DailyUsagePanel({
    membership,
    operations,
    t,
    locale,
}: {
    membership: Membership
    operations: Array<readonly [string, MembershipOperationLimit]>
    t: TFunction
    locale: string
}) {
    return (
        <div className="flex min-w-0 flex-col gap-5 p-5">
            <div className="flex flex-col gap-1">
                <Eyebrow tone="muted">{t('usage.today')}</Eyebrow>
                <span className="font-ui text-[13px] text-parchment-400">{t('usage.dailySubtitle')}</span>
            </div>

            <div className="flex flex-col gap-1.5">
                <UsageMeter
                    label={t('usage.includedCredits')}
                    used={membership.credits.used}
                    max={membership.credits.max}
                    ariaLabel={t('usage.includedDailyCreditsUsed')}
                    t={t}
                    locale={locale}
                    prominent
                />
                <span className="font-ui text-[12px] text-parchment-400">
                    {t('usage.remainingToday', { value: formatNumber(membership.credits.remaining, locale) })}
                </span>
            </div>

            {operations.length > 0 && (
                <div className="flex flex-col gap-2.5">
                    <Eyebrow tone="muted">{t('usage.perOperation')}</Eyebrow>
                    <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                        {operations.map(([operation, limit]) => (
                            <UsageMeter
                                key={operation}
                                label={operationName(operation, t)}
                                used={limit.used_today}
                                max={limit.daily_limit}
                                valueLabel={dailyOperationUsageLabel(limit, t, locale)}
                                t={t}
                                locale={locale}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

function MonthlyUsagePanel({
    monthly,
    operations,
    t,
    locale,
}: {
    monthly: MembershipMonthlyUsage
    operations: Array<readonly [string, MembershipMonthlyOperationUsage]>
    t: TFunction
    locale: string
}) {
    return (
        <div className="flex min-w-0 flex-col gap-5 border-t border-parchment-50/[.08] bg-ink-800/35 p-5 lg:border-l lg:border-t-0">
            <div className="flex flex-col gap-1">
                <Eyebrow tone="ember">{t('usage.month')}</Eyebrow>
                <span className="font-ui text-[13px] text-parchment-400">{formatDateRange(monthly, locale, t)}</span>
            </div>

            <div className="rounded-lg border border-parchment-50/[.08] bg-ink-700/70 px-4 py-3">
                <span className="font-ui text-[12px] font-semibold uppercase tracking-[0.14em] text-parchment-400">
                    {t('usage.creditsThisMonth')}
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-display text-h2 font-semibold leading-none text-parchment-50">
                        {formatNumber(monthly.credits_used, locale)}
                    </span>
                    <span className="font-ui text-[13px] text-parchment-300">{t('usage.used')}</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <MonthlyStat label={t('usage.included')} value={monthly.included_credits_used} locale={locale} />
                <MonthlyStat label={t('usage.payg')} value={monthly.payg_credits_used} locale={locale} />
            </div>

            {operations.length > 0 && (
                <div className="flex flex-col gap-2.5">
                    <Eyebrow tone="muted">{t('usage.accumulatedByOperation')}</Eyebrow>
                    <div className="flex flex-col overflow-hidden rounded-lg border border-parchment-50/[.08]">
                        {operations.map(([operation, usage]) => (
                            <MonthlyOperationRow key={operation} operation={operation} usage={usage} t={t} locale={locale} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

function MonthlyStat({ label, value, locale }: { label: string; value: number; locale: string }) {
    return (
        <div className="rounded-lg border border-parchment-50/[.08] bg-ink-600/60 px-3 py-2.5">
            <span className="block font-ui text-[11px] font-semibold uppercase tracking-[0.14em] text-parchment-400">
                {label}
            </span>
            <span className="mt-1 block font-ui text-[16px] font-semibold text-parchment-50">{formatNumber(value, locale)}</span>
        </div>
    )
}

function MonthlyOperationRow({
    operation,
    usage,
    t,
    locale,
}: {
    operation: string
    usage: MembershipMonthlyOperationUsage
    t: TFunction
    locale: string
}) {
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-parchment-50/[.06] px-3 py-2.5 last:border-b-0">
            <div className="min-w-0">
                <span className="block truncate font-ui text-[12px] font-semibold text-parchment-100">
                    {operationName(operation, t)}
                </span>
                <span className="block font-ui text-[11px] text-parchment-500">
                    {monthlyOperationUsageLabel(usage, t, locale)}
                </span>
            </div>
            <div className="text-right font-ui text-[11px] text-parchment-300">
                <span className="block font-semibold text-parchment-100">{t('usage.credits', { value: formatNumber(usage.credits_used, locale) })}</span>
                <span className="block text-parchment-500">
                    {t('usage.includedPayg', {
                        included: formatNumber(usage.included_credits_used, locale),
                        payg: formatNumber(usage.payg_credits_used, locale),
                    })}
                </span>
            </div>
        </div>
    )
}

interface UsageMeterProps {
    label: string
    used: number
    max: number
    ariaLabel?: string
    valueLabel?: string
    prominent?: boolean
    t: TFunction
    locale: string
}

function UsageMeter({ label, used, max, ariaLabel, valueLabel, prominent = false, t, locale }: UsageMeterProps) {
    const percent = max > 0 ? Math.min(100, Math.max(0, Math.round((used / max) * 100))) : 0

    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
                {prominent ? (
                    <Eyebrow tone="muted">{label}</Eyebrow>
                ) : (
                    <span className="truncate font-ui text-[12px] font-semibold text-parchment-100">{label}</span>
                )}
                <span className="shrink-0 font-ui text-[11px] text-parchment-400">
                    {valueLabel ?? t('usage.of', { used: formatNumber(used, locale), max: formatNumber(max, locale) })}
                </span>
            </div>
            <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={max}
                aria-valuenow={Math.max(0, Math.min(used, max))}
                aria-label={ariaLabel ?? t('usage.usageToday', { label })}
                className={cx('overflow-hidden rounded-full bg-ink-600', prominent ? 'h-2' : 'h-1.5')}
            >
                <div className={cx('h-full rounded-full', fillTone(used, max))} style={{ width: `${percent}%` }} />
            </div>
        </div>
    )
}

/** Ember normally, amber from 80% of the limit, blood once the limit is hit. */
function fillTone(used: number, max: number) {
    if (max <= 0) return 'bg-ember-500'
    if (used >= max) return 'bg-blood-500'
    if (used / max >= 0.8) return 'bg-amber-500'
    return 'bg-ember-500'
}

function formatMonthLabel(monthly: MembershipMonthlyUsage, locale: string, t: TFunction) {
    const [year, month] = monthly.month.split('-').map(Number)
    if (!year || !month) return t('usage.current')
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
}

function formatDateRange(monthly: MembershipMonthlyUsage, locale: string, t: TFunction) {
    return t('usage.dateRange', {
        start: formatDateLabel(monthly.start_date, locale),
        end: formatDateLabel(monthly.end_date, locale),
    })
}

function formatDateLabel(value: string, locale: string) {
    const [year, month, day] = value.split('-').map(Number)
    if (!year || !month || !day) return value
    return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(year, month - 1, day))
}

function dailyOperationUsageLabel(limit: MembershipOperationLimit, t: TFunction, locale: string) {
    if (limit.billing_unit === 'audio_seconds') {
        return t('usage.creditsAndSeconds', {
            credits: formatNumber(limit.used_today, locale),
            seconds: formatNumber(limit.billable_seconds_today ?? 0, locale),
        })
    }
    return undefined
}

function monthlyOperationUsageLabel(usage: MembershipMonthlyOperationUsage, t: TFunction, locale: string) {
    if (typeof usage.billable_seconds === 'number') {
        return t('usage.audioTime', { seconds: formatNumber(usage.billable_seconds, locale) })
    }
    return t('usage.action', { count: usage.used })
}

function operationName(operation: string, t: TFunction) {
    return t(`membership.operations.${operation}`, { defaultValue: operationLabel(operation) })
}
