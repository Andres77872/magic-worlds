import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import {
    createWorkspaceTestState,
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    type WorkspaceTestState,
} from '@/shared/hooks/testing/workspaceTestUtils'

const mocks = vi.hoisted(() => ({
    cardEdit: null as Record<string, unknown> | null,
    setPage: vi.fn(),
    isAuthenticated: true,
    openLoginModal: vi.fn(),
    editingCharacter: null as Record<string, unknown> | null,
    editingWorld: null as Record<string, unknown> | null,
    editingItem: null as Record<string, unknown> | null,
    setEditingCharacter: vi.fn(),
    setEditingWorld: vi.fn(),
    setEditingItem: vi.fn(),
    getCharacter: vi.fn(),
    getWorld: vi.fn(),
    getItem: vi.fn(),
    workspace: null as WorkspaceTestState | null,
}))

vi.mock('@/app/hooks', () => ({
    useNavigation: () => ({ cardEdit: mocks.cardEdit, setPage: mocks.setPage }),
    useAuth: () => ({ isAuthenticated: mocks.isAuthenticated, openLoginModal: mocks.openLoginModal }),
    useData: () => ({
        editingCharacter: mocks.editingCharacter,
        editingWorld: mocks.editingWorld,
        editingItem: mocks.editingItem,
        setEditingCharacter: mocks.setEditingCharacter,
        setEditingWorld: mocks.setEditingWorld,
        setEditingItem: mocks.setEditingItem,
    }),
}))

vi.mock('@/infrastructure/api', () => ({
    apiService: {},
}))

// Workspace R1: the routed card is read through the committed workspace's scoped client.
const scopedClient = {
    workspaceScope: { workspaceId: TEST_WORKSPACE_ID, initialCollectionIds: [] },
    getCharacter: mocks.getCharacter,
    getWorld: mocks.getWorld,
    getItem: mocks.getItem,
}
vi.mock('@/app/hooks/useWorkspace', () => ({ useWorkspace: () => mocks.workspace!.value() }))

import { useCardEditorRoute } from './useCardEditorRoute'

