import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AudioWavePlayer } from './AudioWavePlayer'
import { clearAudioDataCaches, PEAK_BUCKETS } from './audioData'

/**
 * jsdom has no media playback: emulate play/pause on the prototype (flipping
 * `paused` + dispatching events, like ThemeSongButton.test.tsx) and record the
 * created elements so tests can dispatch timeupdate/loadedmetadata on them.
 */
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

/** Give a media element a controllable duration/currentTime, then announce metadata. */
function loadMetadata(el: HTMLMediaElement, duration: number) {
    let time = 0
    Object.defineProperty(el, 'duration', { configurable: true, get: () => duration })
    Object.defineProperty(el, 'currentTime', {
        configurable: true,
        get: () => time,
        set: (value: number) => {
            time = value
        },
    })
    el.dispatchEvent(new Event('loadedmetadata'))
}

function stubFetchBlob() {
    const fetchMock = vi.fn(async () => ({
        ok: true,
        status: 200,
        blob: async () => new Blob(['audio']),
    }) as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}

const createObjectURL = vi.fn(() => 'blob:mock-audio')
const revokeObjectURL = vi.fn()

beforeEach(() => {
    clearAudioDataCaches()
    createObjectURL.mockClear()
    revokeObjectURL.mockClear()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
})

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

describe('AudioWavePlayer', () => {
    it('does no audio work on mount and renders the dormant pseudo waveform', () => {
        const fetchMock = stubFetchBlob()
        render(<AudioWavePlayer src="https://x/idle.mp3" title="Ember Hymn" durationMs={95_000} peakSeed="seed-1" />)

        expect(fetchMock).not.toHaveBeenCalled()
        const strip = screen.getByRole('slider', { name: 'Seek within Ember Hymn' })
        expect(strip.querySelectorAll('span')).toHaveLength(PEAK_BUCKETS)
        // Fallback duration renders before any metadata exists.
        expect(screen.getByText('1:35')).toBeInTheDocument()
    })

    it('first toggle fetches the blob once and plays via an object URL (pseudo bars without Web Audio)', async () => {
        const fetchMock = stubFetchBlob()
        const { play, elements } = stubMedia()
        render(<AudioWavePlayer src="https://x/play.mp3" title="Ember Hymn" />)

        fireEvent.click(screen.getByRole('button', { name: 'Play Ember Hymn' }))

        await waitFor(() => expect(play).toHaveBeenCalledTimes(1))
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(createObjectURL).toHaveBeenCalledTimes(1)
        expect((elements[0] as HTMLAudioElement).src).toContain('blob:mock-audio')
        expect(screen.getByRole('button', { name: 'Pause Ember Hymn' })).toBeInTheDocument()
        // No AudioContext in jsdom → decode fails → the strip keeps its 48 pseudo bars.
        const strip = screen.getByRole('slider', { name: 'Seek within Ember Hymn' })
        expect(strip.querySelectorAll('span')).toHaveLength(PEAK_BUCKETS)
    })

    it('reflects timeupdate in the readout and aria values', async () => {
        stubFetchBlob()
        const { play, elements } = stubMedia()
        render(<AudioWavePlayer src="https://x/progress.mp3" title="Ember Hymn" />)
        fireEvent.click(screen.getByRole('button', { name: 'Play Ember Hymn' }))
        await waitFor(() => expect(play).toHaveBeenCalled())

        const audio = elements[0]
        loadMetadata(audio, 95)
        audio.currentTime = 42
        fireEvent(audio, new Event('timeupdate'))

        const strip = await screen.findByRole('slider', { name: 'Seek within Ember Hymn' })
        await waitFor(() => expect(strip.getAttribute('aria-valuenow')).toBe('42'))
        expect(strip.getAttribute('aria-valuemax')).toBe('95')
        expect(strip.getAttribute('aria-valuetext')).toBe('0:42 of 1:35')
        expect(screen.getByText('0:42')).toBeInTheDocument()
    })

    it('exclusive playback: starting one player pauses the other', async () => {
        stubFetchBlob()
        const { play, pause, elements } = stubMedia()
        render(
            <>
                <AudioWavePlayer src="https://x/a.mp3" title="Track A" />
                <AudioWavePlayer src="https://x/b.mp3" title="Track B" />
            </>,
        )

        fireEvent.click(screen.getByRole('button', { name: 'Play Track A' }))
        await waitFor(() => expect(play).toHaveBeenCalledTimes(1))

        fireEvent.click(screen.getByRole('button', { name: 'Play Track B' }))
        await waitFor(() => expect(play).toHaveBeenCalledTimes(2))

        // Track A's element got paused by the focus registry.
        expect(pause).toHaveBeenCalled()
        expect(elements[0].paused).toBe(true)
        await waitFor(() => expect(screen.getByRole('button', { name: 'Play Track A' })).toBeInTheDocument())
        expect(screen.getByRole('button', { name: 'Pause Track B' })).toBeInTheDocument()
    })

    it('ended resets to the play state at 0:00', async () => {
        stubFetchBlob()
        const { play, elements } = stubMedia()
        render(<AudioWavePlayer src="https://x/ended.mp3" title="Ember Hymn" />)
        fireEvent.click(screen.getByRole('button', { name: 'Play Ember Hymn' }))
        await waitFor(() => expect(play).toHaveBeenCalled())

        loadMetadata(elements[0], 95)
        fireEvent(elements[0], new Event('ended'))

        await waitFor(() => expect(screen.getByRole('button', { name: 'Play Ember Hymn' })).toBeInTheDocument())
        const strip = screen.getByRole('slider', { name: 'Seek within Ember Hymn' })
        expect(strip.getAttribute('aria-valuenow')).toBe('0')
    })

    it('pointer-down at the strip midpoint seeks to half the duration', async () => {
        stubFetchBlob()
        const { play, elements } = stubMedia()
        render(<AudioWavePlayer src="https://x/seek.mp3" title="Ember Hymn" />)
        fireEvent.click(screen.getByRole('button', { name: 'Play Ember Hymn' }))
        await waitFor(() => expect(play).toHaveBeenCalled())
        loadMetadata(elements[0], 100)

        const strip = screen.getByRole('slider', { name: 'Seek within Ember Hymn' })
        vi.spyOn(strip, 'getBoundingClientRect').mockReturnValue({
            left: 0,
            width: 200,
            top: 0,
            right: 200,
            bottom: 9,
            height: 9,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        } as DOMRect)

        fireEvent.pointerDown(strip, { clientX: 100, pointerId: 1 })

        expect(elements[0].currentTime).toBeCloseTo(50)
    })

    it('seeking while idle starts playback from that position', async () => {
        stubFetchBlob()
        const { play, elements } = stubMedia()
        render(<AudioWavePlayer src="https://x/idle-seek.mp3" title="Ember Hymn" />)

        const strip = screen.getByRole('slider', { name: 'Seek within Ember Hymn' })
        vi.spyOn(strip, 'getBoundingClientRect').mockReturnValue({
            left: 0,
            width: 100,
            top: 0,
            right: 100,
            bottom: 9,
            height: 9,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        } as DOMRect)
        fireEvent.pointerDown(strip, { clientX: 25, pointerId: 1 })

        await waitFor(() => expect(play).toHaveBeenCalledTimes(1))
        // The queued seek applies once metadata announces the duration.
        loadMetadata(elements[0], 80)
        expect(elements[0].currentTime).toBeCloseTo(20)
    })

    it('ArrowRight nudges playback forward five seconds', async () => {
        stubFetchBlob()
        const { play, elements } = stubMedia()
        render(<AudioWavePlayer src="https://x/keys.mp3" title="Ember Hymn" />)
        fireEvent.click(screen.getByRole('button', { name: 'Play Ember Hymn' }))
        await waitFor(() => expect(play).toHaveBeenCalled())
        const audio = elements[0]
        loadMetadata(audio, 100)
        audio.currentTime = 40
        fireEvent(audio, new Event('timeupdate'))

        const strip = screen.getByRole('slider', { name: 'Seek within Ember Hymn' })
        await waitFor(() => expect(strip.getAttribute('aria-valuenow')).toBe('40'))
        fireEvent.keyDown(strip, { key: 'ArrowRight' })

        expect(audio.currentTime).toBeCloseTo(45)
    })

    it('unmount pauses playback and revokes the object URL', async () => {
        stubFetchBlob()
        const { play, pause } = stubMedia()
        const { unmount } = render(<AudioWavePlayer src="https://x/unmount.mp3" title="Ember Hymn" />)
        fireEvent.click(screen.getByRole('button', { name: 'Play Ember Hymn' }))
        await waitFor(() => expect(play).toHaveBeenCalled())

        unmount()

        expect(pause).toHaveBeenCalled()
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-audio')
    })

    it('falls back to streaming the source URL when the blob fetch fails', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 }) as unknown as Response))
        const { play, elements } = stubMedia()
        render(<AudioWavePlayer src="https://x/stream-fallback.mp3" title="Ember Hymn" />)

        fireEvent.click(screen.getByRole('button', { name: 'Play Ember Hymn' }))

        await waitFor(() => expect(play).toHaveBeenCalledTimes(1))
        expect(createObjectURL).not.toHaveBeenCalled()
        expect((elements[0] as HTMLAudioElement).src).toBe('https://x/stream-fallback.mp3')
    })
})
