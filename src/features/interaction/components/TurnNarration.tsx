/**
 * TurnNarration — the speaker control in a Game Master turn's action row.
 *
 * Single-clip turns (1:1 chat, or the whole-message fallback) drive one TTS
 * lifecycle:
 *   - idle (no audio yet)        → ▶ request synthesis (onRequest)
 *   - generating (non-terminal)  → ⏳ spinner, disabled
 *   - ready (audio url)          → ▶/⏸ play-pause toggle
 *   - failed (terminal error)    → ▶ retry, danger tone, error in the tooltip
 *
 * Per-segment multi-voice turns (RP/group) carry an ordered list of clips — each
 * line in its speaker's voice, narration in the narrator voice. The player plays
 * them in `segment_index` order, advancing on `ended`; if the next clip is still
 * synthesizing it waits and resumes automatically when that clip's url arrives,
 * so ready clips play while later ones generate.
 *
 * Audio is served by the backend's ownership-checked download route
 * (`/tts/assets/{asset_id}.mp3`), which needs a Bearer token media elements can't
 * send — so the first play fetches bytes through the API client over an object
 * URL. Playback never autostarts (frames arrive from WS callbacks with no
 * user-gesture context) — we always surface a Play affordance.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Pause, Play, Volume2 } from 'lucide-react'
import type { ChatTtsSegmentClip, TtsLifecycleStatus } from '../../../shared'
import { IconButton } from '../../../ui/primitives'
import { claimAudioFocus } from '../../../ui/components/audio'
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
    /** Per-segment multi-voice clips. When present, the ordered player is used. */
    segments?: ChatTtsSegmentClip[]
}

export function TurnNarration(props: TurnNarrationProps) {
    if (props.segments && props.segments.length > 0) {
        return <MultiClipNarration segments={props.segments} canRequest={props.canRequest} onRequest={props.onRequest} />
    }
    return <SingleClipNarration {...props} />
}

function SingleClipNarration({ status, url, errorDetail, canRequest, onRequest }: TurnNarrationProps) {
    const { t } = useTranslation()
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
    // audio) → drop the old element + object URL and abandon any in-flight fetch.
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
            <IconButton label={t('interaction.narration.generating')} size="sm" disabled>
                <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
            </IconButton>
        )
    }

    if (resolved) {
        const attachListeners = (audio: HTMLAudioElement) => {
            audio.addEventListener('play', () => {
                claimAudioFocus(audio)
                setIsPlaying(true)
            })
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
                        URL.revokeObjectURL(objectUrl)
                        return
                    }
                    objectUrlRef.current = objectUrl
                    const fetched = new Audio(objectUrl)
                    attachListeners(fetched)
                    audioRef.current = fetched
                    void fetched.play().catch(() => setIsPlaying(false))
                })
                .catch(() => {})
                .finally(() => {
                    if (seq === fetchSeqRef.current) setIsFetching(false)
                })
        }
        if (isFetching) {
            return (
                <IconButton label={t('interaction.narration.loading')} size="sm" disabled>
                    <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
                </IconButton>
            )
        }
        return (
            <IconButton
                label={isPlaying ? t('interaction.narration.pause') : t('interaction.narration.play')}
                size="sm"
                tone={isPlaying ? 'active' : 'default'}
                onClick={toggle}
            >
                {isPlaying ? <Pause size={14} strokeWidth={1.75} /> : <Play size={14} strokeWidth={1.75} />}
            </IconButton>
        )
    }

    if (!canRequest) return null
    const failed = Boolean(errorDetail) || Boolean(status && status !== 'completed')
    return (
        <IconButton
            label={
                failed
                    ? errorDetail
                        ? t('interaction.narration.failedRetryDetail', { detail: errorDetail })
                        : t('interaction.narration.failedRetry')
                    : t('interaction.narration.play')
            }
            size="sm"
            tone={failed ? 'danger' : 'default'}
            onClick={onRequest}
        >
            <Volume2 size={14} strokeWidth={1.75} />
        </IconButton>
    )
}

function clipReadyUrl(clip: ChatTtsSegmentClip | undefined): string | undefined {
    return clip?.url ? resolveMediaUrl(clip.url) : undefined
}

function clipLabel(clip: ChatTtsSegmentClip | undefined, t: (key: string) => string): string {
    if (!clip) return t('interaction.narration.clipNarration')
    if (clip.kind === 'narrator') return t('interaction.narration.clipNarrator')
    return clip.speaker_name || clip.speaker_id || t('interaction.narration.clipSpeaker')
}

