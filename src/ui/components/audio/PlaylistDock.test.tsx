import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { AudioPlaylistProvider } from '@/app/providers/AudioPlaylistProvider'
import { themeTrack } from '@/app/providers/audioPlaylistContext'
import { PLAYLIST_STORAGE_KEY } from '@/app/providers/playlistReducer'
import { usePlaylist } from '@/app/hooks/usePlaylist'
import { clearAudioDataCaches } from './audioData'
import { PlaylistDock } from './PlaylistDock'

function stubMedia() {
    const elements: HTMLMediaElement[] = []
    const play = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(function (
        this: HTMLMediaElement,
    ) {
        if (!elements.includes(this)) elements.push(this)
        Object.defineProperty(this, 'paused', { configurable: true, get: () => false })
        this.dispatchEvent(new Event('play'))
        return Promise.resolve()
    })
    const pause = vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(function (
        this: HTMLMediaElement,
    ) {
        Object.defineProperty(this, 'paused', { configurable: true, get: () => true })
        this.dispatchEvent(new Event('pause'))
    })
    return { play, pause, elements }
}

/** Seeds the queue the way card surfaces do. */
function Seed() {
    const playlist = usePlaylist()
    return (
        <>
            <button
                onClick={() =>
                    playlist.enqueue(
                        themeTrack({
                            url: 'https://x/one.mp3',
                            title: 'One',
                            cardName: 'Lyra',
                            cardType: 'character',
                            cardId: 'char-1',
                            artworkUrl: '/generated-images/lyra.jpeg',
                        }),
                    )
                }
            >
                seed-one
            </button>
            <button onClick={() => playlist.enqueue(themeTrack({ url: 'https://x/two.mp3', title: 'Two' }))}>
                seed-two
            </button>
        </>
    )
}

function renderDock(onOpenCard?: ComponentProps<typeof PlaylistDock>['onOpenCard']) {
    return render(
        <AudioPlaylistProvider>
            <Seed />
            <PlaylistDock onOpenCard={onOpenCard} />
        </AudioPlaylistProvider>,
    )
}

beforeEach(() => {
    clearAudioDataCaches()
    localStorage.removeItem(PLAYLIST_STORAGE_KEY)
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({ ok: true, status: 200, blob: async () => new Blob(['audio']) }) as unknown as Response),
    )
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() })
})

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    localStorage.removeItem(PLAYLIST_STORAGE_KEY)
})

describe('PlaylistDock', () => {
    it('renders nothing while the queue is empty', () => {
        stubMedia()
        renderDock()
        expect(screen.queryByRole('region', { name: 'Now playing' })).toBeNull()
    })

    it('appears with the current track once something is queued, without autoplaying', () => {
        const { play } = stubMedia()
        renderDock()

        fireEvent.click(screen.getByText('seed-one'))

        const dock = screen.getByRole('region', { name: 'Now playing' })
        expect(dock).toBeInTheDocument()
        expect(screen.getByText('One')).toBeInTheDocument()
        expect(screen.getByText('Lyra')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Play One' })).toBeInTheDocument()
        expect(play).not.toHaveBeenCalled()
    })

    it('opens the queue panel, jumps to a row, and removes rows', async () => {
        const { play } = stubMedia()
        renderDock()
        fireEvent.click(screen.getByText('seed-one'))
        fireEvent.click(screen.getByText('seed-two'))

        fireEvent.click(screen.getByRole('button', { name: 'Show playlist' }))
        expect(screen.getByText('2 tracks')).toBeInTheDocument()

        // Jump to the second row — it becomes the playing current track.
        fireEvent.click(screen.getByRole('button', { name: 'Play track 2: Two' }))
        await waitFor(() => expect(play).toHaveBeenCalledTimes(1))
        expect(screen.getByRole('button', { name: 'Pause Two' })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Remove One from playlist' }))
        expect(screen.getByText('1 track')).toBeInTheDocument()
    })

    it('stop keeps the queue while close clears the dock and the storage', async () => {
        const { play } = stubMedia()
        renderDock()
        fireEvent.click(screen.getByText('seed-one'))
        fireEvent.click(screen.getByRole('button', { name: 'Play One' }))
        await waitFor(() => expect(play).toHaveBeenCalledTimes(1))

        fireEvent.click(screen.getByRole('button', { name: 'Show playlist' }))
        fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
        expect(screen.getByRole('region', { name: 'Now playing' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Play One' })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Close player' }))
        expect(screen.queryByRole('region', { name: 'Now playing' })).toBeNull()
        await waitFor(() => expect(localStorage.getItem(PLAYLIST_STORAGE_KEY)).toBeNull())
    })

    it('disables Next on the last track', () => {
        stubMedia()
        renderDock()
        fireEvent.click(screen.getByText('seed-one'))
        expect(screen.getByRole('button', { name: 'Next track' })).toBeDisabled()

        fireEvent.click(screen.getByText('seed-two'))
        expect(screen.getByRole('button', { name: 'Next track' })).not.toBeDisabled()
    })

    it('opens the current card from the thumbnail and card name', () => {
        const onOpenCard = vi.fn()
        stubMedia()
        renderDock(onOpenCard)
        fireEvent.click(screen.getByText('seed-one'))

        fireEvent.click(screen.getByRole('button', { name: 'Open card Lyra' }))
        expect(onOpenCard).toHaveBeenLastCalledWith({ type: 'character', id: 'char-1', fallbackName: 'Lyra' })

        fireEvent.click(screen.getByRole('button', { name: 'Lyra' }))
        expect(onOpenCard).toHaveBeenCalledTimes(2)
    })

    it('does not expose card-opening controls when metadata is missing', () => {
        const onOpenCard = vi.fn()
        stubMedia()
        renderDock(onOpenCard)
        fireEvent.click(screen.getByText('seed-two'))

        expect(screen.queryByRole('button', { name: /Open card/i })).toBeNull()
        expect(screen.queryByRole('button', { name: 'Two' })).toBeNull()
    })

    it('downloads the current track from the dock', async () => {
        stubMedia()
        let downloadName: string | null = null
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
            this: HTMLAnchorElement,
        ) {
            downloadName = this.getAttribute('download')
        })
        renderDock()
        fireEvent.click(screen.getByText('seed-one'))

        fireEvent.click(screen.getByRole('button', { name: 'Download One' }))

        await waitFor(() => expect(click).toHaveBeenCalledTimes(1))
        expect(downloadName).toBe('One.mp3')
    })

    it('drags the player position and persists it', () => {
        stubMedia()
        renderDock()
        fireEvent.click(screen.getByText('seed-one'))

        const dock = screen.getByRole('region', { name: 'Now playing' })
        vi.spyOn(dock, 'getBoundingClientRect').mockReturnValue({
            x: 500,
            y: 400,
            left: 500,
            top: 400,
            right: 916,
            bottom: 512,
            width: 416,
            height: 112,
            toJSON: () => ({}),
        } as DOMRect)

        const handle = screen.getByRole('button', { name: 'Drag player' })
        fireEvent.pointerDown(handle, { pointerId: 7, button: 0, clientX: 510, clientY: 410 })
        fireEvent.pointerMove(handle, { pointerId: 7, clientX: 560, clientY: 450 })
        fireEvent.pointerUp(handle, { pointerId: 7, clientX: 560, clientY: 450 })

        expect(dock.parentElement).toHaveStyle({ left: '550px', top: '440px' })
        expect(JSON.parse(localStorage.getItem('magic_worlds:playlist_dock_position:v1') ?? 'null')).toEqual({
            x: 550,
            y: 440,
        })
    })
})
