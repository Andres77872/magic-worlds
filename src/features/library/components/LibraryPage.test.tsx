import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    createWorkspaceTestState,
    OTHER_WORKSPACE_ID,
    TEST_COLLECTION_ID,
    TEST_WORKSPACE_ID,
    testWorkspace,
    WorkspaceTestProvider,
    type WorkspaceTestState,
} from '@/shared/hooks/testing/workspaceTestUtils'

const SECOND_COLLECTION_ID = '3c4d5e6f-7a8b-4c9d-8e0f-2a3b4c5d6e7f'

const nav = vi.hoisted(() => ({
    hash: '',
    previousPage: undefined as string | undefined,
    setPage: vi.fn(),
    replaceHash: vi.fn(),
    goBack: vi.fn(),
    navigate: vi.fn(async () => 'navigated'),
}))
const data = vi.hoisted(() => ({
    setEditingCharacter: vi.fn(),
    setEditingWorld: vi.fn(),
    setEditingItem: vi.fn(),
    setEditingTemplate: vi.fn(),
}))

vi.mock('@/app/hooks/usePlaylist', () => ({
    usePlaylist: () => ({ currentTrack: null, isPlaying: false, playNow: vi.fn(), enqueue: vi.fn(), isQueued: () => false }),
}))
vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: true, openLoginModal: vi.fn(), userHash: 'u_test' }),
    useNavigation: () => ({
        currentPage: 'library',
        currentHash: nav.hash,
        previousPage: nav.previousPage,
        setPage: nav.setPage,
        replaceHash: nav.replaceHash,
        goBack: nav.goBack,
    }),
    useData: () => ({
        ...data,
        characters: [],
        setCharacters: vi.fn(),
        worlds: [],
        setWorlds: vi.fn(),
        items: [],
        setItems: vi.fn(),
        templateAdventures: [],
        setTemplateAdventures: vi.fn(),
        editCharacter: vi.fn(),
        deleteCharacter: vi.fn(),
        setDefaultPersona: vi.fn(),
        startCharacterChat: vi.fn(),
        startCharacterGroupChat: vi.fn(),
        resumeCharacterChat: vi.fn(),
        editWorld: vi.fn(),
        deleteWorld: vi.fn(),
        editItem: vi.fn(),
        deleteItem: vi.fn(),
        editTemplate: vi.fn(),
        startTemplate: vi.fn(),
        deleteTemplateById: vi.fn(),
        createStory: vi.fn(),
        loadData: vi.fn(),
    }),
}))
vi.mock('@/features/workspaces/useNavigationCoordinator', () => ({
    useNavigationCoordinator: () => ({
        navigate: nav.navigate,
        switchingTo: null,
        switchFailure: null,
        dismissSwitchFailure: () => {},
        routeStatus: 'ready',
    }),
}))
vi.mock('@/infrastructure/api', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/infrastructure/api')>()
    const apiService = {
        listLibraryCards: vi.fn(),
        listCollections: vi.fn(),
        createCollection: vi.fn(),
        updateCollection: vi.fn(),
        deleteCollection: vi.fn(),
        setCollectionMembers: vi.fn(),
        getCharacter: vi.fn(),
        getWorld: vi.fn(),
        getItem: vi.fn(),
        getAdventureTemplate: vi.fn(),
        withWorkspace: vi.fn(),
    }
    apiService.withWorkspace.mockImplementation(() => apiService)
    return { ...actual, apiService, resolveMediaUrl: (url?: string | null) => url ?? undefined, isProtectedMediaUrl: () => false }
})

import { apiService, WorkspaceApiError, type ApiService } from '@/infrastructure/api'
import { CreationOriginProvider, useCreationOrigin } from '../creationOrigin'
import { forgetLibraryCards } from '../hooks/useLibraryCards'
import { forgetLibraryCollections } from '../hooks/useLibraryCollections'
import { rememberLibraryReturn, takeLibraryReturn } from '../libraryReturn'
import { LibraryPage } from './LibraryPage'

const api = vi.mocked(apiService)
const ROOT = `#/library?workspace=${TEST_WORKSPACE_ID}`

function collection(id: string, name: string, overrides: Record<string, unknown> = {}) {
    return {
        id,
        workspace_id: TEST_WORKSPACE_ID,
        name,
        description: null,
        position: 0,
        card_count: 0,
        row_version: 1,
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
        ...overrides,
    }
}

