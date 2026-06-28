/**
 * useOpenCodexEntry — opens a codex entry's read-only floating preview window.
 * Shared by the codex panel row (CodexEntryRow) and the editor's inline codex
 * detection (Ctrl/Cmd-click on a highlighted name) so the open behaviour and
 * window shape never drift. Lorebook entries open a lore card; library cards
 * (character/world/item/adventure) open a card preview.
 */

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useFloatingWindows } from '@/app/hooks'
import { cardWindow, loreEntryWindow } from '@/features/floatingWindows'
import { snapshotSourceName, snapshotToCardPreview, snapshotToLoreEntry } from '@/features/codex'
import type { CardPreviewTargetType } from '@/features/cards'
import type { CodexEntry } from './useCodex'

const LIBRARY_CARD_KINDS = ['character', 'world', 'item', 'adventure_template']

export function useOpenCodexEntry(onEdit?: (entry: CodexEntry) => void) {
    const { t } = useTranslation()
    const { openWindow } = useFloatingWindows()

    return useCallback(
        (entry: CodexEntry) => {
            const snapshot = entry.ref.snapshot
            const edit = onEdit ? { onEdit: () => onEdit(entry), editLabel: t('floatingWindows.edit') } : {}
            if (entry.kind === 'lorebook_entry') {
                openWindow(loreEntryWindow(snapshotToLoreEntry(snapshot, entry.ref.cardId), { sourceName: snapshotSourceName(snapshot), ...edit }))
                return
            }
            const kind = (LIBRARY_CARD_KINDS.includes(entry.kind) ? entry.kind : 'character') as CardPreviewTargetType
            openWindow(cardWindow(snapshotToCardPreview(snapshot, kind, entry.ref.cardId), edit))
        },
        [onEdit, openWindow, t],
    )
}
