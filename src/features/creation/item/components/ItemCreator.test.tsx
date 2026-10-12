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
    setEditingItem: vi.fn(),
    replaceHash: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    generateCardPortrait: vi.fn(),
    getImageProfiles: vi.fn(async () => ({ items: [], system_default_profile_id: null, user_default_profile_id: null, effective_default_profile_id: null })),
    getItem: vi.fn(),
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
    editingItem: null as Record<string, unknown> | null,
    cardEdit: null as Record<string, unknown> | null,
}))

vi.mock('@/app/hooks', () => ({
    useNavigation: () => ({ setPage: mocks.setPage, goBack: mocks.goBack, cardEdit: mocks.cardEdit, currentHash: '', replaceHash: mocks.replaceHash, registerNavigationInterceptor: () => () => {} }),
    useData: () => ({ editingItem: mocks.editingItem, setEditingItem: mocks.setEditingItem, loadData: mocks.loadData }),
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
        createItem: mocks.createItem,
        updateItem: mocks.updateItem,
        generateCardPortrait: mocks.generateCardPortrait,
        getImageProfiles: mocks.getImageProfiles,
        getItem: mocks.getItem,
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
    TEST_COLLECTION_ID,
    TEST_WORKSPACE_ID,
    type WorkspaceTestState,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { ItemCreator } from './ItemCreator'

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

/** Opened from a Library folder: saves there and returns to the Library afterwards. */
function captureFolderOrigin() {
    mocks.origin.origin = { workspaceId: TEST_WORKSPACE_ID, collectionId: TEST_COLLECTION_ID, returnTo: null }
    mocks.origin.isCaptured = true
    mocks.origin.returnToLibrary.mockImplementation(() => true)
}

describe('ItemCreator guided payload', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isAuthenticated = true
        mocks.editingItem = null
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [] })
        mocks.createItem.mockResolvedValue({ id: 'item-1', name: 'Moonlit Compass' })
        mocks.loadData.mockResolvedValue(undefined)
    })

    it('creates an item with guided Use/Whereabouts fields serialized into category', async () => {
        const { container } = render(<ItemCreator />)

        // Create mode opens on the template gallery — pick a starting shape.
        fireEvent.click(screen.getByRole('button', { name: /the key/i }))

        fireEvent.change(screen.getByPlaceholderText(/moonlit compass/i), { target: { value: 'Silver Gate Key' } })
        fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'A narrow silver key.' } })

        // Copy the template's ghost example into the guided Cost field.
        const costRow = container.querySelector('[data-guided-field="use.cost"]') as HTMLElement
        expect(within(costRow).getByRole('textbox')).toHaveAttribute('placeholder', 'Works once per moonrise.')
        fireEvent.click(within(costRow).getByRole('button', { name: /use example/i }))

        // Type into the guided Location field directly.
        const locationRow = container.querySelector('[data-guided-field="whereabouts.location"]') as HTMLElement
        fireEvent.change(within(locationRow).getByRole('textbox'), { target: { value: 'Sewn into a coat lining.' } })

        fireEvent.click(screen.getByRole('button', { name: /^Create Item$/i }))

        await waitFor(() => expect(mocks.createItem).toHaveBeenCalledTimes(1))
        const payload = mocks.createItem.mock.calls[0][0]
        expect(payload).toEqual(
            expect.objectContaining({ name: 'Silver Gate Key', description: 'A narrow silver key.' }),
        )
        const use = payload.category.find((c: { name: string }) => c.name === 'Use')
        expect(use?.description).toBe('How the item is used and what it costs.')
        expect(use?.attributes).toContainEqual({ Cost: 'Works once per moonrise.' })
        const whereabouts = payload.category.find((c: { name: string }) => c.name === 'Whereabouts')
        expect(whereabouts?.attributes).toContainEqual({ Location: 'Sewn into a coat lining.' })
    })

    it('rebinds guided fields when editing a card saved with guided groups', () => {
        mocks.editingItem = {
            id: 'item-2',
            name: 'Saint Orven’s Bell',
            type: 'Relic',
            rarity: 'Cursed',
            description: 'A blackened silver bell.',
            effects: [],
            requirements: [],
            limitations: [],
            triggers: [],
            category: [
                {
                    name: 'Use',
                    description: 'How the item is used and what it costs.',
                    attributes: [{ Cost: 'The ringer must confess one true guilt aloud.' }],
                },
                { name: 'Traits', description: '', attributes: [{ Material: 'Blackened silver' }] },
            ],
        }
        const { container } = render(<ItemCreator />)

        const costRow = container.querySelector('[data-guided-field="use.cost"]') as HTMLElement
        expect(within(costRow).getByRole('textbox')).toHaveValue('The ringer must confess one true guilt aloud.')
        // The Traits row stays in the quick-add category, not a duplicate group.
        expect(screen.getByDisplayValue('Material')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Blackened silver')).toBeInTheDocument()
    })
})

