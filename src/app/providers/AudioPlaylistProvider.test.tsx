import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { claimAudioFocus } from '@/ui/components/audio/audioFocus'
import { clearAudioDataCaches } from '@/ui/components/audio/audioData'
import { usePlaylist } from '../hooks/usePlaylist'
import { AudioPlaylistProvider, PLAYLIST_AUDIO_PREFS_STORAGE_KEY } from './AudioPlaylistProvider'
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
            <span data-testid="loop">{playlist.loopMode}</span>
            <span data-testid="audio-prefs">{`${playlist.volume}|${playlist.muted}`}</span>
            <button onClick={() => playlist.playNow(themeTrack({ url: 'https://x/1.mp3', title: 'One' }))}>play1</button>
            <button onClick={() => playlist.enqueue(themeTrack({ url: 'https://x/2.mp3', title: 'Two' }))}>add2</button>
            <button onClick={() => playlist.toggle()}>toggle</button>
            <button onClick={() => playlist.stop()}>stop</button>
            <button onClick={() => playlist.cycleLoopMode()}>cycle-loop</button>
            <button onClick={() => playlist.setVolume(0.35)}>set-volume-35</button>
            <button onClick={() => playlist.setVolume(0.7)}>set-volume-70</button>
            <button onClick={() => playlist.setVolume(0)}>set-volume-zero</button>
            <button onClick={() => playlist.toggleMute()}>toggle-mute</button>
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
const loop = () => screen.getByTestId('loop').textContent
const audioPrefs = () => screen.getByTestId('audio-prefs').textContent

beforeEach(() => {
    clearAudioDataCaches()
    localStorage.removeItem(PLAYLIST_STORAGE_KEY)
    localStorage.removeItem(PLAYLIST_AUDIO_PREFS_STORAGE_KEY)
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() })
})

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    localStorage.removeItem(PLAYLIST_STORAGE_KEY)
    localStorage.removeItem(PLAYLIST_AUDIO_PREFS_STORAGE_KEY)
})

