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
    setEditingTemplate: vi.fn(),
    createAssistantConversation: vi.fn(),
    listAssistantConversations: vi.fn(),
    getAssistantConversation: vi.fn(),
    streamAssistantMessage: vi.fn(),
    updateAdventureTemplate: vi.fn(),
    getAdventureTemplate: vi.fn(),
    generateCardPortrait: vi.fn(),
    getImageProfiles: vi.fn(async () => ({ items: [], system_default_profile_id: null, user_default_profile_id: null, effective_default_profile_id: null })),
    isAuthenticated: true,
    editingTemplate: null as Record<string, unknown> | null,
    characters: [] as Record<string, unknown>[],
}))

vi.mock('@/app/hooks', () => ({
    useNavigation: () => ({ setPage: mocks.setPage, goBack: mocks.goBack, currentHash: '', replaceHash: vi.fn(), registerNavigationInterceptor: () => () => {} }),
    useData: () => ({
        characters: mocks.characters,
        worlds: [],
        isLoading: false,
        editingTemplate: mocks.editingTemplate,
        setEditingTemplate: mocks.setEditingTemplate,
        loadData: mocks.loadData,
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
        createAdventureTemplate: vi.fn(),
        updateAdventureTemplate: mocks.updateAdventureTemplate,
        getAdventureTemplate: mocks.getAdventureTemplate,
        generateCardPortrait: mocks.generateCardPortrait,
        getImageProfiles: mocks.getImageProfiles,
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
import { AdventureCreator } from './AdventureCreator'

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

describe('AdventureCreator AI generation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isAuthenticated = true
        mocks.editingTemplate = null
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [] })
        mocks.createAssistantConversation.mockResolvedValue({
            conversation: { conversation_id: 3, kind: 'card', card_type: 'adventure_template', card_id: null, title: 'Untitled Adventure' },
            messages: [],
            target: null,
            target_cas: null,
        })
        const assistantResponse = {
            conversation: { conversation_id: 3, kind: 'card', card_type: 'adventure_template', card_id: 'tmpl-1', title: 'Untitled Adventure' },
            messages: [
                { message_id: 30, conversation_id: 3, sequence_no: 1, role: 'user', status: 'completed', content: 'Generate a volcano heist' },
                { message_id: 31, conversation_id: 3, sequence_no: 2, role: 'assistant', status: 'completed', content: 'Created the heist.' },
            ],
            target: {
                id: 'tmpl-1',
                name: 'Gate',
                description: 'A heist into the volcano fortress.',
                triggers: ['heist', 'volcano'],
                characters: [{ id: 'c1', name: 'Ember' }],
                world: [{ id: 'w1', name: 'Pyre', type: 'volcanic' }],
            },
        }
        mocks.streamAssistantMessage.mockImplementation(async (_conversationId: number, _body: unknown, onEvent: (event: Record<string, unknown>) => void) => {
            onEvent({ type: 'final', ...assistantResponse })
        })
        mocks.loadData.mockResolvedValue(undefined)
    })

    it('sends a creator conversation turn, populates the creator, and renders the generated scene (no navigation)', async () => {
        render(<AdventureCreator />)

        fireEvent.click(screen.getByRole('button', { name: /open card assistant/i }))
        fireEvent.change(screen.getByPlaceholderText(/ask for a change/i), { target: { value: 'Generate a volcano heist' } })
        fireEvent.click(screen.getByRole('button', { name: /send message/i }))

        await waitFor(() => expect(mocks.createAssistantConversation).toHaveBeenCalledTimes(1))
        expect(mocks.createAssistantConversation).toHaveBeenCalledWith(
            {
                kind: 'card',
                card_type: 'adventure_template',
                title: 'Untitled Adventure',
            },
            expect.any(Object),
        )
        await waitFor(() => expect(mocks.streamAssistantMessage).toHaveBeenCalledTimes(1))
        expect(mocks.streamAssistantMessage).toHaveBeenCalledWith(
            3,
            {
                kind: 'card',
                message: 'Generate a volcano heist',
                card_type: 'adventure_template',
                current: null,
            },
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
        expect(mocks.createAssistantConversation).not.toHaveBeenCalled()
        expect(mocks.streamAssistantMessage).not.toHaveBeenCalled()
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

    it('persists removal of the saved cover as null', async () => {
        mocks.editingTemplate = { ...mocks.editingTemplate, image_url: '/generated-images/old.png' }
        render(<AdventureCreator />)

        fireEvent.click(screen.getByRole('button', { name: /remove image/i }))

        await waitFor(() =>
            expect(mocks.updateAdventureTemplate).toHaveBeenCalledWith(
                'tmpl-1',
                expect.objectContaining({ image_url: null }),
            ),
        )
    })
})

describe('AdventureCreator navigation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isAuthenticated = true
        mocks.editingTemplate = null
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [] })
        mocks.loadData.mockResolvedValue(undefined)
    })

    it('returns to the origin after saving a new adventure', async () => {
        const { apiService } = await import('@/infrastructure/api')
        ;(apiService.createAdventureTemplate as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'tmpl-2', name: 'Quest' })

        render(<AdventureCreator />)

        fireEvent.click(screen.getByRole('button', { name: /skip — start with the standard fields/i }))
        fireEvent.change(screen.getByRole('textbox', { name: /premise/i }), { target: { value: 'The beacons are lit.' } })
        fireEvent.click(screen.getByRole('button', { name: /^Create Adventure$/i }))

        await waitFor(() => expect(apiService.createAdventureTemplate).toHaveBeenCalledTimes(1))
        await waitFor(() => expect(mocks.goBack).toHaveBeenCalledWith('landing'))
        expect(mocks.setPage).not.toHaveBeenCalledWith('landing')
    })

    it('returns to the origin from edit back', () => {
        mocks.editingTemplate = { id: 'tmpl-1', scenario: 'A heist into the volcano fortress.', characters: [], triggers: [] }
        render(<AdventureCreator />)

        fireEvent.click(screen.getByRole('button', { name: /^Back$/i }))

        expect(mocks.setEditingTemplate).toHaveBeenCalledWith(null)
        expect(mocks.goBack).toHaveBeenCalledWith('landing')
    })
})

