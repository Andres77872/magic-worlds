import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CATALOG_ELDRIN, CATALOG_MAREN_HOUSE, CATALOG_SELA_LEAVING, CATALOG_TOBIAS_LOCKED } from '../fixtures'
import { CATALOG_BROWSER_PAGE_SIZE, useCatalogBrowser } from './useCatalogBrowser'

const listVoiceCatalog = vi.fn()
const scopedListVoiceCatalog = vi.fn()
const withWorkspace = vi.fn()

vi.mock('@/infrastructure/api', () => ({
    apiService: {
        listVoiceCatalog: (...args: unknown[]) => listVoiceCatalog(...args),
        withWorkspace: (...args: unknown[]) => withWorkspace(...args),
    },
}))

const notFound = () => Object.assign(new Error('Not Found'), { status: 404 })
const withSignal = expect.objectContaining({ signal: expect.any(AbortSignal) })
const signalOf = (mock: ReturnType<typeof vi.fn>, call: number) => (mock.mock.calls[call][2] as { signal: AbortSignal }).signal

describe('useCatalogBrowser (R1-FE-01)', () => {
    beforeEach(() => {
        listVoiceCatalog.mockReset().mockResolvedValue({ items: [CATALOG_ELDRIN, CATALOG_MAREN_HOUSE], next_cursor: 'c2' })
        scopedListVoiceCatalog.mockReset().mockResolvedValue({ items: [CATALOG_SELA_LEAVING], next_cursor: null })
        withWorkspace.mockReset().mockReturnValue({ listVoiceCatalog: scopedListVoiceCatalog })
    })

    it('asks for pages of 24 and appends the next page by cursor, de-duplicated', async () => {
        const { result } = renderHook(() => useCatalogBrowser())
        await waitFor(() => expect(result.current.items).toHaveLength(2))
        expect(listVoiceCatalog).toHaveBeenCalledWith(expect.objectContaining({ limit: CATALOG_BROWSER_PAGE_SIZE }), null, withSignal)
        expect(CATALOG_BROWSER_PAGE_SIZE).toBe(24)
        expect(result.current.nextCursor).toBe('c2')

        listVoiceCatalog.mockResolvedValueOnce({ items: [CATALOG_MAREN_HOUSE, CATALOG_TOBIAS_LOCKED], next_cursor: null })
        act(() => result.current.loadMore())
        // A second loadMore while one is in flight is ignored.
        act(() => result.current.loadMore())
        await waitFor(() => expect(result.current.items).toHaveLength(3))
        expect(listVoiceCatalog).toHaveBeenCalledTimes(2)
        expect(listVoiceCatalog).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 24 }), 'c2', withSignal)
        expect(result.current.items.map((item) => item.display_name)).toEqual(['Eldrin', 'Maren', 'Tobias'])
        expect(result.current.nextCursor).toBeNull()
    })

    it('debounces the search text and sends at most 20 tags', async () => {
        const { result } = renderHook(() => useCatalogBrowser())
        await waitFor(() => expect(listVoiceCatalog).toHaveBeenCalledTimes(1))
        act(() => result.current.setFilters({ q: 'war' }))
        act(() => result.current.setFilters({ q: 'warm ' }))
        expect(listVoiceCatalog).toHaveBeenCalledTimes(1)
        await waitFor(() => expect(listVoiceCatalog).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'warm' }), null, withSignal), { timeout: 1500 })
        expect(listVoiceCatalog).toHaveBeenCalledTimes(2)

        act(() => result.current.setFilters({ tags: Array.from({ length: 25 }, (_, index) => `tag${index}`) }))
        await waitFor(() => expect(listVoiceCatalog).toHaveBeenCalledTimes(3))
        expect((listVoiceCatalog.mock.lastCall?.[0] as { tags: string[] }).tags).toHaveLength(20)
        const query = listVoiceCatalog.mock.lastCall?.[0] as Record<string, unknown>
        expect(query).not.toHaveProperty('accent')
        expect(query).not.toHaveProperty('works_in_calls')
    })

    it('drops a late page of an older query', async () => {
        let resolveOld: (page: unknown) => void = () => undefined
        listVoiceCatalog
            .mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve }))
            .mockResolvedValueOnce({ items: [CATALOG_TOBIAS_LOCKED], next_cursor: null })
        const { result } = renderHook(() => useCatalogBrowser())
        await waitFor(() => expect(listVoiceCatalog).toHaveBeenCalledTimes(1))
        act(() => result.current.setFilters({ language: 'es' }))
        await waitFor(() => expect(result.current.items.map((item) => item.display_name)).toEqual(['Tobias']))
        resolveOld({ items: [CATALOG_ELDRIN], next_cursor: 'stale' })
        await Promise.resolve()
        expect(result.current.items.map((item) => item.display_name)).toEqual(['Tobias'])
        expect(result.current.nextCursor).toBeNull()
        // The superseded request was aborted, not just ignored.
        expect(signalOf(listVoiceCatalog, 0).aborted).toBe(true)
        expect(signalOf(listVoiceCatalog, 1).aborted).toBe(false)
    })

    it('aborts an in-flight "Load more" when a new list starts', async () => {
        const { result } = renderHook(() => useCatalogBrowser())
        await waitFor(() => expect(result.current.nextCursor).toBe('c2'))
        listVoiceCatalog.mockImplementationOnce(() => new Promise(() => undefined))
        act(() => result.current.loadMore())
        await waitFor(() => expect(listVoiceCatalog).toHaveBeenCalledTimes(2))
        const more = signalOf(listVoiceCatalog, 1)
        act(() => result.current.setFilters({ language: 'es' }))
        await waitFor(() => expect(listVoiceCatalog).toHaveBeenCalledTimes(3))
        expect(more.aborted).toBe(true)
    })

    it('aborts and drops a first page that lands after the picker closes', async () => {
        let resolveLate: (page: unknown) => void = () => undefined
        listVoiceCatalog.mockImplementationOnce(() => new Promise((resolve) => { resolveLate = resolve }))
        const { result, rerender } = renderHook(({ enabled }) => useCatalogBrowser({ enabled }), { initialProps: { enabled: true } })
        await waitFor(() => expect(listVoiceCatalog).toHaveBeenCalledTimes(1))
        rerender({ enabled: false })
        expect(signalOf(listVoiceCatalog, 0).aborted).toBe(true)
        await act(async () => {
            resolveLate({ items: [CATALOG_ELDRIN], next_cursor: 'late' })
            await Promise.resolve()
        })
        expect(result.current.items).toEqual([])
        expect(result.current.nextCursor).toBeNull()
    })

    it('sends recommended_for through the card workspace client', async () => {
        const { result } = renderHook(() => useCatalogBrowser({ recommendedFor: { cardId: 'card-1', workspaceId: 'ws-1' } }))
        await waitFor(() => expect(listVoiceCatalog).toHaveBeenCalledTimes(1))
        expect(result.current.canRecommend).toBe(true)
        act(() => result.current.setRecommended(true))
        await waitFor(() => expect(scopedListVoiceCatalog).toHaveBeenCalledTimes(1))
        expect(withWorkspace).toHaveBeenCalledWith('ws-1')
        expect(scopedListVoiceCatalog).toHaveBeenCalledWith(expect.objectContaining({ recommended_for: 'card-1' }), null, withSignal)
        await waitFor(() => expect(result.current.items.map((item) => item.display_name)).toEqual(['Sela']))
    })

    it('turns the recommendation off when the server refuses it (422 or 404)', async () => {
        scopedListVoiceCatalog.mockRejectedValueOnce(Object.assign(new Error('Unprocessable'), { status: 422 }))
        const { result } = renderHook(() => useCatalogBrowser({ recommendedFor: { cardId: 'card-1', workspaceId: 'ws-1' } }))
        await waitFor(() => expect(listVoiceCatalog).toHaveBeenCalledTimes(1))
        act(() => result.current.setRecommended(true))
        await waitFor(() => expect(result.current.recommended).toBe(false))
        await waitFor(() => expect(listVoiceCatalog).toHaveBeenCalledTimes(2))
        expect(result.current.error).toBeNull()
    })

    it('never recommends without a card', () => {
        const { result } = renderHook(() => useCatalogBrowser())
        act(() => result.current.setRecommended(true))
        expect(result.current.recommended).toBe(false)
        expect(result.current.canRecommend).toBe(false)
    })

    it('reports a 404 as unavailable and other failures as failed, with retry', async () => {
        listVoiceCatalog.mockRejectedValueOnce(notFound())
        const unavailable = renderHook(() => useCatalogBrowser())
        await waitFor(() => expect(unavailable.result.current.error).toBe('unavailable'))

        listVoiceCatalog.mockReset().mockRejectedValueOnce(new Error('down')).mockResolvedValue({ items: [CATALOG_ELDRIN], next_cursor: null })
        const failed = renderHook(() => useCatalogBrowser())
        await waitFor(() => expect(failed.result.current.error).toBe('failed'))
        act(() => failed.result.current.retry())
        await waitFor(() => expect(failed.result.current.items).toHaveLength(1))
        expect(failed.result.current.error).toBeNull()
    })

    it('does nothing while disabled', () => {
        renderHook(() => useCatalogBrowser({ enabled: false }))
        expect(listVoiceCatalog).not.toHaveBeenCalled()
    })

    it('starts on the default language, waits for it, and lets "Any" clear it (05 §7.3)', async () => {
        const { result, rerender } = renderHook((props: { language: string | null; pending: boolean }) => useCatalogBrowser({ defaultLanguage: props.language, defaultsPending: props.pending }), {
            initialProps: { language: null as string | null, pending: true },
        })
        // The first page waits for the preference, so it is the filtered one.
        await act(async () => {})
        expect(listVoiceCatalog).not.toHaveBeenCalled()
        expect(result.current.loading).toBe(true)
        rerender({ language: 'es', pending: false })
        await waitFor(() => expect(listVoiceCatalog).toHaveBeenCalledTimes(1))
        expect(listVoiceCatalog).toHaveBeenCalledWith(expect.objectContaining({ language: 'es' }), null, withSignal)
        expect(result.current.filters.language).toBe('es')

        act(() => result.current.setFilters({ language: undefined }))
        await waitFor(() => expect(listVoiceCatalog).toHaveBeenCalledTimes(2))
        expect(listVoiceCatalog.mock.lastCall?.[0]).not.toHaveProperty('language')
        // The user's "Any" sticks even when the default changes later.
        rerender({ language: 'en', pending: false })
        await act(async () => {})
        expect(listVoiceCatalog).toHaveBeenCalledTimes(2)
        expect(result.current.filters.language).toBeUndefined()
    })

    it('sends include_locked only when locked voices are hidden', async () => {
        const { result } = renderHook(() => useCatalogBrowser())
        await waitFor(() => expect(listVoiceCatalog).toHaveBeenCalledTimes(1))
        expect(listVoiceCatalog.mock.lastCall?.[0]).not.toHaveProperty('include_locked')
        act(() => result.current.setFilters({ include_locked: false }))
        await waitFor(() => expect(listVoiceCatalog).toHaveBeenLastCalledWith(expect.objectContaining({ include_locked: false }), null, withSignal))
    })
})
