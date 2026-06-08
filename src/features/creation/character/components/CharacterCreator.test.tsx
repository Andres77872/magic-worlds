import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    setPage: vi.fn(),
    loadData: vi.fn(),
    openLoginModal: vi.fn(),
    createCharacterAI: vi.fn(),
    setEditingCharacter: vi.fn(),
    isAuthenticated: true,
}))

vi.mock('@/app/hooks', () => ({
    useNavigation: () => ({ setPage: mocks.setPage }),
    useData: () => ({ editingCharacter: null, setEditingCharacter: mocks.setEditingCharacter, loadData: mocks.loadData }),
    useAuth: () => ({ isAuthenticated: mocks.isAuthenticated, openLoginModal: mocks.openLoginModal }),
}))

vi.mock('@/infrastructure/api', () => ({
    ApiError: class ApiError extends Error { status = 500; isTransient = true },
    apiService: {
        createCharacterAI: mocks.createCharacterAI,
        createCharacter: vi.fn(),
        updateCharacter: vi.fn(),
    },
}))

import { CharacterCreator } from './CharacterCreator'

describe('CharacterCreator AI generation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isAuthenticated = true
        mocks.createCharacterAI.mockResolvedValue({
            id: 'char-1',
            name: 'Nyra',
            race: 'moon elf',
            description: 'A quiet scout of the lunar dunes.',
            triggers: ['scout', 'moon'],
            category: [{ name: 'Stats', attributes: [{ Agility: '8', Wisdom: '6' }] }],
        })
        mocks.loadData.mockResolvedValue(undefined)
    })

    it('forwards lifecycle options and populates the creator in edit mode (no navigation)', async () => {
        render(<CharacterCreator />)

        fireEvent.change(screen.getByPlaceholderText(/grizzled dwarven blacksmith/i), { target: { value: '  Generate a moon scout  ' } })
        fireEvent.click(screen.getByRole('button', { name: /generate character/i }))

        await waitFor(() => expect(mocks.createCharacterAI).toHaveBeenCalledTimes(1))
        const [description, options] = mocks.createCharacterAI.mock.calls[0]
        expect(description).toBe('Generate a moon scout')
        expect(options.signal).toBeInstanceOf(AbortSignal)
        expect(options.requestId).toMatch(/^mw-ai-card-req-/)
        expect(options.idempotencyKey).toMatch(/^mw-ai-card-idem-/)

        // The generated card populates the live form…
        await waitFor(() => expect(screen.getByDisplayValue('Nyra')).toBeInTheDocument())
        expect(screen.getByDisplayValue('moon elf')).toBeInTheDocument()

        // …switches the creator into edit mode for the already-persisted card…
        expect(mocks.setEditingCharacter).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'char-1', name: 'Nyra', race: 'moon elf' }),
        )
        // …refreshes the library in the background…
        await waitFor(() => expect(mocks.loadData).toHaveBeenCalledTimes(1))
        // …and does NOT navigate away.
        expect(mocks.setPage).not.toHaveBeenCalledWith('landing')
    })

    it('opens login modal instead of calling AI when unauthenticated', async () => {
        mocks.isAuthenticated = false
        render(<CharacterCreator />)

        fireEvent.change(screen.getByPlaceholderText(/grizzled dwarven blacksmith/i), { target: { value: 'Generate a moon scout' } })
        fireEvent.click(screen.getByRole('button', { name: /generate character/i }))

        await waitFor(() => expect(mocks.openLoginModal).toHaveBeenCalledTimes(1))
        expect(mocks.createCharacterAI).not.toHaveBeenCalled()
        expect(mocks.loadData).not.toHaveBeenCalled()
    })
})