beforeEach(() => {
    vi.clearAllMocks()
    mocks.cardEdit = null
    mocks.isAuthenticated = true
    mocks.editingCharacter = null
    mocks.editingWorld = null
    mocks.editingItem = null
    mocks.workspace = createWorkspaceTestState({ api: scopedClient })
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('useCardEditorRoute', () => {
    it('does nothing when there is no card-edit route', () => {
        renderHook(() => useCardEditorRoute('character'))
        expect(mocks.getCharacter).not.toHaveBeenCalled()
        expect(mocks.setEditingCharacter).not.toHaveBeenCalled()
    })

    it('fetches and sets the editing card from the route + forwards the body', async () => {
        mocks.cardEdit = { cardType: 'character', cardId: 'char-1', version: undefined }
        mocks.getCharacter.mockResolvedValue({ id: 'char-1', name: 'Nyra', race: 'elf' })
        const onCardLoaded = vi.fn()

        const { result } = renderHook(() => useCardEditorRoute('character', { onCardLoaded }))

        await waitFor(() => expect(mocks.setEditingCharacter).toHaveBeenCalledWith(expect.objectContaining({ id: 'char-1', name: 'Nyra' })))
        expect(mocks.getCharacter).toHaveBeenCalledWith('char-1')
        expect(onCardLoaded).toHaveBeenCalledWith(expect.objectContaining({ id: 'char-1' }))
        expect(result.current.version).toBeUndefined()
    })

    it('does not fetch when already editing the routed card', () => {
        mocks.cardEdit = { cardType: 'character', cardId: 'char-1' }
        mocks.editingCharacter = { id: 'char-1', name: 'Nyra' }
        renderHook(() => useCardEditorRoute('character'))
        expect(mocks.getCharacter).not.toHaveBeenCalled()
    })

    it.each([
        ['character', mocks.getCharacter, mocks.setEditingCharacter],
        ['world', mocks.getWorld, mocks.setEditingWorld],
        ['item', mocks.getItem, mocks.setEditingItem],
    ] as const)('finishes a cold %s load when StrictMode replays the effect', async (cardType, getCard, setEditingCard) => {
        mocks.cardEdit = { cardType, cardId: 'card-1' }
        let resolveCard!: (card: Record<string, unknown>) => void
        getCard.mockReturnValue(new Promise(resolve => { resolveCard = resolve }))
        const onCardLoaded = vi.fn()
        const { result } = renderHook(() => useCardEditorRoute(cardType, { onCardLoaded }), { reactStrictMode: true })

        expect(result.current.bootstrapping).toBe(true)
        await act(async () => resolveCard({ id: 'card-1', name: 'Restored card' }))

        expect(setEditingCard).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: 'card-1', name: 'Restored card' }))
        expect(onCardLoaded).toHaveBeenCalledExactlyOnceWith({ id: 'card-1', name: 'Restored card' })
        expect(result.current.bootstrapping).toBe(false)
    })

    it('clears loading when leaving a pending route and can load it again', async () => {
        mocks.cardEdit = { cardType: 'character', cardId: 'char-1' }
        let resolveCancelled!: (card: Record<string, unknown>) => void
        mocks.getCharacter.mockReturnValueOnce(new Promise(resolve => { resolveCancelled = resolve }))
        const onCardLoaded = vi.fn()
        const { result, rerender } = renderHook(() => useCardEditorRoute('character', { onCardLoaded }))
        expect(result.current.bootstrapping).toBe(true)

        mocks.cardEdit = null
        rerender()
        expect(result.current.bootstrapping).toBe(false)
        await act(async () => resolveCancelled({ id: 'char-1', name: 'Cancelled card' }))
        expect(mocks.setEditingCharacter).not.toHaveBeenCalled()
        expect(onCardLoaded).not.toHaveBeenCalled()

        mocks.getCharacter.mockResolvedValue({ id: 'char-1', name: 'Restored card' })
        mocks.cardEdit = { cardType: 'character', cardId: 'char-1' }
        rerender()

        await waitFor(() => expect(onCardLoaded).toHaveBeenCalledWith({ id: 'char-1', name: 'Restored card' }))
        expect(result.current.bootstrapping).toBe(false)
    })

    it('ignores routes that target a different editor type', () => {
        mocks.cardEdit = { cardType: 'world', cardId: 'w-1' }
        const { result } = renderHook(() => useCardEditorRoute('character'))
        expect(mocks.getCharacter).not.toHaveBeenCalled()
        expect(result.current.routeCardId).toBeNull()
    })

    it('bounces to the gallery when the card cannot be loaded', async () => {
        mocks.cardEdit = { cardType: 'character', cardId: 'gone' }
        mocks.getCharacter.mockRejectedValue(new Error('404'))
        const { result } = renderHook(() => useCardEditorRoute('character'), { reactStrictMode: true })
        await waitFor(() => expect(mocks.setPage).toHaveBeenCalledWith('gallery-characters'))
        expect(mocks.setEditingCharacter).not.toHaveBeenCalled()
        expect(result.current.bootstrapping).toBe(false)
    })

    it('prompts login and skips the fetch while unauthenticated', () => {
        mocks.isAuthenticated = false
        mocks.cardEdit = { cardType: 'character', cardId: 'char-1' }
        renderHook(() => useCardEditorRoute('character'))
        expect(mocks.openLoginModal).toHaveBeenCalledTimes(1)
        expect(mocks.getCharacter).not.toHaveBeenCalled()
    })

    it('returns the version selector from the route', () => {
        mocks.cardEdit = { cardType: 'item', cardId: 'i-1', version: 4 }
        mocks.editingItem = { id: 'i-1' }
        const { result } = renderHook(() => useCardEditorRoute('item'))
        expect(result.current.version).toBe(4)
        expect(mocks.getItem).not.toHaveBeenCalled()
    })

    it('waits for the workspace handshake before reading the routed card', async () => {
        mocks.cardEdit = { cardType: 'character', cardId: 'char-1' }
        mocks.workspace = createWorkspaceTestState({ api: scopedClient, selectedWorkspaceId: null })
        mocks.getCharacter.mockResolvedValue({ id: 'char-1', name: 'Nyra' })
        const { result, rerender } = renderHook(() => useCardEditorRoute('character'))
        expect(result.current.bootstrapping).toBe(true)
        expect(mocks.getCharacter).not.toHaveBeenCalled()

        mocks.workspace = createWorkspaceTestState({ api: scopedClient })
        rerender()
        await waitFor(() => expect(mocks.setEditingCharacter).toHaveBeenCalledWith(expect.objectContaining({ id: 'char-1' })))
    })

    it('ignores a routed card that lands after a workspace switch', async () => {
        mocks.cardEdit = { cardType: 'world', cardId: 'w-1' }
        let resolveWorld!: (card: Record<string, unknown>) => void
        mocks.getWorld.mockReturnValueOnce(new Promise(resolve => { resolveWorld = resolve }))
        const onCardLoaded = vi.fn()
        renderHook(() => useCardEditorRoute('world', { onCardLoaded }))
        expect(mocks.getWorld).toHaveBeenCalledWith('w-1')

        mocks.workspace!.switchTo(OTHER_WORKSPACE_ID)
        await act(async () => resolveWorld({ id: 'w-1', name: 'Old workspace world' }))

        expect(mocks.setEditingWorld).not.toHaveBeenCalled()
        expect(onCardLoaded).not.toHaveBeenCalled()
        expect(mocks.setPage).not.toHaveBeenCalled()
    })
})
