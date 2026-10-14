/**
 * The caller's account-wide review flags (R1-FE-03), for the Voice studio:
 * grouped by record kind, newest first within a kind. Each notice is a
 * level-2 region under the page heading (05 §10), titled with its record's
 * name ("Review this voice: Gruff mentor"): the host's `nameFor`, else the
 * card's name in the loaded library, else the record kind, numbered when it
 * repeats (`useReviewFlagTitles`), so every region, Listen and Dismiss name
 * is distinct. Card notices also show the origin workspace label.
 */
import type { VoiceReviewFlag, VoiceReviewFlagRefType } from '@/shared'
import { cx } from '@/ui/primitives'
import { useReviewFlagTitles, type ReviewFlagNameFor } from '../hooks/useReviewFlagTitles'
import { ReviewNotice } from './ReviewNotice'

const GROUP_ORDER: readonly VoiceReviewFlagRefType[] = ['preset', 'card', 'card_draft', 'template_cast']

interface ReviewFlagListProps {
    flags: readonly VoiceReviewFlag[]
    onDismiss: (flagId: number) => void
    /** Opens a preset flag in place (the studio is already showing presets). */
    onAdjustPreset?: (presetId: string) => void
    /** The flagged record's catalog voice when the host already knows it (saves the effective-voice read on "Listen"). */
    voiceKeyFor?: (flag: VoiceReviewFlag) => string | null
    /** The flagged record's name when the host knows it (e.g. a preset row); else the library card name or the kind. */
    nameFor?: ReviewFlagNameFor
    /** Heading level of each notice (default 2: the list sits under the page heading). */
    headingLevel?: 2 | 3 | 4
    className?: string
}

export function ReviewFlagList({ flags, onDismiss, onAdjustPreset, voiceKeyFor, nameFor, headingLevel = 2, className }: ReviewFlagListProps) {
    const ordered = GROUP_ORDER.flatMap((kind) =>
        flags
            .filter((flag) => flag.ref_type === kind)
            .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '') || b.flag_id - a.flag_id),
    )
    const titles = useReviewFlagTitles(ordered, nameFor)
    if (ordered.length === 0) return null
    return (
        <div className={cx('flex flex-col gap-2', className)} data-testid="voice-review-flag-list">
            {ordered.map((flag) => (
                <ReviewNotice
                    key={flag.flag_id}
                    flag={flag}
                    title={titles.get(flag.flag_id)}
                    headingLevel={headingLevel}
                    onDismiss={onDismiss}
                    onAdjust={flag.ref_type === 'preset' && onAdjustPreset ? () => onAdjustPreset(flag.ref_id) : undefined}
                    voiceKey={voiceKeyFor?.(flag) ?? null}
                />
            ))}
        </div>
    )
}
