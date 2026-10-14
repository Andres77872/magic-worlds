import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
    // The props the creator passes to the voice picker (a spy around the real dialog).
    pickerProps: null as Record<string, unknown> | null,
}))

vi.mock('@/features/voices', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/features/voices')>()
    const { createElement } = await import('react')
    return {
        ...actual,
        VoicePickerDialog: (props: Parameters<typeof actual.VoicePickerDialog>[0]) => {
            mocks.pickerProps = props as unknown as Record<string, unknown>
            return createElement(actual.VoicePickerDialog, props)
        },
    }
})

vi.mock('@/features/workspaces/originNavigation', () => ({
    useOriginNavigation: () => ({ navigateToOrigin: vi.fn(), registerOriginNavigator: () => () => undefined }),
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

import { ApiError, apiService } from '@/infrastructure/api'
import {
    createWorkspaceTestState,
    OTHER_WORKSPACE_ID,
    TEST_COLLECTION_ID,
    TEST_WORKSPACE_ID,
    testWorkspace,
    type WorkspaceTestState,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { CAPABILITIES_EL_PLUS, CATALOG_MAREN_HOUSE, CATALOG_SELA_LEAVING, VOICE_KEY_MAREN, VOICE_KEY_SELA } from '@/features/voices/fixtures'
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

describe('CharacterCreator voice (D38, D32)', () => {
    // Stored values as the BFF returns them; saves must re-send them untouched.
    const PRESET_VOICE = {
        schema_version: 2,
        provider: 'elevenlabs',
        voice_key: 'vk_1111aaaa2222bbbb3333cccc4444dddd',
        voice_name: 'Child girl',
        settings: { stability: 0.6, similarity_boost: 0.7, speed: 1.05 },
        emotion: 'happy',
        language_code: 'en',
        preset_id: 'p1',
        preset_name: 'Child girl',
    }
    const V2_VOICE = {
        schema_version: 2,
        provider: 'elevenlabs',
        voice_key: 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f',
        voice_name: 'Eldrin',
        settings: { stability: 0.5, similarity_boost: 0.75, speed: 1 },
        emotion: null,
        language_code: null,
        preset_id: null,
        preset_name: null,
    }

    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubEnv('VITE_FEATURE_VOICES_ENABLED', 'true')
        mocks.isAuthenticated = true
        mocks.editingCharacter = null
        mocks.cardEdit = null
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [] })
        mocks.getCardDraft.mockResolvedValue({ id: 'p1', is_draft: false, latest_version_number: 1 })
        mocks.saveCardDraft.mockResolvedValue({ id: 'p1', is_draft: true, latest_version_number: 1 })
        mocks.setEditingCharacter.mockImplementation((card: Record<string, unknown> | null) => {
            mocks.editingCharacter = card
        })
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    async function saveDraft() {
        await waitFor(() => expect(mocks.getCardDraft).toHaveBeenCalled())
        fireEvent.click(screen.getAllByRole('button', { name: /^Save draft$/i })[0])
        await waitFor(() => expect(mocks.saveCardDraft).toHaveBeenCalledTimes(1))
        return mocks.saveCardDraft.mock.calls[0][2] as { voice: unknown }
    }

    it('hides the voice field and picker for persona cards and keeps the stored voice on save', async () => {
        const voice = { ...PRESET_VOICE }
        mocks.editingCharacter = { id: 'p1', name: 'Aria', race: 'Human', role: 'persona', description: '', triggers: [], voice }
        render(<CharacterCreator />)

        expect(screen.getByDisplayValue('Aria')).toBeInTheDocument()
        expect(screen.queryByText('Narration voice')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /^(Choose voice|Change)$/ })).not.toBeInTheDocument()
        expect(screen.queryByText('Child girl')).not.toBeInTheDocument()

        const payload = await saveDraft()
        expect(payload.voice).toBe(voice)
        expect(JSON.stringify(payload.voice)).toBe(JSON.stringify(PRESET_VOICE))
    })

    it('hides the voice field once a card switches to the persona role', () => {
        mocks.editingCharacter = { id: 'c1', name: 'Lyra', race: 'Elf', role: 'character', description: '', triggers: [], voice: { ...PRESET_VOICE } }
        render(<CharacterCreator />)

        expect(screen.getByText('Narration voice')).toBeInTheDocument()
        fireEvent.click(screen.getByText('User persona').closest('button')!)
        expect(screen.queryByText('Narration voice')).not.toBeInTheDocument()
    })

    it('shows a character voice by name, never by id, and re-sends a V2 voice untouched', async () => {
        const voice = { ...V2_VOICE }
        mocks.editingCharacter = { id: 'c1', name: 'Lyra', race: 'Elf', role: 'character', description: '', triggers: [], voice }
        render(<CharacterCreator />)

        expect(screen.getByText('Narration voice')).toBeInTheDocument()
        expect(screen.getByText('Eldrin')).toBeInTheDocument()
        expect(screen.queryByText(/vk_3f0c2a9e/)).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument()

        fireEvent.change(screen.getByDisplayValue('Lyra'), { target: { value: 'Lyra the Bold' } })
        const payload = await saveDraft()
        expect(payload.voice).toBe(voice)
        expect(JSON.stringify(payload.voice)).toBe(JSON.stringify(V2_VOICE))
    })

    it('never shows a raw voice key for a voice without a name', () => {
        mocks.editingCharacter = { id: 'c1', name: 'Lyra', race: 'Elf', role: 'character', description: '', triggers: [], voice: { ...V2_VOICE, voice_name: '' } }
        render(<CharacterCreator />)

        expect(screen.getByText('Voice')).toBeInTheDocument()
        expect(screen.queryByText(/vk_3f0c2a9e/)).not.toBeInTheDocument()
    })

    it('a deep-linked persona keeps its stored voice on save (no `voice: null` overwrite)', async () => {
        mocks.cardEdit = { cardType: 'character', cardId: 'p1' }
        mocks.getCharacter.mockResolvedValue({ id: 'p1', name: 'Aria', race: 'Human', role: 'persona', description: '', triggers: [], voice: { ...PRESET_VOICE } })
        render(<CharacterCreator />)

        await waitFor(() => expect(screen.getByDisplayValue('Aria')).toBeInTheDocument())
        expect(screen.queryByText('Narration voice')).not.toBeInTheDocument()

        const payload = await saveDraft()
        expect(JSON.stringify(payload.voice)).toBe(JSON.stringify(PRESET_VOICE))
    })

    it('shows an unrecognised stored voice as the default but re-sends it untouched on save (09 §3.2)', async () => {
        const voice = { schema_version: 2, provider: 'elevenlabs', voice_name: 'Eldrin' }
        mocks.editingCharacter = { id: 'c1', name: 'Lyra', race: 'Elf', role: 'character', description: '', triggers: [], voice }
        render(<CharacterCreator />)

        expect(screen.getByText('Uses the default narration voice.')).toBeInTheDocument()
        const payload = await saveDraft()
        expect(payload.voice).toBe(voice)
    })

    it('a deep-linked card keeps an unrecognised stored voice instead of saving `voice: null`', async () => {
        const stored = { schema_version: 2, voice_key: '' }
        mocks.cardEdit = { cardType: 'character', cardId: 'c1' }
        mocks.getCharacter.mockResolvedValue({ id: 'c1', name: 'Lyra', race: 'Elf', role: 'character', description: '', triggers: [], voice: stored })
        render(<CharacterCreator />)

        await waitFor(() => expect(screen.getByDisplayValue('Lyra')).toBeInTheDocument())
        const payload = await saveDraft()
        expect(payload.voice).not.toBeNull()
        expect(JSON.stringify(payload.voice)).toBe(JSON.stringify(stored))
    })
})

