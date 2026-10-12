import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'

const setPage = vi.fn()
const createStory = vi.fn()
const openLoginModal = vi.fn()
const openStory = vi.fn().mockResolvedValue(undefined)
const deleteStory = vi.fn().mockResolvedValue(undefined)
let authed = true

// GalleryCard deep-imports the playlist hook (not the barrel) to keep the
// primitives module graph light, so it gets its own mock.
vi.mock('@/app/hooks/usePlaylist', () => ({
    usePlaylist: () => ({
        currentTrack: null,
        isPlaying: false,
        playNow: vi.fn(),
        enqueue: vi.fn(),
        isQueued: () => false,
    }),
}))

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: authed, openLoginModal }),
    useNavigation: () => ({ setPage }),
    useData: () => ({ createStory, openStory, deleteStory }),
}))

vi.mock('@/infrastructure/api', () => {
    const apiService: Record<string, unknown> = {
        getStories: vi.fn(),
        getCharacters: vi.fn().mockResolvedValue([]),
        getWorlds: vi.fn().mockResolvedValue([]),
        getItems: vi.fn().mockResolvedValue([]),
        getAdventureTemplates: vi.fn().mockResolvedValue([]),
    }
    apiService.withWorkspace = vi.fn(() => apiService)
    return { apiService, resolveMediaUrl: (url?: string | null) => url ?? undefined }
})

