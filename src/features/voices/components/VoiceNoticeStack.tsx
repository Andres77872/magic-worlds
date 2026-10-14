/**
 * The voice notices of one surface, in a fixed order and at most two at a time
 * (R1-FE-03, 09 §7): first exposure, then review flags, then the substitution
 * note. A dismissed notice makes room for the next one. Each review notice is
 * titled with its record's name (`useReviewFlagTitles`: the host's `nameFor`,
 * the library card name, else the kind), so its region and its Listen and
 * Dismiss names say what they act on (05 §10).
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Info } from 'lucide-react'
import type { VoiceReviewFlag } from '@/shared'
import { Callout, Icon, cx } from '@/ui/primitives'
import { useFirstExposure } from '../hooks/useFirstExposure'
import { useReviewFlagTitles, type ReviewFlagNameFor } from '../hooks/useReviewFlagTitles'
import { FirstExposureCallout } from './FirstExposureNotice'
import { ReviewNotice } from './ReviewNotice'

export const MAX_VISIBLE_VOICE_NOTICES = 2

interface VoiceNoticeStackProps {
    userHash?: string | null
    /** The surface shows a stored V1 voice that now plays through ElevenLabs (first-exposure condition). */
    hasConvertedVoice?: boolean
    flags?: readonly VoiceReviewFlag[]
    onDismissFlag?: (flagId: number) => void
    onAdjustFlag?: (flag: VoiceReviewFlag) => void
    /** The flagged record's name when the host knows it; else the library card name or the kind. */
    nameFor?: ReviewFlagNameFor
    /** The voice heard instead of the stored one, when substituted. */
    substitutedName?: string | null
    className?: string
}

export function VoiceNoticeStack({
    userHash,
    hasConvertedVoice = false,
    flags = [],
    onDismissFlag,
    onAdjustFlag,
    nameFor,
    substitutedName,
    className,
}: VoiceNoticeStackProps) {
    const { t } = useTranslation()
    const exposure = useFirstExposure(userHash)
    const titles = useReviewFlagTitles(flags, nameFor)
    const notices: { key: string; node: ReactNode }[] = []
    if (hasConvertedVoice && exposure.visible) {
        notices.push({ key: 'first-exposure', node: <FirstExposureCallout onDismiss={exposure.dismiss} /> })
    }
    for (const flag of flags) {
        notices.push({
            key: `flag-${flag.flag_id}`,
            node: (
                <ReviewNotice
                    flag={flag}
                    title={titles.get(flag.flag_id)}
                    // The stack sits under the page heading, beside the first-exposure notice (h2).
                    headingLevel={2}
                    onDismiss={(id) => onDismissFlag?.(id)}
                    onAdjust={onAdjustFlag ? () => onAdjustFlag(flag) : undefined}
                />
            ),
        })
    }
    if (substitutedName) {
        notices.push({
            key: 'substitution',
            node: (
                <Callout tone="info" role="note" icon={<Icon icon={Info} size={16} />}>
                    {t('voices.notice.substituted', { name: substitutedName })}
                </Callout>
            ),
        })
    }
    if (notices.length === 0) return null
    return (
        <div className={cx('flex flex-col gap-2', className)} data-testid="voice-notice-stack">
            {notices.slice(0, MAX_VISIBLE_VOICE_NOTICES).map((notice) => (
                <div key={notice.key}>{notice.node}</div>
            ))}
        </div>
    )
}
