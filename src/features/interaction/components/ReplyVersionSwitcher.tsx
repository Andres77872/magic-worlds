import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { IconButton } from '../../../ui/primitives'

/** Names for what is being paged (defaults: reply versions). `position` is the spoken "n of m". */
export interface PagerLabels {
    group: string
    previous: string
    next: string
    position: string
}

interface ReplyVersionSwitcherProps {
    /** Zero-based position of the version on screen. */
    index: number
    count: number
    onSelect: (index: number) => void
    disabled?: boolean
    /** Reuse the pager for something other than reply versions (e.g. a turn's scene images). */
    labels?: Partial<PagerLabels>
}

/**
 * ‹ 2 / 3 › — steps through the stored versions of the latest reply. Regenerate
 * adds a version instead of replacing one; only the version shown is sent to
 * the model. With `labels` it pages anything else the same way.
 */
export function ReplyVersionSwitcher({ index, count, onSelect, disabled = false, labels }: ReplyVersionSwitcherProps) {
    const { t } = useTranslation()
    const position = { index: index + 1, count }
    return (
        <div role="group" aria-label={labels?.group ?? t('interaction.actions.versions')} className="flex items-center">
            <IconButton
                label={labels?.previous ?? t('interaction.actions.previousVersion')}
                size="sm"
                disabled={disabled || index <= 0}
                onClick={() => onSelect(index - 1)}
            >
                <ChevronLeft size={14} strokeWidth={1.75} />
            </IconButton>
            <span className="min-w-10 text-center font-mono text-caption tabular-nums text-parchment-400">
                <span aria-hidden>{t('interaction.actions.versionCount', position)}</span>
                <span className="sr-only">{labels?.position ?? t('interaction.actions.versionOf', position)}</span>
            </span>
            <IconButton
                label={labels?.next ?? t('interaction.actions.nextVersion')}
                size="sm"
                disabled={disabled || index >= count - 1}
                onClick={() => onSelect(index + 1)}
            >
                <ChevronRight size={14} strokeWidth={1.75} />
            </IconButton>
        </div>
    )
}
