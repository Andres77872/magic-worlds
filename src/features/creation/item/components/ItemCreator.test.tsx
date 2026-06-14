import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    setPage: vi.fn(),
    goBack: vi.fn(),
    loadData: vi.fn(),
    openLoginModal: vi.fn(),
    registerThemeSongJob: vi.fn(),
    createCardAssistantConversation: vi.fn(),
    listCardAssistantConversations: vi.fn(),
    getCardAssistantConversation: vi.fn(),
    sendCardAssistantMessage: vi.fn(),
    streamCardAssistantMessage: vi.fn(),
    setEditingItem: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    generateCardPortrait: vi.fn(),
    isAuthenticated: true,
    editingItem: null as Record<string, unknown> | null,
}))

vi.mock('@/app/hooks', () => ({
    useNavigation: () => ({ setPage: mocks.setPage, goBack: mocks.goBack }),
    useData: () => ({ editingItem: mocks.editingItem, setEditingItem: mocks.setEditingItem, loadData: mocks.loadData }),
    useAuth: () => ({ isAuthenticated: mocks.isAuthenticated, openLoginModal: mocks.openLoginModal }),
    useBackgroundTasks: () => ({ tasks: [], registerThemeSongJob: mocks.registerThemeSongJob }),
}))

vi.mock('@/infrastructure/api', () => ({
    ApiError: class ApiError extends Error { status = 500; isTransient = true },
    resolveMediaUrl: (url?: string | null) => url ?? undefined,
    isProtectedMediaUrl: () => false,
    apiService: {
        createCardAssistantConversation: mocks.createCardAssistantConversation,
        listCardAssistantConversations: mocks.listCardAssistantConversations,
        getCardAssistantConversation: mocks.getCardAssistantConversation,
        sendCardAssistantMessage: mocks.sendCardAssistantMessage,
        streamCardAssistantMessage: mocks.streamCardAssistantMessage,
        createItem: mocks.createItem,
        updateItem: mocks.updateItem,
        generateCardPortrait: mocks.generateCardPortrait,
        waitForImageJob: vi.fn(),
        listThemeSongs: vi.fn().mockResolvedValue({ items: [] }),
    },
}))

import { ItemCreator } from './ItemCreator'

describe('ItemCreator guided payload', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isAuthenticated = true
        mocks.editingItem = null
        mocks.listCardAssistantConversations.mockResolvedValue({ conversations: [] })
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
        mocks.listCardAssistantConversations.mockResolvedValue({ conversations: [] })
    })

    it('returns to the origin after saving a new item', async () => {
        render(<ItemCreator />)

        fireEvent.click(screen.getByRole('button', { name: /skip — start with the standard fields/i }))
        fireEvent.change(screen.getByPlaceholderText(/moonlit compass/i), { target: { value: 'Moonlit Compass' } })
        fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'A brass compass.' } })
        fireEvent.click(screen.getByRole('button', { name: /^Create Item$/i }))

        await waitFor(() => expect(mocks.createItem).toHaveBeenCalledTimes(1))
        await waitFor(() => expect(mocks.goBack).toHaveBeenCalledWith('landing'))
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
