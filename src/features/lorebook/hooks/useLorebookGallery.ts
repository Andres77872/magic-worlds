import { useCallback, useEffect, useRef, useState } from 'react'
import { i18n } from '@/app/i18n'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import type { Lorebook } from '@/shared'
import { normalizeLorebookList } from '../lorebookTransforms'

const PAGE_SIZE = 24
const SEARCH_DEBOUNCE_MS = 300

interface LorebookGalleryOptions {
    enabled?: boolean
}

function appendDeduped(prev: Lorebook[], page: Lorebook[]): Lorebook[] {
    const seen = new Set(prev.map((item) => item.id))
    return [...prev, ...page.filter((item) => !seen.has(item.id))]
}

/**
 * Server-paged lorebooks of the committed workspace. A committed workspace switch
 * drops the previous workspace's pages and paging, refetches from offset 0, and
 * ignores any page of the previous workspace that arrives late.
 */
export function useLorebookGallery(pageSize = PAGE_SIZE, options: LorebookGalleryOptions = {}) {
    const enabled = options.enabled ?? true
    const { api, workspaceEpoch, capture, isCurrent } = useWorkspace()
    const [items, setItems] = useState<Lorebook[]>([])
    const [query, setQuery] = useState('')
    const [debouncedQuery, setDebouncedQuery] = useState('')
    const [loading, setLoading] = useState(enabled)
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const skipRef = useRef(0)
    const seqRef = useRef(0)

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS)
        return () => clearTimeout(timer)
    }, [query])

    useEffect(() => {
        if (enabled) return
        seqRef.current += 1
        skipRef.current = 0
        setItems([])
        setLoading(false)
        setLoadingMore(false)
        setHasMore(false)
        setError(null)
    }, [enabled])

    // Workspace switch: the previous workspace's pages never mix into the new one.
    const [listEpoch, setListEpoch] = useState(workspaceEpoch)
    if (listEpoch !== workspaceEpoch) {
        setListEpoch(workspaceEpoch)
        setItems([])
        setHasMore(false)
        setLoadingMore(false)
        setError(null)
        if (enabled) setLoading(true)
    }

    const fetchPage = useCallback(async (reset: boolean) => {
        if (!enabled || !api) return
        const scope = capture()
        const seq = ++seqRef.current
        const skip = reset ? 0 : skipRef.current
        if (reset) setLoading(true)
        else setLoadingMore(true)
        setError(null)
        try {
            const raw = await api.getLorebooks(skip, pageSize, debouncedQuery || undefined)
            if (seq !== seqRef.current || !isCurrent(scope)) return
            const page = normalizeLorebookList(raw)
            skipRef.current = skip + page.length
            setItems((prev) => (reset ? page : appendDeduped(prev, page)))
            setHasMore(page.length === pageSize)
        } catch (e) {
            if (seq !== seqRef.current || !isCurrent(scope)) return
            setError(e instanceof Error ? e.message : i18n.t('lorebookGallery.error.loadFailed'))
            if (reset) setItems([])
            setHasMore(false)
        } finally {
            if (seq === seqRef.current && isCurrent(scope)) {
                setLoading(false)
                setLoadingMore(false)
            }
        }
    }, [api, capture, debouncedQuery, enabled, isCurrent, pageSize])

    // A committed switch (new epoch and client) restarts from offset 0.
    useEffect(() => {
        if (!enabled) return
        void fetchPage(true)
    }, [enabled, fetchPage, workspaceEpoch])

    const loadMore = useCallback(() => {
        if (!enabled || loading || loadingMore || !hasMore) return
        void fetchPage(false)
    }, [enabled, fetchPage, hasMore, loading, loadingMore])

    const removeItem = useCallback((id: string) => {
        setItems((prev) => {
            const next = prev.filter((item) => item.id !== id)
            if (next.length !== prev.length) skipRef.current = Math.max(0, skipRef.current - 1)
            return next
        })
    }, [])

    const upsertItem = useCallback((lorebook: Lorebook) => {
        setItems((prev) => {
            const index = prev.findIndex((item) => item.id === lorebook.id)
            if (index < 0) return [lorebook, ...prev]
            return prev.map((item) => (item.id === lorebook.id ? lorebook : item))
        })
    }, [])

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
        refresh: () => {
            if (enabled) void fetchPage(true)
        },
        removeItem,
        upsertItem,
    }
}
