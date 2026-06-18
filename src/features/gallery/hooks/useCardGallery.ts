/**
 * useCardGallery — server-driven list state for a gallery page: debounced
 * search (name/alias/triggers via the API's `q` param), skip/limit infinite
 * scroll, and local removal sync after deletes. Independent of DataProvider,
 * which keeps owning the dashboard's first-page shelves.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { GalleryItem } from '../galleryConfig'

export const GALLERY_PAGE_SIZE = 24
const SEARCH_DEBOUNCE_MS = 300

export interface CardGalleryConfig<T extends { id: string } = GalleryItem> {
    fetchPage: (skip: number, limit: number, q?: string) => Promise<unknown>
    toItems: (raw: unknown) => T[]
}

export interface CardGallery<T extends { id: string } = GalleryItem> {
    items: T[]
    /** Raw, controlled search input value (also the tag-pill entry point). */
    query: string
    setQuery: (q: string) => void
    /** True while the debounce window or a search fetch is in flight. */
    searching: boolean
    /** Initial / search-reset load (full skeleton). */
    loading: boolean
    loadingMore: boolean
    hasMore: boolean
    error: string | null
    loadMore: () => void
    refresh: () => void
    /** Drop an item locally after a server delete, keeping the cursor aligned. */
    removeItem: (id: string) => void
    /** Insert or refresh a directly loaded card without advancing the paginated cursor. */
    upsertItem: (item: T) => void
}

export interface CardGalleryOptions {
    enabled?: boolean
}

function appendDedupedById<T extends { id: string }>(prev: T[], page: T[]): T[] {
    const seen = new Set(prev.map((item) => item.id))
    return [...prev, ...page.filter((item) => !seen.has(item.id))]
}

export function useCardGallery<T extends { id: string } = GalleryItem>(
    config: CardGalleryConfig<T>,
    pageSize = GALLERY_PAGE_SIZE,
    options: CardGalleryOptions = {},
): CardGallery<T> {
    const enabled = options.enabled ?? true
    const [items, setItems] = useState<T[]>([])
    const [query, setQuery] = useState('')
    const [debouncedQuery, setDebouncedQuery] = useState('')
    const [loading, setLoading] = useState(enabled)
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Stale-response guard: each fetch takes a ticket; only the latest may
    // commit. Simpler than AbortController and covers out-of-order resolution.
    const seqRef = useRef(0)
    // Server cursor — tracked apart from items.length so local removals
    // (removeItem) keep later pages aligned with the shrunken server list.
    const skipRef = useRef(0)
    const localUpsertIdsRef = useRef<Set<string>>(new Set())

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS)
        return () => clearTimeout(timer)
    }, [query])

    useEffect(() => {
        if (enabled) return
        seqRef.current += 1
        skipRef.current = 0
        localUpsertIdsRef.current.clear()
        setItems([])
        setLoading(false)
        setLoadingMore(false)
        setHasMore(false)
        setError(null)
    }, [enabled])

    const fetchPage = useCallback(
        async (reset: boolean) => {
            if (!enabled) return
            const seq = ++seqRef.current
            const skip = reset ? 0 : skipRef.current
            if (reset) setLoading(true)
            else setLoadingMore(true)
            setError(null)
            try {
                const raw = await config.fetchPage(skip, pageSize, debouncedQuery || undefined)
                if (seq !== seqRef.current) return
                const page = config.toItems(raw)
                skipRef.current = skip + page.length
                // Bare-array responses carry no total; a full page implies more.
                setHasMore(page.length === pageSize)
                setItems((prev) => {
                    if (!reset) return appendDedupedById(prev, page)
                    const pageIds = new Set(page.map((item) => item.id))
                    const localItems = prev.filter(
                        (item) => localUpsertIdsRef.current.has(item.id) && !pageIds.has(item.id),
                    )
                    return [...localItems, ...page]
                })
            } catch (e) {
                if (seq !== seqRef.current) return
                setError(e instanceof Error ? e.message : 'Failed to load')
                if (reset) setItems([])
                setHasMore(false)
            } finally {
                if (seq === seqRef.current) {
                    setLoading(false)
                    setLoadingMore(false)
                }
            }
        },
        [config, pageSize, debouncedQuery, enabled],
    )

    // Mount + every committed search → reset & refetch (fetchPage's identity
    // carries debouncedQuery). A manual fetch hook necessarily flips `loading`
    // the moment the request starts, hence the targeted suppression.
    useEffect(() => {
        if (!enabled) return
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void fetchPage(true)
    }, [fetchPage, enabled])

    const loadMore = useCallback(() => {
        if (!enabled || loading || loadingMore || !hasMore) return
        void fetchPage(false)
    }, [enabled, fetchPage, loading, loadingMore, hasMore])

    const removeItem = useCallback((id: string) => {
        setItems((prev) => {
            const next = prev.filter((item) => item.id !== id)
            if (next.length !== prev.length) skipRef.current -= 1
            return next
        })
        localUpsertIdsRef.current.delete(id)
    }, [])

    const upsertItem = useCallback((item: T) => {
        localUpsertIdsRef.current.add(item.id)
        setItems((prev) => {
            const existingIndex = prev.findIndex((current) => current.id === item.id)
            if (existingIndex < 0) return [item, ...prev]
            const next = [...prev]
            next[existingIndex] = item
            return next
        })
    }, [])

    const refresh = useCallback(() => {
        if (!enabled) return
        void fetchPage(true)
    }, [enabled, fetchPage])

    return {
        items,
        query,
        setQuery,
        searching: enabled && (query.trim() !== debouncedQuery || (loading && debouncedQuery !== '')),
        loading,
        loadingMore,
        hasMore,
        error,
        loadMore,
        refresh,
        removeItem,
        upsertItem,
    }
}
