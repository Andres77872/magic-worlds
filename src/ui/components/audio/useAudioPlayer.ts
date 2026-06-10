/**
 * useAudioPlayer — playback state for one audio track, built for waveform
 * players. Lazily creates its HTMLAudioElement on the first toggle: the track
 * is fetched as a blob (shared cache — the same bytes feed the waveform decode
 * and the download action) and played from an object URL; if the blob fetch
 * fails it falls back to streaming the remote URL directly (waveform stays on
 * pseudo-peaks). Progress updates ride the element's ~4 Hz `timeupdate`.
 *
 * Playback is exclusive app-wide via a module-level audio-focus registry:
 * starting any registered player pauses the previous one.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { getAudioBlob, getAudioPeaks } from './audioData'

/** The one currently-audible element; claiming focus pauses the previous. */
let activeAudio: HTMLAudioElement | null = null

export function claimAudioFocus(audio: HTMLAudioElement): void {
    if (activeAudio && activeAudio !== audio) activeAudio.pause()
    activeAudio = audio
}

function releaseAudioFocus(audio: HTMLAudioElement): void {
    if (activeAudio === audio) activeAudio = null
}

export interface AudioPlayer {
    isPlaying: boolean
    /** True from first toggle until the element is ready (blob fetch window). */
    isLoading: boolean
    error: string | null
    /** Seconds, `timeupdate`-driven. */
    currentTime: number
    /** Seconds from metadata, else the caller-supplied fallback, else null. */
    duration: number | null
    /** Real decoded peaks once available; null → caller renders pseudo-peaks. */
    peaks: number[] | null
    toggle: () => void
    /** Seek to a 0..1 position; while idle this starts playback from there. */
    seekRatio: (ratio: number) => void
}

export function useAudioPlayer(
    url: string,
    opts: { fallbackDurationMs?: number | null } = {},
): AudioPlayer {
    const [isPlaying, setIsPlaying] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [currentTime, setCurrentTime] = useState(0)
    const [metaDuration, setMetaDuration] = useState<number | null>(null)
    const [peaks, setPeaks] = useState<number[] | null>(null)

    const audioRef = useRef<HTMLAudioElement | null>(null)
    const objectUrlRef = useRef<string | null>(null)
    // Stale-async guard: bumped on url change/unmount; only the live sequence
    // may commit state or adopt a fetched element (TurnNarration pattern).
    const seqRef = useRef(0)
    const pendingSeekRef = useRef<number | null>(null)

    // Reset playback when the track changes / on unmount.
    useEffect(() => {
        seqRef.current += 1
        return () => {
            seqRef.current += 1
            const audio = audioRef.current
            if (audio) {
                audio.pause()
                releaseAudioFocus(audio)
            }
            audioRef.current = null
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current)
                objectUrlRef.current = null
            }
        }
    }, [url])

    const attach = useCallback((audio: HTMLAudioElement) => {
        audio.addEventListener('play', () => {
            claimAudioFocus(audio)
            setIsPlaying(true)
        })
        audio.addEventListener('pause', () => setIsPlaying(false))
        audio.addEventListener('ended', () => {
            setIsPlaying(false)
            setCurrentTime(0)
        })
        audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime))
        audio.addEventListener('loadedmetadata', () => {
            if (Number.isFinite(audio.duration) && audio.duration > 0) setMetaDuration(audio.duration)
            const pending = pendingSeekRef.current
            if (pending != null && Number.isFinite(audio.duration) && audio.duration > 0) {
                audio.currentTime = pending * audio.duration
                setCurrentTime(audio.currentTime)
            }
            pendingSeekRef.current = null
        })
        audio.addEventListener('error', () => {
            setIsPlaying(false)
            setError('Playback failed. Try again.')
        })
    }, [])

    const createAndPlay = useCallback(async () => {
        const seq = seqRef.current
        setIsLoading(true)
        setError(null)
        // Waveform decode rides the same cached blob; failure just keeps pseudo.
        getAudioPeaks(url)
            .then((decoded) => {
                if (seq === seqRef.current) setPeaks(decoded)
            })
            .catch(() => undefined)
        let audio: HTMLAudioElement
        try {
            const blob = await getAudioBlob(url)
            if (seq !== seqRef.current) return
            const objectUrl = URL.createObjectURL(blob)
            objectUrlRef.current = objectUrl
            audio = new Audio(objectUrl)
        } catch {
            if (seq !== seqRef.current) return
            // Blob fetch failed — stream straight from the source instead.
            audio = new Audio(url)
        }
        attach(audio)
        audioRef.current = audio
        setIsLoading(false)
        // Strict autoplay policies may reject when the fetch outlived the tap's
        // activation; the element is kept so the next tap plays instantly.
        void audio.play().catch(() => setIsPlaying(false))
    }, [url, attach])

    const toggle = useCallback(() => {
        const audio = audioRef.current
        if (!audio) {
            if (!isLoading) void createAndPlay()
            return
        }
        if (audio.paused) void audio.play().catch(() => setIsPlaying(false))
        else audio.pause()
    }, [createAndPlay, isLoading])

    const seekRatio = useCallback(
        (ratio: number) => {
            const clamped = Math.min(Math.max(ratio, 0), 1)
            const audio = audioRef.current
            if (!audio) {
                pendingSeekRef.current = clamped
                if (!isLoading) void createAndPlay()
                return
            }
            if (Number.isFinite(audio.duration) && audio.duration > 0) {
                audio.currentTime = clamped * audio.duration
                setCurrentTime(audio.currentTime)
            } else {
                pendingSeekRef.current = clamped
            }
        },
        [createAndPlay, isLoading],
    )

    const fallbackDuration =
        opts.fallbackDurationMs && opts.fallbackDurationMs > 0 ? opts.fallbackDurationMs / 1000 : null

    return {
        isPlaying,
        isLoading,
        error,
        currentTime,
        duration: metaDuration ?? fallbackDuration,
        peaks,
        toggle,
        seekRatio,
    }
}
