import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Globe } from 'lucide-react'
import type { World } from '@/shared'
import { LibraryRail } from './LibraryRail'
import { worldCardProps } from './libraryCards'

// GalleryCard reaches usePlaylist through a deep import that bypasses the barrel.
vi.mock('@/app/hooks/usePlaylist', () => ({
    usePlaylist: () => ({
        currentTrack: null,
        isPlaying: false,
        playNow: vi.fn(),
        enqueue: vi.fn(),
        isQueued: () => false,
    }),
}))

const WORLDS = [
    { id: 'w1', name: 'The Ember Coast', type: 'Region', triggers: [], details: {} },
    { id: 'w2', name: "Vael's End", type: 'Kingdom', triggers: [], details: {} },
] as unknown as World[]

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

describe('LibraryRail', () => {
    it('renders nothing when the collection is empty', () => {
        const { container } = render(
            <LibraryRail
                title="Worlds"
                icon={Globe}
                items={[]}
                cardType="world"
                deleteTitle="Delete world"
                toCard={worldCardProps}
                onEdit={vi.fn()}
                onDelete={vi.fn()}
            />,
        )
        expect(container).toBeEmptyDOMElement()
    })

    it('shows the total in view-all and confirms before deleting', async () => {
        const onDelete = vi.fn().mockResolvedValue(undefined)
        const onViewAll = vi.fn()
        render(
            <LibraryRail
                title="Worlds you've built"
                icon={Globe}
                items={WORLDS}
                total={9}
                cardType="world"
                deleteTitle="Delete world"
                toCard={worldCardProps}
                onEdit={vi.fn()}
                onDelete={onDelete}
                onViewAll={onViewAll}
            />,
        )

        expect(screen.getByText("Worlds you've built")).toBeTruthy()
        fireEvent.click(screen.getByRole('button', { name: 'View all (9)' }))
        expect(onViewAll).toHaveBeenCalled()
    })
})
