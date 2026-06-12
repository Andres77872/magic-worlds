import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
                onClick={() => playlist.enqueue(themeTrack({ url: 'https://x/one.mp3', title: 'One', cardName: 'Lyra' }))}
            >
                seed-one
            </button>
            <button onClick={() => playlist.enqueue(themeTrack({ url: 'https://x/two.mp3', title: 'Two' }))}>
                seed-two
            </button>
        </>
    )
}

function renderDock() {
    return render(
        <AudioPlaylistProvider>
            <Seed />
            <PlaylistDock />
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
})
