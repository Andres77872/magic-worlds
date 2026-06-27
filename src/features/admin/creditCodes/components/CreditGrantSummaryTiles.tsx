/**
 * KPI summary tiles for the Credit Tokens console — one per lifecycle state
 * (active / claimed / expired / disabled) showing the token count and the total
 * credits parked in that state. Each tile doubles as a filter: clicking it sets
 * the matching status filter (clicking the active one clears back to "all").
 */
import { useTranslation } from 'react-i18next'
import { BadgeCheck, Ban, CheckCircle2, Clock, Coins } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { CreditGrantStateCounts } from '@/shared'
import { Icon, cx } from '@/ui/primitives'
import type { StatusFilter } from '../hooks/useCreditCodesStudio'

interface CreditGrantSummaryTilesProps {
    counts: CreditGrantStateCounts | undefined
    activeStatus: StatusFilter
    onSelect: (status: StatusFilter) => void
}

interface TileConfig {
    key: Exclude<StatusFilter, 'all'>
    icon: LucideIcon
    accent: string
    countKey: keyof CreditGrantStateCounts
    creditsKey: keyof CreditGrantStateCounts
}

const TILES: TileConfig[] = [
    { key: 'active', icon: CheckCircle2, accent: 'text-verdant-500', countKey: 'active', creditsKey: 'active_credits' },
    { key: 'claimed', icon: BadgeCheck, accent: 'text-ember-300', countKey: 'claimed', creditsKey: 'claimed_credits' },
    { key: 'expired', icon: Clock, accent: 'text-blood-300', countKey: 'expired', creditsKey: 'expired_credits' },
    { key: 'disabled', icon: Ban, accent: 'text-parchment-300', countKey: 'disabled', creditsKey: 'disabled_credits' },
]

export function CreditGrantSummaryTiles({ counts, activeStatus, onSelect }: CreditGrantSummaryTilesProps) {
    const { t } = useTranslation()

    return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TILES.map((tile) => {
                const selected = activeStatus === tile.key
                const count = counts ? Number(counts[tile.countKey]) : 0
                const credits = counts ? Number(counts[tile.creditsKey]) : 0
                return (
                    <button
                        key={tile.key}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onSelect(selected ? 'all' : tile.key)}
                        className={cx(
                            'flex flex-col gap-1 rounded-lg border px-3.5 py-3 text-left transition-colors',
                            selected
                                ? 'border-ember-500/45 bg-ember-500/[.06]'
                                : 'border-parchment-50/[.08] bg-ink-800/70 hover:border-parchment-50/20',
                        )}
                    >
                        <span className="flex items-center gap-1.5 font-ui text-[12px] text-parchment-400">
                            <Icon icon={tile.icon} size={13} className={tile.accent} />
                            {t(`admin.creditCodes.filter.${tile.key}`)}
                        </span>
                        <span className={cx('font-display text-xl font-semibold', tile.accent)}>
                            {counts ? count.toLocaleString() : '—'}
                        </span>
                        <span className="inline-flex items-center gap-1 font-ui text-[11px] text-parchment-500">
                            <Icon icon={Coins} size={11} />
                            {t('admin.creditCodes.summary.credits', { count: credits })}
                        </span>
                    </button>
                )
            })}
        </div>
    )
}
