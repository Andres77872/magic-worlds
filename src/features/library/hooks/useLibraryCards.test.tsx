import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiService } from '@/infrastructure/api'
import {
    createWorkspaceTestState,
    OTHER_WORKSPACE_ID,
    TEST_COLLECTION_ID,
    TEST_WORKSPACE_ID,
    WorkspaceTestProvider,
    type WorkspaceTestState,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { EMPTY_LIBRARY_ROUTE } from '../libraryUrl'
import { forgetLibraryCards, useLibraryCards } from './useLibraryCards'

function card(id: string, cardType = 'item') {
    return { card_type: cardType, card: { id, name: `Card ${id}`, type: 'relic', triggers: [] } }
}

function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((res) => {
        resolve = res
    })
    return { promise, resolve }
}

const listLibraryCards = vi.fn()
const api = { listLibraryCards } as unknown as ApiService
let state: WorkspaceTestState

function wrapper({ children }: { children: ReactNode }) {
    return <WorkspaceTestProvider state={state}>{children}</WorkspaceTestProvider>
}

describe('useLibraryCards', () => {
    beforeEach(() => {
        listLibraryCards.mockReset()
        forgetLibraryCards(TEST_WORKSPACE_ID)
        forgetLibraryCards(OTHER_WORKSPACE_ID)
        state = createWorkspaceTestState({ api })
    })

    it('appends pages without repeats in server order', async () => {
        listLibraryCards
            .mockResolvedValueOnce({ items: [card('a'), card('b')], total: 3, limit: 24, offset: 0 })
            .mockResolvedValueOnce({ items: [card('b'), card('c')], total: 3, limit: 24, offset: 2 })
        const { result } = renderHook(() => useLibraryCards(api, TEST_WORKSPACE_ID, EMPTY_LIBRARY_ROUTE), { wrapper })
        await waitFor(() => expect(result.current.items.map((item) => item.id)).toEqual(['a', 'b']))
        expect(result.current.hasMore).toBe(true)
        act(() => result.current.loadMore())
        await waitFor(() => expect(result.current.items.map((item) => item.id)).toEqual(['a', 'b', 'c']))
        expect(listLibraryCards).toHaveBeenLastCalledWith(TEST_WORKSPACE_ID, { limit: 24, offset: 2 }, expect.anything())
        expect(result.current.hasMore).toBe(false)
    })

    it('keys identities by card type, so equal ids of different types both show', async () => {
        listLibraryCards.mockResolvedValueOnce({ items: [card('x', 'item'), { card_type: 'world', card: { id: 'x', name: 'World x', category: [], triggers: [] } }], total: 2, limit: 24, offset: 0 })
        const { result } = renderHook(() => useLibraryCards(api, TEST_WORKSPACE_ID, EMPTY_LIBRARY_ROUTE), { wrapper })
        await waitFor(() => expect(result.current.items).toHaveLength(2))
    })

    it('never lands a response after a committed workspace switch', async () => {
        const late = deferred<unknown>()
        listLibraryCards.mockReturnValueOnce(late.promise)
        const { result } = renderHook(() => useLibraryCards(api, TEST_WORKSPACE_ID, { ...EMPTY_LIBRARY_ROUTE, collectionId: TEST_COLLECTION_ID }), { wrapper })
        expect(listLibraryCards).toHaveBeenCalledWith(TEST_WORKSPACE_ID, { collection_id: TEST_COLLECTION_ID, limit: 24, offset: 0 }, expect.anything())
        state.switchTo(OTHER_WORKSPACE_ID)
        await act(async () => {
            late.resolve({ items: [card('stale')], total: 1, limit: 24, offset: 0 })
            await late.promise
        })
        expect(result.current.items).toEqual([])
        expect(result.current.loading).toBe(true)
    })
})
