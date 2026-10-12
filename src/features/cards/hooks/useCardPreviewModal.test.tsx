import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Adventure, Character, Item, World } from '@/shared'
import {
    createWorkspaceTestState,
    OTHER_WORKSPACE_ID,
    WorkspaceTestProvider,
    type WorkspaceTestState,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { useCardPreviewModal } from './useCardPreviewModal'

interface MockCardData {
    characters: Character[]
    worlds: World[]
    items: Item[]
    templateAdventures: Adventure[]
}

const mocks = vi.hoisted(() => ({
    data: {
        current: {
            characters: [],
            worlds: [],
            items: [],
            templateAdventures: [],
        } as MockCardData,
    },
    apiService: {
        getCharacter: vi.fn(),
        getWorld: vi.fn(),
        getItem: vi.fn(),
        getAdventureTemplate: vi.fn(),
    },
    // The committed workspace's scoped client (private card reads go through it).
    scoped: {
        getCharacter: vi.fn(),
        getWorld: vi.fn(),
        getItem: vi.fn(),
        getAdventureTemplate: vi.fn(),
    },
}))

vi.mock('@/app/hooks', () => ({
    useData: () => mocks.data.current,
}))

vi.mock('@/infrastructure/api', () => ({
    apiService: mocks.apiService,
    resolveMediaUrl: (url?: string | null) => {
        if (!url) return undefined
        if (/^(https?:|data:|blob:)/i.test(url)) return url
        return `https://api.test${url.startsWith('/') ? '' : '/'}${url}`
    },
}))

function emptyData() {
    return {
        characters: [],
        worlds: [],
        items: [],
        templateAdventures: [],
    }
}

let workspace: WorkspaceTestState

function wrapper({ children }: { children: ReactNode }) {
    return createElement(WorkspaceTestProvider, { state: workspace, children })
}

describe('useCardPreviewModal', () => {
    beforeEach(() => {
        mocks.data.current = emptyData()
        vi.clearAllMocks()
        workspace = createWorkspaceTestState({ api: mocks.scoped })
    })

    it('opens a local card without fetching', () => {
        mocks.data.current = {
            ...emptyData(),
            characters: [
                {
                    id: 'c1',
                    name: 'Lithien',
                    role: 'persona',
                    is_default_persona: true,
                    race: 'Elf',
                    stats: {},
                    description: 'A wandering bard.',
                    image_url: '/generated-images/lithien.jpeg',
                },
            ],
        }
        const { result } = renderHook(() => useCardPreviewModal(), { wrapper })

        act(() => result.current.openCardPreview({ type: 'persona', id: 'c1' }))

        expect(result.current.loading).toBe(false)
        expect(result.current.card).toMatchObject({
            id: 'c1',
            type: 'persona',
            title: 'Lithien',
            badge: 'Default persona',
            imageUrl: 'https://api.test/generated-images/lithien.jpeg',
        })
        expect(mocks.apiService.getCharacter).not.toHaveBeenCalled()
        expect(mocks.scoped.getCharacter).not.toHaveBeenCalled()
    })

    it('falls back to the scoped card API when local data is missing', async () => {
        mocks.scoped.getWorld.mockResolvedValue({
            id: 'w1',
            name: 'Rivendell',
            type: 'Elven realm',
            details: {},
            description: 'A hidden valley.',
            image_url: '/generated-images/rivendell.jpeg',
        })
        const { result } = renderHook(() => useCardPreviewModal(), { wrapper })

        act(() => result.current.openCardPreview({ type: 'world', id: 'w1' }))

        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(mocks.scoped.getWorld).toHaveBeenCalledWith('w1')
        expect(mocks.apiService.getWorld).not.toHaveBeenCalled()
        expect(result.current.card).toMatchObject({
            id: 'w1',
            type: 'world',
            title: 'Rivendell',
            description: 'A hidden valley.',
            imageUrl: 'https://api.test/generated-images/rivendell.jpeg',
        })
    })

    it('ignores a late result and closes the preview after a committed workspace switch', async () => {
        let resolve!: (value: unknown) => void
        mocks.scoped.getItem.mockReturnValue(new Promise((done) => { resolve = done }))
        const { result, rerender } = renderHook(() => useCardPreviewModal(), { wrapper })

        act(() => result.current.openCardPreview({ type: 'item', id: 'i1' }))
        expect(result.current.target).toMatchObject({ id: 'i1' })
        expect(result.current.loading).toBe(true)

        act(() => workspace.switchTo(OTHER_WORKSPACE_ID))
        rerender()
        expect(result.current.target).toBeNull()

        await act(async () => {
            resolve({ id: 'i1', name: 'Old key', type: 'Key', rarity: 'Rare', description: '' })
        })
        expect(result.current.card).toBeNull()
        expect(result.current.loading).toBe(false)
    })
})
