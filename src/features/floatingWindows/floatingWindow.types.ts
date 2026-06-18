/**
 * Descriptor types for the floating preview windows. Each open window is a
 * piece of read-only content (a card preview, a lorebook, or a single lorebook
 * entry) plus a stable `dedupKey` (so re-opening the same item focuses the
 * existing window instead of stacking a duplicate) and an optional `onEdit`
 * action that opens the surface's editor.
 */
import type { CardPreview } from '@/features/cards'
import type { Lorebook, LorebookEntry } from '@/shared'

export type FloatingWindowContent =
    | { kind: 'card'; preview: CardPreview }
    | { kind: 'lorebook'; lorebook: Lorebook }
    | { kind: 'loreEntry'; entry: LorebookEntry; sourceName?: string; originLabel?: string }

export interface FloatingWindowDescriptor {
    /** Unique per opened window (React identity + close/focus target). */
    id: string
    /** Stable content identity for dedup: `card:<id>` / `lorebook:<id>` / `loreEntry:<id>`. */
    dedupKey: string
    title: string
    content: FloatingWindowContent
    /** Optional — opens the surface's editor (shown as an Edit action in the titlebar). */
    onEdit?: () => void
    editLabel?: string
}

/** What callers pass to `openWindow`; the provider assigns the `id`. */
export type FloatingWindowInput = Omit<FloatingWindowDescriptor, 'id'>

interface EditAction {
    onEdit?: () => void
    editLabel?: string
}

/** Options for a lore-entry window: optional clone source, an origin line (e.g.
 *  "From {lorebook}" when opened from a chat trigger), and the editor action. */
interface LoreEntryWindowOptions extends EditAction {
    /** Source lorebook name shown as a "cloned from" line (novel codex). */
    sourceName?: string
    /** Pre-localized origin line (e.g. "From {lorebook}") for session-trigger opens. */
    originLabel?: string
}

export function cardWindow(preview: CardPreview, edit?: EditAction): FloatingWindowInput {
    return { dedupKey: `card:${preview.id}`, title: preview.title, content: { kind: 'card', preview }, ...edit }
}

export function lorebookWindow(lorebook: Lorebook, edit?: EditAction): FloatingWindowInput {
    return { dedupKey: `lorebook:${lorebook.id}`, title: lorebook.name, content: { kind: 'lorebook', lorebook }, ...edit }
}

export function loreEntryWindow(entry: LorebookEntry, options: LoreEntryWindowOptions = {}): FloatingWindowInput {
    const { sourceName, originLabel, ...edit } = options
    return {
        dedupKey: `loreEntry:${entry.id}`,
        title: entry.title,
        content: { kind: 'loreEntry', entry, sourceName, originLabel },
        ...edit,
    }
}