describe('CharacterCreator effective voice (R1-FE-03, R1-FE-01)', () => {
    const V2_VOICE = {
        schema_version: 2,
        provider: 'elevenlabs',
        voice_key: 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f',
        voice_name: 'Eldrin',
        settings: null,
        emotion: null,
        language_code: null,
    }
    const EFFECTIVE = {
        voice_key: 'vk_0a1b2c3d4e5f60718293a4b5c6d7e8f9',
        display_name: 'Maren',
        provider_route: 'elevenlabs',
        substitution_reason: 'voice_removed',
        badges: ['replaced'],
    }
    const extraApi = apiService as unknown as Record<string, unknown>
    const EXTRA_KEYS = ['getVoiceCapabilities', 'listVoiceCatalog', 'listVoicePresets', 'getVoiceCatalogByKeys', 'getUserProfile', 'getEffectiveVoice', 'fetchProtectedMediaBlob']

    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubEnv('VITE_FEATURE_VOICES_ENABLED', 'true')
        mocks.isAuthenticated = true
        mocks.editingCharacter = null
        mocks.cardEdit = null
        mocks.pickerProps = null
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [] })
        mocks.getCardDraft.mockResolvedValue({ id: 'c1', is_draft: false, latest_version_number: 1 })
        mocks.saveCardDraft.mockResolvedValue({ id: 'c1', is_draft: true, latest_version_number: 1 })
    })

    afterEach(() => {
        for (const key of EXTRA_KEYS) delete extraApi[key]
        vi.unstubAllEnvs()
    })

    it('shows what a projection plays as, and never sends it back', async () => {
        const voice = { ...V2_VOICE }
        mocks.editingCharacter = { id: 'c1', name: 'Lyra', race: 'Elf', role: 'character', description: '', triggers: [], voice, effective_voice: EFFECTIVE }
        render(<CharacterCreator />)

        expect(screen.getByText('Eldrin')).toBeInTheDocument()
        expect(screen.getByText('Plays as Maren')).toBeInTheDocument()
        expect(screen.getByText('Voice replaced')).toBeInTheDocument()
        expect(mocks.pickerProps?.currentEffectiveVoice).toEqual(EFFECTIVE)

        await waitFor(() => expect(mocks.getCardDraft).toHaveBeenCalled())
        fireEvent.click(screen.getAllByRole('button', { name: /^Save draft$/i })[0])
        await waitFor(() => expect(mocks.saveCardDraft).toHaveBeenCalledTimes(1))
        const payload = mocks.saveCardDraft.mock.calls[0][2] as Record<string, unknown>
        expect(payload).not.toHaveProperty('effective_voice')
        expect(payload.voice).toBe(voice)
    })

    it('keeps the plain name without a projection', () => {
        mocks.editingCharacter = {
            id: 'c1', name: 'Lyra', race: 'Elf', role: 'character', description: '', triggers: [],
            voice: { ...V2_VOICE, voice_name: '', preset_name: 'Child girl' },
        }
        render(<CharacterCreator />)
        expect(screen.getByText('Child girl')).toBeInTheDocument()
        expect(screen.queryByText(/Plays as/)).not.toBeInTheDocument()
        expect(screen.queryByTestId('voice-badges')).not.toBeInTheDocument()
        // The field sample plays the projected voice: none without a projection.
        expect(screen.queryByTestId('voice-field-sample')).not.toBeInTheDocument()
    })

    it('a re-pick drops the projection; the payload carries only the new voice', async () => {
        mocks.editingCharacter = { id: 'c1', name: 'Lyra', race: 'Elf', role: 'character', description: '', triggers: [], voice: { ...V2_VOICE }, effective_voice: EFFECTIVE }
        render(<CharacterCreator />)
        const picked = { ...V2_VOICE, voice_key: 'vk_9f8e7d6c5b4a39281706f5e4d3c2b1a0', voice_name: 'Sela' }
        act(() => (mocks.pickerProps?.onSelect as (voice: unknown) => void)(picked))
        expect(screen.getByText('Sela')).toBeInTheDocument()
        expect(screen.queryByText(/Plays as/)).not.toBeInTheDocument()

        await waitFor(() => expect(mocks.getCardDraft).toHaveBeenCalled())
        fireEvent.click(screen.getAllByRole('button', { name: /^Save draft$/i })[0])
        await waitFor(() => expect(mocks.saveCardDraft).toHaveBeenCalledTimes(1))
        expect((mocks.saveCardDraft.mock.calls[0][2] as Record<string, unknown>).voice).toEqual(picked)
    })

    it('recommends catalog voices only for a saved, non-persona card in its workspace', () => {
        mocks.editingCharacter = {
            id: 'c1', name: 'Lyra', race: 'Elf', role: 'character', description: '', triggers: [], voice: null,
            organization: { workspace_id: OTHER_WORKSPACE_ID, collection_ids: [] },
        }
        const { unmount } = render(<CharacterCreator />)
        expect(mocks.pickerProps?.recommendedFor).toEqual({ cardId: 'c1', workspaceId: OTHER_WORKSPACE_ID })
        unmount()

        mocks.editingCharacter = null
        mocks.pickerProps = null as Record<string, unknown> | null
        render(<CharacterCreator />)
        fireEvent.click(screen.getByRole('button', { name: /the adversary/i }))
        expect((mocks.pickerProps as Record<string, unknown> | null)?.recommendedFor).toBeNull()
    })

    it('gives the picker the language the stored voice names, never the interface one (05 §7.1, D17)', () => {
        mocks.editingCharacter = { id: 'c1', name: 'Lyra', race: 'Elf', role: 'character', description: '', triggers: [], voice: { ...V2_VOICE, language_code: 'es-MX' } }
        const { unmount } = render(<CharacterCreator />)
        expect(mocks.pickerProps?.language).toBe('es')
        unmount()

        // A stored voice without a language says nothing.
        mocks.editingCharacter = { id: 'c1', name: 'Lyra', race: 'Elf', role: 'character', description: '', triggers: [], voice: { ...V2_VOICE } }
        render(<CharacterCreator />)
        expect(mocks.pickerProps?.language).toBeNull()
    })

    it('says which voice option a refused create needs (422 voice_plan_locked)', async () => {
        mocks.createCharacter.mockRejectedValue(Object.assign(new Error('Unprocessable'), { status: 422, code: 'voice_plan_locked' }))
        render(<CharacterCreator />)
        fireEvent.click(screen.getByRole('button', { name: /the adversary/i }))
        fireEvent.change(screen.getByPlaceholderText(/lyra emberwind/i), { target: { value: 'Mara' } })
        fireEvent.change(screen.getByPlaceholderText(/elf, human, construct/i), { target: { value: 'Human' } })
        fireEvent.click(screen.getByRole('button', { name: /^Create Character$/i }))
        expect((await screen.findAllByText('Your plan doesn’t include this voice option.')).length).toBeGreaterThan(0)
        // 05 §7.4: the refused voice is named on the voice field too.
        expect(screen.getByTestId('voice-field-error')).toHaveTextContent('Your plan doesn’t include this voice option.')
    })

    it('a leaving voice offers "Switch to {replacement}", which keeps the recipe and drops the projection (05 §7.8, AC-K6)', async () => {
        extraApi.getVoiceCatalogByKeys = vi.fn().mockResolvedValue([CATALOG_SELA_LEAVING])
        const sela = { ...V2_VOICE, voice_key: VOICE_KEY_SELA, voice_name: 'Sela', settings: { stability: 0.4, similarity_boost: 0.8, speed: 0.95 }, emotion: 'calm' }
        mocks.editingCharacter = {
            id: 'c1', name: 'Lyra', race: 'Elf', role: 'character', description: '', triggers: [], voice: sela,
            effective_voice: { ...EFFECTIVE, voice_key: VOICE_KEY_SELA, display_name: 'Sela', substitution_reason: null, badges: ['leaving'] },
        }
        render(<CharacterCreator />)
        expect(screen.getByText(/^Leaving/)).toBeInTheDocument()
        // The same catalog read dates the badge (05 §9.3 "Leaving on {date}") and names the replacement.
        expect(await screen.findByText(/^Leaving on /)).toBeInTheDocument()
        const switchTo = await screen.findByRole('button', { name: 'Switch to Maren' })
        switchTo.focus()
        fireEvent.click(switchTo)
        expect(extraApi.getVoiceCatalogByKeys).toHaveBeenCalledTimes(1)
        expect(extraApi.getVoiceCatalogByKeys).toHaveBeenCalledWith([VOICE_KEY_SELA])
        expect(screen.getByText('Maren')).toBeInTheDocument()
        expect(screen.queryByText(/^Leaving/)).not.toBeInTheDocument()
        expect(screen.queryByTestId('voice-owner-prompts')).not.toBeInTheDocument()
        // The prompt unmounted under the focus: it returns to the field's "Change" button (05 §10).
        await waitFor(() => expect(screen.getByRole('button', { name: 'Change' })).toHaveFocus())

        await waitFor(() => expect(mocks.getCardDraft).toHaveBeenCalled())
        fireEvent.click(screen.getAllByRole('button', { name: /^Save draft$/i })[0])
        await waitFor(() => expect(mocks.saveCardDraft).toHaveBeenCalledTimes(1))
        const payload = mocks.saveCardDraft.mock.calls[0][2] as Record<string, unknown>
        expect(payload.voice).toEqual({ ...sela, voice_key: VOICE_KEY_MAREN, voice_name: 'Maren', preset_id: null, preset_name: null })
        expect(payload).not.toHaveProperty('effective_voice')
    })

    it('"Choose a voice" (needs_reselect) and "Pick another" (retired) open the picker; no projection, no prompt', async () => {
        extraApi.getVoiceCatalogByKeys = vi.fn().mockResolvedValue([])
        // The opened picker waits on its lists (it is the real dialog).
        extraApi.listVoicePresets = vi.fn(() => new Promise(() => undefined))
        const withBadges = (badges: string[]) => ({
            id: 'c1', name: 'Lyra', race: 'Elf', role: 'character', description: '', triggers: [], voice: { ...V2_VOICE },
            effective_voice: { ...EFFECTIVE, voice_key: V2_VOICE.voice_key, display_name: 'Eldrin', substitution_reason: null, badges },
        })
        mocks.editingCharacter = withBadges(['needs_reselect'])
        const kept = render(<CharacterCreator />)
        const keep = screen.getByRole('button', { name: 'Keep for now' })
        keep.focus()
        fireEvent.click(keep)
        expect(screen.queryByTestId('voice-owner-prompts')).not.toBeInTheDocument()
        expect(screen.getByText('Voice needs re-selection')).toBeInTheDocument()
        await waitFor(() => expect(screen.getByRole('button', { name: 'Change' })).toHaveFocus())
        kept.unmount()

        const first = render(<CharacterCreator />)
        expect(mocks.pickerProps?.open).toBe(false)
        fireEvent.click(screen.getByRole('button', { name: 'Choose a voice' }))
        expect(mocks.pickerProps?.open).toBe(true)
        first.unmount()

        mocks.editingCharacter = withBadges(['retired'])
        const second = render(<CharacterCreator />)
        fireEvent.click(screen.getByRole('button', { name: 'Pick another' }))
        expect(mocks.pickerProps?.open).toBe(true)
        second.unmount()

        mocks.editingCharacter = { ...withBadges(['leaving', 'needs_reselect', 'retired']), effective_voice: undefined }
        render(<CharacterCreator />)
        expect(screen.queryByTestId('voice-owner-prompts')).not.toBeInTheDocument()
        expect(extraApi.getVoiceCatalogByKeys).not.toHaveBeenCalled()
    })

    /** A saved card heard as Maren, with Maren's catalog sample (05 §7.8). */
    function sampleApi() {
        extraApi.getVoiceCapabilities = vi.fn().mockResolvedValue(CAPABILITIES_EL_PLUS)
        extraApi.getEffectiveVoice = vi.fn().mockResolvedValue({
            ref_type: 'card',
            ref_id: 'c1',
            voices: [{ json_path: 'voice', effective_voice: { ...EFFECTIVE, voice_key: VOICE_KEY_MAREN, substitution_reason: null, badges: [] } }],
        })
        extraApi.getVoiceCatalogByKeys = vi.fn().mockResolvedValue([CATALOG_MAREN_HOUSE])
        extraApi.fetchProtectedMediaBlob = vi.fn().mockResolvedValue(new Blob(['mp3'], { type: 'audio/mpeg' }))
        extraApi.getUserProfile = vi.fn().mockResolvedValue({ membership: {} })
    }

    it('a known ElevenLabs voice gets a field sample that still plays in an archived workspace, without the effective read (AC-C7, 05 §7.9, §10)', async () => {
        archiveOtherWorkspace()
        sampleApi()
        const objectUrls = { createObjectURL: URL.createObjectURL, revokeObjectURL: URL.revokeObjectURL }
        Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:sample'), revokeObjectURL: vi.fn() })
        try {
            mocks.editingCharacter = {
                id: 'c1', name: 'Lyra', race: 'Elf', role: 'character', description: '', triggers: [], voice: { ...V2_VOICE },
                effective_voice: { ...EFFECTIVE, voice_key: VOICE_KEY_MAREN, substitution_reason: null, badges: [] },
                organization: { workspace_id: OTHER_WORKSPACE_ID, collection_ids: [] },
            }
            render(<CharacterCreator />)

            // The field and its picker stay read-only; the sample sits outside the fieldset and plays.
            expect(screen.getByRole('button', { name: 'Change' })).toBeDisabled()
            const sample = screen.getByRole('button', { name: 'Play sample of Maren' })
            expect(sample).toBeEnabled()
            expect(sample).toHaveTextContent('Play sample')
            fireEvent.click(sample)
            await waitFor(() => expect(screen.getByRole('button', { name: 'Play sample of Maren, English' })).toHaveAttribute('aria-pressed', 'true'))
            expect(extraApi.getVoiceCatalogByKeys).toHaveBeenCalledWith([VOICE_KEY_MAREN])
            expect(extraApi.fetchProtectedMediaBlob).toHaveBeenCalledWith(CATALOG_MAREN_HOUSE.languages[0].sample_url, 'audio/mpeg')
            // The projection came with the card: no effective-voice read.
            expect(extraApi.getEffectiveVoice).not.toHaveBeenCalled()
        } finally {
            Object.assign(URL, objectUrls)
        }
    })
})