const SKETCHES = collection(TEST_COLLECTION_ID, 'Sketches', { description: 'Rough ideas', card_count: 2, row_version: 3 })
const ASHFALL = collection(SECOND_COLLECTION_ID, 'Ashfall cast', { position: 1, card_count: 1 })

function character(id: string, name: string, extra: Record<string, unknown> = {}) {
    return { card_type: 'character', card: { id, name, race: 'Human', role: 'character', triggers: [], ...extra } }
}

const CARDS = [
    character('c1', 'Lyra'),
    character('p1', 'Aria', { role: 'persona', is_default_persona: true }),
    { card_type: 'world', card: { id: 'w1', name: 'Eldoria', category: [], type: 'high fantasy', triggers: [] } },
]

/** A `GET /workspaces/{id}/cards` page (loose fixtures: only the fields the cards render). */
function page(items: unknown[], total = items.length, offset = 0) {
    return { items, total, limit: 24, offset } as unknown as Awaited<ReturnType<typeof apiService.listLibraryCards>>
}

let workspace: WorkspaceTestState

function tree() {
    return (
        <WorkspaceTestProvider state={workspace}>
            <CreationOriginProvider>
                <LibraryPage />
                <OriginProbe />
            </CreationOriginProvider>
        </WorkspaceTestProvider>
    )
}

function OriginProbe() {
    const { origin, isCaptured } = useCreationOrigin()
    return <output data-testid="origin">{isCaptured ? JSON.stringify(origin) : 'none'}</output>
}

function renderLibrary(hash = ROOT) {
    nav.hash = hash
    return render(tree())
}

function lastQuery() {
    const calls = api.listLibraryCards.mock.calls
    return calls[calls.length - 1]?.[1]
}

