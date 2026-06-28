import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotFoundPage } from './NotFoundPage'

const setPage = vi.fn()
const goBack = vi.fn()
let previousPage: string | undefined

vi.mock('@/app/hooks', () => ({
    useNavigation: () => ({ setPage, goBack, previousPage }),
}))

describe('NotFoundPage', () => {
    beforeEach(() => {
        setPage.mockClear()
        goBack.mockClear()
        previousPage = undefined
    })

    it('renders the 404 copy and routes home', () => {
        render(<NotFoundPage />)
        expect(screen.getByRole('heading', { name: /wandered off the map/i })).toBeInTheDocument()
        expect(screen.getByText(/faded into the mist/i)).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /take me home/i }))
        expect(setPage).toHaveBeenCalledWith('landing')
    })

    it('offers a back action only when there is navigation history', () => {
        const { rerender } = render(<NotFoundPage />)
        expect(screen.queryByRole('button', { name: /go back/i })).not.toBeInTheDocument()

        previousPage = 'gallery-characters'
        rerender(<NotFoundPage />)
        fireEvent.click(screen.getByRole('button', { name: /go back/i }))
        expect(goBack).toHaveBeenCalledWith('landing')
    })
})
