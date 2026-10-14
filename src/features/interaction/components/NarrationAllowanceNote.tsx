import { useTranslation } from 'react-i18next'
import { Volume2, VolumeX } from 'lucide-react'
import { cx, Icon } from '@/ui/primitives'
import type { NarrationAllowance } from '../hooks/useNarrationAllowance'

/**
 * One line under the composer with today's narration allowance (D24): the
 * characters left, or the daily-limit copy once they run out. Renders nothing
 * until the server reports the usage fields.
 */
export function NarrationAllowanceNote({ meter, limitReached }: NarrationAllowance) {
    const { t, i18n } = useTranslation()
    if (!meter && !limitReached) return null
    const value = meter ? new Intl.NumberFormat(i18n.language).format(meter.remaining) : ''
    return (
        <p
            role="status"
            data-testid="narration-allowance"
            className={cx(
                'mx-auto m-0 flex w-full max-w-[760px] items-center gap-2 px-4 pb-3 font-ui text-caption md:px-6',
                limitReached ? 'text-ember-300' : 'text-parchment-400',
            )}
        >
            <Icon icon={limitReached ? VolumeX : Volume2} size={14} className="shrink-0" />
            <span>
                {limitReached
                    ? t('interaction.narration.dailyLimit')
                    : t('interaction.narration.charsLeft', { count: meter?.remaining ?? 0, value })}
            </span>
        </p>
    )
}
