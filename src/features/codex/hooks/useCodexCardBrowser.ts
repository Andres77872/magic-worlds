/**
 * useCodexCardBrowser — the Codex card picker's paged browse of one
 * workspace's library (Workspace R1): one card kind at a time, optional search
 * and collection filter, offset paging driven by the server `total`.
 *
 * Any change of kind, search, collection or workspace restarts from offset 0;
 * a page that arrives for older parameters, or after a workspace switch, is
 * ignored.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import type { ApiService } from '@/infrastructure/api'
import type { Collection } from '@/shared'
import { useScopedApi } from '@/shared/hooks/useScopedApi'
import { libraryItemToOption, type CardPickerOption } from '@/features/gallery/media/hooks/useCardPickerOptions'
import type { CodexLibraryCardKind } from '../utils/codexUtils'

export const CODEX_PICKER_PAGE_SIZE = 24
const SEARCH_DEBOUNCE_MS = 300

interface CodexCardBrowserOptions {
    /** The workspace to browse; default the committed workspace. */
    workspaceId?: string | null
    kind: CodexLibraryCardKind
    query: string
    /** A collection of that workspace; omitted = every card. */
    collectionId?: string
    enabled: boolean
}

export interface CodexCardBrowser {
    options: CardPickerOption[]
    /** The workspace's collections, for the collection filter. */
    collections: Collection[]
    /** Matching cards on the server. */
    total: number
    loading: boolean
    loadingMore: boolean
    hasMore: boolean
    error: string | null
    loadMore: () => void
}

interface PageRequest {
    api: ApiService
    workspaceId: string
    kind: CodexLibraryCardKind
    q?: string
    collectionId?: string
}

function appendDeduped(prev: CardPickerOption[], page: CardPickerOption[]): CardPickerOption[] {
    const seen = new Set(prev.map((option) => `${option.type}:${option.id}`))
    return [...prev, ...page.filter((option) => !seen.has(`${option.type}:${option.id}`))]
}

export function useCodexCardBrowser({ workspaceId, kind, query, collectionId, enabled }: CodexCardBrowserOptions): CodexCardBrowser {
    const { t } = useTranslation()
    const { selectedWorkspaceId, workspaceEpoch, capture, isCurrent } = useWorkspace()
    const api = useScopedApi(workspaceId)
    const targetWorkspaceId = workspaceId ?? selectedWorkspaceId

    const [options, setOptions] = useState<CardPickerOption[]>([])
    const [collections, setCollections] = useState<Collection[]>([])
    const [total, setTotal] = useState(0)
    /** Server offset after the pages loaded so far. */
    const [loaded, setLoaded] = useState(0)
    const [loading, setLoading] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const seqRef = useRef(0)
    const offsetRef = useRef(0)
    // The parameters of the current listing; "Load more" continues exactly it.
    const requestRef = useRef<PageRequest | null>(null)

    // A committed switch drops the previous workspace's cards and collections.
    const [browseEpoch, setBrowseEpoch] = useState(workspaceEpoch)
    if (browseEpoch !== workspaceEpoch) {
        setBrowseEpoch(workspaceEpoch)
        setOptions([])
        setCollections([])
        setTotal(0)
        setLoaded(0)
        setLoading(false)
        setLoadingMore(false)
        setError(null)
    }

    const fetchPage = useCallback(async (request: PageRequest, reset: boolean) => {
        const seq = ++seqRef.current
        const scope = capture()
        const offset = reset ? 0 : offsetRef.current
        if (reset) setLoading(true)
        else setLoadingMore(true)
        setError(null)
        try {
            const page = await request.api.listLibraryCards(request.workspaceId, {
                card_type: request.kind,
                q: request.q,
                collection_id: request.collectionId,
                limit: CODEX_PICKER_PAGE_SIZE,
                offset,
            })
            if (seq !== seqRef.current || !isCurrent(scope)) return
            const next = page.items.map(libraryItemToOption).filter((option) => option !== null)
            offsetRef.current = offset + page.items.length
            setLoaded(offsetRef.current)
            // An empty page ends paging even if rows vanished under the offset.
            setTotal(page.items.length === 0 ? offsetRef.current : page.total)
            setOptions((prev) => (reset ? next : appendDeduped(prev, next)))
        } catch (cause) {
            if (seq !== seqRef.current || !isCurrent(scope)) return
            setError(cause instanceof Error && cause.message ? cause.message : t('workspaceContent.codex.loadFailed'))
            if (reset) {
                setOptions([])
                setTotal(0)
                setLoaded(0)
            }
        } finally {
            if (seq === seqRef.current && isCurrent(scope)) {
                setLoading(false)
                setLoadingMore(false)
            }
        }
    }, [capture, isCurrent, t])

    // Kind / search / collection / workspace change → debounced restart at offset 0.
    useEffect(() => {
        if (!enabled || !api || !targetWorkspaceId) return
        const request: PageRequest = {
            api,
            workspaceId: targetWorkspaceId,
            kind,
            q: query.trim() || undefined,
            collectionId: collectionId || undefined,
        }
        requestRef.current = request
        seqRef.current += 1
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(true)
        const timer = setTimeout(() => void fetchPage(request, true), SEARCH_DEBOUNCE_MS)
        return () => clearTimeout(timer)
    }, [api, collectionId, enabled, fetchPage, kind, query, targetWorkspaceId])

    // The collection filter lists the browsed workspace's collections.
    useEffect(() => {
        if (!enabled || !api || !targetWorkspaceId) return
        const scope = capture()
        let live = true
        api.listCollections(targetWorkspaceId)
            .then((list) => {
                if (live && isCurrent(scope)) setCollections(list.items)
            })
            .catch(() => {
                // The filter falls back to "All cards"; browsing still works.
                if (live && isCurrent(scope)) setCollections([])
            })
        return () => {
            live = false
        }
    }, [api, capture, enabled, isCurrent, targetWorkspaceId])

    const hasMore = !error && loaded < total

    const loadMore = useCallback(() => {
        const request = requestRef.current
        if (!enabled || !request || loading || loadingMore || !hasMore) return
        void fetchPage(request, false)
    }, [enabled, fetchPage, hasMore, loading, loadingMore])

    return { options, collections, total, loading, loadingMore, hasMore, error, loadMore }
}
