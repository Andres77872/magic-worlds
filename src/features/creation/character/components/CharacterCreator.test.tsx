import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    setPage: vi.fn(),
    goBack: vi.fn(),
    loadData: vi.fn(),
    openLoginModal: vi.fn(),
    registerThemeSongJob: vi.fn(),
    createCardAssistantConversation: vi.fn(),
    listCardAssistantConversations: vi.fn(),
    getCardAssistantConversation: vi.fn(),
    sendCardAssistantMessage: vi.fn(),
    streamCardAssistantMessage: vi.fn(),
    setEditingCharacter: vi.fn(),
    replaceHash: vi.fn(),
    createCharacter: vi.fn(),
    updateCharacter: vi.fn(),
    generateCardPortrait: vi.fn(),
    getCharacter: vi.fn(),
    getCardDraft: vi.fn(),
    saveCardDraft: vi.fn(),
    discardCardDraft: vi.fn(),
    publishCardDraft: vi.fn(),
    restoreVersionIntoDraft: vi.fn(),
    getCardVersion: vi.fn(),
    getPublishedBody: vi.fn(),
    setCardMedia: vi.fn(),
    listCardVersions: vi.fn(),
    isAuthenticated: true,
    editingCharacter: null as Record<string, unknown> | null,
    cardEdit: null as Record<string, unknown> | null,
}))

vi.mock('@/app/hooks', () => ({
    useNavigation: () => ({ setPage: mocks.setPage, goBack: mocks.goBack, cardEdit: mocks.cardEdit, replaceHash: mocks.replaceHash }),
    useData: () => ({ editingCharacter: mocks.editingCharacter, setEditingCharacter: mocks.setEditingCharacter, loadData: mocks.loadData }),
    useAuth: () => ({ isAuthenticated: mocks.isAuthenticated, openLoginModal: mocks.openLoginModal }),
    useBackgroundTasks: () => ({ tasks: [], registerThemeSongJob: mocks.registerThemeSongJob }),
}))

vi.mock('@/infrastructure/api', () => ({
    ApiError: class ApiError extends Error { status = 500; isTransient = true },
    resolveMediaUrl: (url?: string | null) => url ?? undefined,
    isProtectedMediaUrl: () => false,
    apiService: {
        createCardAssistantConversation: mocks.createCardAssistantConversation,
        listCardAssistantConversations: mocks.listCardAssistantConversations,
        getCardAssistantConversation: mocks.getCardAssistantConversation,
        sendCardAssistantMessage: mocks.sendCardAssistantMessage,
        streamCardAssistantMessage: mocks.streamCardAssistantMessage,
        createCharacter: mocks.createCharacter,
        updateCharacter: mocks.updateCharacter,
        generateCardPortrait: mocks.generateCardPortrait,
        getCharacter: mocks.getCharacter,
        getCardDraft: mocks.getCardDraft,
        saveCardDraft: mocks.saveCardDraft,
        discardCardDraft: mocks.discardCardDraft,
        publishCardDraft: mocks.publishCardDraft,
        restoreVersionIntoDraft: mocks.restoreVersionIntoDraft,
        getCardVersion: mocks.getCardVersion,
        getPublishedBody: mocks.getPublishedBody,
        setCardMedia: mocks.setCardMedia,
        listCardVersions: mocks.listCardVersions,
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
        mocks.cardEdit = null
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
        mocks.cardEdit = null
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

describe('CharacterCreator navigation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isAuthenticated = true
        mocks.editingCharacter = null
        mocks.cardEdit = null
        mocks.createCharacter.mockResolvedValue({ id: 'c4', name: 'Bren', race: 'Dwarf' })
        mocks.loadData.mockResolvedValue(undefined)
        mocks.listCardAssistantConversations.mockResolvedValue({ conversations: [] })
    })

    it('stays in the editor after creating a new character (draft/publish from here)', async () => {
        render(<CharacterCreator />)

        fireEvent.click(screen.getByRole('button', { name: /skip — start with the standard fields/i }))
        fireEvent.change(screen.getByPlaceholderText(/lyra emberwind/i), { target: { value: 'Bren' } })
        fireEvent.change(screen.getByPlaceholderText(/elf, human, construct/i), { target: { value: 'Dwarf' } })
        fireEvent.click(screen.getByRole('button', { name: /^Create Character$/i }))

        await waitFor(() => expect(mocks.createCharacter).toHaveBeenCalledTimes(1))
        // New model: creating transitions into edit mode (so Publish/history are available)
        // instead of navigating away.
        await waitFor(() => expect(mocks.setEditingCharacter).toHaveBeenCalledWith(expect.objectContaining({ id: 'c4' })))
        expect(mocks.goBack).not.toHaveBeenCalledWith('landing')
        expect(mocks.setPage).not.toHaveBeenCalledWith('landing')
    })

    it('returns to the origin from edit back and cancel actions', () => {
        mocks.editingCharacter = { id: 'char-1', name: 'Nyra', race: 'moon elf', description: '', triggers: [] }
        const { rerender } = render(<CharacterCreator />)

        fireEvent.click(screen.getByRole('button', { name: /^Back$/i }))
        expect(mocks.setEditingCharacter).toHaveBeenCalledWith(null)
        expect(mocks.goBack).toHaveBeenCalledWith('landing')

        vi.clearAllMocks()
        mocks.editingCharacter = { id: 'char-1', name: 'Nyra', race: 'moon elf', description: '', triggers: [] }
        rerender(<CharacterCreator />)

        fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i }))
        expect(mocks.setEditingCharacter).toHaveBeenCalledWith(null)
        expect(mocks.goBack).toHaveBeenCalledWith('landing')
    })

    it('returns to the template picker before leaving an unsaved create form', () => {
        render(<CharacterCreator />)

        fireEvent.click(screen.getByRole('button', { name: /skip — start with the standard fields/i }))
        fireEvent.click(screen.getByRole('button', { name: /^Back$/i }))

        expect(mocks.goBack).not.toHaveBeenCalled()
        expect(screen.getByRole('button', { name: /skip — start with the standard fields/i })).toBeInTheDocument()
    })
})

