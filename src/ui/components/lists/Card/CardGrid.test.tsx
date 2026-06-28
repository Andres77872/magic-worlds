import type { ReactNode } from 'react'
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

describe('CardGrid loading skeletons', () => {
    const renderGrid = (props: {
        renderSkeleton?: () => ReactNode
        skeletonCount?: number
        layout?: 'grid' | 'rail' | 'list'
    } = {}) =>
        render(
            <CardGrid<string>
                items={[]}
                loading
                renderCard={(name) => <div>{name}</div>}
                {...props}
            />,
        )

    it('renders a matched skeleton grid (not the spinner) when renderSkeleton is provided', () => {
        renderGrid({ renderSkeleton: () => <div data-testid="sk" /> })

        expect(screen.getAllByTestId('sk')).toHaveLength(8)
        expect(screen.queryByText('Loading items...')).toBeNull()
    })

    it('honours a custom skeletonCount', () => {
        renderGrid({ renderSkeleton: () => <div data-testid="sk" />, skeletonCount: 3 })

        expect(screen.getAllByTestId('sk')).toHaveLength(3)
    })

    it('falls back to the centered spinner when no renderSkeleton is given', () => {
        renderGrid()

        expect(screen.getByText('Loading items...')).toBeInTheDocument()
    })

    it('keeps the spinner for rail layout even with a renderSkeleton', () => {
        renderGrid({ layout: 'rail', renderSkeleton: () => <div data-testid="sk" /> })

        expect(screen.queryByTestId('sk')).toBeNull()
        expect(screen.getByText('Loading items...')).toBeInTheDocument()
    })

    it('renders a matched skeleton list (not the spinner) for list layout', () => {
        renderGrid({ layout: 'list', renderSkeleton: () => <div data-testid="sk" /> })

        expect(screen.getAllByTestId('sk')).toHaveLength(8)
        expect(screen.queryByText('Loading items...')).toBeNull()
    })
})

describe('CardGrid list layout', () => {
    it('renders rows and the infinite-scroll trigger like the grid', () => {
        render(
            <CardGrid<string>
                items={['Lyra', 'Theron']}
                layout="list"
                hasMore
                onLoadMore={() => {}}
                renderCard={(name) => <div>{name}</div>}
            />,
        )

        expect(screen.getByText('Lyra')).toBeInTheDocument()
        expect(screen.getByText('Theron')).toBeInTheDocument()
        expect(screen.getByTestId('load-more-trigger')).toBeInTheDocument()
    })
})
