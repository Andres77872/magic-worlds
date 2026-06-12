import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    setPage: vi.fn(),
    loadData: vi.fn(),
    openLoginModal: vi.fn(),
    registerThemeSongJob: vi.fn(),
    setEditingTemplate: vi.fn(),
    createCardAssistantConversation: vi.fn(),
    listCardAssistantConversations: vi.fn(),
    getCardAssistantConversation: vi.fn(),
    sendCardAssistantMessage: vi.fn(),
    streamCardAssistantMessage: vi.fn(),
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
    useBackgroundTasks: () => ({ tasks: [], registerThemeSongJob: mocks.registerThemeSongJob }),
}))

vi.mock('@/infrastructure/api', () => ({
    ApiError: class ApiError extends Error { status = 500; isTransient = true },
    resolveMediaUrl: (url?: string | null) => url ?? undefined,
    apiService: {
        createCardAssistantConversation: mocks.createCardAssistantConversation,
        listCardAssistantConversations: mocks.listCardAssistantConversations,
        getCardAssistantConversation: mocks.getCardAssistantConversation,
        sendCardAssistantMessage: mocks.sendCardAssistantMessage,
        streamCardAssistantMessage: mocks.streamCardAssistantMessage,
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
        mocks.listCardAssistantConversations.mockResolvedValue({ conversations: [] })
        mocks.createCardAssistantConversation.mockResolvedValue({
            conversation: { conversation_id: 3, card_type: 'adventure_template', card_id: null, title: 'Untitled Adventure' },
            messages: [],
            card: null,
        })
        const assistantResponse = {
            conversation: { conversation_id: 3, card_type: 'adventure_template', card_id: 'tmpl-1', title: 'Untitled Adventure' },
            messages: [
                { message_id: 30, conversation_id: 3, sequence_no: 1, role: 'user', status: 'completed', content: 'Generate a volcano heist' },
                { message_id: 31, conversation_id: 3, sequence_no: 2, role: 'assistant', status: 'completed', content: 'Created the heist.' },
            ],
            card: {
                id: 'tmpl-1',
                name: 'Gate',
                description: 'A heist into the volcano fortress.',
                triggers: ['heist', 'volcano'],
                characters: [{ id: 'c1', name: 'Ember' }],
                world: [{ id: 'w1', name: 'Pyre', type: 'volcanic' }],
            },
        }
        mocks.sendCardAssistantMessage.mockResolvedValue(assistantResponse)
        mocks.streamCardAssistantMessage.mockImplementation(async (_conversationId: number, _body: unknown, onEvent: (event: Record<string, unknown>) => void) => {
            onEvent({ type: 'final', ...assistantResponse })
        })
        mocks.loadData.mockResolvedValue(undefined)
    })

    it('sends a creator conversation turn, populates the creator, and renders the generated scene (no navigation)', async () => {
        render(<AdventureCreator />)

        fireEvent.click(screen.getByRole('button', { name: /open card assistant/i }))
        fireEvent.change(screen.getByPlaceholderText(/ask for a change/i), { target: { value: 'Generate a volcano heist' } })
        fireEvent.click(screen.getByRole('button', { name: /send message/i }))

        await waitFor(() => expect(mocks.createCardAssistantConversation).toHaveBeenCalledTimes(1))
        expect(mocks.createCardAssistantConversation).toHaveBeenCalledWith(
            expect.objectContaining({
                card_type: 'adventure_template',
                card_id: undefined,
                title: 'Untitled Adventure',
                current_card: expect.objectContaining({ name: 'Untitled Adventure', description: '' }),
            }),
            expect.any(Object),
        )
        await waitFor(() => expect(mocks.streamCardAssistantMessage).toHaveBeenCalledTimes(1))
        expect(mocks.streamCardAssistantMessage).toHaveBeenCalledWith(
            3,
            expect.objectContaining({
                message: 'Generate a volcano heist',
                current_card: expect.objectContaining({ name: 'Untitled Adventure', description: '' }),
                request_id: expect.stringMatching(/^mw-card-assistant-/),
            }),
            expect.any(Function),
            expect.objectContaining({ requestId: expect.stringMatching(/^mw-card-assistant-/) }),
        )

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

    it('opens login modal instead of opening the assistant when unauthenticated', async () => {
        mocks.isAuthenticated = false
        render(<AdventureCreator />)

        fireEvent.click(screen.getByRole('button', { name: /open card assistant/i }))

        await waitFor(() => expect(mocks.openLoginModal).toHaveBeenCalledTimes(1))
        expect(mocks.createCardAssistantConversation).not.toHaveBeenCalled()
        expect(mocks.sendCardAssistantMessage).not.toHaveBeenCalled()
        expect(mocks.streamCardAssistantMessage).not.toHaveBeenCalled()
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

describe('AdventureCreator guided payload', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isAuthenticated = true
        mocks.editingTemplate = null
        mocks.listCardAssistantConversations.mockResolvedValue({ conversations: [] })
        mocks.loadData.mockResolvedValue(undefined)
    })

    it('serializes guided Opening/Stakes fields from a template pick into category', async () => {
        const createAdventureTemplate = vi.fn().mockResolvedValue({ id: 'tmpl-2', name: 'Quest' })
        const { apiService } = await import('@/infrastructure/api')
        ;(apiService.createAdventureTemplate as ReturnType<typeof vi.fn>).mockImplementation(createAdventureTemplate)

        const { container } = render(<AdventureCreator />)

        // Create mode opens on the template gallery — pick a starting shape.
        fireEvent.click(screen.getByRole('button', { name: /heroic quest/i }))

        fireEvent.change(screen.getByLabelText(/premise/i), { target: { value: 'The beacons are lit.' } })

        // Copy the template's ghost into the guided Opening scene field.
        const openingRow = container.querySelector('[data-guided-field="opening.scene"]') as HTMLElement
        fireEvent.click(within(openingRow).getByRole('button', { name: /use example/i }))

        fireEvent.click(screen.getByRole('button', { name: /^Create Adventure$/i }))

        await waitFor(() => expect(createAdventureTemplate).toHaveBeenCalledTimes(1))
        const payload = createAdventureTemplate.mock.calls[0][0]
        expect(payload.description).toBe('The beacons are lit.')
        const opening = payload.category.find((c: { name: string }) => c.name === 'Opening')
        expect(opening?.description).toBe('How the adventure begins.')
        expect(opening?.attributes).toContainEqual({
            'Opening Scene':
                'Rain on the shrine steps at dusk. The dying protector presses the empty reliquary into your hands and says a name no one has spoken aloud in years.',
        })
    })
})
