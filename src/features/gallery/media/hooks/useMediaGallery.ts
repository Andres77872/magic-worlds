/**
 * useMediaGallery — server-driven state for the media gallery: a newest-first
 * merge over two independently paginated sources (images + theme songs), with
 * media-type / card-type / specific-card filters and local removal sync.
 *
 * Pagination model: each source keeps a private buffer + server offset + done
 * flag. Emitting a page repeatedly refills any empty-but-not-done buffer, then
 * pops the newer head of the two — chronologically correct across page
 * boundaries, unlike concatenate-then-sort. Asset-level deletes don't rewind
 * job-level server offsets (one image job may hold several assets); dedupe on
 * append covers the rare boundary repeat — the same trade-off
 * MediaHistoryDrawer accepts.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiService } from '@/infrastructure/api'
import {
    imageJobToItems,
    themeJobToItem,
    type CardRef,
    type CardTypeFilter,
    type MediaGalleryFilters,
    type MediaGalleryItem,
    type MediaTypeFilter,
} from '../mediaGalleryTypes'

export const MEDIA_PAGE_SIZE = 24

export interface MediaGallery {
    items: MediaGalleryItem[]
    filters: MediaGalleryFilters
    setMediaType: (t: MediaTypeFilter) => void
    /** Changing the card type clears any specific-card filter. */
    setCardType: (t: CardTypeFilter) => void
    /** Picking a card also narrows the card type to the card's own. */
    setCard: (c: CardRef | undefined) => void
    clearFilters: () => void
    /** Initial / filter-reset load (full skeleton). */
    loading: boolean
    loadingMore: boolean
    hasMore: boolean
    error: string | null
    loadMore: () => void
    refresh: () => void
    /** Drop an item locally after a server delete. */
    removeItem: (id: string) => void
}

interface SourceState {
    buffer: MediaGalleryItem[]
    offset: number
    done: boolean
}

function newSource(done = false): SourceState {
    return { buffer: [], offset: 0, done }
}

function appendDedupedById(prev: MediaGalleryItem[], page: MediaGalleryItem[]): MediaGalleryItem[] {
    const seen = new Set(prev.map((item) => item.id))
    return [...prev, ...page.filter((item) => !seen.has(item.id))]
}

const DEFAULT_FILTERS: MediaGalleryFilters = { mediaType: 'all', cardType: 'all' }

