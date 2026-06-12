/**
 * Codex helpers. The codex is the novel's isolated collection of cloned
 * snapshots (story-level card refs): cards are cloned server-side on add,
 * lorebook entries are cloned client-side via lorebookEntrySnapshot. Editing
 * a codex entry only touches the novel's copy, never the source card.
 */

import { BookMarked, Camera, Gem, Globe, ScrollText, Swords, Users, type LucideIcon } from 'lucide-react'
import type { Lorebook, LorebookEntry, StoryCardKind, StoryCardRef } from '@/shared'

export interface CodexKindMeta {
    kind: StoryCardKind
    label: string
    plural: string
}

export const KIND_ICONS: Record<StoryCardKind, LucideIcon> = {
    character: Users,
    world: Globe,
    item: Gem,
    adventure_template: Swords,
    lorebook: BookMarked,
    lorebook_entry: ScrollText,
    snapshot_card: Camera,
}

/** Display order for codex groups. */
export const KIND_META: CodexKindMeta[] = [
    { kind: 'character', label: 'Character', plural: 'Characters' },
    { kind: 'world', label: 'World', plural: 'Worlds' },
    { kind: 'item', label: 'Item', plural: 'Items' },
    { kind: 'adventure_template', label: 'Adventure', plural: 'Adventures' },
    { kind: 'lorebook_entry', label: 'Lore entry', plural: 'Lore entries' },
    { kind: 'lorebook', label: 'Lorebook', plural: 'Lorebooks' },
    { kind: 'snapshot_card', label: 'Snapshot', plural: 'Snapshots' },
]

export function snapshotLabel(ref: StoryCardRef): string {
    const snapshot = ref.snapshot ?? {}
    return String(snapshot.name ?? snapshot.title ?? snapshot.alias ?? ref.cardId)
}

export function snapshotDescription(ref: StoryCardRef): string {
    const snapshot = ref.snapshot ?? {}
    return String(snapshot.description ?? snapshot.content ?? snapshot.race ?? snapshot.type ?? '').trim()
}

/**
 * Clone one lorebook entry into a self-contained codex snapshot. The backend
 * stores this verbatim (it cannot resolve entry ids itself) and its prompt
 * builder reads `description`/`content`, so both carry the entry text.
 */
export function lorebookEntrySnapshot(lorebook: Lorebook, entry: LorebookEntry): Record<string, unknown> {
    return {
        name: entry.title,
        title: entry.title,
        description: entry.content,
        content: entry.content,
        keys: entry.keys,
        entry_type: entry.entryType,
        source_lorebook_id: lorebook.id,
        source_lorebook_name: lorebook.name,
        source_entry_id: entry.id,
        story_card_kind: 'lorebook_entry',
    }
}

/** Entry ids already cloned into the codex (for "In codex" badges). */
export function clonedEntryIds(refs: StoryCardRef[]): Set<string> {
    const ids = new Set<string>()
    for (const ref of refs) {
        const sourceEntryId = ref.snapshot?.source_entry_id
        if (typeof sourceEntryId === 'string' && sourceEntryId) ids.add(sourceEntryId)
    }
    return ids
}