describe('AdventureCreator guided payload', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isAuthenticated = true
        mocks.editingTemplate = null
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [] })
        mocks.loadData.mockResolvedValue(undefined)
    })

    it('serializes guided Opening/Stakes fields from a template pick into category', async () => {
        const createAdventureTemplate = vi.fn().mockResolvedValue({ id: 'tmpl-2', name: 'Quest' })
        const { apiService } = await import('@/infrastructure/api')
        ;(apiService.createAdventureTemplate as ReturnType<typeof vi.fn>).mockImplementation(createAdventureTemplate)

        const { container } = render(<AdventureCreator />)

        // Create mode opens on the template gallery — pick a starting shape.
        fireEvent.click(screen.getByRole('button', { name: /heroic quest/i }))

        fireEvent.change(screen.getByRole('textbox', { name: /premise/i }), { target: { value: 'The beacons are lit.' } })

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

describe('AdventureCreator workspace origin', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isAuthenticated = true
        mocks.editingTemplate = null
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [] })
        mocks.loadData.mockResolvedValue(undefined)
    })

    it('creates at the captured folder and returns to the Library highlighting the adventure', async () => {
        captureFolderOrigin()
        const create = apiService.createAdventureTemplate as ReturnType<typeof vi.fn>
        create.mockResolvedValue({ id: 'tmpl-2', name: 'Quest' })
        render(<AdventureCreator />)
        await waitFor(() => expect(screen.getByTestId('creation-destination')).toHaveTextContent('Will be saved in Main library / Heroes'))

        fireEvent.click(screen.getByRole('button', { name: /skip — start with the standard fields/i }))
        fireEvent.change(screen.getByRole('textbox', { name: /premise/i }), { target: { value: 'The beacons are lit.' } })
        fireEvent.click(screen.getByRole('button', { name: /^Create Adventure$/i }))

        await waitFor(() => expect(mocks.origin.returnToLibrary).toHaveBeenCalledWith({ cardType: 'adventure_template', cardId: 'tmpl-2' }))
        expect(scopeOf(create)).toEqual({ workspaceId: TEST_WORKSPACE_ID, initialCollectionIds: [TEST_COLLECTION_ID] })
        expect(mocks.goBack).not.toHaveBeenCalled()
    })

    it("updates an existing adventure in its own workspace, never with initial collections", async () => {
        captureFolderOrigin()
        mocks.origin.returnToLibrary.mockImplementation(() => false)
        mocks.editingTemplate = {
            id: 'tmpl-1', scenario: 'A heist into the volcano fortress.', characters: [], triggers: [],
            organization: { workspace_id: OTHER_WORKSPACE_ID, collection_ids: [] },
        }
        mocks.updateAdventureTemplate.mockResolvedValue({})
        render(<AdventureCreator />)

        expect(screen.queryByTestId('creation-destination')).toBeNull()
        fireEvent.click(screen.getAllByRole('button', { name: /^Update$/i })[0])

        await waitFor(() => expect(mocks.updateAdventureTemplate).toHaveBeenCalledTimes(1))
        expect(scopeOf(mocks.updateAdventureTemplate)).toEqual({ workspaceId: OTHER_WORKSPACE_ID, initialCollectionIds: [] })
        await waitFor(() => expect(mocks.goBack).toHaveBeenCalledWith('landing'))
    })
})

