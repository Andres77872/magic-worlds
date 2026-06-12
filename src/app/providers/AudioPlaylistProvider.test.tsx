import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { claimAudioFocus } from '@/ui/components/audio/audioFocus'
import { clearAudioDataCaches } from '@/ui/components/audio/audioData'
import { usePlaylist } from '../hooks/usePlaylist'
import { AudioPlaylistProvider } from './AudioPlaylistProvider'
import { themeTrack } from './audioPlaylistContext'
import { PLAYLIST_STORAGE_KEY } from './playlistReducer'

/** Same media emulation as the player component tests (jsdom has no playback). */
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

function stubFetchBlob() {
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({ ok: true, status: 200, blob: async () => new Blob(['audio']) }) as unknown as Response),
    )
}

/** Exposes playlist state as text and actions as buttons. */
function Harness() {
    const playlist = usePlaylist()
    return (
        <div>
            <span data-testid="now">
                {`${playlist.currentTrack?.id ?? 'none'}|${playlist.isPlaying}|${playlist.queue.length}|${playlist.currentIndex}`}
            </span>
            <button onClick={() => playlist.playNow(themeTrack({ url: 'https://x/1.mp3', title: 'One' }))}>play1</button>
            <button onClick={() => playlist.enqueue(themeTrack({ url: 'https://x/2.mp3', title: 'Two' }))}>add2</button>
            <button onClick={() => playlist.toggle()}>toggle</button>
            <button onClick={() => playlist.stop()}>stop</button>
            <button onClick={() => playlist.clearAndClose()}>clear</button>
        </div>
    )
}

function renderHarness() {
    return render(
        <AudioPlaylistProvider>
            <Harness />
        </AudioPlaylistProvider>,
    )
}

const now = () => screen.getByTestId('now').textContent

beforeEach(() => {
    clearAudioDataCaches()
    localStorage.removeItem(PLAYLIST_STORAGE_KEY)
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() })
})

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    localStorage.removeItem(PLAYLIST_STORAGE_KEY)
})

describe('AudioPlaylistProvider', () => {
    it('auto-advances to the next queued track when the current one ends', async () => {
        stubFetchBlob()
        const { play, elements } = stubMedia()
        renderHarness()

        fireEvent.click(screen.getByText('play1'))
        fireEvent.click(screen.getByText('add2'))
        await waitFor(() => expect(play).toHaveBeenCalledTimes(1))
        expect(now()).toBe('https://x/1.mp3|true|2|0')

        fireEvent(elements[0], new Event('ended'))

        await waitFor(() => expect(play).toHaveBeenCalledTimes(2))
        expect(now()).toBe('https://x/2.mp3|true|2|1')
        // One element reused across tracks (keeps media engagement).
        expect(elements).toHaveLength(1)
    })

    it('stops at the end of the queue instead of wrapping', async () => {
        stubFetchBlob()
        const { play, elements } = stubMedia()
        renderHarness()

        fireEvent.click(screen.getByText('play1'))
        await waitFor(() => expect(play).toHaveBeenCalledTimes(1))

        fireEvent(elements[0], new Event('ended'))

        await waitFor(() => expect(now()).toBe('https://x/1.mp3|false|1|0'))
        expect(play).toHaveBeenCalledTimes(1)
    })

    it('persists the queue and restores it paused on a fresh mount', async () => {
        stubFetchBlob()
        const { play } = stubMedia()
        const first = renderHarness()

        fireEvent.click(screen.getByText('play1'))
        fireEvent.click(screen.getByText('add2'))
        await waitFor(() => expect(play).toHaveBeenCalledTimes(1))
        await waitFor(() => {
            const stored = JSON.parse(localStorage.getItem(PLAYLIST_STORAGE_KEY) ?? 'null')
            expect(stored?.queue).toHaveLength(2)
            expect(stored?.currentIndex).toBe(0)
        })
        first.unmount()

        renderHarness()
        // Same queue and position, but paused — play state is never persisted.
        expect(now()).toBe('https://x/1.mp3|false|2|0')
        expect(play).toHaveBeenCalledTimes(1)
    })

    it('clearAndClose stops playback, empties the queue and the storage', async () => {
        stubFetchBlob()
        const { play, pause } = stubMedia()
        renderHarness()

        fireEvent.click(screen.getByText('play1'))
        await waitFor(() => expect(play).toHaveBeenCalledTimes(1))

        fireEvent.click(screen.getByText('clear'))

        expect(now()).toBe('none|false|0|-1')
        expect(pause).toHaveBeenCalled()
        await waitFor(() => expect(localStorage.getItem(PLAYLIST_STORAGE_KEY)).toBeNull())
    })

    it('pauses (and syncs state) when another audio surface claims focus, e.g. TTS', async () => {
        stubFetchBlob()
        stubMedia()
        renderHarness()

        fireEvent.click(screen.getByText('play1'))
        await waitFor(() => expect(now()).toBe('https://x/1.mp3|true|1|0'))

        const foreign = new Audio()
        act(() => {
            claimAudioFocus(foreign)
        })

        await waitFor(() => expect(now()).toBe('https://x/1.mp3|false|1|0'))
    })

    it('skips a failing track to the next one', async () => {
        stubFetchBlob()
        const { play, elements } = stubMedia()
        renderHarness()

        fireEvent.click(screen.getByText('play1'))
        fireEvent.click(screen.getByText('add2'))
        await waitFor(() => expect(play).toHaveBeenCalledTimes(1))

        fireEvent(elements[0], new Event('error'))

        await waitFor(() => expect(now()).toBe('https://x/2.mp3|true|2|1'))
        expect(play).toHaveBeenCalledTimes(2)
    })
})