describe('LibraryPage (Workspace R1)', () => {
    it('hides adventure cards from mixed Library results while workspaces stay enabled', async () => {
        vi.stubEnv('VITE_FEATURE_ADVENTURES_ENABLED', 'false')
        api.listLibraryCards.mockResolvedValue(page([...CARDS, { card_type: 'adventure_template',
            card: { id: 'a1', name: 'Hidden adventure', scenario: 'Hidden adventure', triggers: [], category: [] } }]))
        renderLibrary()
        expect(await screen.findByText('Lyra')).toBeInTheDocument()
        expect(screen.queryByText('Hidden adventure')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /begin adventure/i })).not.toBeInTheDocument()
    })

    beforeEach(() => {
        vi.stubEnv('VITE_FEATURE_WORKSPACES_ENABLED', 'true')
        vi.stubEnv('VITE_FEATURE_ADVENTURES_ENABLED', 'true')
        vi.stubEnv('VITE_FEATURE_GROUP_CHATS_ENABLED', 'false')
        vi.stubEnv('VITE_FEATURE_COMMUNITY_CARDS_ENABLED', 'true')
        vi.clearAllMocks()
        api.withWorkspace.mockImplementation(() => apiService)
        forgetLibraryCards(TEST_WORKSPACE_ID)
        forgetLibraryCards(OTHER_WORKSPACE_ID)
        forgetLibraryCollections(TEST_WORKSPACE_ID)
        forgetLibraryCollections(OTHER_WORKSPACE_ID)
        takeLibraryReturn(TEST_WORKSPACE_ID)
        nav.previousPage = undefined
        api.listCollections.mockResolvedValue({ items: [ASHFALL, SKETCHES] })
        api.listLibraryCards.mockResolvedValue(page(CARDS))
        workspace = createWorkspaceTestState({ api: apiService as unknown as ApiService })
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('shows folders once, then mixed cards with their type, counts and the persona default marker', async () => {
        renderLibrary()
        await screen.findByText('Lyra')
        const folders = screen.getByTestId('library-folders')
        const folderButtons = within(folders).getAllByRole('button', { name: /Open collection/ })
        // Collections sort by position: Sketches (0) before Ashfall cast (1).
        expect(folderButtons.map((button) => button.getAttribute('aria-label'))).toEqual([
            'Open collection Sketches',
            'Open collection Ashfall cast',
        ])
        expect(folders.compareDocumentPosition(screen.getByText('Lyra')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(screen.getByTestId('library-counts')).toHaveTextContent('2 collections · 3 cards')
        expect(screen.getByText('World')).toBeInTheDocument()
        expect(screen.getByText('Persona')).toBeInTheDocument()
        expect(screen.getByText('Default')).toBeInTheDocument()
        expect(api.listCollections).toHaveBeenCalledTimes(1)
        expect(api.listLibraryCards).toHaveBeenCalledWith(TEST_WORKSPACE_ID, { limit: 24, offset: 0 }, expect.objectContaining({ signal: expect.anything() }))
    })

    it('pages 24 cards at a time with Load more', async () => {
        const first = Array.from({ length: 24 }, (_, index) => character(`c${index}`, `Hero ${index}`))
        const second = Array.from({ length: 6 }, (_, index) => character(`c${24 + index}`, `Hero ${24 + index}`))
        api.listLibraryCards.mockResolvedValueOnce(page(first, 30)).mockResolvedValueOnce(page(second, 30, 24))
        renderLibrary()
        await screen.findByText('Hero 0')
        expect(screen.getByTestId('library-counts')).toHaveTextContent('30 cards')
        fireEvent.click(screen.getByRole('button', { name: 'Load more cards' }))
        await screen.findByText('Hero 29')
        expect(api.listLibraryCards).toHaveBeenLastCalledWith(TEST_WORKSPACE_ID, { limit: 24, offset: 24 }, expect.anything())
        expect(screen.queryByRole('button', { name: 'Load more cards' })).not.toBeInTheDocument()
    })

    it('root search filters folders locally and cards on the server', async () => {
        const view = renderLibrary()
        await screen.findByText('Lyra')
        fireEvent.change(screen.getByTestId('library-search-input'), { target: { value: 'ash' } })
        const folders = screen.getByTestId('library-folders')
        expect(within(folders).getByRole('button', { name: 'Open collection Ashfall cast' })).toBeInTheDocument()
        expect(within(folders).queryByRole('button', { name: 'Open collection Sketches' })).not.toBeInTheDocument()

        await waitFor(() => expect(nav.replaceHash).toHaveBeenCalledWith(`${ROOT}&q=ash`))
        nav.hash = `${ROOT}&q=ash`
        view.rerender(tree())
        await waitFor(() => expect(lastQuery()).toEqual({ q: 'ash', limit: 24, offset: 0 }))
        // A folder's description matches too.
        fireEvent.change(screen.getByTestId('library-search-input'), { target: { value: 'rough' } })
        expect(within(screen.getByTestId('library-folders')).getByRole('button', { name: 'Open collection Sketches' })).toBeInTheDocument()
    })

    it('searches inside a folder and offers Search entire library when nothing matches', async () => {
        api.listLibraryCards.mockResolvedValue(page([]))
        renderLibrary(`${ROOT}&collection=${TEST_COLLECTION_ID}&q=zephyr`)
        expect(await screen.findByText('No matching cards in Sketches')).toBeInTheDocument()
        expect(lastQuery()).toEqual({ q: 'zephyr', collection_id: TEST_COLLECTION_ID, limit: 24, offset: 0 })
        expect(screen.getByTestId('library-search-input')).toHaveAttribute('placeholder', 'Search in Sketches…')
        expect(screen.queryByTestId('library-folders')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Only uncollected' })).not.toBeInTheDocument()
        expect(screen.getByRole('navigation', { name: 'Location' })).toHaveTextContent('Library')
        expect(screen.getByTestId('library-counts')).toHaveTextContent('0 cards')

        fireEvent.click(screen.getByRole('button', { name: 'Search entire library' }))
        expect(nav.setPage).toHaveBeenCalledWith('library', { hash: `${ROOT}&q=zephyr` })
    })

    it('applies the type selector and the root-only uncollected filter through the URL', async () => {
        const view = renderLibrary()
        await screen.findByText('Lyra')
        fireEvent.click(screen.getByRole('combobox', { name: 'Card type' }))
        fireEvent.click(screen.getByRole('option', { name: 'Persona' }))
        expect(nav.replaceHash).toHaveBeenLastCalledWith(`${ROOT}&card_type=character&character_role=persona`)

        fireEvent.click(screen.getByRole('button', { name: 'Only uncollected' }))
        expect(nav.replaceHash).toHaveBeenLastCalledWith(`${ROOT}&uncollected=true`)

        nav.hash = `${ROOT}&card_type=character&character_role=persona&uncollected=true`
        view.rerender(tree())
        await waitFor(() => expect(lastQuery()).toEqual({ card_type: 'character', character_role: 'persona', uncollected: true, limit: 24, offset: 0 }))
    })

    it('opens a folder unfiltered while the root keeps its search for the return', async () => {
        renderLibrary(`${ROOT}&q=sketch`)
        await screen.findByText('Lyra')
        fireEvent.click(screen.getByRole('button', { name: 'Open collection Sketches' }))
        expect(nav.setPage).toHaveBeenCalledWith('library', { hash: `${ROOT}&collection=${TEST_COLLECTION_ID}` })
    })

    it('goes back from a folder to the restored root', async () => {
        nav.previousPage = 'library'
        renderLibrary(`${ROOT}&collection=${TEST_COLLECTION_ID}`)
        await screen.findByText('Lyra')
        fireEvent.click(screen.getAllByRole('button', { name: 'Library' })[0])
        expect(nav.goBack).toHaveBeenCalledWith('library')
    })

    it('edits a collection with its row version and reloads it on a conflict', async () => {
        api.updateCollection.mockRejectedValueOnce(new WorkspaceApiError(409, 'changed', { code: 'COLLECTION_VERSION_CONFLICT' }))
        renderLibrary()
        await screen.findByText('Lyra')
        fireEvent.click(screen.getByRole('button', { name: 'Actions for collection Sketches' }))
        fireEvent.click(screen.getByRole('menuitem', { name: 'Edit collection' }))
        const dialog = await screen.findByRole('dialog', { name: 'Edit collection' })
        fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Sketchbook' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

        expect(await within(dialog).findByText(/changed elsewhere/)).toBeInTheDocument()
        expect(api.updateCollection).toHaveBeenCalledWith(TEST_WORKSPACE_ID, TEST_COLLECTION_ID, 3, { name: 'Sketchbook', description: 'Rough ideas' })
        expect(api.listCollections).toHaveBeenCalledTimes(2)

        api.updateCollection.mockResolvedValueOnce({ ...SKETCHES, name: 'Sketchbook', row_version: 4 })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
        expect(await screen.findByRole('button', { name: 'Open collection Sketchbook' })).toBeInTheDocument()
    })

    it('creates and deletes collections (deleting keeps the cards)', async () => {
        const villains = collection('4d5e6f7a-8b9c-4d0e-9f1a-3b4c5d6e7f8a', 'Villains', { position: 2 })
        api.createCollection.mockResolvedValue(villains)
        api.deleteCollection.mockResolvedValue(undefined)
        renderLibrary()
        await screen.findByText('Lyra')

        fireEvent.click(screen.getByTestId('library-new-trigger'))
        fireEvent.click(screen.getByRole('menuitem', { name: 'New collection' }))
        const dialog = await screen.findByRole('dialog', { name: 'New collection' })
        fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Villains' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Create collection' }))
        expect(await screen.findByRole('button', { name: 'Open collection Villains' })).toBeInTheDocument()
        expect(api.createCollection).toHaveBeenCalledWith(TEST_WORKSPACE_ID, { name: 'Villains', description: null })

        fireEvent.click(screen.getByRole('button', { name: 'Actions for collection Sketches' }))
        fireEvent.click(screen.getByRole('menuitem', { name: 'Delete collection' }))
        expect(await screen.findByText('Only the collection is removed. Its cards stay in your library.')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Delete collection' }))
        await waitFor(() => expect(api.deleteCollection).toHaveBeenCalledWith(TEST_WORKSPACE_ID, TEST_COLLECTION_ID, 3))
        await waitFor(() => expect(screen.queryByRole('button', { name: 'Open collection Sketches' })).not.toBeInTheDocument())
        expect(screen.getByText('Lyra')).toBeInTheDocument()
    })

    it('bulk-adds the loaded page to a collection and clears the selection on a workspace switch', async () => {
        api.setCollectionMembers.mockResolvedValue({ collection_id: TEST_COLLECTION_ID, added: 3, removed: 0, unchanged: 0 })
        const view = renderLibrary()
        await screen.findByText('Lyra')
        fireEvent.click(screen.getByRole('button', { name: 'Select' }))
        fireEvent.click(screen.getByRole('button', { name: 'Select this page' }))
        const toolbar = screen.getByRole('toolbar', { name: 'Selection actions' })
        expect(toolbar).toHaveTextContent('3 selected')
        fireEvent.click(within(toolbar).getByRole('button', { name: 'Add to collection' }))
        const picker = await screen.findByRole('dialog', { name: 'Add to collection' })
        fireEvent.click(within(picker).getByRole('button', { name: /Sketches/ }))
        fireEvent.click(within(picker).getByRole('button', { name: 'Add' }))
        await waitFor(() => expect(api.setCollectionMembers).toHaveBeenCalledWith(TEST_WORKSPACE_ID, TEST_COLLECTION_ID, {
            add: [
                { card_type: 'character', card_id: 'c1' },
                { card_type: 'character', card_id: 'p1' },
                { card_type: 'world', card_id: 'w1' },
            ],
            remove: [],
        }))
        await waitFor(() => expect(screen.getByRole('toolbar', { name: 'Selection actions' })).toHaveTextContent('0 selected'))

        fireEvent.click(screen.getByRole('button', { name: 'Select this page' }))
        expect(screen.getByRole('toolbar', { name: 'Selection actions' })).toHaveTextContent('3 selected')
        act(() => workspace.switchTo(OTHER_WORKSPACE_ID))
        nav.hash = `#/library?workspace=${OTHER_WORKSPACE_ID}`
        view.rerender(tree())
        expect(screen.queryByText('3 selected')).not.toBeInTheDocument()
    })

    it('captures the creation origin before opening a creator from a folder', async () => {
        renderLibrary(`${ROOT}&collection=${TEST_COLLECTION_ID}`)
        await screen.findByText('Lyra')
        fireEvent.click(screen.getByTestId('library-new-trigger'))
        // No nested collections inside a folder.
        expect(screen.queryByRole('menuitem', { name: 'New collection' })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('menuitem', { name: 'Persona' }))
        expect(JSON.parse(screen.getByTestId('origin').textContent ?? '')).toMatchObject({
            workspaceId: TEST_WORKSPACE_ID,
            collectionId: TEST_COLLECTION_ID,
            returnTo: { collectionId: TEST_COLLECTION_ID, query: '', typeFilter: 'all', uncollected: false },
        })
        expect(data.setEditingCharacter).toHaveBeenCalledWith(null)
        expect(nav.setPage).toHaveBeenCalledWith('character', { hash: '#/character?role=persona' })
    })

    it('says a saved card is hidden by the restored filters and offers View card', async () => {
        rememberLibraryReturn(TEST_WORKSPACE_ID, { created: { cardType: 'world', cardId: 'w9' }, scrollY: null })
        renderLibrary(`${ROOT}&card_type=character&character_role=character`)
        expect(await screen.findByText('It’s hidden by the current search or filters.')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'View card' }))
        expect(nav.setPage).toHaveBeenCalledWith('library', {
            hash: `${ROOT}&card_type=character&character_role=character&reveal=world%3Aw9`,
        })
    })

    it('keeps an archived workspace read-only while copying out stays available', async () => {
        workspace = createWorkspaceTestState({
            api: apiService as unknown as ApiService,
            workspaces: [
                testWorkspace(TEST_WORKSPACE_ID, 'Main library', { archived_at: '2026-10-10T00:00:00Z' }),
                testWorkspace(OTHER_WORKSPACE_ID, 'Novel A'),
            ],
        })
        renderLibrary()
        await screen.findByText('Lyra')
        expect(screen.queryByTestId('library-new-trigger')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Actions for collection Sketches' })).not.toBeInTheDocument()

        const card = screen.getAllByTestId('gallery-card')[0]
        fireEvent.click(within(card).getByTestId('card-options-button'))
        expect(screen.queryByRole('menuitem', { name: 'Add to collection' })).not.toBeInTheDocument()
        expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('menuitem', { name: 'Copy to workspace' }))
        expect(await screen.findByRole('dialog', { name: 'Copy to workspace' })).toBeInTheDocument()
    })
})
