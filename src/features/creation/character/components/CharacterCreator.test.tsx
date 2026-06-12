import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    setPage: vi.fn(),
    loadData: vi.fn(),
    openLoginModal: vi.fn(),
    registerThemeSongJob: vi.fn(),
    createCardAssistantConversation: vi.fn(),
    listCardAssistantConversations: vi.fn(),
    getCardAssistantConversation: vi.fn(),
    sendCardAssistantMessage: vi.fn(),
    streamCardAssistantMessage: vi.fn(),
    setEditingCharacter: vi.fn(),
    createCharacter: vi.fn(),
    updateCharacter: vi.fn(),
    generateCardPortrait: vi.fn(),
    isAuthenticated: true,
    editingCharacter: null as Record<string, unknown> | null,
}))

vi.mock('@/app/hooks', () => ({
    useNavigation: () => ({ setPage: mocks.setPage }),
    useData: () => ({ editingCharacter: mocks.editingCharacter, setEditingCharacter: mocks.setEditingCharacter, loadData: mocks.loadData }),
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
        createCharacter: mocks.createCharacter,
        updateCharacter: mocks.updateCharacter,
        generateCardPortrait: mocks.generateCardPortrait,
        waitForImageJob: vi.fn(),
        listThemeSongs: vi.fn().mockResolvedValue({ items: [] }),
    },
}))

import { CharacterCreator } from './CharacterCreator'

describe('CharacterCreator AI generation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isAuthenticated = true
        mocks.editingCharacter = null
        mocks.listCardAssistantConversations.mockResolvedValue({ conversations: [] })
        mocks.createCardAssistantConversation.mockResolvedValue({
            conversation: { conversation_id: 1, card_type: 'character', card_id: null, title: 'Untitled Character' },
            messages: [],
            card: null,
        })
        const assistantResponse = {
            conversation: { conversation_id: 1, card_type: 'character', card_id: 'char-1', title: 'Untitled Character' },
            messages: [
                { message_id: 10, conversation_id: 1, sequence_no: 1, role: 'user', status: 'completed', content: 'Generate a moon scout' },
                { message_id: 11, conversation_id: 1, sequence_no: 2, role: 'assistant', status: 'completed', content: 'Created Nyra.' },
            ],
            card: {
                id: 'char-1',
                name: 'Nyra',
                race: 'moon elf',
                description: 'A quiet scout of the lunar dunes.',
                triggers: ['scout', 'moon'],
                category: [{ name: 'Stats', attributes: [{ Agility: '8', Wisdom: '6' }] }],
            },
        }
        mocks.sendCardAssistantMessage.mockResolvedValue(assistantResponse)
        mocks.streamCardAssistantMessage.mockImplementation(async (_conversationId: number, _body: unknown, onEvent: (event: Record<string, unknown>) => void) => {
            onEvent({ type: 'final', ...assistantResponse })
        })
        mocks.loadData.mockResolvedValue(undefined)
        mocks.createCharacter.mockResolvedValue({ id: 'char-1', name: 'Nyra', race: 'moon elf' })
    })

    it('sends a creator conversation turn and populates the creator in edit mode (no navigation)', async () => {
        render(<CharacterCreator />)

        fireEvent.click(screen.getByRole('button', { name: /open card assistant/i }))
        fireEvent.change(screen.getByPlaceholderText(/ask for a change/i), { target: { value: 'Generate a moon scout' } })
        fireEvent.click(screen.getByRole('button', { name: /send message/i }))

        await waitFor(() => expect(mocks.createCardAssistantConversation).toHaveBeenCalledTimes(1))
        expect(mocks.createCardAssistantConversation).toHaveBeenCalledWith(
            expect.objectContaining({
                card_type: 'character',
                card_id: undefined,
                title: 'Untitled Character',
                current_card: expect.objectContaining({ name: '', race: '', description: '' }),
            }),
            expect.any(Object),
        )
        await waitFor(() => expect(mocks.streamCardAssistantMessage).toHaveBeenCalledTimes(1))
        expect(mocks.streamCardAssistantMessage).toHaveBeenCalledWith(
            1,
            expect.objectContaining({
                message: 'Generate a moon scout',
                current_card: expect.objectContaining({ name: '', race: '', description: '' }),
                request_id: expect.stringMatching(/^mw-card-assistant-/),
            }),
            expect.any(Function),
            expect.objectContaining({ requestId: expect.stringMatching(/^mw-card-assistant-/) }),
        )

        await waitFor(() => expect(screen.getByDisplayValue('Nyra')).toBeInTheDocument())
        expect(screen.getByDisplayValue('moon elf')).toBeInTheDocument()
        expect(mocks.setEditingCharacter).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'char-1', name: 'Nyra', race: 'moon elf' }),
        )
        await waitFor(() => expect(mocks.loadData).toHaveBeenCalledTimes(1))
        expect(mocks.setPage).not.toHaveBeenCalledWith('landing')
    })

    it('opens login modal instead of opening the assistant when unauthenticated', async () => {
        mocks.isAuthenticated = false
        render(<CharacterCreator />)

        fireEvent.click(screen.getByRole('button', { name: /open card assistant/i }))

        await waitFor(() => expect(mocks.openLoginModal).toHaveBeenCalledTimes(1))
        expect(mocks.createCardAssistantConversation).not.toHaveBeenCalled()
        expect(mocks.sendCardAssistantMessage).not.toHaveBeenCalled()
        expect(mocks.streamCardAssistantMessage).not.toHaveBeenCalled()
        expect(mocks.loadData).not.toHaveBeenCalled()
    })
})