describe('AudioPlaylistProvider', () => {
    it('defaults to full volume and unmuted', () => {
        renderHarness()
        expect(audioPrefs()).toBe('1|false')
    })

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

    it('applies volume before and after the audio element is created', async () => {
        stubFetchBlob()
        const { play, elements } = stubMedia()
        renderHarness()

        fireEvent.click(screen.getByText('set-volume-35'))
        expect(audioPrefs()).toBe('0.35|false')
        fireEvent.click(screen.getByText('play1'))

        await waitFor(() => expect(play).toHaveBeenCalledTimes(1))
        expect(elements[0].volume).toBeCloseTo(0.35)
        expect(elements[0].muted).toBe(false)

        fireEvent.click(screen.getByText('set-volume-70'))

        await waitFor(() => expect(elements[0].volume).toBeCloseTo(0.7))
        expect(audioPrefs()).toBe('0.7|false')
    })

    it('mutes, unmutes, and restores the last audible volume from zero', async () => {
        stubFetchBlob()
        const { play, elements } = stubMedia()
        renderHarness()

        fireEvent.click(screen.getByText('play1'))
        await waitFor(() => expect(play).toHaveBeenCalledTimes(1))

        fireEvent.click(screen.getByText('set-volume-35'))
        await waitFor(() => expect(elements[0].volume).toBeCloseTo(0.35))

        fireEvent.click(screen.getByText('toggle-mute'))
        await waitFor(() => expect(elements[0].muted).toBe(true))
        expect(audioPrefs()).toBe('0.35|true')

        fireEvent.click(screen.getByText('toggle-mute'))
        await waitFor(() => expect(elements[0].muted).toBe(false))
        expect(elements[0].volume).toBeCloseTo(0.35)
        expect(audioPrefs()).toBe('0.35|false')

        fireEvent.click(screen.getByText('set-volume-zero'))
        await waitFor(() => expect(elements[0].muted).toBe(true))
        expect(elements[0].volume).toBe(0)
        expect(audioPrefs()).toBe('0|true')

        fireEvent.click(screen.getByText('toggle-mute'))
        await waitFor(() => expect(elements[0].muted).toBe(false))
        expect(elements[0].volume).toBeCloseTo(0.35)
        expect(audioPrefs()).toBe('0.35|false')
    })

    it('replays the current track when repeat current track is enabled', async () => {
        stubFetchBlob()
        const { play, elements } = stubMedia()
        renderHarness()

        fireEvent.click(screen.getByText('cycle-loop'))
        expect(loop()).toBe('track')
        fireEvent.click(screen.getByText('play1'))
        await waitFor(() => expect(play).toHaveBeenCalledTimes(1))

        fireEvent(elements[0], new Event('ended'))

        await waitFor(() => expect(play).toHaveBeenCalledTimes(2))
        expect(now()).toBe('https://x/1.mp3|true|1|0')
    })

    it('wraps to the first track when repeat playlist is enabled', async () => {
        stubFetchBlob()
        const { play, elements } = stubMedia()
        renderHarness()

        fireEvent.click(screen.getByText('cycle-loop'))
        fireEvent.click(screen.getByText('cycle-loop'))
        expect(loop()).toBe('queue')
        fireEvent.click(screen.getByText('play1'))
        fireEvent.click(screen.getByText('add2'))
        await waitFor(() => expect(play).toHaveBeenCalledTimes(1))

        fireEvent(elements[0], new Event('ended'))
        await waitFor(() => expect(now()).toBe('https://x/2.mp3|true|2|1'))

        fireEvent(elements[0], new Event('ended'))
        await waitFor(() => expect(now()).toBe('https://x/1.mp3|true|2|0'))
        expect(play).toHaveBeenCalledTimes(3)
    })

    it('persists the queue and restores it paused on a fresh mount', async () => {
        stubFetchBlob()
        const { play } = stubMedia()
        const first = renderHarness()

        fireEvent.click(screen.getByText('play1'))
        fireEvent.click(screen.getByText('add2'))
        fireEvent.click(screen.getByText('cycle-loop'))
        fireEvent.click(screen.getByText('cycle-loop'))
        await waitFor(() => expect(play).toHaveBeenCalledTimes(1))
        await waitFor(() => {
            const stored = JSON.parse(localStorage.getItem(PLAYLIST_STORAGE_KEY) ?? 'null')
            expect(stored?.queue).toHaveLength(2)
            expect(stored?.currentIndex).toBe(0)
            expect(stored?.loopMode).toBe('queue')
        })
        first.unmount()

        renderHarness()
        // Same queue and position, but paused — play state is never persisted.
        expect(now()).toBe('https://x/1.mp3|false|2|0')
        expect(loop()).toBe('queue')
        expect(play).toHaveBeenCalledTimes(1)
    })

    it('persists volume and mute independently from the queue', async () => {
        renderHarness()

        fireEvent.click(screen.getByText('set-volume-35'))
        fireEvent.click(screen.getByText('toggle-mute'))
        await waitFor(() => {
            const stored = JSON.parse(localStorage.getItem(PLAYLIST_AUDIO_PREFS_STORAGE_KEY) ?? 'null')
            expect(stored).toEqual({ volume: 0.35, muted: true })
        })

        cleanup()
        renderHarness()

        expect(audioPrefs()).toBe('0.35|true')
    })

    it('clearAndClose stops playback, empties the queue and the storage', async () => {
        stubFetchBlob()
        const { play, pause } = stubMedia()
        renderHarness()

        fireEvent.click(screen.getByText('play1'))
        fireEvent.click(screen.getByText('cycle-loop'))
        fireEvent.click(screen.getByText('set-volume-35'))
        await waitFor(() => expect(play).toHaveBeenCalledTimes(1))

        fireEvent.click(screen.getByText('clear'))

        expect(now()).toBe('none|false|0|-1')
        expect(loop()).toBe('off')
        expect(audioPrefs()).toBe('0.35|false')
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