import type { Story, StoryChapter } from '@/shared'
import { apiService } from '@/infrastructure/api'
import {
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    WorkspaceTestProvider,
    createWorkspaceTestState,
    testWorkspace,
    type WorkspaceTestState,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { NovelGalleryPage } from './NovelGalleryPage'

let workspace: WorkspaceTestState

function inWorkspace(ui: ReactElement) {
    return <WorkspaceTestProvider state={workspace}>{ui}</WorkspaceTestProvider>
}

const ACTIVE_CONTEXT = {
    includeSelectedCards: true,
    includeLorebooks: true,
    includeRecentChapters: 2,
    tokenBudget: 6000,
    styleSource: 'current_chapter' as const,
    customStyleInstruction: null,
}

function chapter(id: string, storyId: string, body: string): StoryChapter {
    return {
        id,
        storyId,
        title: id,
        body,
        order: 0,
        status: 'draft',
        povCardId: null,
        locationCardId: null,
        activeCardRefs: [],
        generationHistory: [],
    }
}

const STORIES: Story[] = [
    {
        id: 's1',
        title: 'Glass War',
        description: null,
        source: { kind: 'character', id: 'c1', title: 'Aria' },
        chapters: [chapter('ch1', 's1', 'The moon cracks over the wall.')],
        activeCardRefs: [
            {
                id: 'r1',
                storyId: 's1',
                chapterId: null,
                kind: 'character',
                cardId: 'c1',
                source: 'source',
                enabled: true,
                precedence: 0,
                snapshot: {
                    id: 'c1',
                    name: 'Aria',
                    description: 'A ranger.',
                    story_card_kind: 'character',
                },
            },
        ],
        activeContext: ACTIVE_CONTEXT,
    },
    {
        id: 's2',
        title: 'Moon Court',
        description: null,
        source: { kind: 'blank', id: null, title: null },
        chapters: [chapter('ch2', 's2', '')],
        activeCardRefs: [],
        activeContext: ACTIVE_CONTEXT,
    },
]

function renderSpanish(ui: ReactElement) {
    const localI18n = i18n.cloneInstance({ lng: 'es' })
    return render(<I18nextProvider i18n={localI18n}>{inWorkspace(ui)}</I18nextProvider>)
}

describe('NovelGalleryPage', () => {
    beforeEach(async () => {
        await i18n.changeLanguage('en')
        authed = true
        vi.clearAllMocks()
        workspace = createWorkspaceTestState({ api: apiService })
        if (!globalThis.IntersectionObserver) {
            vi.stubGlobal('IntersectionObserver', class IntersectionObserver {
                observe() {}
                unobserve() {}
                disconnect() {}
            })
        }
        vi.mocked(apiService.getStories).mockResolvedValue(STORIES)
        createStory.mockResolvedValue(STORIES[1])
        openStory.mockResolvedValue(undefined)
        deleteStory.mockResolvedValue(undefined)
    })

    it('renders novels fetched from the API with source badge and counts', async () => {
        render(inWorkspace(<NovelGalleryPage />))

        expect(await screen.findByText('Glass War')).toBeInTheDocument()
        expect(screen.getByText('Moon Court')).toBeInTheDocument()
        expect(apiService.getStories).toHaveBeenCalledWith(0, 24, undefined)
        expect(screen.getByText('Aria')).toBeInTheDocument()
        expect(screen.getAllByText('1 chapter').length).toBe(2)
    })

    it('renders signed-out without fetching and opens login from create', async () => {
        authed = false

        render(inWorkspace(<NovelGalleryPage />))

        expect(await screen.findByText('No novels yet')).toBeInTheDocument()
        expect(apiService.getStories).not.toHaveBeenCalled()
        expect(openLoginModal).not.toHaveBeenCalled()

        fireEvent.click(screen.getAllByRole('button', { name: /New novel/ })[0])

        expect(openLoginModal).toHaveBeenCalledTimes(1)
        expect(screen.queryByRole('dialog', { name: 'New novel' })).not.toBeInTheDocument()
    })

    it('fires a debounced server search with the typed query', async () => {
        render(inWorkspace(<NovelGalleryPage />))
        await screen.findByText('Glass War')

        fireEvent.change(screen.getByTestId('gallery-search-input'), { target: { value: 'moon' } })

        await waitFor(() => expect(apiService.getStories).toHaveBeenCalledWith(0, 24, 'moon'))
    })

    it('opens a novel and navigates to the studio when its card is activated', async () => {
        render(inWorkspace(<NovelGalleryPage />))
        const card = (await screen.findAllByTestId('gallery-card'))[0]

        fireEvent.click(card)

        await waitFor(() => expect(openStory).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' })))
        await waitFor(() => expect(setPage).toHaveBeenCalledWith('story'))
    })

    it('deletes via the hover menu through the confirm dialog and removes the card', async () => {
        render(inWorkspace(<NovelGalleryPage />))
        await screen.findByText('Glass War')

        fireEvent.click(screen.getAllByTestId('card-options-button')[0])
        fireEvent.click(screen.getAllByRole('menuitem', { name: 'Delete' })[0])

        const dialog = await screen.findByRole('dialog')
        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

        await waitFor(() => expect(deleteStory).toHaveBeenCalledWith('s1'))
        await waitFor(() => expect(screen.queryByText('Glass War')).not.toBeInTheDocument())
        expect(screen.getByText('Moon Court')).toBeInTheDocument()
    })

    it('creates a blank novel from the create modal and navigates to the studio', async () => {
        render(inWorkspace(<NovelGalleryPage />))
        await screen.findByText('Glass War')

        fireEvent.click(screen.getByRole('button', { name: /New novel/ }))
        const title = await screen.findByTestId('novel-create-title')
        fireEvent.change(title, { target: { value: 'Ember Tides' } })
        fireEvent.click(screen.getByTestId('novel-create-submit'))

        await waitFor(() =>
            expect(createStory).toHaveBeenCalledWith({
                title: 'Ember Tides',
                description: undefined,
                source: { kind: 'blank' },
                chapters: [{ title: 'Chapter 1', body: '', status: 'draft', order: 0 }],
            }),
        )
        await waitFor(() => expect(setPage).toHaveBeenCalledWith('story'))
    })

    it('requires a picked card before creating from a card', async () => {
        render(inWorkspace(<NovelGalleryPage />))
        await screen.findByText('Glass War')

        fireEvent.click(screen.getByRole('button', { name: /New novel/ }))
        fireEvent.click(await screen.findByTestId('novel-create-source-card'))

        expect(screen.getByTestId('novel-create-submit')).toBeDisabled()
    })

    it('renders novel gallery and create modal chrome in Spanish', async () => {
        vi.mocked(apiService.getStories).mockResolvedValue([])

        renderSpanish(<NovelGalleryPage />)

        expect(await screen.findByText('Aún no hay novelas')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('Buscar novelas por título o texto…')).toBeInTheDocument()

        fireEvent.click(screen.getAllByRole('button', { name: 'Nueva novela' })[0])

        expect(await screen.findByRole('dialog', { name: 'Nueva novela' })).toBeInTheDocument()
        expect(screen.getByLabelText('Título')).toBeInTheDocument()
        expect(screen.getByText('Empezar desde')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Crear novela' })).toBeInTheDocument()
    })

    it('lists the committed workspace and restarts from offset 0 after a switch', async () => {
        const otherApi = {
            getStories: vi.fn().mockResolvedValue([STORIES[1]]),
            getCharacters: vi.fn().mockResolvedValue([]),
            getWorlds: vi.fn().mockResolvedValue([]),
            getItems: vi.fn().mockResolvedValue([]),
            getAdventureTemplates: vi.fn().mockResolvedValue([]),
        }
        workspace = createWorkspaceTestState({
            api: apiService,
            overrides: {
                get api() {
                    return (workspace.live.selectedWorkspaceId === OTHER_WORKSPACE_ID ? otherApi : apiService) as never
                },
            },
        })
        const { rerender } = render(inWorkspace(<NovelGalleryPage />))
        expect(await screen.findByText('Glass War')).toBeInTheDocument()
        fireEvent.change(screen.getByTestId('gallery-search-input'), { target: { value: 'glass' } })

        workspace.switchTo(OTHER_WORKSPACE_ID)
        rerender(inWorkspace(<NovelGalleryPage />))

        expect(await screen.findByText('Moon Court')).toBeInTheDocument()
        expect(screen.queryByText('Glass War')).not.toBeInTheDocument()
        expect(otherApi.getStories).toHaveBeenCalledWith(0, 24, undefined)
        // The search of the previous workspace does not carry over.
        expect(screen.getByTestId('gallery-search-input')).toHaveValue('')
    })

    it('keeps an archived workspace readable but disables New and Delete', async () => {
        workspace = createWorkspaceTestState({
            api: apiService,
            selectedWorkspaceId: OTHER_WORKSPACE_ID,
            workspaces: [
                testWorkspace(TEST_WORKSPACE_ID, 'Main library'),
                testWorkspace(OTHER_WORKSPACE_ID, 'Novel A', { archived_at: '2026-10-10T00:00:00Z' }),
            ],
        })
        render(inWorkspace(<NovelGalleryPage />))
        expect(await screen.findByText('Glass War')).toBeInTheDocument()

        // No new novel.
        expect(screen.getByRole('button', { name: /New novel/ })).toBeDisabled()
        fireEvent.click(screen.getByRole('button', { name: /New novel/ }))
        expect(screen.queryByRole('dialog', { name: 'New novel' })).not.toBeInTheDocument()

        // No delete.
        fireEvent.click(screen.getAllByTestId('card-options-button')[0])
        const deleteItem = screen.getAllByRole('menuitem', { name: 'Delete' })[0]
        expect(deleteItem).toBeDisabled()
        fireEvent.click(deleteItem)
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

        // Search and open keep working.
        fireEvent.change(screen.getByTestId('gallery-search-input'), { target: { value: 'moon' } })
        await waitFor(() => expect(apiService.getStories).toHaveBeenCalledWith(0, 24, 'moon'))
        fireEvent.click(screen.getAllByTestId('gallery-card')[0])
        await waitFor(() => expect(openStory).toHaveBeenCalled())
        await waitFor(() => expect(setPage).toHaveBeenCalledWith('story'))

        expect(createStory).not.toHaveBeenCalled()
        expect(deleteStory).not.toHaveBeenCalled()
    })

    it('disables the empty-state New novel of an archived workspace', async () => {
        vi.mocked(apiService.getStories).mockResolvedValue([])
        workspace = createWorkspaceTestState({
            api: apiService,
            workspaces: [testWorkspace(TEST_WORKSPACE_ID, 'Main library', { archived_at: '2026-10-10T00:00:00Z' })],
        })
        render(inWorkspace(<NovelGalleryPage />))

        expect(await screen.findByText('No novels yet')).toBeInTheDocument()
        const buttons = screen.getAllByRole('button', { name: /New novel/ })
        expect(buttons).toHaveLength(2)
        for (const button of buttons) expect(button).toBeDisabled()
    })

    it('does not open the studio when a story opened after a workspace switch', async () => {
        let finishOpen!: () => void
        openStory.mockImplementationOnce(() => new Promise<void>((resolve) => { finishOpen = resolve }))
        const { rerender } = render(inWorkspace(<NovelGalleryPage />))
        fireEvent.click((await screen.findAllByTestId('gallery-card'))[0])
        await waitFor(() => expect(openStory).toHaveBeenCalled())

        workspace.switchTo(OTHER_WORKSPACE_ID)
        rerender(inWorkspace(<NovelGalleryPage />))
        await act(async () => {
            finishOpen()
            await Promise.resolve()
        })

        expect(setPage).not.toHaveBeenCalled()
    })
})
