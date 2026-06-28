/**
 * Build read-only preview models from the loosely-typed cloned snapshots that
 * codex cards / adventure snapshot cards / novel codex entries carry, so they
 * can be shown in a floating preview window without re-fetching. URLs are passed
 * through raw — the preview bodies resolve them via `resolveMediaUrl`.
 */
import type { CardPreview } from '@/features/cards'
import { cardPreviewTypeLabel, mediaTargetType, type CardPreviewTargetType } from '@/features/cards/cardPreview'
import type { LorebookEntry, LorebookEntryType } from '@/shared'
import { snapshotDisplayDescription, snapshotDisplayLabel } from './codexUtils'

type Snapshot = Record<string, unknown> | null | undefined

function stringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.map(String) : []
}

export function snapshotToCardPreview(snapshot: Snapshot, kind: CardPreviewTargetType, fallbackId: string): CardPreview {
    return {
        id: String(snapshot?.source_card_id ?? snapshot?.id ?? fallbackId),
        type: kind,
        mediaType: mediaTargetType(kind),
        title: snapshotDisplayLabel(snapshot, fallbackId),
        badge: String(snapshot?.race ?? snapshot?.place_type ?? snapshot?.type ?? cardPreviewTypeLabel(kind)),
        description: snapshotDisplayDescription(snapshot) || undefined,
        imageUrl: typeof snapshot?.image_url === 'string' ? snapshot.image_url : undefined,
        themeSongUrl: typeof snapshot?.theme_song_url === 'string' ? snapshot.theme_song_url : undefined,
        triggers: stringArray(snapshot?.triggers),
        categories: (snapshot?.category as CardPreview['categories']) ?? undefined,
    }
}

export function snapshotToLoreEntry(snapshot: Snapshot, fallbackId: string): LorebookEntry {
    return {
        id: String(snapshot?.source_entry_id ?? snapshot?.id ?? fallbackId),
        lorebookId: String(snapshot?.source_lorebook_id ?? ''),
        title: snapshotDisplayLabel(snapshot, fallbackId),
        entryType: (typeof snapshot?.entry_type === 'string' ? snapshot.entry_type : 'other') as LorebookEntryType,
        content: String(snapshot?.content ?? snapshot?.description ?? ''),
        keys: stringArray(snapshot?.keys),
        secondaryKeys: stringArray(snapshot?.secondary_keys),
        selectiveLogic: 'any',
        enabled: true,
        constant: false,
        caseSensitive: false,
        matchWholeWords: true,
        regex: false,
        isSecret: false,
        insertionOrder: 0,
        priority: 0,
        insertionPosition: 'before_context',
    }
}

/** Source lorebook name stored on a cloned lorebook-entry snapshot, if present. */
export function snapshotSourceName(snapshot: Snapshot): string | undefined {
    return typeof snapshot?.source_lorebook_name === 'string' ? snapshot.source_lorebook_name : undefined
}
