/**
 * Compact content-stat strip for the profile identity header — character, world,
 * item, adventure and credit counts as small inline pills (not full cards) so the
 * always-visible header stays dense. Pure: takes the loaded profile as a prop.
 */
import { Gem, Globe, Swords, Users, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { UserProfile } from '@/shared'
import { Icon } from '@/ui/primitives'

/** Wallet balance: membership total when present, else the legacy `user_usage`. */
function availableCredits(profile: UserProfile) {
    return profile.membership?.total_available_credits ?? profile.user_usage
}

interface StatPillProps {
    icon: LucideIcon
    label: string
    value: number
}

function StatPill({ icon, label, value }: StatPillProps) {
    return (
        <div className="inline-flex items-center gap-2 rounded-full bg-ink-600 px-3 py-1.5">
            <Icon icon={icon} size={14} className="text-ember-400" />
            <span className="font-display text-[16px] font-semibold leading-none text-parchment-50">{value}</span>
            <span className="font-ui text-[12px] text-parchment-400">{label}</span>
        </div>
    )
}

export function ProfileStats({ profile }: { profile: UserProfile }) {
    const { t } = useTranslation()
    const { card_counts: counts } = profile
    return (
        <div className="flex flex-wrap gap-2">
            <StatPill icon={Users} label={t('profile.stats.characters')} value={counts.character} />
            <StatPill icon={Globe} label={t('profile.stats.worlds')} value={counts.world} />
            <StatPill icon={Gem} label={t('profile.stats.items')} value={counts.item ?? 0} />
            <StatPill icon={Swords} label={t('profile.stats.adventures')} value={counts.adventure_template} />
            <StatPill icon={Zap} label={t('profile.stats.credits')} value={availableCredits(profile)} />
        </div>
    )
}
