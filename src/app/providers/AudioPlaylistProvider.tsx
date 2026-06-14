/**
 * AudioPlaylistProvider — the app's single music engine. Owns ONE lazily
 * created HTMLAudioElement reused across tracks (keeping the browser's media
 * engagement so `ended` → auto-advance needs no new user gesture), a queue
 * managed by the pure {@link playlistReducer}, and the blob/peaks pipeline
 * shared with the download action's cache. Every theme-song play surface
 * (ThemeSongButton, AudioWavePlayer, PlaylistDock) is a view of this provider.
 *
 * The queue and position persist to localStorage; reloads restore the
 * playlist paused. Playback is exclusive app-wide via the audio-focus
 * registry: TTS narration claiming focus pauses this element, whose own
 * `pause` event syncs `isPlaying` back to the dock.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { getAudioBlob, getAudioPeaks } from '@/ui/components/audio/audioData'
import { claimAudioFocus, releaseAudioFocus } from '@/ui/components/audio/audioFocus'
import {
    AudioPlaylistContext,
    type AudioPlaylistContextValue,
    type PlaylistTrack,
} from './audioPlaylistContext'
import {
    PLAYLIST_STORAGE_KEY,
    playlistReducer,
    restorePlaylistState,
    serializePlaylist,
    type PlaylistQueueState,
} from './playlistReducer'

interface AudioPlaylistProviderProps {
    children: ReactNode
}

interface PlaylistAudioPrefs {
    volume: number
    muted: boolean
}

export const PLAYLIST_AUDIO_PREFS_STORAGE_KEY = 'magic_worlds:playlist_audio_prefs:v1'
const DEFAULT_RESTORED_VOLUME = 0.8
const DEFAULT_AUDIO_PREFS: PlaylistAudioPrefs = { volume: 1, muted: false }

function clamp01(value: number): number {
    return Math.min(Math.max(value, 0), 1)
}

function currentTrackOf(state: PlaylistQueueState): PlaylistTrack | null {
    return state.currentIndex >= 0 ? (state.queue[state.currentIndex] ?? null) : null
}

function restoreAudioPrefs(raw: string | null): PlaylistAudioPrefs {
    if (!raw) return DEFAULT_AUDIO_PREFS
    try {
        const parsed = JSON.parse(raw) as { volume?: unknown; muted?: unknown }
        const volume = typeof parsed.volume === 'number' && Number.isFinite(parsed.volume)
            ? clamp01(parsed.volume)
            : DEFAULT_AUDIO_PREFS.volume
        return {
            volume,
            muted: typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULT_AUDIO_PREFS.muted,
        }
    } catch {
        return DEFAULT_AUDIO_PREFS
    }
}

function serializeAudioPrefs(prefs: PlaylistAudioPrefs): string {
    return JSON.stringify(prefs)
}

export function AudioPlaylistProvider({ children }: AudioPlaylistProviderProps) {
    const [state, dispatch] = useReducer(playlistReducer, null, () =>
        restorePlaylistState(localStorage.getItem(PLAYLIST_STORAGE_KEY)),
    )
    const [isPlaying, setIsPlaying] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [currentTime, setCurrentTime] = useState(0)
    const [metaDuration, setMetaDuration] = useState<number | null>(null)
    const [peaks, setPeaks] = useState<number[] | null>(null)
    const [audioPrefs, setAudioPrefs] = useState<PlaylistAudioPrefs>(() =>
        restoreAudioPrefs(localStorage.getItem(PLAYLIST_AUDIO_PREFS_STORAGE_KEY)),
    )

    const audioRef = useRef<HTMLAudioElement | null>(null)
    const objectUrlRef = useRef<string | null>(null)
    /** Which track id the element's current src belongs to. */
    const loadedTrackIdRef = useRef<string | null>(null)
    // Stale-async guard: bumped on every load/reset; only the live sequence
    // may commit state (same pattern as the old useAudioPlayer).
    const seqRef = useRef(0)
    const pendingSeekRef = useRef<number | null>(null)
    const isLoadingRef = useRef(false)
    /** Consecutive failed tracks — stops the auto-skip from looping forever. */
    const failuresRef = useRef(0)
    const effectiveMuted = audioPrefs.muted || audioPrefs.volume === 0
    const lastAudibleVolumeRef = useRef(audioPrefs.volume > 0 ? audioPrefs.volume : DEFAULT_RESTORED_VOLUME)

    const stateRef = useRef(state)
    useEffect(() => {
        stateRef.current = state
    }, [state])

    const setLoading = useCallback((value: boolean) => {
        isLoadingRef.current = value
        setIsLoading(value)
    }, [])

    const ensureElement = useCallback((): HTMLAudioElement => {
        let el = audioRef.current
        if (el) return el
        el = new Audio()
        el.volume = audioPrefs.volume
        el.muted = effectiveMuted
        el.addEventListener('play', () => {
            claimAudioFocus(el)
            failuresRef.current = 0
            setIsPlaying(true)
        })
        el.addEventListener('pause', () => setIsPlaying(false))
        el.addEventListener('ended', () => {
            const { queue, currentIndex, loopMode } = stateRef.current
            if (loopMode === 'track') {
                el.currentTime = 0
                setCurrentTime(0)
                void el.play().catch(() => setIsPlaying(false))
                return
            }
            if (currentIndex >= 0 && (currentIndex < queue.length - 1 || (loopMode === 'queue' && queue.length > 0))) {
                dispatch({ type: 'NEXT' })
                return
            }
            // End of the queue — rewind so the next toggle replays.
            el.currentTime = 0
            setIsPlaying(false)
            setCurrentTime(0)
        })
        el.addEventListener('timeupdate', () => setCurrentTime(el.currentTime))
        el.addEventListener('loadedmetadata', () => {
            if (Number.isFinite(el.duration) && el.duration > 0) setMetaDuration(el.duration)
            const pending = pendingSeekRef.current
            if (pending != null && Number.isFinite(el.duration) && el.duration > 0) {
                el.currentTime = pending * el.duration
                setCurrentTime(el.currentTime)
            }
            pendingSeekRef.current = null
        })
        el.addEventListener('error', () => {
            setIsPlaying(false)
            setLoading(false)
            setError('Playback failed. Try again.')
            // Drop the loaded marker so the next toggle retries from scratch.
            loadedTrackIdRef.current = null
            failuresRef.current += 1
            const { queue, currentIndex, loopMode } = stateRef.current
            // Skip a dead track (deleted asset etc.) but give up once a whole
            // pass over the queue has failed.
            if (
                failuresRef.current < queue.length &&
                (currentIndex < queue.length - 1 || (loopMode === 'queue' && queue.length > 1))
            ) {
                dispatch({ type: 'NEXT' })
            }
        })
        audioRef.current = el
        return el
    }, [audioPrefs.volume, effectiveMuted, setLoading])

    /** Pause and detach whatever is loaded; the next play rebuilds fresh. */
    const resetElement = useCallback(() => {
        seqRef.current += 1
        audioRef.current?.pause()
        loadedTrackIdRef.current = null
        if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current)
            objectUrlRef.current = null
        }
        pendingSeekRef.current = null
        setIsPlaying(false)
        setLoading(false)
        setError(null)
        setCurrentTime(0)
        setMetaDuration(null)
        setPeaks(null)
    }, [setLoading])

    const loadAndPlay = useCallback(
        async (track: PlaylistTrack) => {
            const seq = ++seqRef.current
            setError(null)
            setLoading(true)
            setCurrentTime(0)
            setMetaDuration(null)
            setPeaks(null)
            // Waveform decode rides the same cached blob; failure keeps pseudo.
            getAudioPeaks(track.url)
                .then((decoded) => {
                    if (seq === seqRef.current) setPeaks(decoded)
                })
                .catch(() => undefined)
            let src = track.url
            try {
                const blob = await getAudioBlob(track.url)
                if (seq !== seqRef.current) return
                const objectUrl = URL.createObjectURL(blob)
                if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
                objectUrlRef.current = objectUrl
                src = objectUrl
            } catch {
                if (seq !== seqRef.current) return
                // Blob fetch failed — stream straight from the source instead.
                if (objectUrlRef.current) {
                    URL.revokeObjectURL(objectUrlRef.current)
                    objectUrlRef.current = null
                }
            }
            const el = ensureElement()
            el.src = src
            loadedTrackIdRef.current = track.id
            setLoading(false)
            // Strict autoplay policies may reject when the fetch outlived the
            // tap's activation; the element is kept so the next tap is instant.
            void el.play().catch(() => setIsPlaying(false))
        },
        [ensureElement, setLoading],
    )

    // The engine effect: an epoch bump is play intent for the current track; a
    // track change without one (remove-current, first enqueue) loads paused.
    const lastEpochRef = useRef(state.playEpoch)
    const currentTrack = currentTrackOf(state)
    const currentTrackId = currentTrack?.id ?? null
    useEffect(() => {
        const epochChanged = state.playEpoch !== lastEpochRef.current
        lastEpochRef.current = state.playEpoch
        if (epochChanged && currentTrack) {
            void loadAndPlay(currentTrack)
        } else if (loadedTrackIdRef.current !== currentTrackId) {
            resetElement()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentTrackId, state.playEpoch])

    // Persist the queue and position — never play state or progress.
    useEffect(() => {
        if (state.queue.length === 0) localStorage.removeItem(PLAYLIST_STORAGE_KEY)
        else localStorage.setItem(PLAYLIST_STORAGE_KEY, serializePlaylist(state))
    }, [state])

    useEffect(() => {
        const el = audioRef.current
        if (el) {
            el.volume = audioPrefs.volume
            el.muted = effectiveMuted
        }
        localStorage.setItem(
            PLAYLIST_AUDIO_PREFS_STORAGE_KEY,
            serializeAudioPrefs({ volume: audioPrefs.volume, muted: effectiveMuted }),
        )
    }, [audioPrefs.volume, effectiveMuted])

    // Release the element on app teardown.
    useEffect(() => {
        return () => {
            seqRef.current += 1
            const el = audioRef.current
            if (el) {
                el.pause()
                releaseAudioFocus(el)
            }
            audioRef.current = null
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current)
                objectUrlRef.current = null
            }
        }
    }, [])

    const toggle = useCallback(() => {
        const current = currentTrackOf(stateRef.current)
        if (!current) return
        const el = audioRef.current
        if (el && loadedTrackIdRef.current === current.id) {
            if (el.paused) void el.play().catch(() => setIsPlaying(false))
            else el.pause()
        } else if (!isLoadingRef.current) {
            void loadAndPlay(current)
        }
    }, [loadAndPlay])

    const seekRatio = useCallback(
        (ratio: number) => {
            const current = currentTrackOf(stateRef.current)
            if (!current) return
            const clamped = clamp01(ratio)
            const el = audioRef.current
            if (el && loadedTrackIdRef.current === current.id) {
                if (Number.isFinite(el.duration) && el.duration > 0) {
                    el.currentTime = clamped * el.duration
                    setCurrentTime(el.currentTime)
                } else {
                    pendingSeekRef.current = clamped
                }
            } else if (!isLoadingRef.current) {
                // Seeking an idle track starts playback from there.
                pendingSeekRef.current = clamped
                void loadAndPlay(current)
            } else {
                pendingSeekRef.current = clamped
            }
        },
        [loadAndPlay],
    )

    const playNow = useCallback(
        (track: PlaylistTrack, opts?: { seekRatio?: number }) => {
            const current = currentTrackOf(stateRef.current)
            if (current?.id === track.id) {
                if (opts?.seekRatio != null) seekRatio(opts.seekRatio)
                else toggle()
                return
            }
            if (opts?.seekRatio != null) pendingSeekRef.current = clamp01(opts.seekRatio)
            dispatch({ type: 'PLAY_NOW', track })
        },
        [seekRatio, toggle],
    )

    const enqueue = useCallback((track: PlaylistTrack) => dispatch({ type: 'ENQUEUE', track }), [])
    const playQueueFrom = useCallback((index: number) => dispatch({ type: 'PLAY_AT', index }), [])
    const next = useCallback(() => dispatch({ type: 'NEXT' }), [])

    const prev = useCallback(() => {
        const current = currentTrackOf(stateRef.current)
        const el = audioRef.current
        if (el && current && loadedTrackIdRef.current === current.id && el.currentTime > 3) {
            el.currentTime = 0
            setCurrentTime(0)
            return
        }
        dispatch({ type: 'PREV' })
    }, [])

    const stop = useCallback(() => {
        const el = audioRef.current
        if (el && loadedTrackIdRef.current) {
            el.pause()
            el.currentTime = 0
        }
        setCurrentTime(0)
    }, [])

    const removeAt = useCallback((index: number) => dispatch({ type: 'REMOVE_AT', index }), [])

    const cycleLoopMode = useCallback(() => dispatch({ type: 'CYCLE_LOOP_MODE' }), [])

    const setVolume = useCallback((value: number) => {
        const volume = clamp01(value)
        setAudioPrefs(() => {
            if (volume > 0) lastAudibleVolumeRef.current = volume
            return { volume, muted: volume === 0 ? true : false }
        })
    }, [])

    const toggleMute = useCallback(() => {
        setAudioPrefs((prefs) => {
            const muted = prefs.muted || prefs.volume === 0
            if (muted) {
                const volume = prefs.volume > 0 ? prefs.volume : lastAudibleVolumeRef.current || DEFAULT_RESTORED_VOLUME
                lastAudibleVolumeRef.current = volume
                return { volume, muted: false }
            }
            if (prefs.volume > 0) lastAudibleVolumeRef.current = prefs.volume
            return { ...prefs, muted: true }
        })
    }, [])

    const clearAndClose = useCallback(() => {
        resetElement()
        dispatch({ type: 'CLEAR' })
    }, [resetElement])

    const isQueued = useCallback((id: string) => state.queue.some((track) => track.id === id), [state.queue])

    const fallbackDuration =
        currentTrack?.durationMs && currentTrack.durationMs > 0 ? currentTrack.durationMs / 1000 : null

    const value = useMemo<AudioPlaylistContextValue>(
        () => ({
            queue: state.queue,
            currentIndex: state.currentIndex,
            currentTrack,
            loopMode: state.loopMode,
            isPlaying,
            isLoading,
            error,
            currentTime,
            duration: metaDuration ?? fallbackDuration,
            peaks,
            volume: audioPrefs.volume,
            muted: effectiveMuted,
            playNow,
            enqueue,
            playQueueFrom,
            toggle,
            next,
            prev,
            stop,
            removeAt,
            clearAndClose,
            seekRatio,
            cycleLoopMode,
            setVolume,
            toggleMute,
            isQueued,
        }),
        [
            state.queue,
            state.currentIndex,
            state.loopMode,
            currentTrack,
            isPlaying,
            isLoading,
            error,
            currentTime,
            metaDuration,
            fallbackDuration,
            peaks,
            audioPrefs.volume,
            effectiveMuted,
            playNow,
            enqueue,
            playQueueFrom,
            toggle,
            next,
            prev,
            stop,
            removeAt,
            clearAndClose,
            seekRatio,
            cycleLoopMode,
            setVolume,
            toggleMute,
            isQueued,
        ],
    )

    return <AudioPlaylistContext.Provider value={value}>{children}</AudioPlaylistContext.Provider>
}