describe('CharacterCreator voice save refusals (I-36)', () => {
    const PLAN_LOCKED_COPY = 'Your plan doesn’t include this voice option.'
    const DRAFT_SAVE_COPY = 'Could not save your draft. Try again.'
    const VOICE_TOOLTIP_COPY = "The voice used when this character's chat turns are read aloud. Pick a voice from the voice catalog or one of your saved presets."
    const voiceOf = (voice_name: string, voice_key: string) => ({
        schema_version: 2,
        provider: 'elevenlabs',
        voice_key,
        voice_name,
        settings: null,
        emotion: null,
        language_code: null,
    })
    const STORED_VOICE = voiceOf('Eldrin', 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f')
    const PICKED_VOICE = voiceOf('Maren', 'vk_0a1b2c3d4e5f60718293a4b5c6d7e8f9')

    /** The mocked module's ApiError carrying a coded refusal, as the API client raises it. */
    function refusal(status: number, code?: string) {
        return Object.assign(new ApiError(status, 'Refused', { code }), { status, code, isTransient: false })
    }

    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubEnv('VITE_FEATURE_VOICES_ENABLED', 'true')
        mocks.isAuthenticated = true
        mocks.cardEdit = null
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [] })
        mocks.editingCharacter = {
            id: 'c1', name: 'Lyra', race: 'Elf', role: 'character', description: '', triggers: [], voice: { ...STORED_VOICE },
            organization: { workspace_id: OTHER_WORKSPACE_ID, collection_ids: [] },
        }
        mocks.getCardDraft.mockResolvedValue({ id: 'c1', is_draft: false, latest_version_number: 1 })
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    async function clickSaveDraft() {
        await waitFor(() => expect(mocks.getCardDraft).toHaveBeenCalled())
        fireEvent.click(screen.getAllByRole('button', { name: /^Save draft$/i })[0])
    }

    it('a 422 voice_not_eligible save shows on the voice field too, until the voice changes (05 §7.4)', async () => {
        const ELIGIBILITY_COPY = 'This voice can’t be picked right now. Choose another.'
        mocks.saveCardDraft.mockRejectedValueOnce(refusal(422, 'voice_not_eligible'))
        render(<CharacterCreator />)
        expect(screen.queryByTestId('voice-field-error')).not.toBeInTheDocument()

        await clickSaveDraft()
        const fieldError = await screen.findByTestId('voice-field-error')
        expect(fieldError).toHaveTextContent(ELIGIBILITY_COPY)
        // Inside the voice field, describing its control; the form's save error says it too.
        expect(fieldError.closest('section')).toHaveAttribute('id', 'portrayal')
        expect(screen.getByRole('button', { name: 'Change' })).toHaveAccessibleDescription(ELIGIBILITY_COPY)
        const form = screen.getByDisplayValue('Lyra').closest('form')!
        expect(within(form).getByRole('alert')).toHaveTextContent(ELIGIBILITY_COPY)

        // A new pick is a new voice: the field error was about the refused one.
        act(() => (mocks.pickerProps?.onSelect as (voice: unknown) => void)({ ...PICKED_VOICE }))
        expect(screen.queryByTestId('voice-field-error')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Change' })).not.toHaveAttribute('aria-describedby')
    })

    it('a new save clears the field error first, so a later successful save of the same voice leaves none (05 §7.4)', async () => {
        mocks.saveCardDraft
            .mockRejectedValueOnce(refusal(422, 'voice_not_eligible'))
            .mockResolvedValueOnce({ id: 'c1', is_draft: true, latest_version_number: 1 })
        render(<CharacterCreator />)

        await clickSaveDraft()
        expect(await screen.findByTestId('voice-field-error')).toBeInTheDocument()
        // Shown in the Field's message slot, in place of the field's helper.
        expect(screen.queryByText(VOICE_TOOLTIP_COPY)).not.toBeInTheDocument()

        // E.g. an admin made the voice eligible again: the same voice now saves.
        fireEvent.click(screen.getAllByRole('button', { name: /^Save draft$/i })[0])
        await waitFor(() => expect(mocks.saveCardDraft).toHaveBeenCalledTimes(2))
        await waitFor(() => expect(screen.queryByTestId('voice-field-error')).not.toBeInTheDocument())
        expect(screen.getByRole('button', { name: 'Change' })).not.toHaveAttribute('aria-describedby')
        expect(screen.getByText(VOICE_TOOLTIP_COPY)).toBeInTheDocument()
    })

    it('a refused edit save (422 voice_plan_locked) says which voice to change', async () => {
        mocks.saveCardDraft.mockRejectedValueOnce(refusal(422, 'voice_plan_locked'))
        render(<CharacterCreator />)

        await clickSaveDraft()
        const form = screen.getByDisplayValue('Lyra').closest('form')!
        expect(await within(form).findByRole('alert')).toHaveTextContent(PLAN_LOCKED_COPY)
        // The save error, the voice field (05 §7.4) and the toast.
        expect(screen.getByTestId('voice-field-error')).toHaveTextContent(PLAN_LOCKED_COPY)
        expect(screen.getAllByText(PLAN_LOCKED_COPY).length).toBeGreaterThan(2)
        expect(screen.queryByText(DRAFT_SAVE_COPY)).not.toBeInTheDocument()
    })

    it('a generic edit save failure keeps the draftSave toast', async () => {
        mocks.saveCardDraft.mockRejectedValueOnce(refusal(500))
        render(<CharacterCreator />)

        await clickSaveDraft()
        expect(await screen.findByText(DRAFT_SAVE_COPY)).toBeInTheDocument()
        expect(screen.queryByText(PLAN_LOCKED_COPY)).not.toBeInTheDocument()
        expect(screen.queryByTestId('voice-field-error')).not.toBeInTheDocument()
    })
})
