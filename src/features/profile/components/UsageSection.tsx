/**
 * Profile usage monitor. Daily usage remains a quota view; monthly usage is an
 * accumulated, month-to-date activity view and intentionally has no limit bars.
 * Requests on the user's own provider key (BYOK) are a separate panel: they use
 * no app credits, so they never mix into the credit totals above.
 */
import { Gauge, KeyRound, Mic } from 'lucide-react'
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
import type { LlmOperationCapacityUsage } from '@/shared/types/llmProfile.types'
import { readVoiceUsage, type VoiceUsageView } from '@/shared/voice/voiceUsage'
import { Badge, Eyebrow, SectionHeader } from '@/ui/primitives'
import { cx } from '@/ui/primitives/cx'
import type { LlmCapacityUsageState } from '../hooks/useLlmCapacityUsage'
import { formatNumber, operationLabel, orderedLimitEntries } from './membership.helpers'

interface UsageSectionProps {
    profile: UserProfile
    /** Own-key request counts from `GET /llm/capacity-usage`; the panel is hidden when omitted. */
    llmUsage?: LlmCapacityUsageState
}

export function UsageSection({ profile, llmUsage }: UsageSectionProps) {
    const { t } = useTranslation()
    const { intlLocale } = useLanguage()
    const membership = profile.membership
    if (!membership) {
        return null
    }

    const operations = orderedLimitEntries(membership.limits ?? {})
    const monthly = membership.monthly_usage
    const voiceUsage = readVoiceUsage(membership)
    const monthlyOperations = monthly ? orderedLimitEntries(monthly.operations ?? {}) : []

    return (
        <section className="flex flex-col gap-4" aria-labelledby="usage-heading">
            <SectionHeader
                icon={Gauge}
                title={<span id="usage-heading">{t('usage.title')}</span>}
                right={monthly ? <Badge tone="neutral">{t('usage.toDate', { month: formatMonthLabel(monthly, intlLocale, t) })}</Badge> : undefined}
            />
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-8">
                <DailyUsagePanel membership={membership} operations={operations} t={t} locale={intlLocale} />
                {monthly && <MonthlyUsagePanel monthly={monthly} operations={monthlyOperations} t={t} locale={intlLocale} />}
            </div>
            {voiceUsage && <VoiceUsagePanel usage={voiceUsage} t={t} locale={intlLocale} />}
            {llmUsage && <ByokUsagePanel state={llmUsage} membership={membership} t={t} locale={intlLocale} />}
        </section>
    )
}

/** Seconds as minutes, to one decimal. */
function toMinutes(seconds: number) {
    return Math.round((seconds / 60) * 10) / 10
}

/**
 * Today's voice allowance (D24, D18): narration characters, call minutes and
 * recipe previews. Each row shows only when the server reports it.
 */
function VoiceUsagePanel({ usage, t, locale }: { usage: VoiceUsageView; t: TFunction; locale: string }) {
    const { narration, call, previewsLeft } = usage
    const minutesLeft = call ? toMinutes(call.remaining) : 0
    return (
        <div className="flex flex-col gap-4 border-t border-line-faint pt-6" aria-labelledby="usage-voice-heading" role="group">
            <span className="flex items-center gap-2">
                <Mic size={14} strokeWidth={1.75} className="text-ember-400" aria-hidden />
                <Eyebrow tone="muted" id="usage-voice-heading">{t('usage.voice.title')}</Eyebrow>
            </span>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-x-6 gap-y-4">
                {narration && (
                    <div className="flex flex-col gap-1.5">
                        <UsageMeter
                            label={t('usage.voice.narrationChars')}
                            used={narration.used}
                            max={narration.limit}
                            ariaLabel={t('usage.voice.narrationCharsMeter')}
                            t={t}
                            locale={locale}
                        />
                        <span className="font-ui text-[12px] text-fg-subtle">
                            {narration.remaining === 0
                                ? t('usage.voice.dailyLimit')
                                : t('usage.voice.charsRemaining', { count: narration.remaining, value: formatNumber(narration.remaining, locale) })}
                        </span>
                    </div>
                )}
                {call && (
                    <div className="flex flex-col gap-1.5">
                        <UsageMeter
                            label={t('usage.voice.callMinutes')}
                            used={call.used}
                            max={call.limit}
                            ariaLabel={t('usage.voice.callMinutesMeter')}
                            valueLabel={t('usage.voice.minutesOf', {
                                used: formatNumber(toMinutes(call.used), locale),
                                max: formatNumber(toMinutes(call.limit), locale),
                            })}
                            t={t}
                            locale={locale}
                        />
                        <span className="font-ui text-[12px] text-fg-subtle">
                            {t('usage.voice.minutesRemaining', { count: minutesLeft, value: formatNumber(minutesLeft, locale) })}
                        </span>
                    </div>
                )}
                {previewsLeft !== null && (
                    <div className="flex flex-col gap-1.5">
                        <span className="font-ui text-caption font-semibold text-parchment-100">{t('usage.voice.previews')}</span>
                        <span className="font-ui text-[12px] text-fg-subtle">{t('usage.voice.previewsLeft', { count: previewsLeft })}</span>
                    </div>
                )}
            </div>
        </div>
    )
}