describe('CharacterCreator portrait persistence', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isAuthenticated = true
        mocks.editingCharacter = { id: 'char-1', name: 'Nyra', race: 'moon elf', description: '', triggers: [] }
        mocks.cardEdit = null
        mocks.getCardDraft.mockResolvedValue({ id: 'char-1', is_draft: false, latest_version_number: 0 })
        mocks.setCardMedia.mockResolvedValue({})
        mocks.generateCardPortrait.mockResolvedValue({
            job_id: 'job-1',
            status: 'completed',
            assets: [{ url: '/generated-images/p.png' }],
        })
    })

    it('persists a generated portrait to the published body immediately (no Save click)', async () => {
        render(<CharacterCreator />)

        fireEvent.click(screen.getByRole('button', { name: /generate profile image/i }))

        // Media is a published-body property — persisted via setCardMedia, not staged in the draft.
        await waitFor(() =>
            expect(mocks.setCardMedia).toHaveBeenCalledWith(
                'character',
                'char-1',
                expect.objectContaining({ image_url: '/generated-images/p.png' }),
            ),
        )
    })
})

describe('CharacterCreator deep-link bootstrap', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isAuthenticated = true
        mocks.editingCharacter = null
        mocks.cardEdit = null
        mocks.listCardAssistantConversations.mockResolvedValue({ conversations: [] })
        mocks.getCardDraft.mockResolvedValue({ id: 'char-1', is_draft: false, latest_version_number: 2 })
        // Reflect the editing card back into the mocked DataProvider so the editor re-renders
        // (the real provider does this; here setEditingCharacter is a stub).
        mocks.setEditingCharacter.mockImplementation((card: Record<string, unknown> | null) => {
            mocks.editingCharacter = card
        })
    })

    it('restores the editor from `?card=<id>` on refresh without flashing the create gallery', async () => {
        // Deep-link / cold refresh: route carries the id but no card is in memory yet.
        mocks.cardEdit = { cardType: 'character', cardId: 'char-1' }
        mocks.getCharacter.mockResolvedValue({ id: 'char-1', name: 'Nyra', race: 'moon elf', description: 'Scout', triggers: [] })

        render(<CharacterCreator />)

        // No "create" template gallery flash — the fetched card hydrates the edit form instead.
        expect(screen.queryByRole('button', { name: /skip — start with the standard fields/i })).not.toBeInTheDocument()
        await waitFor(() => expect(mocks.getCharacter).toHaveBeenCalledWith('char-1'))
        await waitFor(() => expect(mocks.setEditingCharacter).toHaveBeenCalledWith(expect.objectContaining({ id: 'char-1', name: 'Nyra' })))
        await waitFor(() => expect(screen.getByDisplayValue('Nyra')).toBeInTheDocument())
    })

    it('bounces to the gallery when the deep-linked card cannot be loaded', async () => {
        mocks.cardEdit = { cardType: 'character', cardId: 'gone' }
        mocks.getCharacter.mockRejectedValue(new Error('404'))

        render(<CharacterCreator />)

        await waitFor(() => expect(mocks.setPage).toHaveBeenCalledWith('gallery-characters'))
    })

    it('prompts login for a deep-link while unauthenticated (no fetch)', async () => {
        mocks.isAuthenticated = false
        mocks.cardEdit = { cardType: 'character', cardId: 'char-1' }

        render(<CharacterCreator />)

        await waitFor(() => expect(mocks.openLoginModal).toHaveBeenCalled())
        expect(mocks.getCharacter).not.toHaveBeenCalled()
    })

    it('shows a read-only version banner for `?version=<n>` and never clobbers the draft', async () => {
        mocks.editingCharacter = { id: 'char-1', name: 'Nyra', race: 'moon elf', description: 'Scout', triggers: [] }
        mocks.cardEdit = { cardType: 'character', cardId: 'char-1', version: 2 }
        mocks.getCardVersion.mockResolvedValue({ id: 'char-1', name: 'Nyra v2', race: 'moon elf', description: 'Older scout', triggers: [], is_historical: true, viewing_version_number: 2 })

        render(<CharacterCreator />)

        await waitFor(() => expect(mocks.getCardVersion).toHaveBeenCalledWith('character', 'char-1', 2))
        await waitFor(() => expect(screen.getByDisplayValue('Nyra v2')).toBeInTheDocument())
        // Read-only view must not stage/overwrite the draft.
        expect(mocks.saveCardDraft).not.toHaveBeenCalled()
        expect(mocks.restoreVersionIntoDraft).not.toHaveBeenCalled()
        // A "restore this version to edit" affordance is offered.
        expect(screen.getByRole('button', { name: /restore this version to edit/i })).toBeInTheDocument()
    })
})
