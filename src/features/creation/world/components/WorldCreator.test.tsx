import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    setEditingWorld: vi.fn(),
    replaceHash: vi.fn(),
    createWorld: vi.fn(),
    updateWorld: vi.fn(),
    generateCardPortrait: vi.fn(),
    getWorld: vi.fn(),
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
    editingWorld: null as Record<string, unknown> | null,
    cardEdit: null as Record<string, unknown> | null,
}))

vi.mock('@/app/hooks', () => ({
    useNavigation: () => ({ setPage: mocks.setPage, goBack: mocks.goBack, cardEdit: mocks.cardEdit, replaceHash: mocks.replaceHash }),
    useData: () => ({ editingWorld: mocks.editingWorld, setEditingWorld: mocks.setEditingWorld, loadData: mocks.loadData }),
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
        createWorld: mocks.createWorld,
        updateWorld: mocks.updateWorld,
        generateCardPortrait: mocks.generateCardPortrait,
        getWorld: mocks.getWorld,
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

import { WorldCreator } from './WorldCreator'

describe('WorldCreator AI generation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isAuthenticated = true
        mocks.editingWorld = null
        mocks.listCardAssistantConversations.mockResolvedValue({ conversations: [] })
        mocks.createCardAssistantConversation.mockResolvedValue({
            conversation: { conversation_id: 2, card_type: 'world', card_id: null, title: 'Untitled World' },
            messages: [],
            card: null,
        })
        const assistantResponse = {
            conversation: { conversation_id: 2, card_type: 'world', card_id: 'world-1', title: 'Untitled World' },
            messages: [
                { message_id: 20, conversation_id: 2, sequence_no: 1, role: 'user', status: 'completed', content: 'Generate a glass desert' },
                { message_id: 21, conversation_id: 2, sequence_no: 2, role: 'assistant', status: 'completed', content: 'Created Glass.' },
            ],
            card: {
                id: 'world-1',
                name: 'Glass',
                place_type: 'country',
                type: 'desert',
                description: 'An endless sea of fused sand.',
                triggers: ['glass', 'desert'],
            },
        }
        mocks.sendCardAssistantMessage.mockResolvedValue(assistantResponse)
        mocks.streamCardAssistantMessage.mockImplementation(async (_conversationId: number, _body: unknown, onEvent: (event: Record<string, unknown>) => void) => {
            onEvent({ type: 'final', ...assistantResponse })
        })
        mocks.loadData.mockResolvedValue(undefined)
    })

    it('sends a creator conversation turn and populates the creator in edit mode (no navigation)', async () => {
        render(<WorldCreator />)

        fireEvent.click(screen.getByRole('button', { name: /open card assistant/i }))
        fireEvent.change(screen.getByPlaceholderText(/ask for a change/i), { target: { value: 'Generate a glass desert' } })
        fireEvent.click(screen.getByRole('button', { name: /send message/i }))

        await waitFor(() => expect(mocks.createCardAssistantConversation).toHaveBeenCalledTimes(1))
        expect(mocks.createCardAssistantConversation).toHaveBeenCalledWith(
            expect.objectContaining({
                card_type: 'world',
                card_id: undefined,
                title: 'Untitled World',
                current_card: expect.objectContaining({ name: '', place_type: 'world', type: '', description: '' }),
            }),
            expect.any(Object),
        )
        await waitFor(() => expect(mocks.streamCardAssistantMessage).toHaveBeenCalledTimes(1))
        expect(mocks.streamCardAssistantMessage).toHaveBeenCalledWith(
            2,
            expect.objectContaining({
                message: 'Generate a glass desert',
                current_card: expect.objectContaining({ name: '', place_type: 'world', type: '', description: '' }),
                request_id: expect.stringMatching(/^mw-card-assistant-/),
            }),
            expect.any(Function),
            expect.objectContaining({ requestId: expect.stringMatching(/^mw-card-assistant-/) }),
        )

        // The generated card populates the live form…
        await waitFor(() => expect(screen.getByDisplayValue('Glass')).toBeInTheDocument())
        expect(screen.getByRole('combobox', { name: /place type/i })).toHaveTextContent('Country')
        expect(screen.getByDisplayValue('desert')).toBeInTheDocument()

        // …switches into edit mode for the already-persisted card…
        expect(mocks.setEditingWorld).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'world-1', name: 'Glass', place_type: 'country', type: 'desert' }),
        )
        // …refreshes the library in the background, and does NOT navigate away.
        await waitFor(() => expect(mocks.loadData).toHaveBeenCalledTimes(1))
        expect(mocks.setPage).not.toHaveBeenCalledWith('landing')
    })

    it('opens login modal instead of opening the assistant when unauthenticated', async () => {
        mocks.isAuthenticated = false
        render(<WorldCreator />)

        fireEvent.click(screen.getByRole('button', { name: /open card assistant/i }))

        await waitFor(() => expect(mocks.openLoginModal).toHaveBeenCalledTimes(1))
        expect(mocks.createCardAssistantConversation).not.toHaveBeenCalled()
        expect(mocks.sendCardAssistantMessage).not.toHaveBeenCalled()
        expect(mocks.streamCardAssistantMessage).not.toHaveBeenCalled()
        expect(mocks.loadData).not.toHaveBeenCalled()
    })
})

