import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const setPage = vi.fn()
const setCharacters = vi.fn()
const setWorlds = vi.fn()
const setItems = vi.fn()
const setTemplateAdventures = vi.fn()
const editCharacter = vi.fn()
const deleteCharacter = vi.fn().mockResolvedValue(undefined)
const editItem = vi.fn()
const deleteItem = vi.fn().mockResolvedValue(undefined)
const startCharacterChat = vi.fn().mockResolvedValue(undefined)
const startCharacterGroupChat = vi.fn().mockResolvedValue(undefined)
const startTemplate = vi.fn().mockResolvedValue(undefined)
const deleteTemplateById = vi.fn().mockResolvedValue(undefined)
const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL
const originalClipboard = navigator.clipboard
const originalScrollIntoView = Element.prototype.scrollIntoView

const mockData = vi.hoisted(() => ({
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
}))

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
        characters: mockData.characters,
        setCharacters,
        worlds: [],
        setWorlds,
        items: [],
        setItems,
        templateAdventures: [],
        setTemplateAdventures,
        editCharacter,
        deleteCharacter,
        startCharacterChat,
        startCharacterGroupChat,
        editWorld: vi.fn(),
        deleteWorld: vi.fn(),
        editItem,
        setEditingItem: vi.fn(),
        deleteItem,
        editTemplate: vi.fn(),
        startTemplate,
        deleteTemplateById,
        loadData: vi.fn().mockResolvedValue(undefined),
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
        createCardShareLink: vi.fn(),
        publishCard: vi.fn(),
        unpublishCard: vi.fn(),
        listPublicCards: vi.fn().mockResolvedValue({ items: [], skip: 0, limit: 24 }),
        getPublicCard: vi.fn(),
        cloneCard: vi.fn(),
        duplicateCard: vi.fn(),
    },
    resolveMediaUrl: (url?: string | null) => url ?? undefined,
    isProtectedMediaUrl: () => false,
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
        vi.mocked(apiService.createCardShareLink).mockResolvedValue({
            share_token: 'share-token-1',
            share_url: 'http://localhost/cards/shared/share-token-1',
            resource: {
                card_type: 'character',
                card: CHARACTERS[0],
                visibility: { share_link: true },
                original_card_id: 'c1',
            },
        })
        vi.mocked(apiService.publishCard).mockResolvedValue({
            card_type: 'character',
            card: CHARACTERS[0],
            visibility: { public: true },
            original_card_id: 'c1',
        })
        vi.mocked(apiService.unpublishCard).mockResolvedValue({
            card_type: 'character',
            card: CHARACTERS[0],
            visibility: { public: false },
            original_card_id: 'c1',
        })
        vi.mocked(apiService.cloneCard).mockResolvedValue({
            card_type: 'character',
            card: CHARACTERS[0],
            source_access: 'public',
            original_card_id: 'c1',
        })
        vi.mocked(apiService.duplicateCard).mockResolvedValue({
            card_type: 'character',
            card: { ...CHARACTERS[0], id: 'c-copy', name: 'Lyra Copy' },
            cloned_from: CHARACTERS[0],
            source_access: 'owner',
            original_card_id: 'c1',
        })
        mockData.characters = [
            {
                id: 'p1',
                name: 'Aria',
                race: 'Human',
                description: 'A steady traveler.',
                role: 'persona',
                is_default_persona: true,
            },
            { id: 'c1', name: 'Lyra', race: 'Half-elf', role: 'character' },
        ]
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
        // The card id is stamped into the URL so a refresh restores the editor.
        expect(setPage).toHaveBeenCalledWith('character', { hash: '#/character?card=c1' })
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
        fireEvent.click(screen.getAllByRole('menuitem', { name: 'Copy unlisted link' })[0])

        await waitFor(() => expect(apiService.createCardShareLink).toHaveBeenCalledWith('character', 'c1'))
        await waitFor(() =>
            expect(writeText).toHaveBeenCalledWith(expect.stringContaining('#/shared/share-token-1')),
        )
        const toast = await screen.findByRole('status', { name: 'Unlisted link copied' })
        expect(within(toast).getByText('"Lyra" is accessible only through this link.')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument()
    })

    it('opens the custom context menu without firing the primary card action', async () => {
        render(<GalleryPage type="character" />)
        const card = (await screen.findAllByTestId('gallery-card'))[0]

        fireEvent.contextMenu(card, { clientX: 120, clientY: 140 })

        const menu = await screen.findByTestId('card-context-menu')
        expect(within(menu).getByRole('menuitem', { name: 'Copy unlisted link' })).toBeInTheDocument()
        expect(within(menu).getByRole('menuitem', { name: 'Share as public' })).toBeInTheDocument()
        expect(within(menu).getByRole('menuitem', { name: 'Download PNG' })).toBeInTheDocument()
        expect(within(menu).getByRole('menuitem', { name: 'Write' })).toBeInTheDocument()
        expect(within(menu).getByRole('menuitem', { name: 'New chat' })).toBeInTheDocument()
        expect(within(menu).getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument()
        expect(within(menu).getByRole('menuitem', { name: 'Duplicate' })).toBeInTheDocument()
        expect(within(menu).getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument()
        expect(editCharacter).not.toHaveBeenCalled()
    })

    it('does not offer Duplicate in the public gallery menu', async () => {
        vi.mocked(apiService.listPublicCards).mockResolvedValue({
            items: [
                {
                    card_type: 'character',
                    card: CHARACTERS[0],
                    visibility: { public: true },
                    original_card_id: 'c1',
                    original_creator: { user_id: 7, username: 'creator' },
                },
            ],
            skip: 0,
            limit: 24,
        })

        render(<GalleryPage type="character" />)
        await screen.findByText('Lyra')

        fireEvent.click(screen.getByRole('button', { name: 'Public cards' }))
        await waitFor(() => expect(apiService.listPublicCards).toHaveBeenCalledWith(0, 24, undefined, 'character', 'character'))
        const card = (await screen.findAllByTestId('gallery-card'))[0]

        fireEvent.contextMenu(card, { clientX: 120, clientY: 140 })

        const menu = await screen.findByTestId('card-context-menu')
        expect(within(menu).getByRole('menuitem', { name: 'Import card' })).toBeInTheDocument()
        expect(within(menu).queryByRole('menuitem', { name: 'Duplicate' })).not.toBeInTheDocument()
    })

    it('duplicates an owned card and prepends the clone without version metadata', async () => {
        vi.mocked(apiService.getCharacters).mockResolvedValue([
            { ...CHARACTERS[0], latest_version_number: 3 },
            CHARACTERS[1],
        ])
        vi.mocked(apiService.duplicateCard).mockResolvedValue({
            card_type: 'character',
            card: {
                id: 'c-copy',
                name: 'Lyra Copy',
                race: 'Half-elf',
                role: 'character',
                triggers: ['bard'],
                image_url: '/images/assets/copied-image',
                theme_song_url: '/theme-songs/assets/copied-theme.mp3',
                latest_version_id: null,
                latest_version_number: 0,
            },
            cloned_from: CHARACTERS[0],
            source_access: 'owner',
            original_card_id: 'c1',
        })

        render(<GalleryPage type="character" />)
        const firstCard = (await screen.findAllByTestId('gallery-card'))[0]

        fireEvent.contextMenu(firstCard, { clientX: 120, clientY: 140 })
        fireEvent.click(within(await screen.findByTestId('card-context-menu')).getByRole('menuitem', { name: 'Duplicate' }))

        await waitFor(() => expect(apiService.duplicateCard).toHaveBeenCalledWith('character', 'c1'))
        const cards = await screen.findAllByTestId('gallery-card')
        expect(within(cards[0]).getByText('Lyra Copy')).toBeInTheDocument()
        expect(within(cards[0]).queryByText('v3')).not.toBeInTheDocument()
        expect(setCharacters).toHaveBeenCalledWith([
            expect.objectContaining({
                id: 'c-copy',
                image_url: '/images/assets/copied-image',
                theme_song_url: '/theme-songs/assets/copied-theme.mp3',
                latest_version_number: 0,
            }),
            ...mockData.characters,
        ])
        expect(await screen.findByRole('status', { name: 'Card duplicated' })).toBeInTheDocument()
    })

    it('shows an error toast and leaves the list unchanged when duplicate fails', async () => {
        vi.mocked(apiService.duplicateCard).mockRejectedValueOnce(new Error('Clone storage failed'))

        render(<GalleryPage type="character" />)
        const firstCard = (await screen.findAllByTestId('gallery-card'))[0]

        fireEvent.contextMenu(firstCard, { clientX: 120, clientY: 140 })
        fireEvent.click(within(await screen.findByTestId('card-context-menu')).getByRole('menuitem', { name: 'Duplicate' }))

        await waitFor(() => expect(apiService.duplicateCard).toHaveBeenCalledWith('character', 'c1'))
        expect(await screen.findByText('Could not duplicate card')).toBeInTheDocument()
        expect(screen.getByText('Clone storage failed')).toBeInTheDocument()
        expect(screen.queryByText('Lyra Copy')).not.toBeInTheDocument()
        expect(screen.getAllByTestId('gallery-card')).toHaveLength(2)
        expect(setCharacters).not.toHaveBeenCalled()
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

        await waitFor(() => expect(apiService.getCharacter).toHaveBeenCalledWith('c99'))
        expect(await screen.findByText('Zed')).toBeInTheDocument()
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
        expect(setPage).toHaveBeenCalledWith('item', { hash: '#/item?card=i1' })
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

    it('starts a new character chat with the default persona', async () => {
        render(<GalleryPage type="character" />)
        await screen.findByText('Lyra')

        fireEvent.click(screen.getAllByRole('button', { name: 'New chat' })[0])

        await waitFor(() => expect(startCharacterChat).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'c1' }),
            expect.objectContaining({ id: 'p1' }),
        ))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        await waitFor(() => expect(setPage).toHaveBeenCalledWith('character-chat'))
    })

    it('falls back to the persona picker when no default persona is set', async () => {
        mockData.characters = [
            {
                id: 'p1',
                name: 'Aria',
                race: 'Human',
                description: 'A steady traveler.',
                role: 'persona',
                is_default_persona: false,
            },
            { id: 'c1', name: 'Lyra', race: 'Half-elf', role: 'character' },
        ]
        render(<GalleryPage type="character" />)
        await screen.findByText('Lyra')

        fireEvent.click(screen.getAllByRole('button', { name: 'New chat' })[0])
        const dialog = await screen.findByRole('dialog', { name: 'Choose your persona' })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Start chat' }))

        expect(startCharacterChat).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'c1' }),
            expect.objectContaining({ id: 'p1' }),
        )
        await waitFor(() => expect(setPage).toHaveBeenCalledWith('character-chat'))
    })

    it('reports a new character chat start failure without navigating', async () => {
        startCharacterChat.mockRejectedValueOnce(new Error('Chat service down'))
        render(<GalleryPage type="character" />)
        await screen.findByText('Lyra')

        fireEvent.click(screen.getAllByRole('button', { name: 'New chat' })[0])

        expect(await screen.findByText('Could not start this chat')).toBeInTheDocument()
        expect(screen.getByText('Chat service down')).toBeInTheDocument()
        expect(setPage).not.toHaveBeenCalledWith('character-chat')
    })

    it('starts a group chat from selected character cards', async () => {
        render(<GalleryPage type="character" />)
        await screen.findByText('Lyra')

        fireEvent.click(screen.getByRole('button', { name: 'Group chat' }))
        expect(screen.getByText('0 selected for group chat')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'New chat' })).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Add to group chat: Lyra' }))
        fireEvent.click(screen.getByRole('button', { name: 'Add to group chat: Dorn' }))
        expect(screen.getByText('2 selected for group chat')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Start group chat' }))
        const dialog = await screen.findByRole('dialog')
        fireEvent.click(within(dialog).getByRole('button', { name: 'Start group chat' }))

        expect(startCharacterGroupChat).toHaveBeenCalledWith(
            [expect.objectContaining({ id: 'c1' }), expect.objectContaining({ id: 'c2' })],
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
