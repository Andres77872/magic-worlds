/**
 * Opens the floating card for a matched trigger — just that one entry's content, with
 * a "From {lorebook}" origin line. Shared by the transcript marks and the composer
 * overlay so the open behaviour and label stay identical.
 */
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useFloatingWindows } from '@/app/hooks'
import { loreEntryWindow } from '@/features/floatingWindows/floatingWindow.types'
import type { TriggerMatch } from '../loreTriggers'

export function useOpenLoreEntry() {
    const { t } = useTranslation()
    const { openWindow } = useFloatingWindows()
    return useCallback(
        (match: TriggerMatch) => {
            openWindow(
                loreEntryWindow(match.entry, {
                    originLabel: t('floatingWindows.fromLorebook', { name: match.lorebookName }),
                }),
            )
        },
        [openWindow, t],
    )
}
