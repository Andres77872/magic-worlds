import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const setPage = vi.fn()
const editCharacter = vi.fn()
const deleteCharacter = vi.fn().mockResolvedValue(undefined)
const startCharacterChat = vi.fn().mockResolvedValue(undefined)
const startTemplate = vi.fn().mockResolvedValue(undefined)
const deleteTemplateById = vi.fn().mockResolvedValue(undefined)

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: true, openLoginModal: vi.fn() }),
    useNavigation: () => ({ setPage }),
    useData: () => ({
        editCharacter,
        deleteCharacter,
        startCharacterChat,
        editWorld: vi.fn(),
        deleteWorld: vi.fn(),
        editTemplate: vi.fn(),
        startTemplate,
        deleteTemplateById,
    }),
}))

vi.mock('@/infrastructure/api', () => ({
    apiService: {
        getCharacters: vi.fn(),
        getWorlds: vi.fn().mockResolvedValue([]),
        getAdventureTemplates: vi.fn(),
    },
    resolveMediaUrl: (url?: string | null) => url ?? undefined,
}))

import { apiService } from '@/infrastructure/api'
import { GalleryPage } from './GalleryPage'

const CHARACTERS = [
    { id: 'c1', name: 'Lyra', race: 'Half-elf', triggers: ['bard', 'song'] },
    { id: 'c2', name: 'Dorn', race: 'Dwarf', triggers: [] },
]

describe('GalleryPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(apiService.getCharacters).mockResolvedValue(CHARACTERS)
        vi.mocked(apiService.getAdventureTemplates).mockResolvedValue([])
    })

    it('renders cards fetched from the API', async () => {
        render(<GalleryPage type="character" />)

        expect(await screen.findByText('Lyra')).toBeInTheDocument()
        expect(screen.getByText('Dorn')).toBeInTheDocument()
        expect(apiService.getCharacters).toHaveBeenCalledWith(0, 24, undefined)
    })

    it('fires a debounced server search with the typed query', async () => {
        render(<GalleryPage type="character" />)
        await screen.findByText('Lyra')

        fireEvent.change(screen.getByTestId('gallery-search-input'), { target: { value: 'elf' } })

        await waitFor(() => expect(apiService.getCharacters).toHaveBeenCalledWith(0, 24, 'elf'))
    })

    it('searches a trigger when its pill is clicked', async () => {
        render(<GalleryPage type="character" />)
        await screen.findByText('Lyra')

        fireEvent.click(screen.getByRole('button', { name: 'Search for bard' }))

        expect(screen.getByTestId('gallery-search-input')).toHaveValue('bard')
        await waitFor(() => expect(apiService.getCharacters).toHaveBeenCalledWith(0, 24, 'bard'))
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

    it('begins an adventure when an adventure card is activated', async () => {
        vi.mocked(apiService.getAdventureTemplates).mockResolvedValue([
            { id: 't1', name: 'Ring Quest', description: 'Destroy the ring', triggers: ['ring'] },
        ])
        render(<GalleryPage type="adventure" />)
        const card = (await screen.findAllByTestId('gallery-card'))[0]

        fireEvent.click(card)

        expect(startTemplate).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }))
        expect(setPage).toHaveBeenCalledWith('interaction')
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