export function useMediaGallery(pageSize = MEDIA_PAGE_SIZE): MediaGallery {
    const [items, setItems] = useState<MediaGalleryItem[]>([])
    const [filters, setFilters] = useState<MediaGalleryFilters>(DEFAULT_FILTERS)
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Stale-response guard: each load takes a ticket; only the latest commits.
    const seqRef = useRef(0)
    const imagesRef = useRef<SourceState>(newSource())
    const themesRef = useRef<SourceState>(newSource())

    const fetchImagesPage = useCallback(
        async (f: MediaGalleryFilters) => {
            const src = imagesRef.current
            const res = await apiService.listImageJobs({
                status: 'completed',
                limit: pageSize,
                offset: src.offset,
                cardType: f.card ? f.card.type : f.cardType !== 'all' ? f.cardType : undefined,
                cardId: f.card?.id,
            })
            src.buffer.push(...res.items.flatMap(imageJobToItems))
            src.offset = res.next_offset ?? src.offset
            src.done = res.next_offset == null
        },
        [pageSize],
    )

    const fetchThemesPage = useCallback(
        async (f: MediaGalleryFilters) => {
            const src = themesRef.current
            const res = await apiService.listUserThemeSongs({
                status: 'completed',
                limit: pageSize,
                offset: src.offset,
                targetType: f.card ? f.card.type : f.cardType !== 'all' ? f.cardType : undefined,
                targetId: f.card?.id,
            })
            src.buffer.push(...res.items.map(themeJobToItem).filter((item) => item !== null))
            src.offset = res.next_offset ?? src.offset
            src.done = res.next_offset == null
        },
        [pageSize],
    )

    /**
     * Pop up to `pageSize` items, newest first, refilling whichever source runs
     * its buffer dry (while not exhausted) before each comparison.
     */
    const emitPage = useCallback(
        async (f: MediaGalleryFilters): Promise<MediaGalleryItem[]> => {
            const out: MediaGalleryItem[] = []
            const images = imagesRef.current
            const themes = themesRef.current
            while (out.length < pageSize) {
                const refills: Promise<void>[] = []
                if (!images.done && images.buffer.length === 0) refills.push(fetchImagesPage(f))
                if (!themes.done && themes.buffer.length === 0) refills.push(fetchThemesPage(f))
                if (refills.length > 0) {
                    await Promise.all(refills)
                    continue
                }
                const img = images.buffer[0]
                const theme = themes.buffer[0]
                if (!img && !theme) break
                const takeImage = img && (!theme || img.createdAt >= theme.createdAt)
                out.push(takeImage ? images.buffer.shift()! : themes.buffer.shift()!)
            }
            return out
        },
        [pageSize, fetchImagesPage, fetchThemesPage],
    )

    const sourcesHaveMore = () =>
        imagesRef.current.buffer.length > 0 ||
        themesRef.current.buffer.length > 0 ||
        !imagesRef.current.done ||
        !themesRef.current.done

    const fetchPage = useCallback(
        async (reset: boolean, f: MediaGalleryFilters) => {
            const seq = ++seqRef.current
            if (reset) {
                imagesRef.current = newSource(f.mediaType === 'themes')
                themesRef.current = newSource(f.mediaType === 'images')
                setLoading(true)
            } else {
                setLoadingMore(true)
            }
            setError(null)
            try {
                const page = await emitPage(f)
                if (seq !== seqRef.current) return
                setHasMore(sourcesHaveMore())
                setItems((prev) => (reset ? page : appendDedupedById(prev, page)))
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
        [emitPage],
    )

    // Mount + every filter change → reset & refetch.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void fetchPage(true, filters)
    }, [fetchPage, filters])

    const loadMore = useCallback(() => {
        if (loading || loadingMore || !hasMore) return
        void fetchPage(false, filters)
    }, [fetchPage, filters, loading, loadingMore, hasMore])

    const refresh = useCallback(() => {
        void fetchPage(true, filters)
    }, [fetchPage, filters])

    const removeItem = useCallback((id: string) => {
        setItems((prev) => prev.filter((item) => item.id !== id))
        // Also purge not-yet-emitted copies so the next page can't resurrect it.
        imagesRef.current.buffer = imagesRef.current.buffer.filter((item) => item.id !== id)
        themesRef.current.buffer = themesRef.current.buffer.filter((item) => item.id !== id)
    }, [])

    const setMediaType = useCallback((mediaType: MediaTypeFilter) => {
        setFilters((prev) => (prev.mediaType === mediaType ? prev : { ...prev, mediaType }))
    }, [])

    const setCardType = useCallback((cardType: CardTypeFilter) => {
        setFilters((prev) =>
            prev.cardType === cardType && !prev.card ? prev : { ...prev, cardType, card: undefined },
        )
    }, [])

    const setCard = useCallback((card: CardRef | undefined) => {
        setFilters((prev) => {
            if (prev.card?.id === card?.id && prev.card?.type === card?.type) return prev
            // Clearing the card keeps the type scope; picking one narrows to its type.
            return { ...prev, card, cardType: card ? card.type : prev.cardType }
        })
    }, [])

    const clearFilters = useCallback(() => {
        setFilters((prev) =>
            prev.mediaType === 'all' && prev.cardType === 'all' && !prev.card ? prev : DEFAULT_FILTERS,
        )
    }, [])

    return {
        items,
        filters,
        setMediaType,
        setCardType,
        setCard,
        clearFilters,
        loading,
        loadingMore,
        hasMore,
        error,
        loadMore,
        refresh,
        removeItem,
    }
}
