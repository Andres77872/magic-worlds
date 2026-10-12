import { StrictMode, type ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceContext } from '@/app/providers/workspaceContext'
import type { ApiService } from '@/infrastructure/api'
import type { LorebookResource } from '@/shared'
import {
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    createWorkspaceTestState,
    type WorkspaceTestState,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { useLorebookResourceRoute } from './useLorebookResourceRoute'

const mockState = vi.hoisted(() => ({
    resourceEdit: null as { page: 'gallery-resources'; resourceId: string; createType?: 'md' | 'txt' } | null,
    isAuthenticated: true,
    openLoginModal: vi.fn(),
    setPage: vi.fn(),
    getLorebookResource: vi.fn(),
}))

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({
        isAuthenticated: mockState.isAuthenticated,
        openLoginModal: mockState.openLoginModal,
    }),
    useNavigation: () => ({
        resourceEdit: mockState.resourceEdit,
        setPage: mockState.setPage,
    }),
}))

// One scoped client per committed workspace, like the real provider.
const clients = {
    [TEST_WORKSPACE_ID]: { getLorebookResource: (id: string) => mockState.getLorebookResource(TEST_WORKSPACE_ID, id) },
    [OTHER_WORKSPACE_ID]: { getLorebookResource: (id: string) => mockState.getLorebookResource(OTHER_WORKSPACE_ID, id) },
}
let workspace: WorkspaceTestState

function resource(overrides: Partial<LorebookResource> = {}): LorebookResource {
    return {
        id: 'resource-deep',
        title: 'Deep resource',
        description: 'Source notes.',
        triggers: ['deep resource'],
        fileName: 'deep-resource.md',
        fileType: 'md',
        content: 'Deep source notes.',
        contentLength: 18,
        extractionStatus: 'pending',
        extraction: null,
        ...overrides,
    }
}

function StrictWrapper({ children }: { children: ReactNode }) {
    const value = workspace.value()
    const api = clients[value.selectedWorkspaceId as keyof typeof clients] as unknown as ApiService
    return <StrictMode><WorkspaceContext.Provider value={{ ...value, api }}>{children}</WorkspaceContext.Provider></StrictMode>
}

describe('useLorebookResourceRoute', () => {
    beforeEach(() => {
        mockState.resourceEdit = { page: 'gallery-resources', resourceId: 'resource-deep' }
        mockState.isAuthenticated = true
        mockState.openLoginModal.mockReset()
        mockState.setPage.mockReset()
        mockState.getLorebookResource.mockReset()
        workspace = createWorkspaceTestState()
    })

    it('resolves a cold deep link after StrictMode re-runs the effect', async () => {
        const loaded = resource()
        const upsertItem = vi.fn()
        mockState.getLorebookResource.mockResolvedValue(loaded)

        const { result } = renderHook(() => (
            useLorebookResourceRoute({ items: [], upsertItem })
        ), { wrapper: StrictWrapper })

        await waitFor(() => expect(result.current.resource?.id).toBe('resource-deep'))
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.isCreate).toBe(false)
        expect(mockState.getLorebookResource).toHaveBeenCalledWith(TEST_WORKSPACE_ID, 'resource-deep')
        expect(upsertItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'resource-deep' }))
        expect(mockState.setPage).not.toHaveBeenCalled()
    })

    it('bounces missing deep-linked resources back to the resource gallery', async () => {
        const onMissing = vi.fn()
        mockState.getLorebookResource.mockRejectedValue(new Error('not found'))

        const { result } = renderHook(() => (
            useLorebookResourceRoute({ items: [], upsertItem: vi.fn(), onMissing })
        ), { wrapper: StrictWrapper })

        await waitFor(() => expect(mockState.setPage).toHaveBeenCalledWith('gallery-resources'))
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.resource).toBeNull()
        expect(onMissing).toHaveBeenCalledTimes(1)
    })

    it('drops a resource of the previous workspace and ignores its late load after a switch', async () => {
        let finishPrevious!: (value: LorebookResource) => void
        mockState.getLorebookResource.mockImplementation((workspaceId: string) => (
            workspaceId === TEST_WORKSPACE_ID
                ? new Promise((resolve) => { finishPrevious = resolve })
                : Promise.reject(new Error('not found'))
        ))
        const onMissing = vi.fn()
        const upsertItem = vi.fn()
        const { result, rerender } = renderHook(() => (
            useLorebookResourceRoute({ items: [], upsertItem, onMissing })
        ), { wrapper: StrictWrapper })
        await waitFor(() => expect(mockState.getLorebookResource).toHaveBeenCalledWith(TEST_WORKSPACE_ID, 'resource-deep'))

        act(() => workspace.switchTo(OTHER_WORKSPACE_ID))
        rerender()

        // The new workspace does not own it: back to its gallery, never the old resource.
        await waitFor(() => expect(mockState.setPage).toHaveBeenCalledWith('gallery-resources'))
        expect(mockState.getLorebookResource).toHaveBeenCalledWith(OTHER_WORKSPACE_ID, 'resource-deep')
        await act(async () => finishPrevious(resource()))
        expect(result.current.resource).toBeNull()
        expect(upsertItem).not.toHaveBeenCalled()
        expect(onMissing).toHaveBeenCalledTimes(1)
    })
})
