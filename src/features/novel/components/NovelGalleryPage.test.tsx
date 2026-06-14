import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'

const setPage = vi.fn()
const createStory = vi.fn()
const openStory = vi.fn().mockResolvedValue(undefined)
const deleteStory = vi.fn().mockResolvedValue(undefined)

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
    useAuth: () => ({ isAuthenticated: true, openLoginModal: vi.fn() }),
    useNavigation: () => ({ setPage }),
    useData: () => ({ createStory, openStory, deleteStory }),
}))

vi.mock('@/infrastructure/api', () => ({
    apiService: {
        getStories: vi.fn(),
        getCharacters: vi.fn().mockResolvedValue([]),
        getWorlds: vi.fn().mockResolvedValue([]),
        getItems: vi.fn().mockResolvedValue([]),
        getAdventureTemplates: vi.fn().mockResolvedValue([]),
    },
    resolveMediaUrl: (url?: string | null) => url ?? undefined,
}))

import type { Story, StoryChapter } from '@/shared'
import { apiService } from '@/infrastructure/api'
import { NovelGalleryPage } from './NovelGalleryPage'

const ACTIVE_CONTEXT = {
    includeSelectedCards: true,
    includeMentionedCards: true,
    includeLorebooks: true,
    includeRecentScenes: 2,
    tokenBudget: 6000,
}

function chapter(id: string, storyId: string, body: string): StoryChapter {
    return { id, storyId, title: id, body, order: 0, status: 'draft', activeCardRefs: [], mentionRefs: [] }
}

const STORIES: Story[] = [
    {
        id: 's1',
        title: 'Glass War',
        source: { kind: 'character', id: 'c1', title: 'Aria' },
        scenes: [],
        chapters: [chapter('ch1', 's1', 'The moon cracks over the wall.')],
        activeCardRefs: [
            {
                id: 'r1',
                storyId: 's1',
                kind: 'character',
                cardId: 'c1',
                source: 'source',
                enabled: true,
                precedence: 0,
                snapshot: { name: 'Aria', image_url: '/img/aria.png' },
            },
        ],
        activeContext: ACTIVE_CONTEXT,
    },
    {
        id: 's2',
        title: 'Moon Court',
        source: { kind: 'blank' },
        scenes: [],
        chapters: [chapter('ch2', 's2', '')],
        activeCardRefs: [],
        activeContext: ACTIVE_CONTEXT,
    },
]

function renderSpanish(ui: ReactElement) {
    const localI18n = i18n.cloneInstance({ lng: 'es' })
    return render(<I18nextProvider i18n={localI18n}>{ui}</I18nextProvider>)
}

describe('NovelGalleryPage', () => {
    beforeEach(async () => {
        await i18n.changeLanguage('en')
        vi.clearAllMocks()
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
        render(<NovelGalleryPage />)

        expect(await screen.findByText('Glass War')).toBeInTheDocument()
        expect(screen.getByText('Moon Court')).toBeInTheDocument()
        expect(apiService.getStories).toHaveBeenCalledWith(0, 24, undefined)
        expect(screen.getByText('Aria')).toBeInTheDocument()
        expect(screen.getAllByText('1 chapter').length).toBe(2)
    })

    it('fires a debounced server search with the typed query', async () => {
        render(<NovelGalleryPage />)
        await screen.findByText('Glass War')

        fireEvent.change(screen.getByTestId('gallery-search-input'), { target: { value: 'moon' } })

        await waitFor(() => expect(apiService.getStories).toHaveBeenCalledWith(0, 24, 'moon'))
    })

    it('opens a novel and navigates to the studio when its card is activated', async () => {
        render(<NovelGalleryPage />)
        const card = (await screen.findAllByTestId('gallery-card'))[0]

        fireEvent.click(card)

        await waitFor(() => expect(openStory).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' })))
        await waitFor(() => expect(setPage).toHaveBeenCalledWith('story'))
    })

    it('deletes via the hover menu through the confirm dialog and removes the card', async () => {
        render(<NovelGalleryPage />)
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
        render(<NovelGalleryPage />)
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
        render(<NovelGalleryPage />)
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
})
