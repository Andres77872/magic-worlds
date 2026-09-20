/**
 * Compact content-stat strip for the profile identity header — character, world,
 * item, adventure and credit counts as open inline metrics so the
 * always-visible header stays dense. Pure: takes the loaded profile as a prop.
 */
import { Gem, Globe, Swords, Users, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { UserProfile } from '@/shared'
import { Icon } from '@/ui/primitives'

function availableCredits(profile: UserProfile) {
    return profile.membership.total_available_credits
}

interface StatItemProps {
    icon: LucideIcon
    label: string
    value: number
}

function StatItem({ icon, label, value }: StatItemProps) {
    return (
        <div className="inline-flex items-center gap-2 py-1">
            <dt className="inline-flex items-center gap-2 font-ui text-caption text-fg-subtle">
                <Icon icon={icon} size={14} className="text-ember-400" />
                {label}
            </dt>
            <dd className="font-ui text-body font-semibold text-fg">{value}</dd>
        </div>
    )
}

export function ProfileStats({ profile }: { profile: UserProfile }) {
    const { t } = useTranslation()
    const { card_counts: counts } = profile
    return (
        <dl className="flex flex-wrap gap-x-6 gap-y-2">
            <StatItem icon={Users} label={t('profile.stats.characters')} value={counts.character} />
            <StatItem icon={Globe} label={t('profile.stats.worlds')} value={counts.world} />
            <StatItem icon={Gem} label={t('profile.stats.items')} value={counts.item ?? 0} />
            <StatItem icon={Swords} label={t('profile.stats.adventures')} value={counts.adventure_template} />
            <StatItem icon={Zap} label={t('profile.stats.credits')} value={availableCredits(profile)} />
        </dl>
    )
}
