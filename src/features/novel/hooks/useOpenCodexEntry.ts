/**
 * useOpenCodexEntry — opens a codex entry's read-only floating preview window.
 * Its one caller is the editor's inline codex detection (Ctrl/Cmd-click on a
 * highlighted name): the codex panel row opens the edit drawer instead, so an
 * entry has exactly one editing surface. Lorebook entries open a lore card;
 * library cards (character/world/item/adventure) open a card preview.
 */

import { useCallback } from 'react'
import { useFloatingWindows } from '@/app/hooks'
import { cardWindow, loreEntryWindow } from '@/features/floatingWindows'
import { snapshotToCardPreview } from '@/features/codex'
import type { CardPreviewTargetType } from '@/features/cards'
import { lorebookEntryFromSnapshot } from '../utils/codexUtils'
import type { CodexEntry } from './useCodex'

const LIBRARY_CARD_KINDS = ['character', 'world', 'item', 'adventure_template']

export function useOpenCodexEntry() {
    const { openWindow } = useFloatingWindows()

    return useCallback(
        (entry: CodexEntry) => {
            const snapshot = entry.ref.snapshot
            if (entry.kind === 'lorebook_entry') {
                openWindow(loreEntryWindow(lorebookEntryFromSnapshot(snapshot, entry.ref.cardId), {
                    sourceName: snapshot.source_lorebook_id ?? undefined,
                }))
                return
            }
            const kind = (LIBRARY_CARD_KINDS.includes(entry.kind) ? entry.kind : 'character') as CardPreviewTargetType
            openWindow(cardWindow(snapshotToCardPreview(snapshot as unknown as Record<string, unknown>, kind, entry.ref.cardId), {}))
        },
        [openWindow],
    )
}