describe('WorldCreator portrait persistence', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isAuthenticated = true
        mocks.editingWorld = { id: 'world-1', name: 'Glass', type: 'desert', description: '', triggers: [] }
        mocks.getCardDraft.mockResolvedValue({ id: 'world-1', is_draft: false, latest_version_number: 0 })
        mocks.setCardMedia.mockResolvedValue({})
        mocks.generateCardPortrait.mockResolvedValue({
            job_id: 'job-1',
            status: 'completed',
            assets: [{ url: '/generated-images/w.png' }],
        })
    })

    it('persists a generated image to the published body immediately (no Save click)', async () => {
        render(<WorldCreator />)

        fireEvent.click(screen.getByRole('button', { name: /generate setting image/i }))

        await waitFor(() =>
            expect(mocks.generateCardPortrait).toHaveBeenCalledWith(
                expect.objectContaining({
                    card_type: 'world',
                    name: 'Glass',
                    place_type: 'world',
                    subtype: 'desert',
                }),
                expect.any(Object),
            ),
        )

        // Media is a published-body property — persisted via setCardMedia, not staged in the draft.
        await waitFor(() =>
            expect(mocks.setCardMedia).toHaveBeenCalledWith(
                'world',
                'world-1',
                expect.objectContaining({ image_url: '/generated-images/w.png' }),
            ),
        )
    })
})

describe('WorldCreator navigation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isAuthenticated = true
        mocks.editingWorld = null
        mocks.createWorld.mockResolvedValue({ id: 'world-2', name: 'Glass Province' })
        mocks.loadData.mockResolvedValue(undefined)
        mocks.listCardAssistantConversations.mockResolvedValue({ conversations: [] })
    })

    it('stays in the editor after creating a new world (draft/publish from here)', async () => {
        render(<WorldCreator />)

        fireEvent.click(screen.getByRole('button', { name: /skip — start with the standard fields/i }))
        fireEvent.change(screen.getByRole('textbox', { name: /^name/i }), { target: { value: 'Glass Province' } })
        fireEvent.change(screen.getByLabelText(/genre \/ vibe/i), { target: { value: 'Mystery' } })
        fireEvent.click(screen.getByRole('button', { name: /^Create World$/i }))

        await waitFor(() => expect(mocks.createWorld).toHaveBeenCalledTimes(1))
        // New model: creating transitions into edit mode instead of navigating away.
        await waitFor(() => expect(mocks.setEditingWorld).toHaveBeenCalledWith(expect.objectContaining({ id: 'world-2' })))
        expect(mocks.goBack).not.toHaveBeenCalledWith('landing')
        expect(mocks.setPage).not.toHaveBeenCalledWith('landing')
    })

    it('returns to the origin from edit back', () => {
        mocks.editingWorld = { id: 'world-1', name: 'Glass', type: 'desert', description: '', triggers: [] }
        render(<WorldCreator />)

        fireEvent.click(screen.getByRole('button', { name: /^Back$/i }))

        expect(mocks.setEditingWorld).toHaveBeenCalledWith(null)
        expect(mocks.goBack).toHaveBeenCalledWith('landing')
    })
})

describe('WorldCreator place type payloads', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isAuthenticated = true
        mocks.editingWorld = null
        mocks.createWorld.mockResolvedValue({ id: 'world-2', name: 'Glass Province' })
        mocks.loadData.mockResolvedValue(undefined)
        mocks.listCardAssistantConversations.mockResolvedValue({ conversations: [] })
        mocks.createCardAssistantConversation.mockResolvedValue({
            conversation: { conversation_id: 2, card_type: 'world', card_id: null, title: 'Untitled World' },
            messages: [],
            card: null,
        })
    })

    it('saves a custom place type separately from the existing genre field', async () => {
        render(<WorldCreator />)

        // Create mode opens on the template gallery — continue with the standard fields.
        fireEvent.click(screen.getByRole('button', { name: /skip — start with the standard fields/i }))

        fireEvent.change(screen.getByRole('textbox', { name: /^name/i }), { target: { value: 'Glass Province' } })
        fireEvent.click(screen.getByRole('combobox', { name: /place type/i }))
        fireEvent.click(screen.getByRole('option', { name: /^Custom/ }))
        fireEvent.change(screen.getByLabelText(/custom place type/i), { target: { value: 'province' } })
        fireEvent.change(screen.getByLabelText(/genre \/ vibe/i), { target: { value: 'Mystery' } })
        fireEvent.click(screen.getByRole('button', { name: /create world/i }))

        await waitFor(() => expect(mocks.createWorld).toHaveBeenCalledTimes(1))
        expect(mocks.createWorld).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Glass Province',
                place_type: 'province',
                type: 'Mystery',
            }),
        )
        // place_type is also dual-written into the Setting category so it
        // survives the backend (which drops the first-class field).
        const payload = mocks.createWorld.mock.calls[0][0]
        const setting = payload.category.find((c: { name: string }) => c.name === 'Setting')
        expect(setting?.attributes).toContainEqual({ 'Place type': 'province' })
    })

    it('restores the place type from the Setting mirror when the API dropped the field', () => {
        mocks.editingWorld = {
            id: 'world-3',
            name: 'Vellore',
            type: 'Political Intrigue',
            description: '',
            triggers: [],
            category: [{ name: 'Setting', description: '', attributes: [{ 'Place type': 'city' }] }],
        }
        render(<WorldCreator />)

        expect(screen.getByRole('combobox', { name: /place type/i })).toHaveTextContent('City')
    })
})
