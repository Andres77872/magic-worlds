/**
 * useMediaGallery — server-driven state for the media gallery: a merge over two
 * independently paginated sources (images + theme songs), with media-type /
 * card-type / specific-card filters and local removal sync.
 *
 * Workspace R1 — two modes, both on the committed workspace:
 * - discovery (no card-type and no card filter) pages the workspace media
 *   associations per kind (`listWorkspaceMedia`, offset paging against
 *   `total`). The projection has no timestamps, so the two kinds interleave
 *   round-robin;
 * - card-filtered views page the job histories (`listImageJobs`,
 *   `listUserThemeSongs`, filtered by the job's origin workspace) through the
 *   scoped client and merge newest-first.
 * A committed workspace switch resets filters and feed and refetches from
 * offset 0; pages of the previous workspace are ignored.
 *
 * Pagination model: each source keeps a private buffer + server offset + done
 * flag. Emitting a page repeatedly refills any empty-but-not-done buffer, then
 * pops the next head — chronologically correct across page boundaries for job
 * histories, unlike concatenate-then-sort. Asset-level deletes don't rewind
 * job-level server offsets (one image job may hold several assets); dedupe on
 * append covers the rare boundary repeat — the same trade-off
 * MediaHistoryDrawer accepts.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { i18n } from '@/app/i18n'
import { useWorkspace, type WorkspaceScopeCapture } from '@/app/hooks/useWorkspace'
import type { ApiService } from '@/infrastructure/api'
import type { WorkspaceMediaKind } from '@/shared'
import { parseApiTimestamp } from '@/utils/time'
import {
    imageJobToItems,
    themeJobToItem,
    workspaceImageToItem,
    workspaceThemeToItem,
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

export interface MediaGalleryOptions {
    enabled?: boolean
}

interface SourceState {
    buffer: MediaGalleryItem[]
    offset: number
    done: boolean
}

/** What one feed load reads: the committed workspace's client, captured when it started. */
interface FeedContext {
    api: ApiService
    workspaceId: string
    scope: WorkspaceScopeCapture | null
    /** No card-type and no card filter: the workspace media associations. */
    discovery: boolean
}

function newSource(done = false): SourceState {
    return { buffer: [], offset: 0, done }
}

function appendDedupedById(prev: MediaGalleryItem[], page: MediaGalleryItem[]): MediaGalleryItem[] {
    const seen = new Set(prev.map((item) => item.id))
    return [...prev, ...page.filter((item) => !seen.has(item.id))]
}

function createdTime(item?: MediaGalleryItem): number {
    if (!item?.createdAt) return Number.NEGATIVE_INFINITY
    const stamp = parseApiTimestamp(item.createdAt)
    return Number.isNaN(stamp) ? Number.NEGATIVE_INFINITY : stamp
}

const DEFAULT_FILTERS: MediaGalleryFilters = { mediaType: 'all', cardType: 'all' }

function isDiscovery(f: MediaGalleryFilters): boolean {
    return f.cardType === 'all' && !f.card
}

/** One offset page of the workspace's media associations of one kind. */
async function fetchWorkspaceMediaPage(
    kind: Extract<WorkspaceMediaKind, 'image' | 'theme_song'>,
    src: SourceState,
    feed: FeedContext,
    pageSize: number,
): Promise<void> {
    const res = await feed.api.listWorkspaceMedia(feed.workspaceId, { media_kind: kind, limit: pageSize, offset: src.offset })
    const page: Array<MediaGalleryItem | null> = res.items.map((media) =>
        kind === 'image' ? workspaceImageToItem(media) : workspaceThemeToItem(media))
    src.buffer.push(...page.filter((item) => item !== null))
    src.offset += res.items.length
    src.done = res.items.length === 0 || src.offset >= res.total
}

