import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    // Workspace R1: the committed workspace, the captured creation origin and scoped clients.
    workspace: null as unknown as WorkspaceTestState,
    origin: {
        origin: null as { workspaceId: string; collectionId: string | null; returnTo: null } | null,
        isCaptured: false,
        capture: vi.fn(),
        clear: vi.fn(),
        registerReturnHandler: vi.fn(),
        returnToLibrary: vi.fn<(created: unknown) => boolean>(() => false),
    },
    withWorkspace: vi.fn(),
    getCollection: vi.fn(),
    setPage: vi.fn(),
    goBack: vi.fn(),
    loadData: vi.fn(),
    openLoginModal: vi.fn(),
    registerThemeSongJob: vi.fn(),
    createAssistantConversation: vi.fn(),
    listAssistantConversations: vi.fn(),
    getAssistantConversation: vi.fn(),
    streamAssistantMessage: vi.fn(),
    setEditingCharacter: vi.fn(),
    replaceHash: vi.fn(),
    createCharacter: vi.fn(),
    updateCharacter: vi.fn(),
    generateCardPortrait: vi.fn(),
    getImageProfiles: vi.fn(async () => ({ items: [], system_default_profile_id: null, user_default_profile_id: null, effective_default_profile_id: null })),
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
    characters: [] as Record<string, unknown>[],
}))

vi.mock('@/app/hooks', () => ({
    useNavigation: () => ({ setPage: mocks.setPage, goBack: mocks.goBack, cardEdit: mocks.cardEdit, currentHash: '', replaceHash: mocks.replaceHash, registerNavigationInterceptor: () => () => {} }),
    useData: () => ({
        editingCharacter: mocks.editingCharacter,
        setEditingCharacter: mocks.setEditingCharacter,
        loadData: mocks.loadData,
        characters: mocks.characters,
    }),
    useAuth: () => ({ isAuthenticated: mocks.isAuthenticated, openLoginModal: mocks.openLoginModal }),
    useBackgroundTasks: () => ({ tasks: [], registerThemeSongJob: mocks.registerThemeSongJob }),
}))

vi.mock('@/app/hooks/useWorkspace', () => ({ useWorkspace: () => mocks.workspace.value() }))

vi.mock('@/features/library/creationOrigin', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/features/library/creationOrigin')>()),
    useCreationOrigin: () => mocks.origin,
}))

