import { snapshotToLoreEntry } from '@/features/codex'
import type { LorebookEntry, StoryCardSnapshot } from '@/shared'

export {
    CODEX_LIBRARY_KINDS,
    KIND_ICONS,
    KIND_META,
    snapshotDescription,
    snapshotDisplayDescription,
    snapshotDisplayLabel,
    snapshotLabel,
    clonedEntryIds,
    lorebookEntrySnapshot,
    type CodexKindMeta,
    type CodexLibraryCardKind,
    type CodexLibraryCardSelection,
} from '@/features/codex/utils/codexUtils'

/** Rebuild the editor's lightweight trigger model from the stored snapshot. */
export function lorebookEntryFromSnapshot(snapshot: StoryCardSnapshot, fallbackId: string): LorebookEntry {
    const entry = snapshotToLoreEntry(snapshot as unknown as Record<string, unknown>, fallbackId)
    const fallbackKey = snapshot.name ?? snapshot.alias ?? fallbackId
    return {
        ...entry,
        keys: entry.keys.length > 0 ? entry.keys : [fallbackKey],
    }
}