describe('ItemCreator navigation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isAuthenticated = true
        mocks.editingItem = null
        mocks.createItem.mockResolvedValue({ id: 'item-1', name: 'Moonlit Compass' })
        mocks.loadData.mockResolvedValue(undefined)
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [] })
    })

    it('stays in the editor after creating a new item (draft/publish from here)', async () => {
        render(<ItemCreator />)

        fireEvent.click(screen.getByRole('button', { name: /skip — start with the standard fields/i }))
        fireEvent.change(screen.getByPlaceholderText(/moonlit compass/i), { target: { value: 'Moonlit Compass' } })
        fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'A brass compass.' } })
        fireEvent.click(screen.getByRole('button', { name: /^Create Item$/i }))

        await waitFor(() => expect(mocks.createItem).toHaveBeenCalledTimes(1))
        // New model: creating transitions into edit mode instead of navigating away.
        await waitFor(() => expect(mocks.setEditingItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'item-1' })))
        expect(mocks.goBack).not.toHaveBeenCalledWith('landing')
        expect(mocks.setPage).not.toHaveBeenCalledWith('landing')
    })

    it('returns to the origin from edit back', () => {
        mocks.editingItem = {
            id: 'item-2',
            name: 'Saint Orven Bell',
            type: 'Relic',
            rarity: 'Cursed',
            description: 'A blackened silver bell.',
            effects: [],
            requirements: [],
            limitations: [],
            triggers: [],
        }
        render(<ItemCreator />)

        fireEvent.click(screen.getByRole('button', { name: /^Back$/i }))

        expect(mocks.setEditingItem).toHaveBeenCalledWith(null)
        expect(mocks.goBack).toHaveBeenCalledWith('landing')
    })
})

describe('ItemCreator workspace origin', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isAuthenticated = true
        mocks.editingItem = null
        mocks.createItem.mockResolvedValue({ id: 'item-1', name: 'Moonlit Compass' })
        mocks.loadData.mockResolvedValue(undefined)
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [] })
    })

    it('creates at the captured folder and returns to the Library highlighting the item', async () => {
        captureFolderOrigin()
        render(<ItemCreator />)
        await waitFor(() => expect(screen.getByTestId('creation-destination')).toHaveTextContent('Will be saved in Main library / Heroes'))

        fireEvent.click(screen.getByRole('button', { name: /skip — start with the standard fields/i }))
        fireEvent.change(screen.getByPlaceholderText(/moonlit compass/i), { target: { value: 'Moonlit Compass' } })
        fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'A brass compass.' } })
        fireEvent.click(screen.getByRole('button', { name: /^Create Item$/i }))

        await waitFor(() => expect(mocks.origin.returnToLibrary).toHaveBeenCalledWith({ cardType: 'item', cardId: 'item-1' }))
        expect(scopeOf(mocks.createItem)).toEqual({ workspaceId: TEST_WORKSPACE_ID, initialCollectionIds: [TEST_COLLECTION_ID] })
        expect(mocks.setEditingItem).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'item-1' }))
    })

    it('reports a deleted origin collection instead of a generic failure', async () => {
        captureFolderOrigin()
        mocks.createItem.mockRejectedValue(Object.assign(new Error('gone'), { code: 'COLLECTION_NOT_FOUND' }))
        render(<ItemCreator />)

        fireEvent.click(screen.getByRole('button', { name: /skip — start with the standard fields/i }))
        fireEvent.change(screen.getByPlaceholderText(/moonlit compass/i), { target: { value: 'Moonlit Compass' } })
        fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'A brass compass.' } })
        fireEvent.click(screen.getByRole('button', { name: /^Create Item$/i }))

        expect(await screen.findByText(/collection this card was going into no longer exists/i)).toBeInTheDocument()
        expect(mocks.origin.returnToLibrary).not.toHaveBeenCalled()
    })
})