describe('AdventureCreator in an archived workspace', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isAuthenticated = true
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [] })
        mocks.loadData.mockResolvedValue(undefined)
        archiveOtherWorkspace()
    })

    it('opens an existing adventure read-only and never updates it', async () => {
        mocks.editingTemplate = {
            id: 'tmpl-1', scenario: 'A heist into the volcano fortress.', characters: [], triggers: [],
            organization: { workspace_id: OTHER_WORKSPACE_ID, collection_ids: [] },
        }
        render(<AdventureCreator />)

        expect(screen.getByRole('textbox', { name: /premise/i })).toBeDisabled()
        for (const update of screen.getAllByRole('button', { name: /^Update/i })) expect(update).toBeDisabled()
        expect(screen.getByRole('button', { name: /generate cover/i })).toBeDisabled()
        expect(screen.getAllByRole('button', { name: /^Back$/i })[0]).toBeEnabled()

        fireEvent.submit(screen.getByRole('textbox', { name: /premise/i }).closest('form')!)
        expect(await screen.findByText(/this workspace is archived/i)).toBeInTheDocument()
        expect(mocks.updateAdventureTemplate).not.toHaveBeenCalled()
    })
})

describe('AdventureCreator voice write refusals (I-36, R5-BE-01)', () => {
    // The mapping below is dormant: the BFF judges only the voices a save sets (enforce_voice_writes
    // skips absent ones), and this form sends none. These tests pin the FE wiring only; if this premise
    // ever changes, the refusals become reachable and need a contract test against the BFF route.
    it('sends no persona or cast voice, so the BFF has no voice to refuse', async () => {
        const voice = { voice_id: 'male-qn-qingse', preset_name: 'Calm' }
        mocks.characters = [
            { id: 'c1', name: 'Lyra', role: 'character', voice, stats: {} },
            { id: 'p1', name: 'Me', role: 'persona', voice, stats: {} },
        ]
        mocks.updateAdventureTemplate.mockResolvedValue({ id: 'tmpl-1' })
        mocks.editingTemplate = {
            ...mocks.editingTemplate,
            characters: [{ id: 'c1', name: 'Lyra', voice }],
            persona: { id: 'p1', name: 'Me', voice },
        }
        try {
            render(<AdventureCreator />)

            update()

            await waitFor(() => expect(mocks.updateAdventureTemplate).toHaveBeenCalled())
            const payload = mocks.updateAdventureTemplate.mock.calls[0][1] as { persona?: Record<string, unknown> | null; characters?: Record<string, unknown>[] }
            expect(payload.persona).toMatchObject({ source_card_id: 'p1' })
            expect(payload.characters).toEqual([expect.objectContaining({ source_card_id: 'c1' })])
            for (const entry of [payload.persona, ...(payload.characters ?? [])]) expect(entry).not.toHaveProperty('voice')
            expect(JSON.stringify(payload)).not.toContain('"voice"')
        } finally {
            mocks.characters = []
        }
    })

    /** The mocked ApiError takes no metadata: set the refusal fields the client would. */
    function refusal(status: number, code: string) {
        return Object.assign(new ApiError(status, 'refused', { code }), { status, code, isTransient: false })
    }

    const update = () => fireEvent.click(screen.getAllByRole('button', { name: /^Update$/i })[0])

    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isAuthenticated = true
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [] })
        mocks.loadData.mockResolvedValue(undefined)
        mocks.editingTemplate = { id: 'tmpl-1', scenario: 'A heist into the volcano fortress.', characters: [], triggers: [] }
    })

    it.each([
        ['voice_v1_not_allowed', 'This voice uses an older format that can no longer be saved. Choose a voice from the catalog.'],
        ['voice_not_eligible', 'This voice can’t be picked right now. Choose another.'],
        ['voice_plan_locked', 'Your plan doesn’t include this voice option.'],
        ['voice_invalid', 'This voice choice isn’t valid. Choose the voice again.'],
    ])('shows the voice copy for a 422 %s and stays in the editor without Reload', async (code, copy) => {
        mocks.updateAdventureTemplate.mockRejectedValue(refusal(422, code))
        render(<AdventureCreator />)

        update()

        expect(await screen.findByText(copy)).toBeInTheDocument()
        expect(screen.queryByText("Couldn't save your adventure. Please try again.")).toBeNull()
        expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull()
        expect(mocks.goBack).not.toHaveBeenCalled()
    })

    it('offers Reload on a 409 voice_reload_required; Reload re-reads the template in its workspace and clears the refusal', async () => {
        mocks.editingTemplate = { ...mocks.editingTemplate, organization: { workspace_id: OTHER_WORKSPACE_ID, collection_ids: [] } }
        mocks.updateAdventureTemplate.mockRejectedValue(refusal(409, 'voice_reload_required'))
        mocks.getAdventureTemplate.mockResolvedValue({ id: 'tmpl-1', description: 'A heist into the volcano fortress.', characters: [] })
        render(<AdventureCreator />)

        update()

        expect(await screen.findByRole('alert')).toHaveTextContent('Voices changed since this page loaded. Reload to continue.')
        const reload = screen.getByRole('button', { name: 'Reload' })
        expect(reload).toHaveAccessibleDescription('Voices changed since this page loaded. Reload to continue.')

        fireEvent.click(reload)

        await waitFor(() => expect(mocks.getAdventureTemplate).toHaveBeenCalledWith('tmpl-1'))
        expect(scopeOf(mocks.getAdventureTemplate)).toEqual({ workspaceId: OTHER_WORKSPACE_ID, initialCollectionIds: [] })
        await waitFor(() => expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull())
        expect(screen.queryByRole('alert')).toBeNull()
        expect(mocks.setEditingTemplate).toHaveBeenCalledWith(expect.objectContaining({ id: 'tmpl-1' }))
    })

    it('keeps the refusal when the reload fails', async () => {
        mocks.updateAdventureTemplate.mockRejectedValue(refusal(409, 'voice_reload_required'))
        mocks.getAdventureTemplate.mockRejectedValue(new Error('offline'))
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
        render(<AdventureCreator />)

        update()
        fireEvent.click(await screen.findByRole('button', { name: 'Reload' }))

        await waitFor(() => expect(mocks.getAdventureTemplate).toHaveBeenCalled())
        expect(await screen.findByRole('button', { name: 'Reload' })).toBeEnabled()
        expect(screen.getByRole('alert')).toHaveTextContent('Voices changed since this page loaded. Reload to continue.')
        consoleError.mockRestore()
    })

    it('keeps the generic copy for other failures (no voice code, or a 409 that is not a reload)', async () => {
        mocks.updateAdventureTemplate.mockRejectedValueOnce(refusal(409, 'voice_refresh_busy'))
        render(<AdventureCreator />)

        update()

        expect(await screen.findByText("Couldn't save your adventure. Please try again.")).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull()
    })

    it('a refused cover save shows the voice copy instead of the media error', async () => {
        mocks.updateAdventureTemplate.mockRejectedValue(refusal(422, 'voice_plan_locked'))
        mocks.editingTemplate = { ...mocks.editingTemplate, image_url: '/generated-images/old.png' }
        render(<AdventureCreator />)

        fireEvent.click(screen.getByRole('button', { name: /remove image/i }))

        expect(await screen.findByText('Your plan doesn’t include this voice option.')).toBeInTheDocument()
    })
})