function ByokUsagePanel({
    state,
    membership,
    t,
    locale,
}: {
    state: LlmCapacityUsageState
    membership: Membership
    t: TFunction
    locale: string
}) {
    const operations = state.usage?.operations.filter((operation) => operation.byok_enabled) ?? []
    const active = operations.filter((operation) => operation.month.user_byok > 0)
    const historical = state.usage?.operations.reduce((total, operation) => total + operation.month.unattributed, 0) ?? 0

    return (
        <div className="flex flex-col gap-4 border-t border-line-faint pt-6" aria-labelledby="usage-byok-heading" role="group">
            <div className="flex flex-col gap-1">
                <span className="flex items-center gap-2">
                    <KeyRound size={14} strokeWidth={1.75} className="text-arcane-300" aria-hidden />
                    <Eyebrow tone="arcane" id="usage-byok-heading">{t('usage.byokTitle')}</Eyebrow>
                </span>
                <span className="max-w-prose font-ui text-[13px] text-fg-subtle">{t('usage.byokSubtitle')}</span>
            </div>
            {state.status === 'loading' && <p className="font-ui text-caption text-parchment-300" role="status">{t('usage.byokLoading')}</p>}
            {state.status === 'unavailable' && <p className="font-ui text-caption text-parchment-300">{t('usage.byokUnavailable')}</p>}
            {state.status === 'ready' && active.length === 0 && (
                <p className="font-ui text-caption text-parchment-300">{t('usage.byokEmpty')}</p>
            )}
            {active.length > 0 && (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-x-6 gap-y-3">
                    {active.map((operation) => (
                        <ByokOperationMeter
                            key={operation.operation}
                            operation={operation}
                            dailyLimit={membership.limits?.[operation.operation]?.daily_limit ?? 0}
                            t={t}
                            locale={locale}
                        />
                    ))}
                </div>
            )}
            {historical > 0 && (
                <p className="max-w-prose font-ui text-[12px] text-fg-subtle">
                    {t('usage.historicalRequests', { count: historical, value: formatNumber(historical, locale) })}
                </p>
            )}
        </div>
    )
}

function ByokOperationMeter({
    operation,
    dailyLimit,
    t,
    locale,
}: {
    operation: LlmOperationCapacityUsage
    dailyLimit: number
    t: TFunction
    locale: string
}) {
    const label = operationName(operation.operation, t)
    return (
        <UsageMeter
            label={label}
            used={operation.today.user_byok}
            max={dailyLimit}
            ariaLabel={t('usage.byokMeterLabel', { label })}
            valueLabel={t('usage.byokCounts', {
                today: dailyLimit > 0
                    ? t('usage.of', { used: formatNumber(operation.today.user_byok, locale), max: formatNumber(dailyLimit, locale) })
                    : formatNumber(operation.today.user_byok, locale),
                month: formatNumber(operation.month.user_byok, locale),
            })}
            t={t}
            locale={locale}
        />
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
        <div className="flex min-w-0 flex-col gap-5">
            <div className="flex flex-col gap-1">
                <Eyebrow tone="muted">{t('usage.today')}</Eyebrow>
                <span className="font-ui text-[13px] text-fg-subtle">{t('usage.dailySubtitle')}</span>
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
                <span className="font-ui text-[12px] text-fg-subtle">
                    {t('usage.remainingToday', { value: formatNumber(membership.credits.remaining, locale) })}
                </span>
            </div>

            {operations.length > 0 && (
                <div className="flex flex-col gap-2.5">
                    <Eyebrow tone="muted">{t('usage.perOperation')}</Eyebrow>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-x-6 gap-y-3">
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
        <div className="flex min-w-0 flex-col gap-5">
            <div className="flex flex-col gap-1">
                <Eyebrow tone="ember">{t('usage.month')}</Eyebrow>
                <span className="font-ui text-[13px] text-fg-subtle">{formatDateRange(monthly, locale, t)}</span>
            </div>

            <div className="border-b border-line-faint pb-5">
                <Eyebrow tone="muted">{t('usage.creditsThisMonth')}</Eyebrow>
                <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-display text-h2 font-semibold leading-none text-parchment-50">
                        {formatNumber(monthly.credits_used, locale)}
                    </span>
                    <span className="font-ui text-[13px] text-parchment-300">{t('usage.used')}</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
                <MonthlyStat label={t('usage.included')} value={monthly.included_credits_used} locale={locale} />
                <MonthlyStat label={t('usage.payg')} value={monthly.payg_credits_used} locale={locale} />
            </div>

            {operations.length > 0 && (
                <div className="flex flex-col gap-2.5">
                    <Eyebrow tone="muted">{t('usage.accumulatedByOperation')}</Eyebrow>
                    <div className="flex flex-col">
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
        <div className="min-w-0">
            <Eyebrow tone="muted" className="block text-[11px]">
                {label}
            </Eyebrow>
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
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line-faint py-3 last:border-b-0">
            <div className="min-w-0">
                <span className="block font-ui text-caption font-semibold text-parchment-100">
                    {operationName(operation, t)}
                </span>
                <span className="block font-ui text-[11px] text-fg-subtle">
                    {monthlyOperationUsageLabel(usage, t, locale)}
                </span>
            </div>
            <div className="text-right font-ui text-[11px] text-parchment-300">
                <span className="block font-semibold text-parchment-100">{t('usage.credits', { value: formatNumber(usage.credits_used, locale) })}</span>
                <span className="block text-fg-subtle">
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
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                {prominent ? (
                    <Eyebrow tone="muted">{label}</Eyebrow>
                ) : (
                    <span className="min-w-0 font-ui text-caption font-semibold text-parchment-100">{label}</span>
                )}
                <span className="shrink-0 font-ui text-[11px] text-fg-subtle">
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