vi.mock('@/infrastructure/api', () => ({
    ApiError: class ApiError extends Error { status = 500; isTransient = true },
    resolveMediaUrl: (url?: string | null) => url ?? undefined,
    isProtectedMediaUrl: () => false,
    isWorkspaceApiError: (error: unknown, code: string) => (error as { code?: string } | null)?.code === code,
    apiService: {
        withWorkspace: mocks.withWorkspace,
        getCollection: mocks.getCollection,
        createAssistantConversation: mocks.createAssistantConversation,
        listAssistantConversations: mocks.listAssistantConversations,
        getAssistantConversation: mocks.getAssistantConversation,
        streamAssistantMessage: mocks.streamAssistantMessage,
        createCharacter: mocks.createCharacter,
        updateCharacter: mocks.updateCharacter,
        generateCardPortrait: mocks.generateCardPortrait,
        getImageProfiles: mocks.getImageProfiles,
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

import { apiService } from '@/infrastructure/api'
import {
    createWorkspaceTestState,
    OTHER_WORKSPACE_ID,
    TEST_COLLECTION_ID,
    TEST_WORKSPACE_ID,
    testWorkspace,
    type WorkspaceTestState,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { CharacterCreator } from './CharacterCreator'

beforeEach(() => {
    mocks.withWorkspace.mockImplementation((workspaceId: string, options: { initialCollectionIds?: readonly string[] } = {}) =>
        Object.assign(Object.create(apiService), { workspaceScope: { workspaceId, initialCollectionIds: [...(options.initialCollectionIds ?? [])] } }))
    mocks.workspace = createWorkspaceTestState({ api: mocks.withWorkspace(TEST_WORKSPACE_ID) })
    mocks.withWorkspace.mockClear()
    mocks.origin.origin = { workspaceId: TEST_WORKSPACE_ID, collectionId: null, returnTo: null }
    mocks.origin.isCaptured = false
    mocks.origin.returnToLibrary.mockImplementation(() => false)
    mocks.getCollection.mockResolvedValue({ id: TEST_COLLECTION_ID, name: 'Heroes' })
})

/** The workspace scope (id + initial collections) a mocked API call was made through. */
function scopeOf(fn: { mock: { contexts: unknown[] } }, index = 0) {
    return (fn.mock.contexts[index] as { workspaceScope?: unknown } | undefined)?.workspaceScope
}

/** The other workspace is archived (read-only until restored). */
function archiveOtherWorkspace() {
    mocks.workspace = createWorkspaceTestState({
        api: mocks.withWorkspace(TEST_WORKSPACE_ID),
        workspaces: [
            testWorkspace(TEST_WORKSPACE_ID, 'Main library'),
            testWorkspace(OTHER_WORKSPACE_ID, 'Novel A', { archived_at: '2026-10-10T00:00:00Z' }),
        ],
    })
}

/** Opened from a Library folder: saves there and returns to the Library afterwards. */
function captureFolderOrigin() {
    mocks.origin.origin = { workspaceId: TEST_WORKSPACE_ID, collectionId: TEST_COLLECTION_ID, returnTo: null }
    mocks.origin.isCaptured = true
    mocks.origin.returnToLibrary.mockImplementation(() => true)
}

beforeEach(() => {
    mocks.characters = []
})

describe('CharacterCreator AI generation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isAuthenticated = true
        mocks.editingCharacter = null
        mocks.cardEdit = null
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [] })
        mocks.createAssistantConversation.mockResolvedValue({
            conversation: { conversation_id: 1, kind: 'card', card_type: 'character', card_id: null, title: 'Untitled Character' },
            messages: [],
            target: null,
            target_cas: null,
        })
        const assistantResponse = {
            conversation: { conversation_id: 1, kind: 'card', card_type: 'character', card_id: 'char-1', title: 'Untitled Character' },
            messages: [
                { message_id: 10, conversation_id: 1, sequence_no: 1, role: 'user', status: 'completed', content: 'Generate a moon scout' },
                { message_id: 11, conversation_id: 1, sequence_no: 2, role: 'assistant', status: 'completed', content: 'Created Nyra.' },
            ],
            target: {
                id: 'char-1',
                name: 'Nyra',
                race: 'moon elf',
                description: 'A quiet scout of the lunar dunes.',
                triggers: ['scout', 'moon'],
                category: [{ name: 'Stats', attributes: [{ Agility: '8', Wisdom: '6' }] }],
            },
        }
        mocks.streamAssistantMessage.mockImplementation(async (_conversationId: number, _body: unknown, onEvent: (event: Record<string, unknown>) => void) => {
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

        await waitFor(() => expect(mocks.createAssistantConversation).toHaveBeenCalledTimes(1))
        expect(mocks.createAssistantConversation).toHaveBeenCalledWith(
            {
                kind: 'card',
                card_type: 'character',
                title: 'Untitled Character',
            },
            expect.any(Object),
        )
        await waitFor(() => expect(mocks.streamAssistantMessage).toHaveBeenCalledTimes(1))
        expect(mocks.streamAssistantMessage).toHaveBeenCalledWith(
            1,
            {
                kind: 'card',
                message: 'Generate a moon scout',
                card_type: 'character',
                current: null,
            },
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
        expect(mocks.createAssistantConversation).not.toHaveBeenCalled()
        expect(mocks.streamAssistantMessage).not.toHaveBeenCalled()
        expect(mocks.loadData).not.toHaveBeenCalled()
    })
})

describe('CharacterCreator role payload', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isAuthenticated = true
        mocks.editingCharacter = null
        mocks.cardEdit = null
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [] })
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

    it('creates an AI character with a card-specific default chat persona', async () => {
        mocks.characters = [{ id: 'p2', name: 'Sera', race: 'Elf', role: 'persona' }]
        mocks.createCharacter.mockResolvedValue({ id: 'c1', name: 'Lyra', race: 'Human', role: 'character', default_persona_id: 'p2' })
        render(<CharacterCreator />)

        fireEvent.click(screen.getByRole('button', { name: /skip — start with the standard fields/i }))
        fireEvent.click(screen.getByRole('combobox', { name: /default 1:1 chat persona/i }))
        fireEvent.click(screen.getByText('Sera'))
        fireEvent.change(screen.getByPlaceholderText(/lyra emberwind/i), { target: { value: 'Lyra' } })
        fireEvent.change(screen.getByPlaceholderText(/elf, human, construct/i), { target: { value: 'Human' } })
        fireEvent.click(screen.getByRole('button', { name: /^Create Character$/i }))

        await waitFor(() =>
            expect(mocks.createCharacter).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Lyra',
                    race: 'Human',
                    role: 'character',
                    default_persona_id: 'p2',
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
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [] })
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

    it('flags a required field on blur, before any submit', () => {
        render(<CharacterCreator />)
        fireEvent.click(screen.getByRole('button', { name: /skip — start with the standard fields/i }))

        const nameInput = screen.getByPlaceholderText(/lyra emberwind/i)
        expect(screen.queryByText(/name is required/i)).toBeNull()

        fireEvent.blur(nameInput)
        expect(screen.getByText(/name is required/i)).toBeInTheDocument()

        fireEvent.change(nameInput, { target: { value: 'Bren' } })
        expect(screen.queryByText(/name is required/i)).toBeNull()

        // Untouched required fields still get flagged all at once on submit.
        fireEvent.click(screen.getByRole('button', { name: /^Create Character$/i }))
        expect(screen.getByText(/race \/ species is required/i)).toBeInTheDocument()
        expect(mocks.createCharacter).not.toHaveBeenCalled()
    })

    it('asks before leaving when the form has unsaved changes', () => {
        mocks.editingCharacter = { id: 'char-1', name: 'Nyra', race: 'moon elf', description: '', triggers: [] }
        render(<CharacterCreator />)

        fireEvent.change(screen.getByPlaceholderText(/lyra emberwind/i), { target: { value: 'Nyra Renamed' } })
        fireEvent.click(screen.getByRole('button', { name: /^Back$/i }))

        // Blocked: the confirm dialog is up, nothing navigated yet.
        expect(mocks.goBack).not.toHaveBeenCalled()
        expect(screen.getByText('Leave without saving?')).toBeInTheDocument()

        // Stay: dialog closes, still no navigation, edits intact.
        fireEvent.click(screen.getByRole('button', { name: /keep editing/i }))
        expect(mocks.goBack).not.toHaveBeenCalled()
        expect(screen.getByDisplayValue('Nyra Renamed')).toBeInTheDocument()

        // Leave: navigation completes.
        fireEvent.click(screen.getByRole('button', { name: /^Back$/i }))
        fireEvent.click(screen.getByRole('button', { name: /^Leave$/i }))
        expect(mocks.setEditingCharacter).toHaveBeenCalledWith(null)
        expect(mocks.goBack).toHaveBeenCalledWith('landing')
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
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [] })
        mocks.getCardDraft.mockResolvedValue({ id: 'char-1', is_draft: false, latest_version_number: 2 })
        // Reflect the editing card back into the mocked DataProvider so the editor re-renders
        // (the real provider does this; here setEditingCharacter is a stub).
        mocks.setEditingCharacter.mockImplementation((card: Record<string, unknown> | null) => {
            mocks.editingCharacter = card
        })
    })

    it.each([false, true])('restores the editor from `?card=<id>` on refresh (StrictMode: %s) without flashing the create gallery', async (reactStrictMode) => {
        // Deep-link / cold refresh: route carries the id but no card is in memory yet.
        mocks.cardEdit = { cardType: 'character', cardId: 'char-1' }
        mocks.getCharacter.mockResolvedValue({ id: 'char-1', name: 'Nyra', race: 'moon elf', description: 'Scout', triggers: [] })

        render(<CharacterCreator />, { reactStrictMode })

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

describe('CharacterCreator workspace origin', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isAuthenticated = true
        mocks.editingCharacter = null
        mocks.cardEdit = null
        mocks.createCharacter.mockResolvedValue({ id: 'c4', name: 'Bren', race: 'Dwarf' })
        mocks.loadData.mockResolvedValue(undefined)
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [] })
    })

    function fillAndCreate() {
        fireEvent.click(screen.getByRole('button', { name: /skip — start with the standard fields/i }))
        fireEvent.change(screen.getByPlaceholderText(/lyra emberwind/i), { target: { value: 'Bren' } })
        fireEvent.change(screen.getByPlaceholderText(/elf, human, construct/i), { target: { value: 'Dwarf' } })
        fireEvent.click(screen.getByRole('button', { name: /^Create Character$/i }))
    }

    it('shows where a new card will be saved before any submission', async () => {
        const { unmount } = render(<CharacterCreator />)
        expect(screen.getByTestId('creation-destination')).toHaveTextContent('Will be saved in Main library / Library')
        unmount()

        captureFolderOrigin()
        render(<CharacterCreator />)
        await waitFor(() => expect(screen.getByTestId('creation-destination')).toHaveTextContent('Will be saved in Main library / Heroes'))
        expect(mocks.getCollection).toHaveBeenCalledWith(TEST_WORKSPACE_ID, TEST_COLLECTION_ID)
    })

    it('creates at the captured origin with its collection and returns to the Library', async () => {
        captureFolderOrigin()
        render(<CharacterCreator />)
        fillAndCreate()

        await waitFor(() => expect(mocks.origin.returnToLibrary).toHaveBeenCalledWith({ cardType: 'character', cardId: 'c4' }))
        expect(scopeOf(mocks.createCharacter)).toEqual({ workspaceId: TEST_WORKSPACE_ID, initialCollectionIds: [TEST_COLLECTION_ID] })
        // The Library took over: no transition into this editor.
        expect(mocks.setEditingCharacter).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'c4' }))
        expect(mocks.replaceHash).not.toHaveBeenCalled()
        expect(mocks.goBack).not.toHaveBeenCalled()
    })

    it('keeps the existing behavior when no Library location was captured', async () => {
        render(<CharacterCreator />)
        fillAndCreate()

        await waitFor(() => expect(mocks.setEditingCharacter).toHaveBeenCalledWith(expect.objectContaining({ id: 'c4' })))
        expect(mocks.origin.returnToLibrary).toHaveBeenCalledWith({ cardType: 'character', cardId: 'c4' })
        expect(scopeOf(mocks.createCharacter)).toEqual({ workspaceId: TEST_WORKSPACE_ID, initialCollectionIds: [] })
    })

    it("saves an existing card's draft in its own workspace, never with initial collections", async () => {
        captureFolderOrigin()
        mocks.editingCharacter = {
            id: 'char-1', name: 'Nyra', race: 'moon elf', description: '', triggers: [],
            organization: { workspace_id: OTHER_WORKSPACE_ID, collection_ids: [] },
        }
        mocks.getCardDraft.mockResolvedValue({ id: 'char-1', is_draft: false, latest_version_number: 1 })
        mocks.saveCardDraft.mockResolvedValue({ id: 'char-1', is_draft: true, latest_version_number: 1 })
        render(<CharacterCreator />)

        expect(screen.queryByTestId('creation-destination')).toBeNull()
        await waitFor(() => expect(mocks.getCardDraft).toHaveBeenCalled())
        fireEvent.click(screen.getAllByRole('button', { name: /^Save draft$/i })[0])

        await waitFor(() => expect(mocks.saveCardDraft).toHaveBeenCalledTimes(1))
        expect(scopeOf(mocks.saveCardDraft)).toEqual({ workspaceId: OTHER_WORKSPACE_ID, initialCollectionIds: [] })
        expect(scopeOf(mocks.getCardDraft)).toEqual({ workspaceId: OTHER_WORKSPACE_ID, initialCollectionIds: [] })
    })

    it('shows a concise notice when the first card lost its deleted collection', async () => {
        captureFolderOrigin()
        mocks.createAssistantConversation.mockResolvedValue({
            conversation: { conversation_id: 1, kind: 'card', card_type: 'character', card_id: null, title: 'Untitled Character' },
            messages: [], target: null, target_cas: null,
        })
        mocks.streamAssistantMessage.mockImplementation(async (_id: number, _body: unknown, onEvent: (event: Record<string, unknown>) => void) => {
            onEvent({
                type: 'final',
                conversation: { conversation_id: 1, kind: 'card', card_type: 'character', card_id: 'char-1', title: 'Untitled Character' },
                messages: [],
                target: { id: 'char-1', name: 'Nyra', race: 'moon elf', description: '', triggers: [] },
                organization_warnings: [{ code: 'COLLECTION_REMOVED', collection_id: TEST_COLLECTION_ID }],
            })
        })
        render(<CharacterCreator />)

        fireEvent.click(screen.getByRole('button', { name: /open card assistant/i }))
        fireEvent.change(screen.getByPlaceholderText(/ask for a change/i), { target: { value: 'Generate a moon scout' } })
        fireEvent.click(screen.getByRole('button', { name: /send message/i }))

        expect(await screen.findByTestId('organization-warning')).toHaveTextContent(/collection it was going into was deleted/i)
        expect(scopeOf(mocks.streamAssistantMessage)).toEqual({ workspaceId: TEST_WORKSPACE_ID, initialCollectionIds: [TEST_COLLECTION_ID] })
    })

    it('Back returns to the captured Library location', () => {
        captureFolderOrigin()
        render(<CharacterCreator />)

        fireEvent.click(screen.getByRole('button', { name: /^Back$/i }))
        expect(mocks.origin.returnToLibrary).toHaveBeenCalledWith(null)
        expect(mocks.goBack).not.toHaveBeenCalled()
    })

    it('a committed workspace switch resets the form and saves to the new workspace root', () => {
        captureFolderOrigin()
        const { rerender } = render(<CharacterCreator />)
        fireEvent.click(screen.getByRole('button', { name: /skip — start with the standard fields/i }))
        fireEvent.change(screen.getByPlaceholderText(/lyra emberwind/i), { target: { value: 'Bren' } })

        mocks.workspace.switchTo(OTHER_WORKSPACE_ID)
        rerender(<CharacterCreator />)

        // Fresh form on the template gallery; the old folder origin is dropped.
        expect(screen.getByRole('button', { name: /skip — start with the standard fields/i })).toBeInTheDocument()
        expect(screen.getByTestId('creation-destination')).toHaveTextContent('Will be saved in Novel A / Library')
        expect(mocks.origin.clear).toHaveBeenCalled()
    })
})

