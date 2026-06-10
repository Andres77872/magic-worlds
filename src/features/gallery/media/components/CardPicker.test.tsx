import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/api', () => ({
    apiService: {
        getCharacters: vi.fn().mockResolvedValue([]),
        getWorlds: vi.fn().mockResolvedValue([]),
        getAdventureTemplates: vi.fn().mockResolvedValue([]),
    },
    resolveMediaUrl: (url?: string | null) => url ?? undefined,
}))

import { apiService } from '@/infrastructure/api'
import { CardPicker } from './CardPicker'

const CHARACTERS = [
    { id: 'c1', name: 'Lyra', image_url: '/generated-images/lyra.jpeg' },
    { id: 'c2', name: 'Dorn' },
]

describe('CardPicker', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(apiService.getCharacters).mockResolvedValue(CHARACTERS)
        vi.mocked(apiService.getWorlds).mockResolvedValue([{ id: 'w1', name: 'Rivendell' }])
        vi.mocked(apiService.getAdventureTemplates).mockResolvedValue([])
    })

    it('opens on click and merges all three endpoints when scope is "all"', async () => {
        render(<CardPicker cardType="all" onChange={vi.fn()} />)

        fireEvent.click(screen.getByTestId('card-picker-trigger'))

        expect(await screen.findByText('Lyra')).toBeInTheDocument()
        expect(screen.getByText('Rivendell')).toBeInTheDocument()
        expect(apiService.getCharacters).toHaveBeenCalledWith(0, 8, undefined)
        expect(apiService.getWorlds).toHaveBeenCalledWith(0, 8, undefined)
        expect(apiService.getAdventureTemplates).toHaveBeenCalledWith(0, 8, undefined)
    })

    it('scopes the option fetch to the active card type', async () => {
        render(<CardPicker cardType="character" onChange={vi.fn()} />)

        fireEvent.click(screen.getByTestId('card-picker-trigger'))
        await screen.findByText('Lyra')

        expect(apiService.getWorlds).not.toHaveBeenCalled()
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
