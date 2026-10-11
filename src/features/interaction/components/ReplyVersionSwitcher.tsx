import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { IconButton } from '../../../ui/primitives'

interface ReplyVersionSwitcherProps {
    /** Zero-based position of the version on screen. */
    index: number
    count: number
    onSelect: (index: number) => void
    disabled?: boolean
}

/**
 * ‹ 2 / 3 › — steps through the stored versions of the latest reply. Regenerate
 * adds a version instead of replacing one; only the version shown is sent to
 * the model.
 */
export function ReplyVersionSwitcher({ index, count, onSelect, disabled = false }: ReplyVersionSwitcherProps) {
    const { t } = useTranslation()
    const position = { index: index + 1, count }
    return (
        <div role="group" aria-label={t('interaction.actions.versions')} className="flex items-center">
            <IconButton
                label={t('interaction.actions.previousVersion')}
                size="sm"
                disabled={disabled || index <= 0}
                onClick={() => onSelect(index - 1)}
            >
                <ChevronLeft size={14} strokeWidth={1.75} />
            </IconButton>
            <span className="min-w-10 text-center font-mono text-caption tabular-nums text-parchment-400">
                <span aria-hidden>{t('interaction.actions.versionCount', position)}</span>
                <span className="sr-only">{t('interaction.actions.versionOf', position)}</span>
            </span>
            <IconButton
                label={t('interaction.actions.nextVersion')}
                size="sm"
                disabled={disabled || index >= count - 1}
                onClick={() => onSelect(index + 1)}
            >
                <ChevronRight size={14} strokeWidth={1.75} />
            </IconButton>
        </div>
    )
}
