/**
 * LoreTriggerMark — an inline, arcane-underlined word in the transcript that touches
 * session lore. Ctrl/Cmd-click (or a plain tap on touch) opens the entry's floating
 * card; a plain desktop click is a no-op so it never hijacks text selection.
 */
import type { MouseEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '@/ui/primitives'
import type { TriggerMatch } from '../loreTriggers'
import { useOpenLoreEntry } from '../hooks/useOpenLoreEntry'

interface LoreTriggerMarkProps {
    match: TriggerMatch
    children?: ReactNode
    className?: string
}

function isCoarsePointer(): boolean {
    return (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(pointer: coarse)').matches
    )
}

export function LoreTriggerMark({ match, children, className }: LoreTriggerMarkProps) {
    const { t } = useTranslation()
    const openEntry = useOpenLoreEntry()

    const handleClick = (event: MouseEvent<HTMLSpanElement>) => {
        if (event.ctrlKey || event.metaKey || isCoarsePointer()) {
            event.preventDefault()
            event.stopPropagation()
            openEntry(match)
        }
    }

    return (
        <span
            className={cx('lore-trigger', className)}
            title={t('loreTrigger.openHint', { name: match.lorebookName })}
            aria-label={t('loreTrigger.ariaLabel', { keyword: match.keyword, name: match.lorebookName })}
            data-lore-entry={match.entry.id}
            onClick={handleClick}
        >
            {children ?? match.keyword}
        </span>
    )
}
