/**
 * QualityHint — a quiet, non-blocking nudge about play usefulness (per the
 * cards-enrichment research: warnings should teach why a card works in play,
 * never gate saving). Amber italic narrative, one line.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Flame } from 'lucide-react'
import { Icon } from '@/ui/primitives'
import { findBroadTrigger } from './triggerQuality'

export interface QualityHintProps {
    children: ReactNode
}

export function QualityHint({ children }: QualityHintProps) {
    return (
        <p className="flex items-start gap-1.5 font-narrative text-[12.5px] italic leading-snug text-amber-500">
            <Icon icon={Flame} size={13} className="mt-0.5 shrink-0 opacity-80" />
            <span>{children}</span>
        </p>
    )
}

export interface TriggerHintsProps {
    triggers: string[]
    /** Whether the card has enough content for the "no triggers" nudge to matter. */
    hasContent: boolean
}

/** Activation-section nudges: too-broad triggers and the no-triggers note. */
export function TriggerHints({ triggers, hasContent }: TriggerHintsProps) {
    const { t } = useTranslation()
    const broad = findBroadTrigger(triggers)
    if (broad) {
        return (
            <QualityHint>
                {t('creation.common.triggerHints.broad', { trigger: broad.trim() })}
            </QualityHint>
        )
    }
    if (triggers.length === 0 && hasContent) {
        return (
            <QualityHint>
                {t('creation.common.triggerHints.none')}
            </QualityHint>
        )
    }
    return null
}
