import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    setPage: vi.fn(),
    loadData: vi.fn(),
    openLoginModal: vi.fn(),
    setEditingTemplate: vi.fn(),
    createAdventureTemplateAI: vi.fn(),
    updateAdventureTemplate: vi.fn(),
    generateCardPortrait: vi.fn(),
    isAuthenticated: true,
    editingTemplate: null as Record<string, unknown> | null,
}))

vi.mock('@/app/hooks', () => ({
    useNavigation: () => ({ setPage: mocks.setPage }),
    useData: () => ({
        characters: [],
        worlds: [],
        isLoading: false,
        editingTemplate: mocks.editingTemplate,
        setEditingTemplate: mocks.setEditingTemplate,
        loadData: mocks.loadData,
    }),
    useAuth: () => ({ isAuthenticated: mocks.isAuthenticated, openLoginModal: mocks.openLoginModal }),
}))

vi.mock('@/infrastructure/api', () => ({
    ApiError: class ApiError extends Error { status = 500; isTransient = true },
    resolveMediaUrl: (url?: string | null) => url ?? undefined,
    apiService: {
        createAdventureTemplateAI: mocks.createAdventureTemplateAI,
        createAdventureTemplate: vi.fn(),
        updateAdventureTemplate: mocks.updateAdventureTemplate,
        generateCardPortrait: mocks.generateCardPortrait,
        waitForImageJob: vi.fn(),
        listThemeSongs: vi.fn().mockResolvedValue({ items: [] }),
    },
}))

import { AdventureCreator } from './AdventureCreator'

describe('AdventureCreator AI generation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isAuthenticated = true
        mocks.editingTemplate = null
        mocks.createAdventureTemplateAI.mockResolvedValue({
            id: 'tmpl-1',
            name: 'Gate',
            description: 'A heist into the volcano fortress.',
            triggers: ['heist', 'volcano'],
            characters: [{ id: 'c1', name: 'Ember' }],
            world: [{ id: 'w1', name: 'Pyre', type: 'volcanic' }],
        })
        mocks.loadData.mockResolvedValue(undefined)
    })

    it('forwards lifecycle options, populates the creator in edit mode, and renders the generated scene (no navigation)', async () => {
        render(<AdventureCreator />)

        fireEvent.change(screen.getByPlaceholderText(/dragon's egg/i), { target: { value: 'Generate a volcano heist' } })
        fireEvent.click(screen.getByRole('button', { name: /generate adventure/i }))

        await waitFor(() => expect(mocks.createAdventureTemplateAI).toHaveBeenCalledTimes(1))
        const [description, options] = mocks.createAdventureTemplateAI.mock.calls[0]
        expect(description).toBe('Generate a volcano heist')
        expect(options.signal).toBeInstanceOf(AbortSignal)
        expect(options.idempotencyKey).toMatch(/^mw-ai-card-idem-/)

        // The generated scenario populates the premise field…
        await waitFor(() => expect(screen.getByDisplayValue('A heist into the volcano fortress.')).toBeInTheDocument())
        // …the invented world renders read-only in the preview…
        expect(screen.getByText(/volcanic: Pyre/i)).toBeInTheDocument()
        // …the creator switches to edit mode for the persisted template (not null)…
        expect(mocks.setEditingTemplate).toHaveBeenCalledWith(expect.objectContaining({ id: 'tmpl-1' }))
        // …the library refreshes in the background, and no navigation occurs.
        await waitFor(() => expect(mocks.loadData).toHaveBeenCalledTimes(1))
        expect(mocks.setPage).not.toHaveBeenCalledWith('landing')
    })

    it('opens login modal instead of calling AI when unauthenticated', async () => {
        mocks.isAuthenticated = false
        render(<AdventureCreator />)

        fireEvent.change(screen.getByPlaceholderText(/dragon's egg/i), { target: { value: 'Generate a volcano heist' } })
        fireEvent.click(screen.getByRole('button', { name: /generate adventure/i }))

        await waitFor(() => expect(mocks.openLoginModal).toHaveBeenCalledTimes(1))
        expect(mocks.createAdventureTemplateAI).not.toHaveBeenCalled()
        expect(mocks.loadData).not.toHaveBeenCalled()
    })
})

describe('AdventureCreator cover persistence', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isAuthenticated = true
        mocks.editingTemplate = { id: 'tmpl-1', scenario: 'A heist into the volcano fortress.', characters: [], triggers: [] }
        mocks.updateAdventureTemplate.mockResolvedValue({})
        mocks.generateCardPortrait.mockResolvedValue({
            job_id: 'job-1',
            status: 'completed',
            assets: [{ url: '/generated-images/a.png' }],
        })
    })

    it('persists a generated cover onto the saved template immediately (no Save click)', async () => {
        render(<AdventureCreator />)

        fireEvent.click(screen.getByRole('button', { name: /generate cover image/i }))

        await waitFor(() =>
            expect(mocks.updateAdventureTemplate).toHaveBeenCalledWith(
                'tmpl-1',
                expect.objectContaining({ image_url: '/generated-images/a.png' }),
            ),
        )
    })
})
