import { useFeatureFlags } from '@/shared/hooks/useFeatureFlags'
/**
 * CardUsageLine — one muted line summarizing how much a card is used:
 * "Used in 5 sessions · 2 stories". Shared by the gallery card, card preview,
 * version-history drawer, and the adventure side panel so the sessions/stories
 * wording is derived in exactly one place.
 */

import { useTranslation } from 'react-i18next'
import type { CardUsage } from '@/shared'
import { isNovelsFeatureEnabled, isSessionUsageCountAvailable } from '@/shared/featureFlags'
import { cx } from '@/ui/primitives'

export interface CardUsageLineProps {
    /** Resolved usage, or null while loading / unknown. */
    usage: CardUsage | null
    /** When both counts are zero, render "Not used yet" instead of nothing. */
    showNone?: boolean
    className?: string
}

export function CardUsageLine({ usage, showNone = false, className }: CardUsageLineProps) {
    useFeatureFlags()
    const { t } = useTranslation()
    if (!usage) return null

    const parts: string[] = []
    if (isSessionUsageCountAvailable() && usage.sessions > 0) parts.push(t('cardVersions.usage.sessionsShort', { count: usage.sessions }))
    if (isNovelsFeatureEnabled() && usage.stories > 0) parts.push(t('cardVersions.usage.storiesShort', { count: usage.stories }))

    const unused = showNone && usage.sessions === 0 && usage.stories === 0
    const text = parts.length > 0 ? `${t('cardVersions.usage.used')} ${parts.join(' · ')}` : unused ? t('cardVersions.usage.none') : null
    if (!text) return null

    return <p className={cx('font-ui text-caption text-parchment-400', className)}>{text}</p>
}
