/**
 * TurnNarration — the speaker control in a Game Master turn's action row.
 *
 * Drives the TTS lifecycle for a single turn:
 *   - idle (no audio yet)        → ▶ request synthesis (onRequest)
 *   - generating (non-terminal)  → ⏳ spinner, disabled
 *   - ready (audio url)          → ▶/⏸ play-pause toggle
 *   - failed (terminal error)    → ▶ retry, danger tone, error in the tooltip
 *
 * Audio is served by the backend's ownership-checked download route
 * (`/tts/assets/{asset_id}.mp3`), which requires a Bearer token that media
 * elements can't send — so the first play fetches the bytes through the API
 * client and owns a single HTMLAudioElement over an object URL, recreated when
 * the source changes and released (URL revoked) on unmount. Playback is never
 * assumed to autostart — even with auto-narrate the frame arrives from a
 * WebSocket callback with no user-gesture context, so we always surface a Play
 * affordance and reflect a rejected play() as paused.
 */
import { useEffect, useRef, useState } from 'react'
import { Loader2, Pause, Play, Volume2 } from 'lucide-react'
import type { TtsLifecycleStatus } from '../../../shared'
import { IconButton } from '../../../ui/primitives'
import { apiService, resolveMediaUrl } from '../../../infrastructure/api'

const NON_TERMINAL: TtsLifecycleStatus[] = ['pending', 'in_progress', 'synthesizing', 'mirroring']

interface TurnNarrationProps {
    status?: TtsLifecycleStatus
    /** Sanitized (possibly root-relative) audio url; resolved to absolute here. */
    url?: string
    errorDetail?: string
    /** False while the turn is still streaming or has no persisted ids yet. */
    canRequest: boolean
    onRequest: () => void
}

export function TurnNarration({ status, url, errorDetail, canRequest, onRequest }: TurnNarrationProps) {
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const objectUrlRef = useRef<string | null>(null)
    // Monotonic token: bumping it invalidates any in-flight audio fetch.
    const fetchSeqRef = useRef(0)
    const [isPlaying, setIsPlaying] = useState(false)
    const [isFetching, setIsFetching] = useState(false)
    const resolved = resolveMediaUrl(url)

    // Release the audio element (and its fetched bytes) on unmount.
    useEffect(() => {
        return () => {
            fetchSeqRef.current += 1
            audioRef.current?.pause()
            audioRef.current = null
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current)
                objectUrlRef.current = null
            }
        }
    }, [])

    // Source changed (e.g. a regenerate produced new audio, or the turn lost its
    // audio) → drop the old element + object URL and abandon any in-flight fetch
    // so the next play builds a fresh one. Pausing fires the element's 'pause'
    // listener, which clears isPlaying, so isPlaying is never set directly here.
    useEffect(() => {
        fetchSeqRef.current += 1
        setIsFetching(false)
        const previous = audioRef.current
        const previousUrl = objectUrlRef.current
        audioRef.current = null
        objectUrlRef.current = null
        previous?.pause()
        if (previousUrl) URL.revokeObjectURL(previousUrl)
    }, [resolved])

    const generating = status ? NON_TERMINAL.includes(status) : false

    if (generating) {
        return (
            <IconButton label="Generating narration…" size="sm" disabled>
                <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
            </IconButton>
        )
    }

    if (resolved) {
        const attachListeners = (audio: HTMLAudioElement) => {
            audio.addEventListener('play', () => setIsPlaying(true))
            audio.addEventListener('pause', () => setIsPlaying(false))
            audio.addEventListener('ended', () => setIsPlaying(false))
        }
        const toggle = () => {
            const audio = audioRef.current
            if (audio) {
                if (audio.paused) void audio.play().catch(() => setIsPlaying(false))
                else audio.pause()
                return
            }
            if (isFetching) return
            const seq = ++fetchSeqRef.current
            setIsFetching(true)
            apiService.fetchTtsAudioBlob(resolved)
                .then((blob) => {
                    const objectUrl = URL.createObjectURL(blob)
                    if (seq !== fetchSeqRef.current) {
                        // Source changed (or unmounted) while fetching — discard.
                        URL.revokeObjectURL(objectUrl)
                        return
                    }
                    objectUrlRef.current = objectUrl
                    const fetched = new Audio(objectUrl)
                    attachListeners(fetched)
                    audioRef.current = fetched
                    // Strict autoplay policies may reject if the fetch outlived the
                    // tap's transient activation; the element is kept, so the next
                    // tap plays instantly without re-fetching.
                    void fetched.play().catch(() => setIsPlaying(false))
                })
                .catch(() => {
                    // Fetch failed (expired/stale asset, offline). Stay in the ready
                    // state; another tap retries the download.
                })
                .finally(() => {
                    if (seq === fetchSeqRef.current) setIsFetching(false)
                })
        }
        if (isFetching) {
            return (
                <IconButton label="Loading narration…" size="sm" disabled>
                    <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
                </IconButton>
            )
        }
        return (
            <IconButton
                label={isPlaying ? 'Pause narration' : 'Play narration'}
                size="sm"
                tone={isPlaying ? 'active' : 'default'}
                onClick={toggle}
            >
                {isPlaying ? <Pause size={14} strokeWidth={1.75} /> : <Play size={14} strokeWidth={1.75} />}
            </IconButton>
        )
    }

    // No audio: offer to request it (or retry a failed job). Hidden until the turn
    // has finished and carries the ids the backend needs.
    if (!canRequest) return null
    const failed = Boolean(errorDetail) || Boolean(status && status !== 'completed')
    return (
        <IconButton
            label={failed ? `Narration failed — tap to retry${errorDetail ? `: ${errorDetail}` : ''}` : 'Play narration'}
            size="sm"
            tone={failed ? 'danger' : 'default'}
            onClick={onRequest}
        >
            <Volume2 size={14} strokeWidth={1.75} />
        </IconButton>
    )
}
