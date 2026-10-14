/**
 * A dismissible, neutral break reminder (R2-BE-01 FE; 13 §2.7). Renders
 * nothing unless {@link useBreakNudge} says so; `minutes` null (every non-EL
 * caller, R-19) means never. It sits inline and never stops playback; the copy
 * has no guilt and no streaks.
 */
import { useTranslation } from 'react-i18next'
import { Coffee } from 'lucide-react'
import { Button, Callout, Icon } from '@/ui/primitives'
import { useBreakNudge } from '../hooks/useBreakNudge'

export interface BreakNudgeProps {
    /** `readSafeguards(capabilities).break_nudge_minutes`. */
    minutes: number | null
    /** A call is live or narration is playing. */
    active: boolean
    className?: string
}

export function BreakNudge({ minutes, active, className }: BreakNudgeProps) {
    const { t } = useTranslation()
    const nudge = useBreakNudge(minutes, active)
    if (!nudge.visible) return null
    return (
        <Callout
            tone="info"
            role="status"
            icon={<Icon icon={Coffee} size={16} />}
            className={className}
            data-testid="break-nudge"
            action={<Button variant="secondary" size="sm" onClick={nudge.dismiss}>{t('voiceSafety.breakNudge.dismiss')}</Button>}
        >
            <p className="m-0 font-semibold text-parchment-50">{t('voiceSafety.breakNudge.title')}</p>
            <p className="mt-0.5 mb-0">{t('voiceSafety.breakNudge.body')}</p>
        </Callout>
    )
}
