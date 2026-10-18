import { useFeatureFlags } from '@/shared/hooks/useFeatureFlags'
import { useCallback, useEffect, useRef, useState } from 'react'
import { i18n } from '@/app/i18n'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import type { LorebookResource } from '@/shared'
import { isLorebookResourcesFeatureEnabled } from '@/shared/featureFlags'
import { useScopedApi } from '@/shared/hooks/useScopedApi'
import { normalizeLorebookResource } from '../lorebookResources'

const PAGE_SIZE = 24
const SEARCH_DEBOUNCE_MS = 300

interface LorebookResourceGalleryOptions {
    enabled?: boolean
    /** The workspace a host captured (e.g. the open lorebook's); defaults to the committed one. */
    workspaceId?: string | null
}

function normalizeList(raw: unknown): LorebookResource[] {
    const source = Array.isArray(raw)
        ? raw
        : raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown[] }).items)
          ? (raw as { items: unknown[] }).items
          : []
    return source
        .map(normalizeLorebookResource)
        .filter((resource): resource is LorebookResource => Boolean(resource))
}

function appendDeduped(prev: LorebookResource[], page: LorebookResource[]): LorebookResource[] {
    const seen = new Set(prev.map((item) => item.id))
    return [...prev, ...page.filter((item) => !seen.has(item.id))]
}

/**
 * Server-paged resources of one workspace (the host's captured one, else the
 * committed one). A committed workspace switch drops the previous pages and
 * paging, refetches from offset 0, and ignores late pages of the previous scope.
 */
export function useLorebookResourceGallery(pageSize = PAGE_SIZE, options: LorebookResourceGalleryOptions = {}) {
    useFeatureFlags()
    const enabled = (options.enabled ?? true) && isLorebookResourcesFeatureEnabled()
    const { workspaceEpoch, capture, isCurrent } = useWorkspace()
    const api = useScopedApi(options.workspaceId)
    const [items, setItems] = useState<LorebookResource[]>([])
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
            const raw = await api.getLorebookResources(skip, pageSize, debouncedQuery || undefined)
            if (seq !== seqRef.current || !isCurrent(scope)) return
            const page = normalizeList(raw)
            skipRef.current = skip + page.length
            setItems((prev) => (reset ? page : appendDeduped(prev, page)))
            setHasMore(page.length === pageSize)
        } catch (e) {
            if (seq !== seqRef.current || !isCurrent(scope)) return
            setError(e instanceof Error ? e.message : i18n.t('lorebookResourcesGallery.errors.loadFailed'))
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

    const upsertItem = useCallback((resource: LorebookResource) => {
        setItems((prev) => {
            const index = prev.findIndex((item) => item.id === resource.id)
            if (index < 0) return [resource, ...prev]
            return prev.map((item) => (item.id === resource.id ? resource : item))
        })
    }, [])

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
        searching: enabled && (query.trim() !== debouncedQuery || (loading && debouncedQuery !== '')),
        loading,
        loadingMore,
        hasMore,
        error,
        loadMore,
        refresh: () => {
            if (enabled) void fetchPage(true)
        },
        upsertItem,
        removeItem,
    }
}