describe('CharacterCreator in an archived workspace', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isAuthenticated = true
        mocks.editingCharacter = null
        mocks.cardEdit = null
        mocks.loadData.mockResolvedValue(undefined)
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [] })
        archiveOtherWorkspace()
    })

    it('opens an existing card read-only while keeping history and Back', async () => {
        mocks.editingCharacter = {
            id: 'char-1', name: 'Nyra', race: 'moon elf', description: '', triggers: [],
            organization: { workspace_id: OTHER_WORKSPACE_ID, collection_ids: [] },
        }
        mocks.getCardDraft.mockResolvedValue({
            id: 'char-1', name: 'Nyra', race: 'moon elf', description: '', triggers: [],
            is_draft: true, based_on_version_number: 1, latest_version_number: 1,
        })
        render(<CharacterCreator />)
        await waitFor(() => expect(mocks.getCardDraft).toHaveBeenCalled())

        expect(await screen.findByDisplayValue('Nyra')).toBeDisabled()
        expect(screen.getByDisplayValue('moon elf')).toBeDisabled()
        for (const save of screen.getAllByRole('button', { name: /^Save draft$/i })) expect(save).toBeDisabled()
        expect(screen.getByRole('button', { name: /^Publish$/i })).toBeDisabled()
        expect(screen.getByRole('button', { name: /generate profile image/i })).toBeDisabled()
        expect(screen.getByRole('button', { name: /generate theme/i })).toBeDisabled()
        expect(screen.getByRole('button', { name: /version history/i })).toBeEnabled()
        expect(screen.getAllByRole('button', { name: /^Back$/i })[0]).toBeEnabled()
        expect(screen.getByRole('button', { name: /^Cancel$/i })).toBeEnabled()

        fireEvent.click(screen.getByRole('button', { name: /open card assistant/i }))
        fireEvent.change(screen.getByPlaceholderText(/ask for a change/i), { target: { value: 'Rename her' } })
        expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled()
        fireEvent.keyDown(screen.getByPlaceholderText(/ask for a change/i), { key: 'Enter' })
        expect(mocks.streamAssistantMessage).not.toHaveBeenCalled()

        // Even a forced submit never writes to the archived workspace.
        fireEvent.submit(screen.getByDisplayValue('Nyra').closest('form')!)
        expect(await screen.findByText(/this workspace is archived/i)).toBeInTheDocument()
        expect(mocks.saveCardDraft).not.toHaveBeenCalled()
    })

    it('does not create a new card at an archived origin', async () => {
        mocks.origin.origin = { workspaceId: OTHER_WORKSPACE_ID, collectionId: null, returnTo: null }
        mocks.origin.isCaptured = true
        mocks.workspace.switchTo(OTHER_WORKSPACE_ID)
        render(<CharacterCreator />)

        expect(screen.getByRole('button', { name: /generate character/i })).toBeDisabled()
        fireEvent.click(screen.getByRole('button', { name: /skip — start with the standard fields/i }))
        expect(screen.getByPlaceholderText(/lyra emberwind/i)).toBeDisabled()
        expect(screen.getByRole('button', { name: /^Create Character$/i })).toBeDisabled()
        expect(mocks.createCharacter).not.toHaveBeenCalled()
    })
})
