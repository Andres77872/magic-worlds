/**
 * A stored voice's name, plus what the caller actually hears (R1-FE-03, D35).
 *
 * Without a projection (a share-link reader, an older row) this is the plain text:
 * `voiceDisplayName(stored)` or the translated fallback, no badges. With one,
 * the projection's badges render, and when the voice is substituted the line
 * "Plays as {{name}}" names the voice heard instead.
 */
import { useTranslation } from 'react-i18next'
import type { EffectiveVoice, StoredCharacterVoice } from '@/shared'
import { isElevenLabsProjection, voiceDisplayName } from '@/shared/voice'
import { cx } from '@/ui/primitives'
import { VoiceBadges, type VoiceBadgeContext } from './VoiceBadges'

interface EffectiveVoiceLabelProps {
    stored: StoredCharacterVoice | null | undefined
    effective?: EffectiveVoice | null
    badgeContext?: VoiceBadgeContext
    showBadges?: boolean
    /** Copy when nothing is assigned or no name is known; defaults to the generic voice name. */
    fallback?: string
    className?: string
    /** Replaces the name line's classes (they are joined, not merged). */
    nameClassName?: string
}

/** The substituted voice's name when the projection says another voice plays; null otherwise. */
export function substitutedName(stored: StoredCharacterVoice | null | undefined, effective: EffectiveVoice | null | undefined): string | null {
    if (!isElevenLabsProjection(effective) || !effective.substitution_reason) return null
    const heard = effective.display_name.trim()
    if (!heard) return null
    return heard === (voiceDisplayName(stored) ?? '') ? null : heard
}

export function EffectiveVoiceLabel({
    stored,
    effective,
    badgeContext,
    showBadges = true,
    fallback,
    className,
    nameClassName,
}: EffectiveVoiceLabelProps) {
    const { t } = useTranslation()
    const projection = isElevenLabsProjection(effective) ? effective : null
    const heard = substitutedName(stored, projection)
    // A substituted voice keeps its own name; the voice heard goes on the line below.
    const name = (heard ? voiceDisplayName(stored) : voiceDisplayName(stored, projection))
        ?? (projection?.display_name.trim() || null)
        ?? fallback
        ?? t('voices.display.fallbackName')
    const context: VoiceBadgeContext = { original: voiceDisplayName(stored), name: heard ?? undefined, ...badgeContext }
    return (
        <div className={cx('flex min-w-0 flex-col gap-1', className)}>
            <p className={nameClassName ?? 'truncate font-ui text-sm font-semibold text-parchment-50'}>{name}</p>
            {heard && <p className="font-ui text-xs text-parchment-300">{t('voices.notice.substituted', { name: heard })}</p>}
            {projection && showBadges && <VoiceBadges badges={projection.badges} context={context} />}
        </div>
    )
}
