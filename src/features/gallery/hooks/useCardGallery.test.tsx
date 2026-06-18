import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { GalleryItem } from '../galleryConfig'
import { useCardGallery } from './useCardGallery'

const PAGE_SIZE = 2

function makeItem(id: string): GalleryItem {
    return {
        id,
        title: `Item ${id}`,
        tags: [],
        backendType: 'item',
        galleryType: 'item',
        source: { id } as never,
    }
}

/** Config whose fetchPage resolves pre-seeded pages keyed by `skip|q`. */
function makeConfig(pages: Record<string, GalleryItem[]>) {
    const fetchPage = vi.fn(async (skip: number, _limit: number, q?: string) => {
        return pages[`${skip}|${q ?? ''}`] ?? []
    })
    return { fetchPage, toItems: (raw: unknown) => raw as GalleryItem[] }
}

describe('useCardGallery', () => {
    it('fetches the first page on mount and infers hasMore from a full page', async () => {
        const config = makeConfig({ '0|': [makeItem('a'), makeItem('b')] })
        const { result } = renderHook(() => useCardGallery(config, PAGE_SIZE))

        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(config.fetchPage).toHaveBeenCalledWith(0, PAGE_SIZE, undefined)
        expect(result.current.items.map((i) => i.id)).toEqual(['a', 'b'])
        expect(result.current.hasMore).toBe(true)
    })

    it('does not fetch while disabled and resets to an empty idle state', async () => {
        const config = makeConfig({ '0|': [makeItem('a'), makeItem('b')] })
        const { result } = renderHook(() => useCardGallery(config, PAGE_SIZE, { enabled: false }))

        expect(result.current.loading).toBe(false)
        expect(result.current.items).toEqual([])
        expect(result.current.hasMore).toBe(false)
        expect(config.fetchPage).not.toHaveBeenCalled()
    })

    it('reports hasMore=false on a short page', async () => {
        const config = makeConfig({ '0|': [makeItem('a')] })
        const { result } = renderHook(() => useCardGallery(config, PAGE_SIZE))

        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.hasMore).toBe(false)
    })

    it('loadMore appends the next page with an advanced cursor and dedupes by id', async () => {
        const config = makeConfig({
            '0|': [makeItem('a'), makeItem('b')],
            // 'b' repeats (page-boundary shift) and must not duplicate.
            '2|': [makeItem('b'), makeItem('c')],
        })
        const { result } = renderHook(() => useCardGallery(config, PAGE_SIZE))
        await waitFor(() => expect(result.current.loading).toBe(false))

        act(() => result.current.loadMore())
        await waitFor(() => expect(result.current.loadingMore).toBe(false))

        expect(config.fetchPage).toHaveBeenLastCalledWith(2, PAGE_SIZE, undefined)
        expect(result.current.items.map((i) => i.id)).toEqual(['a', 'b', 'c'])
    })

    it('a committed search resets to page 0 with the q param after the debounce', async () => {
        const config = makeConfig({
            '0|': [makeItem('a'), makeItem('b')],
            '0|elf': [makeItem('e')],
        })
        const { result } = renderHook(() => useCardGallery(config, PAGE_SIZE))
        await waitFor(() => expect(result.current.loading).toBe(false))

        act(() => result.current.setQuery('elf'))
        await waitFor(() => expect(config.fetchPage).toHaveBeenLastCalledWith(0, PAGE_SIZE, 'elf'))
        await waitFor(() => expect(result.current.items.map((i) => i.id)).toEqual(['e']))
        expect(result.current.hasMore).toBe(false)
    })

    it('drops stale responses that resolve after a newer fetch', async () => {
        const resolvers: Array<(items: GalleryItem[]) => void> = []
        const fetchPage = vi.fn(
            () => new Promise<GalleryItem[]>((resolve) => resolvers.push(resolve)),
        )
        const config = { fetchPage, toItems: (raw: unknown) => raw as GalleryItem[] }
        const { result } = renderHook(() => useCardGallery(config, PAGE_SIZE))

        // Trigger a second (search) fetch while the mount fetch is in flight.
        act(() => result.current.setQuery('elf'))
        await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2))

        // Newer (search) resolves first, then the stale mount fetch.
        await act(async () => resolvers[1]([makeItem('fresh')]))
        await act(async () => resolvers[0]([makeItem('stale'), makeItem('stale2')]))

        expect(result.current.items.map((i) => i.id)).toEqual(['fresh'])
    })

    it('removeItem drops the card locally and keeps the server cursor aligned', async () => {
        const config = makeConfig({
            '0|': [makeItem('a'), makeItem('b')],
            // After removing one of the first two, the next page starts at 1.
            '1|': [makeItem('b'), makeItem('c')],
        })
        const { result } = renderHook(() => useCardGallery(config, PAGE_SIZE))
        await waitFor(() => expect(result.current.loading).toBe(false))

        act(() => result.current.removeItem('a'))
        expect(result.current.items.map((i) => i.id)).toEqual(['b'])

        act(() => result.current.loadMore())
        await waitFor(() => expect(result.current.loadingMore).toBe(false))
        expect(config.fetchPage).toHaveBeenLastCalledWith(1, PAGE_SIZE, undefined)
        expect(result.current.items.map((i) => i.id)).toEqual(['b', 'c'])
    })

    it('upsertItem prepends a directly loaded card without advancing the cursor', async () => {
        const config = makeConfig({
            '0|': [makeItem('a'), makeItem('b')],
            '2|': [makeItem('c')],
        })
        const { result } = renderHook(() => useCardGallery(config, PAGE_SIZE))
        await waitFor(() => expect(result.current.loading).toBe(false))

        act(() => result.current.upsertItem(makeItem('shared')))
        expect(result.current.items.map((i) => i.id)).toEqual(['shared', 'a', 'b'])

        act(() => result.current.loadMore())
        await waitFor(() => expect(result.current.loadingMore).toBe(false))

        expect(config.fetchPage).toHaveBeenLastCalledWith(2, PAGE_SIZE, undefined)
        expect(result.current.items.map((i) => i.id)).toEqual(['shared', 'a', 'b', 'c'])
    })

    it('surfaces fetch errors without crashing and clears on refresh', async () => {
        let fail = true
        const fetchPage = vi.fn(async () => {
            if (fail) throw new Error('boom')
            return [makeItem('a')]
        })
        const config = { fetchPage, toItems: (raw: unknown) => raw as GalleryItem[] }
        const { result } = renderHook(() => useCardGallery(config, PAGE_SIZE))

        await waitFor(() => expect(result.current.error).toBe('boom'))
        expect(result.current.items).toEqual([])
        expect(result.current.hasMore).toBe(false)

        fail = false
        act(() => result.current.refresh())
        await waitFor(() => expect(result.current.items.map((i) => i.id)).toEqual(['a']))
        expect(result.current.error).toBeNull()
    })
})