function MultiClipNarration({
    segments,
    canRequest,
    onRequest,
}: {
    segments: ChatTtsSegmentClip[]
    canRequest: boolean
    onRequest: () => void
}) {
    const { t } = useTranslation()
    const clips = [...segments].sort((a, b) => a.segment_index - b.segment_index)
    const clipsRef = useRef(clips)
    clipsRef.current = clips

    const audioRef = useRef<HTMLAudioElement | null>(null)
    const objectUrlRef = useRef<string | null>(null)
    const fetchSeqRef = useRef(0)
    const indexRef = useRef(0)
    const wantPlayRef = useRef(false)
    const [index, setIndex] = useState(0)
    const [isPlaying, setIsPlaying] = useState(false)
    const [isFetching, setIsFetching] = useState(false)
    const [waiting, setWaiting] = useState(false)

    const ensureAudio = (): HTMLAudioElement => {
        let audio = audioRef.current
        if (!audio) {
            audio = new Audio()
            audio.addEventListener('play', () => {
                claimAudioFocus(audio!)
                setIsPlaying(true)
            })
            audio.addEventListener('pause', () => {
                if (!wantPlayRef.current) setIsPlaying(false)
            })
            audio.addEventListener('ended', () => advanceTo(indexRef.current + 1))
            audioRef.current = audio
        }
        return audio
    }

    const loadAndPlay = (clip: ChatTtsSegmentClip) => {
        const resolved = clipReadyUrl(clip)
        if (!resolved) {
            setWaiting(true)
            return
        }
        const seq = ++fetchSeqRef.current
        setIsFetching(true)
        setWaiting(false)
        apiService.fetchTtsAudioBlob(resolved)
            .then((blob) => {
                if (seq !== fetchSeqRef.current) return
                const objectUrl = URL.createObjectURL(blob)
                if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
                objectUrlRef.current = objectUrl
                const audio = ensureAudio()
                audio.src = objectUrl
                claimAudioFocus(audio)
                void audio.play().catch(() => setIsPlaying(false))
            })
            .catch(() => {})
            .finally(() => {
                if (seq === fetchSeqRef.current) setIsFetching(false)
            })
    }

    const advanceTo = (next: number) => {
        const list = clipsRef.current
        if (next >= list.length) {
            // Played the whole turn — reset to the top, ready to replay.
            indexRef.current = 0
            setIndex(0)
            wantPlayRef.current = false
            setIsPlaying(false)
            setWaiting(false)
            return
        }
        indexRef.current = next
        setIndex(next)
        if (wantPlayRef.current) loadAndPlay(list[next])
    }

    // Resume sequential playback when the awaited clip's audio arrives.
    useEffect(() => {
        if (!waiting || !wantPlayRef.current) return
        const clip = clipsRef.current[indexRef.current]
        if (clipReadyUrl(clip)) loadAndPlay(clip)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [segments, waiting])

    // Release everything on unmount.
    useEffect(() => {
        return () => {
            fetchSeqRef.current += 1
            wantPlayRef.current = false
            audioRef.current?.pause()
            audioRef.current = null
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current)
                objectUrlRef.current = null
            }
        }
    }, [])

    const anyReady = clips.some((clip) => clipReadyUrl(clip))
    const anyGenerating = clips.some((clip) => clip.status != null && NON_TERMINAL.includes(clip.status))
    const failedAll = !anyReady && !anyGenerating && clips.some((clip) => clip.error)

    const toggle = () => {
        const audio = audioRef.current
        if (isPlaying && audio) {
            wantPlayRef.current = false
            audio.pause()
            return
        }
        wantPlayRef.current = true
        if (audio && audio.src && !audio.ended) {
            void audio.play().catch(() => setIsPlaying(false))
            return
        }
        const clip = clipsRef.current[indexRef.current] ?? clipsRef.current[0]
        if (clip) loadAndPlay(clip)
    }

    // Nothing ready yet, still generating → disabled spinner (like single-clip).
    if (!anyReady && anyGenerating) {
        return (
            <IconButton label={t('interaction.narration.generating')} size="sm" disabled>
                <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
            </IconButton>
        )
    }

    // Everything failed and nothing playable → offer a retry.
    if (!anyReady && failedAll) {
        if (!canRequest) return null
        return (
            <IconButton label={t('interaction.narration.failedRetry')} size="sm" tone="danger" onClick={onRequest}>
                <Volume2 size={14} strokeWidth={1.75} />
            </IconButton>
        )
    }

    if (!anyReady) {
        if (!canRequest) return null
        return (
            <IconButton label={t('interaction.narration.play')} size="sm" onClick={onRequest}>
                <Volume2 size={14} strokeWidth={1.75} />
            </IconButton>
        )
    }

    const caption = isPlaying || waiting ? `${clipLabel(clips[index], t)} · ${index + 1}/${clips.length}` : null
    return (
        <span className="inline-flex items-center gap-1.5">
            {isFetching ? (
                <IconButton label={t('interaction.narration.loading')} size="sm" disabled>
                    <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
                </IconButton>
            ) : (
                <IconButton
                    label={isPlaying ? t('interaction.narration.pause') : t('interaction.narration.play')}
                    size="sm"
                    tone={isPlaying ? 'active' : 'default'}
                    onClick={toggle}
                >
                    {isPlaying ? <Pause size={14} strokeWidth={1.75} /> : <Play size={14} strokeWidth={1.75} />}
                </IconButton>
            )}
            {caption && <span className="font-mono text-[10px] text-parchment-500">{caption}</span>}
        </span>
    )
}