describe('CharacterCreator role payload', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isAuthenticated = true
        mocks.editingCharacter = null
        mocks.listCardAssistantConversations.mockResolvedValue({ conversations: [] })
        mocks.createCharacter.mockResolvedValue({ id: 'p1', name: 'Aria', race: 'Human', role: 'persona', is_default_persona: true })
        mocks.loadData.mockResolvedValue(undefined)
    })

    it('creates a default persona card when the persona role is selected', async () => {
        render(<CharacterCreator />)

        // Create mode opens on the template gallery — continue with the standard fields.
        fireEvent.click(screen.getByRole('button', { name: /skip — start with the standard fields/i }))

        fireEvent.click(screen.getByText('User persona').closest('button')!)
        fireEvent.click(screen.getByLabelText(/use as default persona/i))
        fireEvent.change(screen.getByPlaceholderText(/lyra emberwind/i), { target: { value: 'Aria' } })
        fireEvent.change(screen.getByPlaceholderText(/elf, human, construct/i), { target: { value: 'Human' } })
        fireEvent.click(screen.getByRole('button', { name: /^Create Character$/i }))

        await waitFor(() =>
            expect(mocks.createCharacter).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Aria',
                    race: 'Human',
                    role: 'persona',
                    is_default_persona: true,
                }),
            ),
        )
    })

    it('serializes guided template fields into the category payload via "use example"', async () => {
        mocks.createCharacter.mockResolvedValue({ id: 'c2', name: 'Mara' })
        const { container } = render(<CharacterCreator />)

        // Pick a starting shape from the gallery.
        fireEvent.click(screen.getByRole('button', { name: /the adversary/i }))

        fireEvent.change(screen.getByPlaceholderText(/lyra emberwind/i), { target: { value: 'Mara' } })
        fireEvent.change(screen.getByPlaceholderText(/elf, human, construct/i), { target: { value: 'Human' } })

        // The template's guided fields are active with ghost examples; copy one in.
        const motivation = screen.getByLabelText('Motivation')
        expect(motivation).toHaveAttribute(
            'placeholder',
            'To finish the great work — they genuinely believe the world will thank them.',
        )
        const motivationRow = container.querySelector('[data-guided-field="personality.motivation"]') as HTMLElement
        fireEvent.click(within(motivationRow).getByRole('button', { name: /use example/i }))

        fireEvent.click(screen.getByRole('button', { name: /^Create Character$/i }))

        await waitFor(() => expect(mocks.createCharacter).toHaveBeenCalledTimes(1))
        const payload = mocks.createCharacter.mock.calls[0][0]
        const personality = payload.category.find((c: { name: string }) => c.name === 'Personality')
        expect(personality).toBeDefined()
        expect(personality.description).toBe('What drives this character in play.')
        expect(personality.attributes).toContainEqual({
            Motivation: 'To finish the great work — they genuinely believe the world will thank them.',
        })
    })

    it('removes a guided field so it no longer serializes', async () => {
        mocks.createCharacter.mockResolvedValue({ id: 'c3', name: 'Bren' })
        render(<CharacterCreator />)

        fireEvent.click(screen.getByRole('button', { name: /skip — start with the standard fields/i }))
        fireEvent.change(screen.getByPlaceholderText(/lyra emberwind/i), { target: { value: 'Bren' } })
        fireEvent.change(screen.getByPlaceholderText(/elf, human, construct/i), { target: { value: 'Dwarf' } })

        const motivation = screen.getByLabelText('Motivation')
        fireEvent.change(motivation, { target: { value: 'Win the contest' } })
        // Remove the filled field — confirm in the dialog — then save.
        fireEvent.click(screen.getByRole('button', { name: /remove motivation/i }))
        fireEvent.click(screen.getByRole('button', { name: /^Discard$/ }))

        fireEvent.click(screen.getByRole('button', { name: /^Create Character$/i }))

        await waitFor(() => expect(mocks.createCharacter).toHaveBeenCalledTimes(1))
        const payload = mocks.createCharacter.mock.calls[0][0]
        expect(payload.category.find((c: { name: string }) => c.name === 'Personality')).toBeUndefined()
    })
})

describe('CharacterCreator portrait persistence', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isAuthenticated = true
        mocks.editingCharacter = { id: 'char-1', name: 'Nyra', race: 'moon elf', description: '', triggers: [] }
        mocks.updateCharacter.mockResolvedValue({})
        mocks.generateCardPortrait.mockResolvedValue({
            job_id: 'job-1',
            status: 'completed',
            assets: [{ url: '/generated-images/p.png' }],
        })
    })

    it('persists a generated portrait onto the saved card immediately (no Save click)', async () => {
        render(<CharacterCreator />)

        fireEvent.click(screen.getByRole('button', { name: /generate profile image/i }))

        await waitFor(() =>
            expect(mocks.updateCharacter).toHaveBeenCalledWith(
                'char-1',
                expect.objectContaining({ image_url: '/generated-images/p.png' }),
            ),
        )
    })
})
