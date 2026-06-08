import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    setPage: vi.fn(),
    loadData: vi.fn(),
    openLoginModal: vi.fn(),
    createWorldAI: vi.fn(),
    setEditingWorld: vi.fn(),
    isAuthenticated: true,
}))

vi.mock('@/app/hooks', () => ({
    useNavigation: () => ({ setPage: mocks.setPage }),
    useData: () => ({ editingWorld: null, setEditingWorld: mocks.setEditingWorld, loadData: mocks.loadData }),
    useAuth: () => ({ isAuthenticated: mocks.isAuthenticated, openLoginModal: mocks.openLoginModal }),
}))

vi.mock('@/infrastructure/api', () => ({
    ApiError: class ApiError extends Error { status = 500; isTransient = true },
    apiService: {
        createWorldAI: mocks.createWorldAI,
        createWorld: vi.fn(),
        updateWorld: vi.fn(),
    },
}))

import { WorldCreator } from './WorldCreator'

describe('WorldCreator AI generation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isAuthenticated = true
        mocks.createWorldAI.mockResolvedValue({
            id: 'world-1',
            name: 'Glass',
            type: 'desert',
            description: 'An endless sea of fused sand.',
            triggers: ['glass', 'desert'],
        })
        mocks.loadData.mockResolvedValue(undefined)
    })

    it('forwards lifecycle options and populates the creator in edit mode (no navigation)', async () => {
        render(<WorldCreator />)

        fireEvent.change(screen.getByPlaceholderText(/storm-wracked archipelago/i), { target: { value: 'Generate a glass desert' } })
        fireEvent.click(screen.getByRole('button', { name: /generate world/i }))

        await waitFor(() => expect(mocks.createWorldAI).toHaveBeenCalledTimes(1))
        const [description, options] = mocks.createWorldAI.mock.calls[0]
        expect(description).toBe('Generate a glass desert')
        expect(options.signal).toBeInstanceOf(AbortSignal)
        expect(options.idempotencyKey).toMatch(/^mw-ai-card-idem-/)

        // The generated card populates the live form…
        await waitFor(() => expect(screen.getByDisplayValue('Glass')).toBeInTheDocument())
        expect(screen.getByDisplayValue('desert')).toBeInTheDocument()

        // …switches into edit mode for the already-persisted card…
        expect(mocks.setEditingWorld).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'world-1', name: 'Glass', type: 'desert' }),
        )
        // …refreshes the library in the background, and does NOT navigate away.
        await waitFor(() => expect(mocks.loadData).toHaveBeenCalledTimes(1))
        expect(mocks.setPage).not.toHaveBeenCalledWith('landing')
    })

    it('opens login modal instead of calling AI when unauthenticated', async () => {
        mocks.isAuthenticated = false
        render(<WorldCreator />)

        fireEvent.change(screen.getByPlaceholderText(/storm-wracked archipelago/i), { target: { value: 'Generate a glass desert' } })
        fireEvent.click(screen.getByRole('button', { name: /generate world/i }))

        await waitFor(() => expect(mocks.openLoginModal).toHaveBeenCalledTimes(1))
        expect(mocks.createWorldAI).not.toHaveBeenCalled()
        expect(mocks.loadData).not.toHaveBeenCalled()
    })
})
