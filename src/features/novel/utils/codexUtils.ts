import { snapshotToLoreEntry } from '@/features/codex'
import type { Lorebook, LorebookEntry, StoryCardRef, StoryCardSnapshot } from '@/shared'

export {
    CODEX_LIBRARY_KINDS,
    KIND_ICONS,
    KIND_META,
    snapshotDescription,
    snapshotDisplayDescription,
    snapshotDisplayLabel,
    snapshotLabel,
    type CodexKindMeta,
    type CodexLibraryCardKind,
    type CodexLibraryCardSelection,
} from '@/features/codex/utils/codexUtils'

/** Build the exact strict snapshot accepted for a lorebook-entry story ref. */
export function lorebookEntrySnapshot(lorebook: Lorebook, entry: LorebookEntry): StoryCardSnapshot {
    return {
        id: entry.id,
        name: entry.title,
        description: entry.content,
        source_lorebook_id: lorebook.id,
        story_card_kind: 'lorebook_entry',
    }
}

/** Lorebook-entry snapshots use their canonical `id` as the source entry identity. */
export function clonedEntryIds(refs: StoryCardRef[]): Set<string> {
    return new Set(
        refs
            .filter((ref) => ref.kind === 'lorebook_entry')
            .map((ref) => ref.snapshot.id)
            .filter(Boolean),
    )
}

/** Rebuild the editor's lightweight trigger model from the canonical snapshot. */
export function lorebookEntryFromSnapshot(snapshot: StoryCardSnapshot, fallbackId: string): LorebookEntry {
    const entry = snapshotToLoreEntry(snapshot as unknown as Record<string, unknown>, fallbackId)
    const fallbackKey = snapshot.name ?? snapshot.alias ?? fallbackId
    return {
        ...entry,
        keys: entry.keys.length > 0 ? entry.keys : [fallbackKey],
    }
}
