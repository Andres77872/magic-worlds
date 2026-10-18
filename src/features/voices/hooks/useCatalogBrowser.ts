/**
 * The catalog browser behind the picker's "Voices" tab (R1-FE-01, D35, 08 §5.1).
 *
 * - Pages of 24 (`limit` never above 50) with "Load more" via `next_cursor`;
 *   appended pages are de-duplicated by `voice_key`, and a second `loadMore`
 *   while one is in flight is ignored.
 * - The search text is debounced 300 ms; any filter change starts a new list.
 * - Latest wins: every new list bumps a sequence number and aborts the requests
 *   of the list it replaces (first page and "Load more"), so a late page of an
 *   older query (or an older cursor) is dropped. Disabling (a closed picker) and
 *   unmounting do the same.
 * - "Recommended for this character" sends `recommended_for=<card id>` through
 *   the card's own workspace client (the BFF answers 422 without the selector
 *   and 404 from another workspace); a public card uses the unscoped client.
 *   A 422 or 404 on that filter switches it off silently and reloads without it.
 * - A 404 without it is `error: 'unavailable'`, which the picker shows as the
 *   catalog being unavailable (no fallback list).
 * - The language filter starts at `defaultLanguage` (05 §7.3: the user's
 *   preferred language, or the card's when known) until the user picks one or
 *   "Any"; while `defaultsPending` the first page waits, so it is the filtered
 *   one. "Show locked" (`include_locked`) is sent only when off (server default true).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiService } from '@/infrastructure/api'
import type { CatalogPage, CatalogQuery, CatalogVoice } from '@/shared'

export const CATALOG_BROWSER_PAGE_SIZE = 24
export const CATALOG_SEARCH_DEBOUNCE_MS = 300
/** The BFF accepts at most 20 tags per query. */
export const CATALOG_MAX_TAGS = 20

export interface CatalogRecommendationTarget {
    cardId: string
    /** The card's workspace; null for a card without one (public cards use the unscoped client). */
    workspaceId: string | null
}

export type CatalogBrowserError = 'unavailable' | 'failed'

/** Editable filters: everything but the cursor, the page size and `recommended_for` (a toggle). */
export type CatalogFilters = Omit<CatalogQuery, 'limit' | 'recommended_for' | 'works_in_calls' | 'accent'>

interface ListState {
    items: CatalogVoice[]
    nextCursor: string | null
    loading: boolean
    loadingMore: boolean
    error: CatalogBrowserError | null
}

const INITIAL: ListState = { items: [], nextCursor: null, loading: false, loadingMore: false, error: null }

function statusOf(error: unknown): number | null {
    const status = (error as { status?: unknown } | null)?.status
    return typeof status === 'number' ? status : null
}

function appendUnique(current: CatalogVoice[], next: CatalogVoice[]): CatalogVoice[] {
    const seen = new Set(current.map((item) => item.voice_key))
    const added = next.filter((item) => {
        if (seen.has(item.voice_key)) return false
        seen.add(item.voice_key)
        return true
    })
    return added.length > 0 ? [...current, ...added] : current
}

export interface UseCatalogBrowserOptions {
    enabled?: boolean
    initialFilters?: CatalogFilters
    recommendedFor?: CatalogRecommendationTarget | null
    /** The language filter until the user changes it (05 §7.3). */
    defaultLanguage?: string | null
    /** The default language is still being read: hold the first page until it settles. */
    defaultsPending?: boolean
    /** Only voices that can speak on a call (`works_in_calls`), for the call voice picker. */
    worksInCalls?: boolean
}

