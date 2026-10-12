import { fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import { I18nextProvider } from 'react-i18next'
import type { ReactElement, ReactNode } from 'react'

vi.mock('@/infrastructure/api', () => {
    const apiService: Record<string, unknown> = {
        getCharacters: vi.fn().mockResolvedValue([]),
        getWorlds: vi.fn().mockResolvedValue([]),
        getItems: vi.fn().mockResolvedValue([]),
        getAdventureTemplates: vi.fn().mockResolvedValue([]),
        listLibraryCards: vi.fn(),
    }
    apiService.withWorkspace = vi.fn(() => apiService)
    return {
        apiService,
        isProtectedMediaUrl: () => false,
        resolveMediaUrl: (url?: string | null) => url ?? undefined,
    }
})

import { apiService } from '@/infrastructure/api'
import {
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    WorkspaceTestProvider,
    createWorkspaceTestState,
    type WorkspaceTestState,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { CardPicker } from './CardPicker'

let workspace: WorkspaceTestState

function Wrapper({ children }: { children: ReactNode }) {
    return <WorkspaceTestProvider state={workspace}>{children}</WorkspaceTestProvider>
}

function render(ui: ReactElement) {
    return rtlRender(ui, { wrapper: Wrapper })
}

function libraryItem(cardType: 'character' | 'world' | 'item', id: string, name: string) {
    return { card_type: cardType, card: { id, name, organization: { workspace_id: TEST_WORKSPACE_ID, collection_ids: [] } } }
}

const CHARACTERS = [
    { id: 'c1', name: 'Lyra', image_url: '/generated-images/lyra.jpeg' },
    { id: 'c2', name: 'Dorn' },
]

function renderSpanish(ui: ReactElement) {
    const localI18n = i18n.cloneInstance({ lng: 'es' })
    return render(<I18nextProvider i18n={localI18n}>{ui}</I18nextProvider>)
}

describe('CardPicker', () => {
    beforeEach(async () => {
        await i18n.changeLanguage('en')
        vi.clearAllMocks()
        workspace = createWorkspaceTestState({ api: apiService })
        vi.mocked(apiService.listLibraryCards).mockResolvedValue({
            items: [libraryItem('character', 'c1', 'Lyra'), libraryItem('world', 'w1', 'Rivendell'), libraryItem('item', 'i1', 'Moonlit Compass')],
            total: 3,
            limit: 32,
            offset: 0,
        })
        vi.mocked(apiService.getCharacters).mockResolvedValue(CHARACTERS)
        vi.mocked(apiService.getWorlds).mockResolvedValue([{ id: 'w1', name: 'Rivendell' }])
        vi.mocked(apiService.getItems).mockResolvedValue([{ id: 'i1', name: 'Moonlit Compass' }])
        vi.mocked(apiService.getAdventureTemplates).mockResolvedValue([])
    })

    it('opens on click and reads every card type of the workspace in one library request when scope is "all"', async () => {
        render(<CardPicker cardType="all" onChange={vi.fn()} />)

        fireEvent.click(screen.getByTestId('card-picker-trigger'))

        expect(await screen.findByText('Lyra')).toBeInTheDocument()
        expect(screen.getByText('Rivendell')).toBeInTheDocument()
        expect(screen.getByText('Moonlit Compass')).toBeInTheDocument()
        expect(apiService.listLibraryCards).toHaveBeenCalledTimes(1)
        expect(apiService.listLibraryCards).toHaveBeenCalledWith(TEST_WORKSPACE_ID, { q: undefined, limit: 32 })
        expect(apiService.getCharacters).not.toHaveBeenCalled()
        expect(apiService.getWorlds).not.toHaveBeenCalled()
    })

    it('drops the previous workspace options after a switch and lists the new workspace', async () => {
        const { rerender } = render(<CardPicker cardType="all" onChange={vi.fn()} />)
        fireEvent.click(screen.getByTestId('card-picker-trigger'))
        await screen.findByText('Lyra')

        vi.mocked(apiService.listLibraryCards).mockResolvedValue({ items: [libraryItem('world', 'w2', 'Eldoria')], total: 1, limit: 32, offset: 0 })
        workspace.switchTo(OTHER_WORKSPACE_ID)
        rerender(<CardPicker cardType="all" onChange={vi.fn()} />)

        expect(screen.queryByText('Lyra')).not.toBeInTheDocument()
        expect(await screen.findByText('Eldoria')).toBeInTheDocument()
        expect(apiService.listLibraryCards).toHaveBeenLastCalledWith(OTHER_WORKSPACE_ID, { q: undefined, limit: 32 })
    })

    it('scopes the option fetch to the active card type', async () => {
        render(<CardPicker cardType="character" onChange={vi.fn()} />)

        fireEvent.click(screen.getByTestId('card-picker-trigger'))
        await screen.findByText('Lyra')

        expect(apiService.getWorlds).not.toHaveBeenCalled()
        expect(apiService.getItems).not.toHaveBeenCalled()
        expect(apiService.getAdventureTemplates).not.toHaveBeenCalled()
    })

    it('debounces the typed query into the scoped endpoint', async () => {
        render(<CardPicker cardType="character" onChange={vi.fn()} />)
        fireEvent.click(screen.getByTestId('card-picker-trigger'))
        await screen.findByText('Lyra')

        fireEvent.change(screen.getByTestId('card-picker-search'), { target: { value: 'ly' } })

        await waitFor(() => expect(apiService.getCharacters).toHaveBeenLastCalledWith(0, 8, 'ly'))
    })

    it('selects an option on click and reports it upward', async () => {
        const onChange = vi.fn()
        render(<CardPicker cardType="character" onChange={onChange} />)
        fireEvent.click(screen.getByTestId('card-picker-trigger'))
        await screen.findByText('Lyra')

        fireEvent.click(screen.getByText('Lyra'))

        expect(onChange).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'character', id: 'c1', name: 'Lyra' }),
        )
        expect(screen.queryByTestId('card-picker-panel')).not.toBeInTheDocument()
    })

    it('supports keyboard selection with arrows + Enter', async () => {
        const onChange = vi.fn()
        render(<CardPicker cardType="character" onChange={onChange} />)
        fireEvent.click(screen.getByTestId('card-picker-trigger'))
        await screen.findByText('Dorn')

        const input = screen.getByTestId('card-picker-search')
        fireEvent.keyDown(input, { key: 'ArrowDown' })
        fireEvent.keyDown(input, { key: 'Enter' })

        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'c2', name: 'Dorn' }))
    })

    it('shows the picked card on the trigger and clears it', async () => {
        const onChange = vi.fn()
        render(<CardPicker cardType="character" value={{ type: 'character', id: 'c1', name: 'Lyra' }} onChange={onChange} />)

        expect(screen.getByTestId('card-picker-trigger')).toHaveTextContent('Lyra')

        fireEvent.click(screen.getByTestId('card-picker-clear'))
        expect(onChange).toHaveBeenCalledWith(undefined)
    })

    it('renders picker chrome in Spanish', async () => {
        const onChange = vi.fn()
        renderSpanish(<CardPicker cardType="character" value={{ type: 'character', id: 'c1', name: 'Lyra' }} onChange={onChange} />)

        expect(screen.getByRole('combobox', { name: 'Filtrar por carta' })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtro de carta' }))
        expect(onChange).toHaveBeenCalledWith(undefined)
    })

    it('portals the searchable panel out of clipping containers and clamps it inside a narrow viewport', async () => {
        const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
            x: 270, y: 100, left: 270, right: 360, top: 100, bottom: 132, width: 90, height: 32, toJSON: () => ({}),
        })
        vi.stubGlobal('innerWidth', 390)
        try {
            const { container } = render(<div style={{ overflow: 'hidden' }}><CardPicker cardType="character" onChange={vi.fn()} /></div>)
            fireEvent.click(screen.getByTestId('card-picker-trigger'))
            const panel = await screen.findByTestId('card-picker-panel')
            expect(container).not.toContainElement(panel)
            expect(panel).toHaveStyle({ position: 'fixed', left: '94px', width: '288px' })
            expect(screen.getByTestId('card-picker-search')).toHaveFocus()
        } finally {
            bounds.mockRestore()
            vi.unstubAllGlobals()
        }
    })

    it('closes on outside click', async () => {
        render(
            <div>
                <button type="button">outside</button>
                <CardPicker cardType="character" onChange={vi.fn()} />
            </div>,
        )
        fireEvent.click(screen.getByTestId('card-picker-trigger'))
        await screen.findByTestId('card-picker-panel')

        fireEvent.mouseDown(screen.getByText('outside'))

        await waitFor(() => expect(screen.queryByTestId('card-picker-panel')).not.toBeInTheDocument())
    })
})
