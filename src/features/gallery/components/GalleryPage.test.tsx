import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const setPage = vi.fn()
const editCharacter = vi.fn()
const deleteCharacter = vi.fn().mockResolvedValue(undefined)
const editItem = vi.fn()
const deleteItem = vi.fn().mockResolvedValue(undefined)
const startCharacterChat = vi.fn().mockResolvedValue(undefined)
const startTemplate = vi.fn().mockResolvedValue(undefined)
const deleteTemplateById = vi.fn().mockResolvedValue(undefined)
const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL
const originalClipboard = navigator.clipboard
const originalScrollIntoView = Element.prototype.scrollIntoView

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
    useData: () => ({
        characters: [
            {
                id: 'p1',
                name: 'Aria',
                race: 'Human',
                description: 'A steady traveler.',
                role: 'persona',
                is_default_persona: true,
            },
            { id: 'c1', name: 'Lyra', race: 'Half-elf', role: 'character' },
        ],
        editCharacter,
        deleteCharacter,
        startCharacterChat,
        editWorld: vi.fn(),
        deleteWorld: vi.fn(),
        editItem,
        setEditingItem: vi.fn(),
        deleteItem,
        editTemplate: vi.fn(),
        startTemplate,
        deleteTemplateById,
    }),
}))

vi.mock('@/infrastructure/api', () => ({
    apiService: {
        getCharacters: vi.fn(),
        getCharacter: vi.fn(),
        getWorlds: vi.fn().mockResolvedValue([]),
        getWorld: vi.fn(),
        getItems: vi.fn().mockResolvedValue([]),
        getItem: vi.fn(),
        getAdventureTemplates: vi.fn(),
        getAdventureTemplate: vi.fn(),
        exportCardImage: vi.fn(),
    },
    resolveMediaUrl: (url?: string | null) => url ?? undefined,
}))

import { apiService } from '@/infrastructure/api'
import { GalleryPage } from './GalleryPage'

const CHARACTERS = [
    { id: 'c1', name: 'Lyra', race: 'Half-elf', role: 'character', triggers: ['bard', 'song'] },
    { id: 'c2', name: 'Dorn', race: 'Dwarf', role: 'character', triggers: [] },
]

const PERSONAS = [
    { id: 'p1', name: 'Aria', race: 'Human', role: 'persona', is_default_persona: true, triggers: ['traveler'] },
]

const WORLDS = [
    { id: 'w1', name: 'Eldoria', place_type: 'kingdom', type: 'high fantasy', triggers: ['castle'] },
]

const ITEMS = [
    { id: 'i1', name: 'Moonlit Compass', type: 'relic', rarity: 'rare', description: 'Finds safe roads.', triggers: ['compass'] },
]

const ADVENTURES = [
    { id: 't1', name: 'Ring Quest', description: 'Destroy the ring', triggers: ['ring'] },
]

function mockDownload(expectedFilename: string) {
    const createObjectURL = vi.fn(() => 'blob:card-export')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: createObjectURL,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: revokeObjectURL,
    })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
    ) {
        expect(this.getAttribute('download')).toBe(expectedFilename)
        expect(this.getAttribute('href')).toBe('blob:card-export')
    })

    return { click, revokeObjectURL }
}

