/**
 * Provider cost estimates by payer for this project. These are what a provider
 * may bill, never app credits: platform estimates are the application's cost,
 * BYOK estimates are billed to each member's own provider account, and
 * historical calls predate payer tracking. Unpriced calls stay "unknown", never
 * zero, so a missing price is not read as free.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Coins } from 'lucide-react'
import { useAuth, useLanguage } from '@/app/hooks'
import { apiService } from '@/infrastructure/api'
import type { LlmProviderUsage } from '@/shared/types/llmProfile.types'
import { Badge, SectionHeader } from '@/ui/primitives'
import { formatNumber } from './membershipFormat'

export type ProviderCostState =
    | { status: 'loading' }
    | { status: 'unavailable' }
    | { status: 'ready'; usage: LlmProviderUsage }

const PAYERS = ['platform', 'user_byok', 'unattributed'] as const

function formatAmount(amount: string, currency: string, locale: string): string {
    try {
        return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 4 }).format(Number(amount))
    } catch {
        return `${amount} ${currency}`
    }
}

export function ProviderCostView({ state }: { state: ProviderCostState }) {
    const { t } = useTranslation()
    const { intlLocale } = useLanguage()
    return (
        <section className="flex flex-col gap-3" aria-labelledby="usage-provider-cost-heading">
            <SectionHeader
                icon={Coins}
                title={<span id="usage-provider-cost-heading">{t('admin.membership.usage.providerCost.title')}</span>}
                right={state.status === 'ready'
                    ? <Badge tone="neutral">{t('admin.membership.usage.providerCost.range', { from: state.usage.from_date, to: state.usage.to_date })}</Badge>
                    : undefined}
            />
            <p className="max-w-[72ch] font-ui text-[13px] leading-relaxed text-parchment-300">{t('admin.membership.usage.providerCost.description')}</p>
            {state.status === 'loading' && <p role="status" className="font-ui text-sm text-parchment-300">{t('admin.membership.usage.providerCost.loading')}</p>}
            {state.status === 'unavailable' && <p role="status" className="font-ui text-sm text-parchment-300">{t('admin.membership.usage.providerCost.unavailable')}</p>}
            {state.status === 'ready' && (
                <ul className="flex flex-col divide-y divide-line-faint">
                    {PAYERS.map((payer) => {
                        const usage = state.usage.by_payer[payer]
                        return (
                            <li key={payer} className="flex flex-wrap items-start justify-between gap-3 py-2.5">
                                <div className="flex min-w-0 flex-col gap-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge tone={payer === 'user_byok' ? 'arcane' : 'neutral'}>{t(`admin.membership.usage.providerCost.payers.${payer}`)}</Badge>
                                        <span className="font-ui text-[13px] text-parchment-300">{t(`admin.membership.usage.providerCost.billedTo.${payer}`)}</span>
                                    </div>
                                    <span className="font-ui text-[11px] tabular-nums text-parchment-500">
                                        {t('admin.membership.usage.requests', { count: usage.requests })} ·{' '}
                                        {t('admin.membership.usage.providerCost.tokens', {
                                            input: formatNumber(usage.prompt_tokens, intlLocale),
                                            output: formatNumber(usage.completion_tokens, intlLocale),
                                        })}
                                    </span>
                                    {usage.unknown_cost_calls > 0 && (
                                        <span className="font-ui text-[11px] text-parchment-500">
                                            {t('admin.membership.usage.providerCost.unknownCost', { count: usage.unknown_cost_calls })}
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-col items-end gap-0.5">
                                    {usage.provider_estimates.length === 0
                                        ? <span className="font-ui text-[13px] text-parchment-400">{t('admin.membership.usage.providerCost.noEstimate')}</span>
                                        : usage.provider_estimates.map((estimate) => (
                                            <span key={estimate.currency} className="font-ui text-[13px] font-semibold tabular-nums text-parchment-100">
                                                {formatAmount(estimate.amount, estimate.currency, intlLocale)}
                                            </span>
                                        ))}
                                </div>
                            </li>
                        )
                    })}
                </ul>
            )}
        </section>
    )
}

/** Loads once the Usage tab is shown, and again for another account; never shows another account's figures. */
export function ProviderCostByPayer({ active }: { active: boolean }) {
    const { accountKey } = useAuth()
    const [loaded, setLoaded] = useState<{ accountKey: string; state: ProviderCostState } | null>(null)
    const current = loaded?.accountKey === accountKey ? loaded.state : null
    useEffect(() => {
        if (!active || current) return
        let cancelled = false
        apiService.getLlmProviderUsage().then(
            (usage) => { if (!cancelled) setLoaded({ accountKey, state: { status: 'ready', usage } }) },
            () => { if (!cancelled) setLoaded({ accountKey, state: { status: 'unavailable' } }) },
        )
        return () => { cancelled = true }
    }, [active, accountKey, current])
    return <ProviderCostView state={current ?? { status: 'loading' }} />
}
