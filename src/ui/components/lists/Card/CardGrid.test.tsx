import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { CardGrid } from './CardGrid'

let scrollWidth = 320
let clientWidth = 320

function renderRail({ fadeEdges = true }: { fadeEdges?: boolean } = {}) {
    return render(
        <CardGrid
            items={['Lyra', 'Theron', 'Elara']}
            layout="rail"
            railWidth="compact"
            fadeEdges={fadeEdges}
            renderCard={(name) => (
                <div className="h-40 rounded-xl bg-ink-700 p-4 text-parchment-50">
                    {name}
                </div>
            )}
        />,
    )
}

beforeEach(() => {
    scrollWidth = 320
    clientWidth = 320
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
        callback(0)
        return 1
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(() => scrollWidth)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => clientWidth)
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('CardGrid rail fade', () => {
    it('does not fade a rail when every card fits', async () => {
        renderRail()

        await waitFor(() => {
            expect(screen.getByTestId('card-grid-list')).not.toHaveClass('rail-fade-right')
        })
    })

    it('fades the rail content when cards overflow horizontally', async () => {
        scrollWidth = 640
        clientWidth = 320

        renderRail()

        await waitFor(() => {
            expect(screen.getByTestId('card-grid-list')).toHaveClass('rail-fade-right')
        })
    })

    it('does not fade overflowing rails when fadeEdges is disabled', async () => {
        scrollWidth = 640
        clientWidth = 320

        renderRail({ fadeEdges: false })

        await waitFor(() => {
            expect(screen.getByTestId('card-grid-list')).not.toHaveClass('rail-fade-right')
        })
    })
})
