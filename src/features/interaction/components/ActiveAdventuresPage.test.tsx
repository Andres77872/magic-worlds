import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Adventure, Character, World } from '@/shared'
import { ActiveAdventuresPage } from './ActiveAdventuresPage'

const setPage = vi.fn()
const openLoginModal = vi.fn()
const editInProgress = vi.fn()
const deleteInProgress = vi.fn().mockResolvedValue(undefined)
const loadData = vi.fn().mockResolvedValue(undefined)
let authed = true
let inProgressAdventures: Adventure[] = []

const PERSONA = { id: 'p1', name: 'Aria', stats: {}, role: 'persona' } as Character
const WORLDS = [
    { id: 'w1', name: 'Eldergrove', type: 'forest', details: {} },
    { id: 'w2', name: 'Frostglass', type: 'city', details: {} },
] as World[]

const ADVENTURES: Adventure[] = [
    {
        id: 'a1',
        scenario: 'Lost Keep',
        persona: PERSONA,
        world: WORLDS[0],
        turns: [{ id: 't1', type: 'ai', content: 'The gate burns with quiet light.', timestamp: '' }],
        status: 'in-progress',
        updatedAt: '2026-06-12 09:00:00',
    },
    {
        id: 'a2',
        scenario: 'Sunken Gate',
        persona: PERSONA,
        world: WORLDS[1],
        turns: [{ id: 't2', type: 'user', content: 'I cross the bridge.', timestamp: '' }],
        status: 'in-progress',
        updatedAt: '2026-06-11 09:00:00',
    },
] as Adventure[]

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: authed, openLoginModal }),
    useNavigation: () => ({ setPage }),
    useData: () => ({
        inProgressAdventures,
        editInProgress,
        deleteInProgress,
        loadData,
    }),
}))

beforeEach(() => {
    authed = true
    inProgressAdventures = ADVENTURES
})

afterEach(() => {
    vi.clearAllMocks()
})

describe('ActiveAdventuresPage', () => {
    it('renders active adventures and resumes the selected session', () => {
        render(<ActiveAdventuresPage />)

        expect(screen.getByTestId('active-adventures-page')).toBeInTheDocument()
        expect(screen.getByText('Lost Keep')).toBeInTheDocument()
        expect(screen.getByText('Sunken Gate')).toBeInTheDocument()
        expect(loadData).toHaveBeenCalledWith({ silent: true })

        fireEvent.click(screen.getByRole('button', { name: 'Continue the tale: Lost Keep' }))

        expect(editInProgress).toHaveBeenCalledWith(ADVENTURES[0])
        expect(setPage).toHaveBeenCalledWith('interaction')
    })

    it('filters adventures by query and clears the search', () => {
        render(<ActiveAdventuresPage />)

        fireEvent.change(screen.getByLabelText('Search adventures'), { target: { value: 'frost' } })

        expect(screen.queryByText('Lost Keep')).not.toBeInTheDocument()
        expect(screen.getByText('Sunken Gate')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))

        expect(screen.getByText('Lost Keep')).toBeInTheDocument()
    })

    it('deletes an adventure after confirmation', async () => {
        render(<ActiveAdventuresPage />)

        fireEvent.click(screen.getByRole('button', { name: 'Actions for Sunken Gate' }))
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))

        const dialog = screen.getByRole('dialog', { name: 'Delete adventure' })
        expect(within(dialog).getByText('Delete "Sunken Gate"? This cannot be undone.')).toBeInTheDocument()

        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

        expect(deleteInProgress).toHaveBeenCalledWith(1)
    })

    it('opens the adventure gallery from the empty state', () => {
        inProgressAdventures = []

        render(<ActiveAdventuresPage />)

        expect(screen.getByText('No active adventures yet')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Browse adventures' }))

        expect(setPage).toHaveBeenCalledWith('gallery-adventures')
    })

    it('gates signed-out visitors', () => {
        authed = false

        render(<ActiveAdventuresPage />)

        expect(openLoginModal).toHaveBeenCalled()
        expect(setPage).toHaveBeenCalledWith('landing')
        expect(screen.queryByTestId('active-adventures-page')).not.toBeInTheDocument()
    })
})
