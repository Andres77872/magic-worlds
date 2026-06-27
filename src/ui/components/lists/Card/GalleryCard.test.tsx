import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AudioPlaylistProvider } from '@/app/providers/AudioPlaylistProvider'
import { PLAYLIST_STORAGE_KEY } from '@/app/providers/playlistReducer'
import { apiService } from '@/infrastructure/api'
import { clearAudioDataCaches } from '@/ui/components/audio'
import { GalleryCard } from './GalleryCard'

function renderWithPlaylist(ui: React.ReactNode) {
    return render(<AudioPlaylistProvider>{ui}</AudioPlaylistProvider>)
}

beforeEach(() => {
    clearAudioDataCaches()
    localStorage.removeItem(PLAYLIST_STORAGE_KEY)
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
            ok: true,
            status: 200,
            blob: async () => new Blob(['audio']),
        }) as unknown as Response),
    )
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:theme'), revokeObjectURL: vi.fn() })
})

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    localStorage.removeItem(PLAYLIST_STORAGE_KEY)
})

describe('GalleryCard', () => {
    it('does not trigger the card action when a footer action is clicked', () => {
        const onCardClick = vi.fn()
        const onFooterClick = vi.fn()
        renderWithPlaylist(
            <GalleryCard
                title="Lyra Dawnwhisper"
                onClick={onCardClick}
                footer={<button type="button" onClick={onFooterClick}>Chat</button>}
            />,
        )

        fireEvent.click(screen.getByRole('button', { name: 'Chat' }))

        expect(onFooterClick).toHaveBeenCalledTimes(1)
        expect(onCardClick).not.toHaveBeenCalled()
    })

    it('downloads a theme from the context menu', async () => {
        let downloadName: string | null = null
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
            this: HTMLAnchorElement,
        ) {
            downloadName = this.getAttribute('download')
        })
        renderWithPlaylist(<GalleryCard title="Lyra Dawnwhisper" themeSongUrl="https://x/lyra.mp3" />)

        fireEvent.contextMenu(screen.getByTestId('gallery-card'), { clientX: 24, clientY: 24 })
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Download theme' }))

        await waitFor(() => expect(click).toHaveBeenCalledTimes(1))
        expect(downloadName).toBe('Lyra-Dawnwhisper.mp3')
    })

    it('renders the mono eyebrow and one-line description', () => {
        renderWithPlaylist(
            <GalleryCard
                title="Lyra"
                eyebrow="The Ember Coast"
                description="A card-sharp innkeeper who knows more than she lets on."
            />,
        )
        expect(screen.getByText('The Ember Coast')).toBeInTheDocument()
        expect(screen.getByText('A card-sharp innkeeper who knows more than she lets on.')).toBeInTheDocument()
    })

    it.each(['compact', 'default'] as const)(
        'prefers the description over trigger pills (%s size)',
        (size) => {
            renderWithPlaylist(
                <GalleryCard
                    title="Theron Mistwood"
                    size={size}
                    description="An old wizard with too many specializations."
                    tags={['Alignment Neutral Good', 'Specialization Evocation', 'Preferred See Misty Step']}
                />,
            )
            expect(screen.getByText('An old wizard with too many specializations.')).toBeInTheDocument()
            // No trigger phrases cluttering the card when a description is present.
            expect(screen.queryByText('Specialization Evocation')).not.toBeInTheDocument()
        },
    )

    it('falls back to trigger pills when a card has no description', () => {
        renderWithPlaylist(<GalleryCard title="Lyra" tags={['bard', 'moonlight']} />)
        expect(screen.getByText('bard')).toBeInTheDocument()
        expect(screen.getByText('moonlight')).toBeInTheDocument()
    })

    it('renders a version chip when versionNumber > 0 (and not at 0)', () => {
        const { rerender } = renderWithPlaylist(<GalleryCard title="Lyra" versionNumber={3} />)
        expect(screen.getByText('v3')).toBeInTheDocument()

        rerender(
            <AudioPlaylistProvider>
                <GalleryCard title="Lyra" versionNumber={0} />
            </AudioPlaylistProvider>,
        )
        expect(screen.queryByText('v0')).not.toBeInTheDocument()
    })

    it('renders a Draft chip when the card has unpublished edits', () => {
        const { rerender } = renderWithPlaylist(<GalleryCard title="Lyra" hasDraft />)
        expect(screen.getByText('Draft')).toBeInTheDocument()

        rerender(
            <AudioPlaylistProvider>
                <GalleryCard title="Lyra" hasDraft={false} />
            </AudioPlaylistProvider>,
        )
        expect(screen.queryByText('Draft')).not.toBeInTheDocument()
    })

    it('lazily fetches and shows the usage line once the card is in view', async () => {
        vi.spyOn(apiService, 'getCardUsage').mockResolvedValue({ sessions: 5, stories: 2 })
        // Real observers fire asynchronously; mimic that (a synchronous fire would trip
        // observers that disconnect via closure, e.g. Portrait's lazy loader).
        vi.stubGlobal(
            'IntersectionObserver',
            class {
                cb: (entries: { isIntersecting: boolean }[], obs: { disconnect(): void }) => void
                constructor(cb: (entries: { isIntersecting: boolean }[], obs: { disconnect(): void }) => void) {
                    this.cb = cb
                }
                observe() {
                    queueMicrotask(() => this.cb([{ isIntersecting: true }], this))
                }
                disconnect() {}
            },
        )
        renderWithPlaylist(
            <GalleryCard title="Lyra" usageEnabled usageCardType="character" cardId="gc-usage-1" />,
        )
        expect(await screen.findByText('Used in 5 sessions · 2 stories')).toBeInTheDocument()
    })

    it('does not fetch usage when usageEnabled is off', () => {
        const spy = vi.spyOn(apiService, 'getCardUsage')
        renderWithPlaylist(<GalleryCard title="Lyra" usageCardType="character" cardId="gc-usage-2" />)
        expect(spy).not.toHaveBeenCalled()
    })

    it('suppresses the action bubble on a static card even when options exist', () => {
        const options = [
            { type: 'edit' as const, label: 'Edit', onClick: vi.fn() },
            { type: 'delete' as const, label: 'Delete', onClick: vi.fn() },
        ]
        const { rerender } = renderWithPlaylist(
            <GalleryCard title="Lyra" onClick={vi.fn()} staticCard options={options} />,
        )
        expect(screen.queryByTestId('card-options-button')).not.toBeInTheDocument()
        fireEvent.contextMenu(screen.getByTestId('gallery-card'), { clientX: 24, clientY: 24 })
        expect(screen.queryByTestId('card-context-menu')).not.toBeInTheDocument()

        rerender(
            <AudioPlaylistProvider>
                <GalleryCard title="Lyra" onClick={vi.fn()} options={options} />
            </AudioPlaylistProvider>,
        )
        expect(screen.getByTestId('card-options-button')).toBeInTheDocument()
    })

    describe('row variant', () => {
        it('shows the description and tags together (unlike the tile, which hides tags)', () => {
            renderWithPlaylist(
                <GalleryCard
                    title="Lyra"
                    view="row"
                    description="A card-sharp innkeeper who knows more than she lets on."
                    tags={['bard', 'moonlight']}
                    versionNumber={3}
                    hasDraft
                />,
            )
            expect(screen.getByText('A card-sharp innkeeper who knows more than she lets on.')).toBeInTheDocument()
            expect(screen.getByText('bard')).toBeInTheDocument()
            expect(screen.getByText('moonlight')).toBeInTheDocument()
            expect(screen.getByText('v3')).toBeInTheDocument()
            expect(screen.getByText('Draft')).toBeInTheDocument()
        })

        it('keeps the overflow menu and footer action working without firing the card click', () => {
            const onCardClick = vi.fn()
            const onFooterClick = vi.fn()
            renderWithPlaylist(
                <GalleryCard
                    title="Lyra"
                    view="row"
                    onClick={onCardClick}
                    options={[
                        { type: 'edit', label: 'Edit', onClick: vi.fn() },
                        { type: 'delete', label: 'Delete', onClick: vi.fn() },
                    ]}
                    footer={<button type="button" onClick={onFooterClick}>Chat</button>}
                />,
            )
            expect(screen.getByTestId('card-options-button')).toBeInTheDocument()

            fireEvent.click(screen.getByRole('button', { name: 'Chat' }))
            expect(onFooterClick).toHaveBeenCalledTimes(1)
            expect(onCardClick).not.toHaveBeenCalled()
        })
    })
})
