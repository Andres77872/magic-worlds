import { useCallback, useEffect, useRef, useState } from 'react'
import { i18n } from '@/app/i18n'
import { apiService } from '@/infrastructure/api'
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

export function useLorebookGallery(pageSize = PAGE_SIZE, options: LorebookGalleryOptions = {}) {
    const enabled = options.enabled ?? true
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

    const fetchPage = useCallback(async (reset: boolean) => {
        if (!enabled) return
        const seq = ++seqRef.current
        const skip = reset ? 0 : skipRef.current
        if (reset) setLoading(true)
        else setLoadingMore(true)
        setError(null)
        try {
            const raw = await apiService.getLorebooks(skip, pageSize, debouncedQuery || undefined)
            if (seq !== seqRef.current) return
            const page = normalizeLorebookList(raw)
            skipRef.current = skip + page.length
            setItems((prev) => (reset ? page : appendDeduped(prev, page)))
            setHasMore(page.length === pageSize)
        } catch (e) {
            if (seq !== seqRef.current) return
            setError(e instanceof Error ? e.message : i18n.t('lorebookGallery.error.loadFailed'))
            if (reset) setItems([])
            setHasMore(false)
        } finally {
            if (seq === seqRef.current) {
                setLoading(false)
                setLoadingMore(false)
            }
        }
    }, [debouncedQuery, enabled, pageSize])

    useEffect(() => {
        if (!enabled) return
        void fetchPage(true)
    }, [enabled, fetchPage])

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
