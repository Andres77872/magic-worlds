import { useCallback, useEffect, useRef, useState } from 'react'
import { apiService } from '@/infrastructure/api'
import type { Lorebook } from '@/shared'
import { normalizeLorebookList } from '../lorebookTransforms'

const PAGE_SIZE = 24
const SEARCH_DEBOUNCE_MS = 300

function appendDeduped(prev: Lorebook[], page: Lorebook[]): Lorebook[] {
    const seen = new Set(prev.map((item) => item.id))
    return [...prev, ...page.filter((item) => !seen.has(item.id))]
}

export function useLorebookGallery(pageSize = PAGE_SIZE) {
    const [items, setItems] = useState<Lorebook[]>([])
    const [query, setQuery] = useState('')
    const [debouncedQuery, setDebouncedQuery] = useState('')
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const skipRef = useRef(0)
    const seqRef = useRef(0)

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS)
        return () => clearTimeout(timer)
    }, [query])

    const fetchPage = useCallback(async (reset: boolean) => {
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
            setError(e instanceof Error ? e.message : 'Failed to load lorebooks')
            if (reset) setItems([])
            setHasMore(false)
        } finally {
            if (seq === seqRef.current) {
                setLoading(false)
                setLoadingMore(false)
            }
        }
    }, [debouncedQuery, pageSize])

    useEffect(() => {
        void fetchPage(true)
    }, [fetchPage])

    const loadMore = useCallback(() => {
        if (loading || loadingMore || !hasMore) return
        void fetchPage(false)
    }, [fetchPage, hasMore, loading, loadingMore])

    const removeItem = useCallback((id: string) => {
        setItems((prev) => {
            const next = prev.filter((item) => item.id !== id)
            if (next.length !== prev.length) skipRef.current = Math.max(0, skipRef.current - 1)
            return next
        })
    }, [])

    return {
        items,
        query,
        setQuery,
        searching: query.trim() !== debouncedQuery || (loading && debouncedQuery !== ''),
        loading,
        loadingMore,
        hasMore,
        error,
        loadMore,
        refresh: () => void fetchPage(true),
        removeItem,
    }
}
