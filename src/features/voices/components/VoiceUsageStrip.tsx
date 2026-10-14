import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { VoiceUsageView } from '@/shared/voice/voiceUsage'
import { Badge, cx } from '@/ui/primitives'

interface VoiceUsageStripProps {
    /** Today's D24 usage (narration characters, call seconds) from the profile; null hides those items. */
    usage: VoiceUsageView | null
    /** Recipe previews left today, kept current by each preview answer; null hides the item. */
    previewsLeft: number | null
    className?: string
}

interface StripItem {
    key: string
    content: ReactNode
    /** Preceded by the "·" separator (text items after the first). */
    separated: boolean
}

/**
 * The Voice Studio usage strip (AC-S3, 05 §5.7 / §9.3): previews, narration
 * characters and call minutes left today. Each item shows only when the usage
 * DTO reports it; with none, the strip is not rendered. Call time is rounded
 * down to whole minutes, so it never promises more than is left. With no
 * narration left today the danger `daily_limit` badge follows the narration
 * item (05 §7.7, 03 §5.12 copy).
 */
export function VoiceUsageStrip({ usage, previewsLeft, className }: VoiceUsageStripProps) {
    const { t, i18n } = useTranslation()
    const items: StripItem[] = []
    const text = (key: string, content: string) => items.push({ key, content, separated: items.length > 0 })
    if (previewsLeft !== null) text('previews', t('voices.usage.previews', { count: previewsLeft }))
    if (usage?.narration) {
        const left = usage.narration.remaining
        text('narration', t('voices.usage.narration', { count: left, value: new Intl.NumberFormat(i18n.language).format(left) }))
        if (left === 0) {
            items.push({
                key: 'daily_limit',
                separated: false,
                // The copy is a sentence: it wraps inside the badge instead of overflowing a phone.
                content: <Badge tone="danger" data-badge="daily_limit"><span className="whitespace-normal">{t('voices.badge.daily_limit')}</span></Badge>,
            })
        }
    }
    if (usage?.call) text('calls', t('voices.usage.calls', { minutes: Math.floor(usage.call.remaining / 60) }))
    if (items.length === 0) return null
    return (
        <ul
            aria-label={t('voices.usage.label')}
            data-testid="voice-usage-strip"
            className={cx('flex flex-wrap items-center gap-x-2 gap-y-1 font-ui text-caption text-fg-muted', className)}
        >
            {items.map((item) => (
                <li key={item.key}>
                    {item.separated && <span aria-hidden className="mr-2 text-parchment-500">·</span>}
                    {item.content}
                </li>
            ))}
        </ul>
    )
}
