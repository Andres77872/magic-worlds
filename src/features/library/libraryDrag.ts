/**
 * Drag-and-drop helpers and card-membership utilities for the Library browser.
 *
 * Dragging a card drags that card—or all selected cards when the dragged card
 * belongs to a multi-card selection (`selected.size > 1`). An in-memory active
 * drag fallback accompanies the HTML5 `DataTransfer` payload so both standard
 * browser drag events (where `getData` is restricted during `dragover`) and
 * test environments (`fireEvent.dragStart` / `fireEvent.drop`) resolve the
 * exact dragged card set.
 */
import type { DragEvent } from 'react'
import type { GalleryItem } from '@/features/gallery/galleryConfig'
import type { CardOrganization } from '@/shared/types'
import { libraryItemKey } from './hooks/useLibraryCards'

export const LIBRARY_CARDS_DRAG_MIME = 'application/x-magic-worlds-library-cards'

let activeDragKeys: readonly string[] | null = null

/** Resolve which cards are dragged when a drag starts on `draggedItem`. */
export function resolveDragItems(
    draggedItem: GalleryItem,
    selected: ReadonlyMap<string, GalleryItem>,
): GalleryItem[] {
    const key = libraryItemKey(draggedItem)
    if (selected.has(key) && selected.size > 1) {
        return [...selected.values()]
    }
    return [draggedItem]
}

/** Read a card's current collection IDs from its server-owned `organization` metadata. */
export function cardCollectionIds(item: GalleryItem): readonly string[] {
    const source = item.source as { organization?: CardOrganization } | undefined
    return source?.organization?.collection_ids ?? []
}

/** Return a copy of `item` with `collectionId` added to or removed from `source.organization.collection_ids`. */
export function withUpdatedCardMembership(
    item: GalleryItem,
    collectionId: string,
    mode: 'add' | 'remove',
    fallbackWorkspaceId?: string | null,
): GalleryItem {
    const source = item.source as { organization?: CardOrganization }
    const existing = source?.organization?.collection_ids ?? []
    const has = existing.includes(collectionId)
    if (mode === 'add' && has) return item
    if (mode === 'remove' && !has) return item
    const nextIds = mode === 'add'
        ? [...existing, collectionId]
        : existing.filter((id) => id !== collectionId)
    const workspaceId = source?.organization?.workspace_id ?? fallbackWorkspaceId
    if (!workspaceId) return item
    return {
        ...item,
        source: {
            ...item.source,
            organization: {
                workspace_id: workspaceId,
                collection_ids: nextIds,
            },
        },
    }
}

/** Compute full and partial collection membership sets across a list of target cards. */
export function summarizeCardMemberships(items: readonly GalleryItem[]): {
    allIn: ReadonlySet<string>
    someIn: ReadonlySet<string>
} {
    if (items.length === 0) {
        return { allIn: new Set(), someIn: new Set() }
    }
    const counts = new Map<string, number>()
    for (const item of items) {
        for (const id of cardCollectionIds(item)) {
            counts.set(id, (counts.get(id) ?? 0) + 1)
        }
    }
    const allIn = new Set<string>()
    const someIn = new Set<string>()
    for (const [id, count] of counts) {
        if (count === items.length) allIn.add(id)
        else if (count > 0) someIn.add(id)
    }
    return { allIn, someIn }
}

/** Populate `DataTransfer` and the in-memory active drag state for a card drag. */
export function writeLibraryDragData(
    event: DragEvent<HTMLElement>,
    items: readonly GalleryItem[],
    badgeLabel: string,
): void {
    const keys = items.map(libraryItemKey)
    activeDragKeys = keys
    const transfer = event.dataTransfer
    if (!transfer) return
    try {
        transfer.effectAllowed = 'copyMove'
        transfer.setData(LIBRARY_CARDS_DRAG_MIME, JSON.stringify(keys))
        transfer.setData('text/plain', items.map((item) => item.title).join(', '))
    } catch {
        // Ignore restricted DataTransfer environments.
    }
    attachLibraryDragGhost(event, badgeLabel, items.length)
}

/** Clear the in-memory active drag state on drag end or drop. */
export function clearLibraryDragData(): void {
    activeDragKeys = null
}

/** Check whether a drag event carries library card data. */
export function hasLibraryDragData(event: DragEvent<HTMLElement>): boolean {
    if (activeDragKeys && activeDragKeys.length > 0) return true
    const types = event.dataTransfer?.types
    return Boolean(types && Array.from(types).includes(LIBRARY_CARDS_DRAG_MIME))
}

/** Read dragged card keys (`backendType:id`) from `DataTransfer` or the active drag state. */
export function readLibraryDragKeys(event?: DragEvent<HTMLElement>): readonly string[] {
    if (event?.dataTransfer) {
        try {
            const raw = event.dataTransfer.getData(LIBRARY_CARDS_DRAG_MIME)
            if (raw) {
                const parsed: unknown = JSON.parse(raw)
                if (Array.isArray(parsed) && parsed.every((item): item is string => typeof item === 'string')) {
                    return parsed
                }
            }
        } catch {
            // Fall back to activeDragKeys.
        }
    }
    return activeDragKeys ?? []
}

/** Attach a temporary Reverie-styled floating drag badge when `setDragImage` is available. */
export function attachLibraryDragGhost(
    event: DragEvent<HTMLElement>,
    label: string,
    count: number,
): void {
    const transfer = event.dataTransfer
    if (!transfer || typeof transfer.setDragImage !== 'function' || typeof document === 'undefined') return
    const ghost = document.createElement('div')
    ghost.setAttribute('aria-hidden', 'true')
    ghost.className = [
        'pointer-events-none fixed -left-[9999px] -top-[9999px] z-[110]',
        'inline-flex max-w-[260px] items-center gap-2 rounded-lg border border-ember-500/60',
        'bg-ink-700 px-3 py-2 font-ui text-sm font-semibold text-parchment-50 shadow-card-hover',
    ].join(' ')
    const dot = document.createElement('span')
    dot.className = 'h-2 w-2 shrink-0 rounded-full bg-ember-400'
    ghost.appendChild(dot)
    const text = document.createElement('span')
    text.className = 'truncate'
    text.textContent = label
    ghost.appendChild(text)
    if (count > 1) {
        const badge = document.createElement('span')
        badge.className = 'shrink-0 rounded-full bg-ember-500 px-1.5 py-0.5 font-mono text-micro font-semibold text-on-ember'
        badge.textContent = String(count)
        ghost.appendChild(badge)
    }
    document.body.appendChild(ghost)
    try {
        transfer.setDragImage(ghost, 18, 18)
    } catch {
        // Ignore if setDragImage fails in synthetic events.
    }
    window.setTimeout(() => {
        ghost.remove()
    }, 0)
}
