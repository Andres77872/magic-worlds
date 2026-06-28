import { StrictMode, type ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LorebookResource } from '@/shared'
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

vi.mock('@/infrastructure/api', () => ({
    apiService: {
        getLorebookResource: mockState.getLorebookResource,
    },
}))

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
    return <StrictMode>{children}</StrictMode>
}

describe('useLorebookResourceRoute', () => {
    beforeEach(() => {
        mockState.resourceEdit = { page: 'gallery-resources', resourceId: 'resource-deep' }
        mockState.isAuthenticated = true
        mockState.openLoginModal.mockReset()
        mockState.setPage.mockReset()
        mockState.getLorebookResource.mockReset()
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
        expect(mockState.getLorebookResource).toHaveBeenCalledWith('resource-deep')
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
})
