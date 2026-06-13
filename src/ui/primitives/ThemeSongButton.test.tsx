import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { AudioPlaylistProvider } from '@/app/providers/AudioPlaylistProvider'
import { PLAYLIST_STORAGE_KEY } from '@/app/providers/playlistReducer'
import { ThemeSongButton } from './ThemeSongButton'

// jsdom doesn't implement media playback; emulate play/pause by flipping `paused`
// and emitting the events the playlist engine listens for.
function stubMedia() {
    const play = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
        Object.defineProperty(this, 'paused', { configurable: true, get: () => false })
        this.dispatchEvent(new Event('play'))
        return Promise.resolve()
    })
    const pause = vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
        Object.defineProperty(this, 'paused', { configurable: true, get: () => true })
        this.dispatchEvent(new Event('pause'))
    })
    return { play, pause }
}

function renderWithPlaylist(ui: React.ReactNode) {
    return render(<AudioPlaylistProvider>{ui}</AudioPlaylistProvider>)
}

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    localStorage.removeItem(PLAYLIST_STORAGE_KEY)
})

describe('ThemeSongButton', () => {
    it('plays through the global playlist and toggles pause on click', async () => {
        const { play, pause } = stubMedia()
        renderWithPlaylist(<ThemeSongButton src="/generated-audio/t.mp3" cardName="Lyra" />)

        const btn = screen.getByRole('button', { name: /play theme song/i })
        expect(btn.getAttribute('aria-pressed')).toBe('false')

        fireEvent.click(btn)
        // The playlist engine fetches the track (falling back to streaming in
        // jsdom) before playing, so the play call lands asynchronously.
        await waitFor(() => expect(play).toHaveBeenCalledTimes(1))
        const playing = await screen.findByRole('button', { name: /pause theme song/i })
        expect(playing.getAttribute('aria-pressed')).toBe('true')

        fireEvent.click(playing)
        expect(pause).toHaveBeenCalledTimes(1)
        expect(screen.getByRole('button', { name: /play theme song/i }).getAttribute('aria-pressed')).toBe('false')
    })

    it('does not bubble clicks to an enclosing clickable parent', () => {
        stubMedia()
        const onParentClick = vi.fn()
        renderWithPlaylist(
            <div onClick={onParentClick}>
                <ThemeSongButton src="/generated-audio/t.mp3" />
            </div>,
        )
        fireEvent.click(screen.getByRole('button', { name: /play theme song/i }))
        expect(onParentClick).not.toHaveBeenCalled()
    })

    it('downloads the theme without bubbling to an enclosing clickable parent', async () => {
        const onParentClick = vi.fn()
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => ({
                ok: true,
                status: 200,
                blob: async () => new Blob(['audio']),
            }) as unknown as Response),
        )
        vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:theme'), revokeObjectURL: vi.fn() })
        let downloadName: string | null = null
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
            this: HTMLAnchorElement,
        ) {
            downloadName = this.getAttribute('download')
        })

        renderWithPlaylist(
            <div onClick={onParentClick}>
                <ThemeSongButton src="https://x/lyra.mp3" cardName="Lyra" />
            </div>,
        )

        fireEvent.click(screen.getByRole('button', { name: 'Download Lyra theme' }))

        await waitFor(() => expect(click).toHaveBeenCalledTimes(1))
        expect(downloadName).toBe('Lyra.mp3')
        expect(onParentClick).not.toHaveBeenCalled()
    })
})