describe('GalleryPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        if (!globalThis.IntersectionObserver) {
            vi.stubGlobal('IntersectionObserver', class IntersectionObserver {
                observe() {}
                unobserve() {}
                disconnect() {}
            })
        }
        vi.mocked(apiService.getCharacters).mockResolvedValue(CHARACTERS)
        vi.mocked(apiService.getCharacter).mockResolvedValue(CHARACTERS[0])
        vi.mocked(apiService.getWorlds).mockResolvedValue([])
        vi.mocked(apiService.getWorld).mockResolvedValue(WORLDS[0])
        vi.mocked(apiService.getItems).mockResolvedValue([])
        vi.mocked(apiService.getItem).mockResolvedValue(ITEMS[0])
        vi.mocked(apiService.getAdventureTemplates).mockResolvedValue([])
        vi.mocked(apiService.getAdventureTemplate).mockResolvedValue(ADVENTURES[0])
        vi.mocked(apiService.exportCardImage).mockResolvedValue(new Blob(['png'], { type: 'image/png' }))
        Element.prototype.scrollIntoView = vi.fn()
        window.location.hash = ''
    })

    afterEach(() => {
        vi.restoreAllMocks()
        Object.defineProperty(URL, 'createObjectURL', {
            configurable: true,
            writable: true,
            value: originalCreateObjectURL,
        })
        Object.defineProperty(URL, 'revokeObjectURL', {
            configurable: true,
            writable: true,
            value: originalRevokeObjectURL,
        })
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: originalClipboard,
        })
        Element.prototype.scrollIntoView = originalScrollIntoView
        window.location.hash = ''
    })

    it('renders cards fetched from the API', async () => {
        render(<GalleryPage type="character" />)

        expect(await screen.findByText('Lyra')).toBeInTheDocument()
        expect(screen.getByText('Dorn')).toBeInTheDocument()
        expect(apiService.getCharacters).toHaveBeenCalledWith(0, 24, undefined, 'character')
    })

    it('renders persona cards fetched with the persona role filter', async () => {
        vi.mocked(apiService.getCharacters).mockResolvedValue(PERSONAS)

        render(<GalleryPage type="persona" />)

        expect(await screen.findByText('Aria')).toBeInTheDocument()
        expect(apiService.getCharacters).toHaveBeenCalledWith(0, 24, undefined, 'persona')
    })

    it('fires a debounced server search with the typed query', async () => {
        render(<GalleryPage type="character" />)
        await screen.findByText('Lyra')

        fireEvent.change(screen.getByTestId('gallery-search-input'), { target: { value: 'elf' } })

        await waitFor(() => expect(apiService.getCharacters).toHaveBeenCalledWith(0, 24, 'elf', 'character'))
    })

    it('searches a trigger when its pill is clicked', async () => {
        render(<GalleryPage type="character" />)
        await screen.findByText('Lyra')

        fireEvent.click(screen.getByRole('button', { name: 'Search for bard' }))

        expect(screen.getByTestId('gallery-search-input')).toHaveValue('bard')
        await waitFor(() => expect(apiService.getCharacters).toHaveBeenCalledWith(0, 24, 'bard', 'character'))
    })

    it('navigates to the editor when a character card is activated', async () => {
        render(<GalleryPage type="character" />)
        const card = (await screen.findAllByTestId('gallery-card'))[0]

        fireEvent.click(card)

        expect(editCharacter).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }))
        expect(setPage).toHaveBeenCalledWith('character')
    })

    it('deletes via the hover menu through the confirm dialog and removes the card', async () => {
        render(<GalleryPage type="character" />)
        await screen.findByText('Lyra')

        fireEvent.click(screen.getAllByTestId('card-options-button')[0])
        // Both cards' menus are portaled into the DOM (hidden only via CSS,
        // which jsdom doesn't apply) — the first belongs to the first card.
        fireEvent.click(screen.getAllByRole('menuitem', { name: 'Delete' })[0])

        const dialog = await screen.findByRole('dialog')
        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

        await waitFor(() => expect(deleteCharacter).toHaveBeenCalledWith('c1'))
        await waitFor(() => expect(screen.queryByText('Lyra')).not.toBeInTheDocument())
        expect(screen.getByText('Dorn')).toBeInTheDocument()
    })

    it('exports a character card image from the share menu', async () => {
        const { click, revokeObjectURL } = mockDownload('Lyra.png')

        render(<GalleryPage type="character" />)
        await screen.findByText('Lyra')

        fireEvent.click(screen.getAllByTestId('card-share-button')[0])
        fireEvent.click(screen.getAllByRole('menuitem', { name: 'Download PNG' })[0])

        await waitFor(() => expect(apiService.exportCardImage).toHaveBeenCalledWith('character', 'c1'))
        await waitFor(() => expect(click).toHaveBeenCalledTimes(1))
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:card-export')
    })

    it('copies a share link from the share menu', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined)
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText },
        })

        render(<GalleryPage type="character" />)
        await screen.findByText('Lyra')

        fireEvent.click(screen.getAllByTestId('card-share-button')[0])
        fireEvent.click(screen.getAllByRole('menuitem', { name: 'Share' })[0])

        await waitFor(() =>
            expect(writeText).toHaveBeenCalledWith(expect.stringContaining('#/gallery/characters?card=c1')),
        )
        const toast = await screen.findByRole('status', { name: 'Share link copied' })
        expect(within(toast).getByText('Lyra')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument()
    })

    it('opens the custom context menu without firing the primary card action', async () => {
        render(<GalleryPage type="character" />)
        const card = (await screen.findAllByTestId('gallery-card'))[0]

        fireEvent.contextMenu(card, { clientX: 120, clientY: 140 })

        const menu = await screen.findByTestId('card-context-menu')
        expect(within(menu).getByRole('menuitem', { name: 'Share' })).toBeInTheDocument()
        expect(within(menu).getByRole('menuitem', { name: 'Download PNG' })).toBeInTheDocument()
        expect(within(menu).getByRole('menuitem', { name: 'Write' })).toBeInTheDocument()
        expect(within(menu).getByRole('menuitem', { name: 'Chat' })).toBeInTheDocument()
        expect(within(menu).getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument()
        expect(within(menu).getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument()
        expect(editCharacter).not.toHaveBeenCalled()
    })

    it('opens the context menu from the keyboard and restores focus on Escape', async () => {
        render(<GalleryPage type="character" />)
        const card = (await screen.findAllByTestId('gallery-card'))[0]
        card.focus()

        fireEvent.keyDown(card, { key: 'ContextMenu' })
        expect(await screen.findByTestId('card-context-menu')).toBeInTheDocument()

        fireEvent.keyDown(document, { key: 'Escape' })

        await waitFor(() => expect(screen.queryByTestId('card-context-menu')).not.toBeInTheDocument())
        expect(document.activeElement).toBe(card)
    })

    it('loads and highlights a directly shared card link', async () => {
        vi.mocked(apiService.getCharacter).mockResolvedValue({
            id: 'c99',
            name: 'Zed',
            race: 'Tiefling',
            role: 'character',
            triggers: ['ash'],
        })
        window.location.hash = '#/gallery/characters?card=c99'

        render(<GalleryPage type="character" />)

        expect(await screen.findByText('Zed')).toBeInTheDocument()
        expect(apiService.getCharacter).toHaveBeenCalledWith('c99')
        expect(screen.getByText('Zed').closest('[data-gallery-card-id="c99"]')).toHaveClass('ring-1')
    })

    it('exports a world card image from the share menu', async () => {
        vi.mocked(apiService.getWorlds).mockResolvedValue(WORLDS)
        const { click } = mockDownload('Eldoria.png')

        render(<GalleryPage type="world" />)
        await screen.findByText('Eldoria')

        fireEvent.click(screen.getAllByTestId('card-share-button')[0])
        fireEvent.click(screen.getAllByRole('menuitem', { name: 'Download PNG' })[0])

        await waitFor(() => expect(apiService.exportCardImage).toHaveBeenCalledWith('world', 'w1'))
        await waitFor(() => expect(click).toHaveBeenCalledTimes(1))
    })

    it('renders item cards and opens the item editor', async () => {
        vi.mocked(apiService.getItems).mockResolvedValue(ITEMS)

        render(<GalleryPage type="item" />)
        const card = (await screen.findAllByTestId('gallery-card'))[0]

        expect(screen.getByText('Moonlit Compass')).toBeInTheDocument()
        expect(apiService.getItems).toHaveBeenCalledWith(0, 24, undefined)
        fireEvent.click(card)

        expect(editItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'i1' }))
        expect(setPage).toHaveBeenCalledWith('item')
    })

    it('exports an item card image from the share menu', async () => {
        vi.mocked(apiService.getItems).mockResolvedValue(ITEMS)
        const { click } = mockDownload('Moonlit Compass.png')

        render(<GalleryPage type="item" />)
        await screen.findByText('Moonlit Compass')

        fireEvent.click(screen.getAllByTestId('card-share-button')[0])
        fireEvent.click(screen.getAllByRole('menuitem', { name: 'Download PNG' })[0])

        await waitFor(() => expect(apiService.exportCardImage).toHaveBeenCalledWith('item', 'i1'))
        await waitFor(() => expect(click).toHaveBeenCalledTimes(1))
    })

    it('exports an adventure card image from the share menu', async () => {
        vi.mocked(apiService.getAdventureTemplates).mockResolvedValue(ADVENTURES)
        const { click } = mockDownload('Destroy the ring.png')

        render(<GalleryPage type="adventure" />)
        await screen.findByText('Destroy the ring')

        fireEvent.click(screen.getAllByTestId('card-share-button')[0])
        fireEvent.click(screen.getAllByRole('menuitem', { name: 'Download PNG' })[0])

        await waitFor(() => expect(apiService.exportCardImage).toHaveBeenCalledWith('adventure_template', 't1'))
        await waitFor(() => expect(click).toHaveBeenCalledTimes(1))
    })

    it('begins an adventure when an adventure card is activated', async () => {
        vi.mocked(apiService.getAdventureTemplates).mockResolvedValue(ADVENTURES)
        render(<GalleryPage type="adventure" />)
        const card = (await screen.findAllByTestId('gallery-card'))[0]

        fireEvent.click(card)
        const dialog = await screen.findByRole('dialog')
        fireEvent.click(within(dialog).getByRole('button', { name: 'Begin adventure' }))

        expect(startTemplate).toHaveBeenCalledWith(
            expect.objectContaining({ id: 't1' }),
            expect.objectContaining({ id: 'p1' }),
        )
        await waitFor(() => expect(setPage).toHaveBeenCalledWith('interaction'))
    })

    it('keeps the persona picker open and reports an adventure start failure', async () => {
        startTemplate.mockRejectedValueOnce(new Error('Session service down'))
        vi.mocked(apiService.getAdventureTemplates).mockResolvedValue(ADVENTURES)
        render(<GalleryPage type="adventure" />)
        const card = (await screen.findAllByTestId('gallery-card'))[0]

        fireEvent.click(card)
        const dialog = await screen.findByRole('dialog')
        fireEvent.click(within(dialog).getByRole('button', { name: 'Begin adventure' }))

        expect(await within(dialog).findByRole('alert')).toHaveTextContent('Session service down')
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(setPage).not.toHaveBeenCalledWith('interaction')
    })

    it('starts a character chat with the selected persona', async () => {
        render(<GalleryPage type="character" />)
        await screen.findByText('Lyra')

        fireEvent.click(screen.getAllByTestId('card-options-button')[0])
        fireEvent.click(screen.getAllByRole('menuitem', { name: 'Chat' })[0])
        const dialog = await screen.findByRole('dialog')
        fireEvent.click(within(dialog).getByRole('button', { name: 'Start chat' }))

        expect(startCharacterChat).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'c1' }),
            expect.objectContaining({ id: 'p1' }),
        )
        await waitFor(() => expect(setPage).toHaveBeenCalledWith('character-chat'))
    })

    it('offers a clear-search empty state when a query matches nothing', async () => {
        vi.mocked(apiService.getCharacters).mockImplementation(async (_skip, _limit, q) =>
            q ? [] : CHARACTERS,
        )
        render(<GalleryPage type="character" />)
        await screen.findByText('Lyra')

        fireEvent.change(screen.getByTestId('gallery-search-input'), { target: { value: 'nothing' } })

        expect(await screen.findByText('No characters match')).toBeInTheDocument()
        // getByText targets the empty-state Button (the masthead X clear
        // button matches the same accessible name via its aria-label).
        fireEvent.click(screen.getByText('Clear search'))
        expect(await screen.findByText('Lyra')).toBeInTheDocument()
    })
})
