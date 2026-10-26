/**
 * The mixed-type card list of one library location (`GET /workspaces/{id}/cards`),
 * in the server's stable `creation_at DESC, card_id DESC` order: offset pages
 * of 24 appended without repeats, filtered server-side before pagination
 * (search, type/role, collection, uncollected).
 *
 * Results are keyed by workspace + query; a stale response (another location,
 * a newer request, a committed workspace switch) never lands. A small cache per
 * key restores a location's loaded position instantly when the user comes
 * back to it (e.g. from a folder or a creator) while it revalidates.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import type { ApiService } from '@/infrastructure/api'
import { galleryItemsFromLibrary, type GalleryItem } from '@/features/gallery/galleryConfig'
import { LIBRARY_PAGE_SIZE, libraryQueryFor, libraryQueryKey, type LibraryRoute } from '../libraryUrl'

/** Card identity across types (IDs of different card types may collide). */
export function libraryItemKey(item: Pick<GalleryItem, 'backendType' | 'id'>): string {
    return `${item.backendType}:${item.id}`
}

const MAX_RESTORE = 100
const CACHE_LIMIT = 24
const cache = new Map<string, { items: GalleryItem[]; total: number }>()

function remember(key: string, items: GalleryItem[], total: number): void {
    cache.delete(key)
    cache.set(key, { items, total })
    while (cache.size > CACHE_LIMIT) {
        const oldest = cache.keys().next().value
        if (oldest === undefined) break
        cache.delete(oldest)
    }
}

function mergeUnique(current: readonly GalleryItem[], next: readonly GalleryItem[]): GalleryItem[] {
    const seen = new Set(current.map(libraryItemKey))
    const merged = [...current]
    for (const item of next) {
        const key = libraryItemKey(item)
        if (seen.has(key)) continue
        seen.add(key)
        merged.push(item)
    }
    return merged
}

interface CardsState {
    key: string | null
    items: GalleryItem[]
    total: number
    loading: boolean
    loadingMore: boolean
    error: boolean
}

const EMPTY: CardsState = { key: null, items: [], total: 0, loading: true, loadingMore: false, error: false }

export interface LibraryCards {
    items: GalleryItem[]
    total: number
    loading: boolean
    loadingMore: boolean
    error: boolean
    hasMore: boolean
    /** The key of the location these results belong to. */
    key: string | null
    loadMore: () => void
    refresh: () => void
    upsertItem: (item: GalleryItem) => void
    removeItems: (keys: readonly string[]) => void
}

export type LibraryLocationQuery = Pick<LibraryRoute, 'collectionId' | 'query' | 'typeFilter' | 'uncollected'>

export function useLibraryCards(api: ApiService | null, workspaceId: string | null, location: LibraryLocationQuery): LibraryCards {
    const { capture, isCurrent } = useWorkspace()
    const key = workspaceId ? libraryQueryKey(workspaceId, location) : null
    const [state, setState] = useState<CardsState>(() => {
        const cached = key ? cache.get(key) : undefined
        return cached ? { key, items: cached.items, total: cached.total, loading: false, loadingMore: false, error: false } : { ...EMPTY, key }
    })
    const requestRef = useRef(0)
    const abortRef = useRef<AbortController | null>(null)
    const locationRef = useRef(location)
    useEffect(() => {
        locationRef.current = location
    })

    const fetchPage = useCallback(async (offset: number, limit: number, mode: 'reset' | 'append') => {
        if (!api || !workspaceId || !key) return
        const request = (requestRef.current += 1)
        abortRef.current?.abort()
        const controller = new AbortController()
        abortRef.current = controller
        const scope = capture()
        const query = { ...libraryQueryFor(locationRef.current), limit, offset }
        try {
            const page = await api.listLibraryCards(workspaceId, query, { signal: controller.signal })
            if (request !== requestRef.current || !isCurrent(scope)) return
            const pageItems = galleryItemsFromLibrary(page.items)
            setState((current) => {
                const items = mode === 'append' && current.key === key ? mergeUnique(current.items, pageItems) : mergeUnique([], pageItems)
                remember(key, items, page.total)
                return { key, items, total: page.total, loading: false, loadingMore: false, error: false }
            })
        } catch (error) {
            if (request !== requestRef.current || !isCurrent(scope)) return
            if (error instanceof DOMException && error.name === 'AbortError') return
            setState((current) => ({ ...current, key, loading: false, loadingMore: false, error: true }))
        }
    }, [api, capture, isCurrent, key, workspaceId])

    // A new location starts at offset 0 (restoring its cached position when known).
    useEffect(() => {
        if (!key) return
        const cached = cache.get(key)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setState((current) => {
            if (current.key === key) return { ...current, loading: current.items.length === 0, error: false }
            return cached
                ? { key, items: cached.items, total: cached.total, loading: false, loadingMore: false, error: false }
                : { ...EMPTY, key }
        })
        const restore = Math.min(MAX_RESTORE, Math.max(LIBRARY_PAGE_SIZE, cached?.items.length ?? 0))
        void fetchPage(0, restore, 'reset')
        return () => abortRef.current?.abort()
    }, [fetchPage, key])

    const owned = state.key === key
    const items = owned ? state.items : []
    const total = owned ? state.total : 0
    const hasMore = owned && !state.error && items.length < total

    const loadMore = useCallback(() => {
        if (!hasMore || state.loading || state.loadingMore) return
        setState((current) => ({ ...current, loadingMore: true }))
        void fetchPage(items.length, LIBRARY_PAGE_SIZE, 'append')
    }, [fetchPage, hasMore, items.length, state.loading, state.loadingMore])

    const refresh = useCallback(() => {
        setState((current) => ({ ...current, loading: current.items.length === 0, error: false }))
        void fetchPage(0, Math.min(MAX_RESTORE, Math.max(LIBRARY_PAGE_SIZE, items.length)), 'reset')
    }, [fetchPage, items.length])

    const upsertItem = useCallback((item: GalleryItem) => {
        setState((current) => {
            if (current.key !== key || !key) return current
            const itemKey = libraryItemKey(item)
            const index = current.items.findIndex((candidate) => libraryItemKey(candidate) === itemKey)
            const next = index === -1
                ? [item, ...current.items]
                : current.items.map((candidate, position) => (position === index ? item : candidate))
            const total = index === -1 ? current.total + 1 : current.total
            remember(key, next, total)
            return { ...current, items: next, total }
        })
    }, [key])

    const removeItems = useCallback((keys: readonly string[]) => {
        const doomed = new Set(keys)
        setState((current) => {
            if (current.key !== key || !key) return current
            const next = current.items.filter((item) => !doomed.has(libraryItemKey(item)))
            const total = Math.max(0, current.total - (current.items.length - next.length))
            remember(key, next, total)
            return { ...current, items: next, total }
        })
    }, [key])

    return {
        items,
        total,
        // No workspace means nothing will ever be fetched: never report an endless load.
        loading: key !== null && (owned ? state.loading : true),
        loadingMore: owned && state.loadingMore,
        error: owned && state.error,
        hasMore,
        key,
        loadMore,
        refresh,
        upsertItem,
        removeItems,
    }
}

/** Drops every cached location of a workspace (after membership/copy changes). */
export function forgetLibraryCards(workspaceId: string): void {
    for (const key of [...cache.keys()]) {
        if (key.startsWith(`${workspaceId}|`)) cache.delete(key)
    }
}