export function useMediaGallery(pageSize = MEDIA_PAGE_SIZE, options: MediaGalleryOptions = {}): MediaGallery {
    const enabled = options.enabled ?? true
    const { api, selectedWorkspaceId, workspaceEpoch, capture, isCurrent } = useWorkspace()
    const [items, setItems] = useState<MediaGalleryItem[]>([])
    const [filters, setFilters] = useState<MediaGalleryFilters>(DEFAULT_FILTERS)
    const [loading, setLoading] = useState(enabled)
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Stale-response guard: each load takes a ticket; only the latest commits.
    const seqRef = useRef(0)
    const imagesRef = useRef<SourceState>(newSource())
    const themesRef = useRef<SourceState>(newSource())
    // The feed being paged; "load more" continues it with the same client.
    const feedRef = useRef<FeedContext | null>(null)
    // Round-robin turn for discovery (no timestamps to merge by); survives page boundaries.
    const imageTurnRef = useRef(true)

    // A committed switch: the previous workspace's feed, filters and paging are dropped.
    const [feedEpoch, setFeedEpoch] = useState(workspaceEpoch)
    if (feedEpoch !== workspaceEpoch) {
        setFeedEpoch(workspaceEpoch)
        setFilters(DEFAULT_FILTERS)
        setItems([])
        setHasMore(false)
        setLoadingMore(false)
        setError(null)
        setLoading(enabled)
    }

    useEffect(() => {
        if (enabled) return
        seqRef.current += 1
        imagesRef.current = newSource()
        themesRef.current = newSource()
        setItems([])
        setLoading(false)
        setLoadingMore(false)
        setHasMore(false)
        setError(null)
    }, [enabled])

    const fetchImagesPage = useCallback(
        async (f: MediaGalleryFilters, src: SourceState, feed: FeedContext) => {
            if (feed.discovery) return fetchWorkspaceMediaPage('image', src, feed, pageSize)
            const res = await feed.api.listImageJobs({
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
        async (f: MediaGalleryFilters, src: SourceState, feed: FeedContext) => {
            if (feed.discovery) return fetchWorkspaceMediaPage('theme_song', src, feed, pageSize)
            const res = await feed.api.listUserThemeSongs({
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
     * Pop up to `pageSize` items, refilling whichever source runs its buffer dry
     * (while not exhausted) before each comparison: newest first for job
     * histories, alternating kinds for workspace discovery.
     */
    const emitPage = useCallback(
        async (f: MediaGalleryFilters, seq: number, feed: FeedContext): Promise<MediaGalleryItem[]> => {
            const out: MediaGalleryItem[] = []
            const images = imagesRef.current
            const themes = themesRef.current
            const live = () => seq === seqRef.current && isCurrent(feed.scope)
            // Keep this load's buffers together and stop before any further refill when
            // a refresh, filter change, workspace switch, or unmount has invalidated the request.
            while (live() && out.length < pageSize) {
                const refills: Promise<void>[] = []
                if (!images.done && images.buffer.length === 0) refills.push(fetchImagesPage(f, images, feed))
                if (!themes.done && themes.buffer.length === 0) refills.push(fetchThemesPage(f, themes, feed))
                if (refills.length > 0) {
                    await Promise.all(refills)
                    continue
                }
                const img = images.buffer[0]
                const theme = themes.buffer[0]
                if (!img && !theme) break
                const takeImage = img && (!theme || (feed.discovery ? imageTurnRef.current : createdTime(img) >= createdTime(theme)))
                if (feed.discovery && img && theme) imageTurnRef.current = !imageTurnRef.current
                out.push(takeImage ? images.buffer.shift()! : themes.buffer.shift()!)
            }
            return out
        },
        [pageSize, fetchImagesPage, fetchThemesPage, isCurrent],
    )

    const sourcesHaveMore = () =>
        imagesRef.current.buffer.length > 0 ||
        themesRef.current.buffer.length > 0 ||
        !imagesRef.current.done ||
        !themesRef.current.done

    const fetchPage = useCallback(
        async (reset: boolean, f: MediaGalleryFilters) => {
            if (!enabled) return
            const feed: FeedContext | null = reset
                ? (api && selectedWorkspaceId ? { api, workspaceId: selectedWorkspaceId, scope: capture(), discovery: isDiscovery(f) } : null)
                : feedRef.current
            if (!feed) return
            const seq = ++seqRef.current
            if (reset) {
                feedRef.current = feed
                imagesRef.current = newSource(f.mediaType === 'themes')
                themesRef.current = newSource(f.mediaType === 'images')
                imageTurnRef.current = true
                setLoading(true)
            } else {
                setLoadingMore(true)
            }
            setError(null)
            const current = () => seq === seqRef.current && isCurrent(feed.scope)
            try {
                const page = await emitPage(f, seq, feed)
                if (!current()) return
                setHasMore(sourcesHaveMore())
                setItems((prev) => (reset ? page : appendDedupedById(prev, page)))
            } catch (e) {
                if (!current()) return
                setError(e instanceof Error ? e.message : i18n.t('mediaGallery.error.loadFailed'))
                if (reset) setItems([])
                setHasMore(false)
            } finally {
                if (current()) {
                    setLoading(false)
                    setLoadingMore(false)
                }
            }
        },
        [api, capture, emitPage, enabled, isCurrent, selectedWorkspaceId],
    )

    // Mount + every filter change + every committed workspace (new client) → reset & refetch from offset 0.
    useEffect(() => {
        if (!enabled) return
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void fetchPage(true, filters)
        return () => { seqRef.current += 1 }
    }, [enabled, fetchPage, filters])

    const loadMore = useCallback(() => {
        if (!enabled || loading || loadingMore || !hasMore) return
        void fetchPage(false, filters)
    }, [enabled, fetchPage, filters, loading, loadingMore, hasMore])

    const refresh = useCallback(() => {
        if (!enabled) return
        void fetchPage(true, filters)
    }, [enabled, fetchPage, filters])

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