export function useCatalogBrowser({
    enabled = true,
    initialFilters = {},
    recommendedFor = null,
    defaultLanguage = null,
    defaultsPending = false,
    worksInCalls = false,
}: UseCatalogBrowserOptions = {}) {
    const [filterState, setFilterState] = useState<CatalogFilters>(initialFilters)
    /** The user chose a language or "Any": the default no longer applies. */
    const [languageTouched, setLanguageTouched] = useState(false)
    const filters = useMemo<CatalogFilters>(
        () => (languageTouched || filterState.language || !defaultLanguage ? filterState : { ...filterState, language: defaultLanguage }),
        [defaultLanguage, filterState, languageTouched],
    )
    const waiting = defaultsPending && !languageTouched && !filterState.language
    const [debouncedQ, setDebouncedQ] = useState(initialFilters.q ?? '')
    const [recommended, setRecommendedState] = useState(false)
    const [attempt, setAttempt] = useState(0)
    const [list, setList] = useState<ListState>(INITIAL)
    const seq = useRef(0)
    const loadingMore = useRef(false)
    /** Aborts every request of the current list (its first page and any "Load more"). */
    const listAbort = useRef<AbortController | null>(null)
    const recommendationCard = recommendedFor?.cardId ?? null
    const recommendationWorkspace = recommendedFor?.workspaceId ?? null
    const recommending = recommended && Boolean(recommendationCard)

    useEffect(() => {
        const handle = setTimeout(() => setDebouncedQ(filters.q ?? ''), CATALOG_SEARCH_DEBOUNCE_MS)
        return () => clearTimeout(handle)
    }, [filters.q])

    const query = useMemo<CatalogQuery>(() => {
        const tags = (filters.tags ?? []).slice(0, CATALOG_MAX_TAGS)
        return {
            ...filters,
            q: debouncedQ.trim() || undefined,
            tags: tags.length > 0 ? tags : undefined,
            limit: CATALOG_BROWSER_PAGE_SIZE,
            ...(recommending && recommendationCard ? { recommended_for: recommendationCard } : {}),
            ...(worksInCalls ? { works_in_calls: true } : {}),
        }
    }, [filters, debouncedQ, recommending, recommendationCard, worksInCalls])
    const queryKey = JSON.stringify(query)

    const fetchPage = useCallback((page: CatalogQuery, cursor: string | null, signal: AbortSignal): Promise<CatalogPage> => {
        const scoped = page.recommended_for && recommendationWorkspace && typeof apiService.withWorkspace === 'function'
            ? apiService.withWorkspace(recommendationWorkspace)
            : apiService
        return scoped.listVoiceCatalog(page, cursor, { signal })
    }, [recommendationWorkspace])

    useEffect(() => {
        if (!enabled || waiting || typeof apiService.listVoiceCatalog !== 'function') return
        const mine = ++seq.current
        loadingMore.current = false
        const abort = new AbortController()
        listAbort.current = abort
        const page = JSON.parse(queryKey) as CatalogQuery
        /* eslint-disable-next-line react-hooks/set-state-in-effect -- a new list starts loading (backend sync) */
        setList((current) => ({ ...current, items: [], nextCursor: null, loading: true, loadingMore: false, error: null }))
        void Promise.resolve()
            .then(() => fetchPage(page, null, abort.signal))
            .then((result) => {
                if (mine !== seq.current) return
                setList({ items: appendUnique([], result.items), nextCursor: result.next_cursor, loading: false, loadingMore: false, error: null })
            })
            .catch((error: unknown) => {
                if (mine !== seq.current) return
                const status = statusOf(error)
                if (page.recommended_for && (status === 422 || status === 404)) {
                    // The card cannot be recommended for here: drop the filter, keep browsing.
                    setRecommendedState(false)
                    return
                }
                setList({ ...INITIAL, error: status === 404 ? 'unavailable' : 'failed' })
            })
        return () => {
            // Superseded, disabled or unmounted: nothing of this list may land any more.
            seq.current += 1
            loadingMore.current = false
            abort.abort()
            if (listAbort.current === abort) listAbort.current = null
        }
    }, [enabled, waiting, queryKey, attempt, fetchPage])

    const loadMore = useCallback(() => {
        const cursor = list.nextCursor
        const signal = listAbort.current?.signal
        if (!enabled || waiting || !cursor || !signal || list.loading || loadingMore.current) return
        loadingMore.current = true
        const mine = seq.current
        const page = JSON.parse(queryKey) as CatalogQuery
        setList((current) => ({ ...current, loadingMore: true }))
        void Promise.resolve()
            .then(() => fetchPage(page, cursor, signal))
            .then((result) => {
                if (mine !== seq.current) return
                setList((current) => ({ ...current, items: appendUnique(current.items, result.items), nextCursor: result.next_cursor, loadingMore: false, error: null }))
            })
            .catch(() => {
                if (mine !== seq.current) return
                setList((current) => ({ ...current, loadingMore: false, error: 'failed' }))
            })
            .finally(() => {
                if (mine === seq.current) loadingMore.current = false
            })
    }, [enabled, waiting, fetchPage, list.loading, list.nextCursor, queryKey])

    const setFilters = useCallback((patch: Partial<CatalogFilters>) => {
        if ('language' in patch) setLanguageTouched(true)
        setFilterState((current) => ({ ...current, ...patch }))
    }, [])

    const setRecommended = useCallback((value: boolean) => setRecommendedState(value && Boolean(recommendationCard)), [recommendationCard])

    const retry = useCallback(() => setAttempt((value) => value + 1), [])

    return {
        filters,
        setFilters,
        recommended: recommending,
        canRecommend: Boolean(recommendationCard),
        setRecommended,
        items: list.items,
        nextCursor: list.nextCursor,
        // Waiting for the default language reads as loading: the first page has not been asked for yet.
        loading: list.loading || (enabled && waiting),
        loadingMore: list.loadingMore,
        error: list.error,
        loadMore,
        retry,
    }
}

export type CatalogBrowser = ReturnType<typeof useCatalogBrowser>
