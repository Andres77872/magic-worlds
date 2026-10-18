import { useFeatureFlags } from '@/shared/hooks/useFeatureFlags'
/**
 * TurnNarration — the speaker control in a Game Master turn's action row.
 *
 * Single-clip turns (1:1 chat, or the whole-message fallback) drive one TTS
 * lifecycle:
 *   - idle (no audio yet)        → ▶ request synthesis (onRequest)
 *   - generating (non-terminal)  → ⏳ spinner, disabled
 *   - ready (audio url)          → ▶/⏸ play-pause toggle
 *   - failed (terminal error)    → ▶ retry, danger tone, error in the tooltip
 *   - safety pause / geo block   → disabled, danger tone, labelled with why (no retry);
 *                                  a timed pause offers ▶ again once it has run out
 *
 * Per-segment multi-voice turns (RP/group) carry an ordered list of clips — each
 * line in its speaker's voice, narration in the narrator voice. A pure queue
 * (`narrationQueue`) plays them in `segment_index` order: ready clips play while
 * later ones generate, a clip still generating is waited for, and a failed,
 * capped or unplayable clip is skipped so the rest of the turn still plays
 * (D30 #3). Retryable skips offer "Retry n" once nothing is generating.
 *
 * Volume follows the playlist's volume and mute, scaled per clip by its voice
 * gain and the thought factor (D16, `clipVolume`). Narrated turns carry the
 * "AI voice" label (D26). When `canRequest` is false (still streaming, or a
 * read-only workspace) stored clips still play but nothing new is requested.
 * When `unavailable` (the server switched narration off, 09 §7) the request
 * control stays visible but disabled, labelled with why; stored clips still play.
 *
 * Audio is served by the backend's ownership-checked download route
 * (`/tts/assets/{asset_id}.mp3`), which needs a Bearer token media elements can't
 * send — so the first play fetches bytes through the API client over an object
 * URL. Playback never autostarts (frames arrive from WS callbacks with no
 * user-gesture context) — we always surface a Play affordance.
 */
import { isVoicesFeatureEnabled } from '@/shared/featureFlags'
import { useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Bot, Loader2, Pause, Play, RotateCcw, ShieldCheck, Volume2, VolumeX } from 'lucide-react'
import type { ChatTtsError, ChatTtsSegmentClip, TtsLifecycleStatus } from '../../../shared'
import { AudioPlaylistContext } from '../../../app/providers/audioPlaylistContext'
import { Badge, Icon, IconButton } from '../../../ui/primitives'
import { claimAudioFocus } from '../../../ui/components/audio'
import { apiService, resolveMediaUrl } from '../../../infrastructure/api'
import { clipVolume } from '@/shared/voice/clipVolume'
import { isGeneratingClipStatus } from '../utils/chatTtsTurnState'
import {
    clipPlayback,
    clipSkipReason,
    initialNarrationQueueState,
    isRetryableSkip,
    isSafetyPause,
    narrationErrorKey,
    narrationQueueReducer,
    needsAttestation,
    orderClips,
} from '../utils/narrationQueue'
import { NarrationVoiceNotes, type VoiceRefreshTarget } from './NarrationVoiceNotes'

interface TurnNarrationProps {
    status?: TtsLifecycleStatus
    /** Sanitized (possibly root-relative) audio url; resolved to absolute here. */
    url?: string
    /** The turn's error: a single clip's failure, or a refusal of the whole turn (no job). */
    error?: ChatTtsError
    /** False while the turn is still streaming, has no persisted ids yet, or the workspace is read-only. */
    canRequest: boolean
    onRequest: () => void
    /** Per-segment multi-voice clips. When present, the ordered player is used. */
    segments?: ChatTtsSegmentClip[]
    /** Opens the age and terms attestation for an `attestation_required` refusal (D26); nothing happens without it. */
    onAttest?: () => void
    /** Narration is switched off for this account right now (`capabilities.status.narration_available: false`). */
    unavailable?: boolean
    /** "Voice replaced" action for a cast speaker (R1, R-30): re-resolve its voice from the card. */
    onRefreshVoice?: (target: VoiceRefreshTarget) => Promise<unknown>
    /** "Voice replaced" action for the narrator: open the narrator voice picker. */
    onEditNarratorVoice?: () => void
    /** The voice actions are shown disabled (read-only, streaming, or before the capabilities read settles). */
    refreshDisabled?: boolean
    /** Told when this turn's narration starts (true) and stops or unmounts (false); feeds the break nudge. */
    onPlayingChange?: (playing: boolean) => void
    /** `call` mode replays a saved voice-call MP3 and never synthesizes new chat narration (D1). */
    mode?: 'narration' | 'call'
}

export function TurnNarration(props: TurnNarrationProps) {
    useFeatureFlags()
    if (!isVoicesFeatureEnabled()) return null
    if (props.segments && props.segments.length > 0) {
        return (
            <MultiClipNarration
                segments={props.segments}
                error={props.error}
                canRequest={props.mode === 'call' ? false : props.canRequest}
                onRequest={props.onRequest}
                onAttest={props.onAttest}
                unavailable={props.unavailable}
                onRefreshVoice={props.onRefreshVoice}
                onEditNarratorVoice={props.onEditNarratorVoice}
                refreshDisabled={props.refreshDisabled}
                onPlayingChange={props.onPlayingChange}
                mode={props.mode}
            />
        )
    }
    return <SingleClipNarration {...props} canRequest={props.mode === 'call' ? false : props.canRequest} />
}

/** Reports a playing stretch to `onPlayingChange`: true when it starts, false when it stops or the player unmounts. */
function useReportPlaying(playing: boolean, onPlayingChange?: (playing: boolean) => void) {
    useFeatureFlags()
    const callbackRef = useRef(onPlayingChange)
    useEffect(() => {
        callbackRef.current = onPlayingChange
    }, [onPlayingChange])
    useEffect(() => {
        if (!playing) return
        callbackRef.current?.(true)
        return () => callbackRef.current?.(false)
    }, [playing])
}

/**
 * The playlist's output level, which narration follows (D16): 0 when muted.
 * Outside an AudioPlaylistProvider (isolated renders) it is full volume.
 */
function usePlaylistVolume(): number {
    useFeatureFlags()
    const playlist = useContext(AudioPlaylistContext)
    if (!playlist) return 1
    return playlist.muted ? 0 : playlist.volume
}

/** `play()` that never throws: older engines return no promise, and the promise may reject. */
function startPlayback(audio: HTMLAudioElement, onRejected: (error: unknown) => void): void {
    let result: Promise<void> | undefined
    try {
        result = audio.play()
    } catch (error) {
        onRejected(error)
        return
    }
    if (result && typeof result.then === 'function') result.catch(onRejected)
}

function errorName(error: unknown): string | undefined {
    return typeof error === 'object' && error !== null && 'name' in error ? String((error as { name: unknown }).name) : undefined
}

/** Localized copy for a narration error: known codes get their own line, others the server's detail. */
function errorCopy(error: ChatTtsError | null | undefined, t: TFunction): string | undefined {
    const key = narrationErrorKey(error)
    return key ? t(key) : error?.detail || undefined
}

function AiVoiceBadge() {
    useFeatureFlags()
    const { t } = useTranslation()
    return (
        <Badge tone="arcane" icon={<Icon icon={Bot} size={12} />}>
            {t('interaction.narration.aiVoice')}
        </Badge>
    )
}

function AttestButton({ onAttest }: { onAttest?: () => void }) {
    useFeatureFlags()
    const { t } = useTranslation()
    return (
        <IconButton label={t('interaction.narration.attestRequired')} size="sm" tone="danger" onClick={() => onAttest?.()}>
            <ShieldCheck size={14} strokeWidth={1.75} />
        </IconButton>
    )
}

/** The request control while narration is switched off: visible, disabled, labelled with why. */
function UnavailableButton() {
    useFeatureFlags()
    const { t } = useTranslation()
    return (
        <IconButton label={t('interaction.narration.unavailable')} size="sm" disabled data-testid="narration-unavailable-button">
            <VolumeX size={14} strokeWidth={1.75} />
        </IconButton>
    )
}

/**
 * Refusals no retry can lift (R1/R2 only, never sent on R0): a safety pause
 * (PC-1) or a geo block (PC-2). Every other code keeps its retry (G-1).
 */
function isRefusedForGood(error: ChatTtsError | null | undefined): boolean {
    return isSafetyPause(error) || error?.code === 'voice_region_unavailable'
}

/** setTimeout's ceiling: a longer hold never lapses while the page is open. */
const MAX_TIMER_MS = 2_147_483_647

/**
 * How long such a refusal holds once shown (ms). A geo block, and a safety
 * pause without `retry_after_seconds`, hold for good; a timed safety pause
 * holds until its `retry_after_seconds` have run out.
 */
function refusalHoldMs(error: ChatTtsError): number {
    const retry = error.retry_after_seconds
    if (!isSafetyPause(error) || typeof retry !== 'number' || !Number.isFinite(retry) || retry < 0) return Infinity
    return retry * 1000
}

/**
 * Whether the turn's refusal still holds. A timed safety pause ends, and the
 * server then narrates the turn again (the turn's refusal and the VoiceAccess
 * pause both lapse at its end), so once `holdMs` has passed since this turn
 * first showed `refusal`, the turn offers its request control again instead of
 * saying voice is still paused. A new refusal (a new error) restarts the clock.
 */
function useRefusalHolds(refusal: ChatTtsError | undefined, holdMs: number): boolean {
    useFeatureFlags()
    const [lapsed, setLapsed] = useState<ChatTtsError | null>(null)
    useEffect(() => {
        if (!refusal || !(holdMs <= MAX_TIMER_MS)) return undefined
        const timer = window.setTimeout(() => setLapsed(refusal), Math.max(0, holdMs))
        return () => window.clearTimeout(timer)
    }, [refusal, holdMs])
    return Boolean(refusal) && lapsed !== refusal
}

/** Shown instead of the retry for such a refusal: disabled, labelled with why. */
function RefusedButton({ label }: { label: string }) {
    useFeatureFlags()
    return (
        <IconButton label={label} size="sm" tone="danger" disabled data-testid="narration-refused-button">
            <VolumeX size={14} strokeWidth={1.75} />
        </IconButton>
    )
}

/** The plain request control: nothing failed that still applies. */
function RequestButton({ onClick }: { onClick: () => void }) {
    useFeatureFlags()
    const { t } = useTranslation()
    return (
        <IconButton label={t('interaction.narration.play')} size="sm" onClick={onClick}>
            <Volume2 size={14} strokeWidth={1.75} />
        </IconButton>
    )
}

function Spinner({ label }: { label: string }) {
    useFeatureFlags()
    return (
        <IconButton label={label} size="sm" disabled>
            <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
        </IconButton>
    )
}

function SingleClipNarration({ status, url, error, canRequest, onRequest, onAttest, unavailable = false, onPlayingChange, mode = 'narration' }: TurnNarrationProps) {
    useFeatureFlags()
    const { t } = useTranslation()
    const userVolume = usePlaylistVolume()
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const objectUrlRef = useRef<string | null>(null)
    // Monotonic token: bumping it invalidates any in-flight audio fetch.
    const fetchSeqRef = useRef(0)
    const userVolumeRef = useRef(userVolume)
    const [isPlaying, setIsPlaying] = useState(false)
    const [isFetching, setIsFetching] = useState(false)
    const [loadFailed, setLoadFailed] = useState(false)
    const resolved = resolveMediaUrl(url)
    useReportPlaying(isPlaying, onPlayingChange)
    const refusal = isRefusedForGood(error) ? error : undefined
    const refusalHolds = useRefusalHolds(refusal, refusal ? refusalHoldMs(refusal) : Infinity)
    const playLabel = mode === 'call' ? t('interaction.narration.playCallAudio') : t('interaction.narration.play')

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
        setLoadFailed(false)
        const previous = audioRef.current
        const previousUrl = objectUrlRef.current
        audioRef.current = null
        objectUrlRef.current = null
        previous?.pause()
        if (previousUrl) URL.revokeObjectURL(previousUrl)
    }, [resolved])

    // Follow the playlist volume while the clip plays (a single clip carries no voice gain).
    useEffect(() => {
        userVolumeRef.current = userVolume
        if (audioRef.current) audioRef.current.volume = clipVolume(userVolume, null)
    }, [userVolume])

    if (isGeneratingClipStatus(status)) return <Spinner label={t('interaction.narration.generating')} />

    if (resolved) {
        const attachListeners = (audio: HTMLAudioElement) => {
            const playing = () => {
                claimAudioFocus(audio)
                setIsPlaying(true)
            }
            audio.addEventListener('play', playing)
            audio.addEventListener('playing', playing)
            audio.addEventListener('pause', () => setIsPlaying(false))
            audio.addEventListener('ended', () => setIsPlaying(false))
        }
        const toggle = () => {
            const audio = audioRef.current
            if (audio) {
                if (audio.paused) startPlayback(audio, () => setIsPlaying(false))
                else audio.pause()
                return
            }
            if (isFetching) return
            const seq = ++fetchSeqRef.current
            setIsFetching(true)
            setLoadFailed(false)
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
                    fetched.volume = clipVolume(userVolumeRef.current, null)
                    audioRef.current = fetched
                    startPlayback(fetched, () => setIsPlaying(false))
                })
                // A failed fetch shows Retry instead of looking idle.
                .catch(() => {
                    if (seq === fetchSeqRef.current) setLoadFailed(true)
                })
                .finally(() => {
                    if (seq === fetchSeqRef.current) setIsFetching(false)
                })
        }
        if (isFetching) return <Spinner label={t('interaction.narration.loading')} />
        return (
            <span className="inline-flex items-center gap-1.5">
                {loadFailed ? (
                    <IconButton label={t('interaction.narration.loadFailedRetry')} size="sm" tone="danger" onClick={toggle}>
                        <RotateCcw size={14} strokeWidth={1.75} />
                    </IconButton>
                ) : (
                    <IconButton
                        label={isPlaying ? t('interaction.narration.pause') : playLabel}
                        size="sm"
                        tone={isPlaying ? 'active' : 'default'}
                        onClick={toggle}
                    >
                        {isPlaying ? <Pause size={14} strokeWidth={1.75} /> : <Play size={14} strokeWidth={1.75} />}
                    </IconButton>
                )}
                <AiVoiceBadge />
            </span>
        )
    }

    if (!canRequest || mode === 'call') return null
    if (unavailable) return <UnavailableButton />
    if (needsAttestation(error)) return <AttestButton onAttest={onAttest} />
    const failed = Boolean(error) || Boolean(status && status !== 'completed')
    const detail = errorCopy(error, t)
    if (refusal) {
        // A timed safety pause that has run out: the turn can be narrated again.
        return refusalHolds ? <RefusedButton label={detail ?? t('interaction.narration.unavailable')} /> : <RequestButton onClick={onRequest} />
    }
    return (
        <IconButton
            label={
                failed
                    ? detail
                        ? t('interaction.narration.failedRetryDetail', { detail })
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

function clipLabel(clip: ChatTtsSegmentClip | undefined, t: (key: string) => string): string {
    if (!clip) return t('interaction.narration.clipNarration')
    if (clip.kind === 'narrator') return t('interaction.narration.clipNarrator')
    return clip.speaker_name || clip.speaker_id || t('interaction.narration.clipSpeaker')
}

function MultiClipNarration({
    segments,
    error,
    canRequest,
    onRequest,
    onAttest,
    unavailable = false,
    onRefreshVoice,
    onEditNarratorVoice,
    refreshDisabled,
    onPlayingChange,
    mode = 'narration',
}: {
    segments: ChatTtsSegmentClip[]
    error?: ChatTtsError
    canRequest: boolean
    onRequest: () => void
    onAttest?: () => void
    unavailable?: boolean
    onRefreshVoice?: (target: VoiceRefreshTarget) => Promise<unknown>
    onEditNarratorVoice?: () => void
    refreshDisabled?: boolean
    onPlayingChange?: (playing: boolean) => void
    mode?: 'narration' | 'call'
}) {
    useFeatureFlags()
    const { t } = useTranslation()
    const clips = useMemo(() => orderClips(segments), [segments])
    const userVolume = usePlaylistVolume()
    const [queue, dispatch] = useReducer(narrationQueueReducer, initialNarrationQueueState)
    useReportPlaying(queue.phase === 'playing', onPlayingChange)
    const playLabel = mode === 'call' ? t('interaction.narration.playCallAudio') : t('interaction.narration.play')

    // Read by the element listeners and the load effect, which outlive a render.
    const clipsRef = useRef(clips)
    const userVolumeRef = useRef(userVolume)
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const objectUrlRef = useRef<string | null>(null)
    /** The clip whose audio the element holds. */
    const loadedRef = useRef<ChatTtsSegmentClip | null>(null)

    // New frames: a clip the queue waits for may have landed, or failed.
    useEffect(() => {
        clipsRef.current = clips
        dispatch({ type: 'clipsChanged', clips })
    }, [clips])

    useEffect(() => {
        userVolumeRef.current = userVolume
        const audio = audioRef.current
        const clip = loadedRef.current
        if (audio) audio.volume = clipVolume(userVolume, clip?.gain_db, clip?.kind)
    }, [userVolume])

    const ensureAudio = (): HTMLAudioElement => {
        if (audioRef.current) return audioRef.current
        const audio = new Audio()
        const playing = () => {
            claimAudioFocus(audio)
            dispatch({ type: 'playing' })
        }
        audio.addEventListener('play', playing)
        audio.addEventListener('playing', playing)
        // The element's own `ended` flag tells a clip transition from a real pause.
        audio.addEventListener('pause', () => dispatch({ type: 'paused', ended: audio.ended }))
        audio.addEventListener('ended', () => dispatch({ type: 'ended', clips: clipsRef.current }))
        audio.addEventListener('error', () => {
            if (audio.getAttribute('src')) dispatch({ type: 'loadFailed', clips: clipsRef.current })
        })
        audioRef.current = audio
        return audio
    }

    // Load and start the cursor clip each time the queue asks for it.
    useEffect(() => {
        if (queue.phase !== 'loading' || queue.current === null) return
        const clip = clipsRef.current.find((entry) => entry.segment_index === queue.current)
        const resolved = clip?.url ? resolveMediaUrl(clip.url) : undefined
        if (!clip || !resolved) {
            dispatch({ type: 'loadFailed', clips: clipsRef.current })
            return
        }
        let cancelled = false
        const fail = () => {
            if (!cancelled) dispatch({ type: 'loadFailed', clips: clipsRef.current })
        }
        apiService.fetchTtsAudioBlob(resolved)
            .then((blob) => {
                if (cancelled) return
                const audio = ensureAudio()
                const previousUrl = objectUrlRef.current
                objectUrlRef.current = URL.createObjectURL(blob)
                loadedRef.current = clip
                audio.src = objectUrlRef.current
                if (previousUrl) URL.revokeObjectURL(previousUrl)
                // Gain is per voice, so every clip sets it before it plays (D16).
                audio.volume = clipVolume(userVolumeRef.current, clip.gain_db, clip.kind)
                claimAudioFocus(audio)
                startPlayback(audio, (playError) => {
                    if (cancelled) return
                    // Refused without a user gesture: wait for a tap rather than skip the clip.
                    if (errorName(playError) === 'NotAllowedError') dispatch({ type: 'pause' })
                    else if (errorName(playError) !== 'AbortError') fail()
                })
            })
            .catch(fail)
        return () => {
            cancelled = true
        }
        // ensureAudio only touches refs and the stable dispatch.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queue.loadToken, queue.phase, queue.current])

    // Release everything on unmount.
    useEffect(() => {
        return () => {
            const audio = audioRef.current
            audioRef.current = null
            loadedRef.current = null
            audio?.pause()
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current)
                objectUrlRef.current = null
            }
        }
    }, [])

    const loadFailed = new Set(queue.loadFailed)
    const anyReady = clips.some((clip) => clipPlayback(clip, loadFailed) === 'play')
    const anyGenerating = clips.some((clip) => isGeneratingClipStatus(clip.status))
    const skippedClips = clips.filter((clip) => clipPlayback(clip, loadFailed) === 'skip')
    const retryCount = skippedClips.filter((clip) => isRetryableSkip(clip, loadFailed)).length
    const attest = needsAttestation(error) || skippedClips.some((clip) => needsAttestation(clip.error))
    // Once per turn, not per clip: the cap applies to the whole remainder.
    const notices = [
        skippedClips.some((clip) => clipSkipReason(clip) === 'daily_limit') ? t('interaction.narration.dailyLimit') : null,
        skippedClips.some((clip) => clipSkipReason(clip) === 'not_narrated') ? t('interaction.narration.notNarrated') : null,
    ].filter((notice): notice is string => notice !== null)
    const noticeLines = notices.map((notice) => (
        <span key={notice} className="text-caption text-blood-300">{notice}</span>
    ))
    // Every failure is a safety pause or geo block (R1/R2 only): nothing to retry while it holds.
    const refusals = [error, ...skippedClips.map((clip) => clip.error)].filter((entry): entry is ChatTtsError => Boolean(entry))
    const refusedForGood = retryCount === 0 && refusals.length > 0 && refusals.every(isRefusedForGood)
    const primaryError = error ?? skippedClips.find((clip) => clip.error)?.error ?? undefined
    const refusalHolds = useRefusalHolds(
        refusedForGood ? primaryError : undefined,
        refusedForGood ? Math.max(...refusals.map(refusalHoldMs)) : Infinity,
    )

    const retry = () => {
        dispatch({ type: 'retry' })
        if (mode === 'call') {
            dispatch({ type: 'play', clips })
            return
        }
        onRequest()
    }

    const toggle = () => {
        const audio = audioRef.current
        // Decide from the element, not React state: an element another audio
        // surface paused must read as paused here (D30 #2).
        if (audio && !audio.paused) {
            dispatch({ type: 'pause' })
            audio.pause()
            return
        }
        if (queue.wantPlay) {
            // Loading, or waiting for the next clip: cancel.
            dispatch({ type: 'pause' })
            return
        }
        const loaded = loadedRef.current
        if (audio && loaded && loaded.segment_index === queue.current && audio.getAttribute('src') && !audio.ended) {
            dispatch({ type: 'resume' })
            claimAudioFocus(audio)
            startPlayback(audio, () => dispatch({ type: 'pause' }))
            return
        }
        dispatch({ type: 'play', clips })
    }

    // Nothing ready yet, still generating → disabled spinner (like single-clip).
    if (!anyReady && anyGenerating) return <Spinner label={t('interaction.narration.generating')} />

    if (!anyReady) {
        if (mode === 'call') {
            if (loadFailed.size === 0) return null
            return (
                <span className="inline-flex flex-wrap items-center gap-1.5">
                    <IconButton label={t('interaction.narration.loadFailedRetry')} size="sm" tone="danger" onClick={retry}>
                        <RotateCcw size={14} strokeWidth={1.75} />
                    </IconButton>
                    <AiVoiceBadge />
                </span>
            )
        }
        const failedAll = skippedClips.some((clip) => clip.error) || retryCount > 0
        let control = null
        if (canRequest) {
            if (unavailable) {
                control = <UnavailableButton />
            } else if (attest) {
                control = <AttestButton onAttest={onAttest} />
            } else if (refusedForGood) {
                // A timed safety pause that has run out: the turn can be narrated again.
                control = refusalHolds
                    ? <RefusedButton label={errorCopy(primaryError, t) ?? t('interaction.narration.unavailable')} />
                    : <RequestButton onClick={retry} />
            } else if (failedAll) {
                // Everything failed and nothing playable → offer a retry.
                const detail = errorCopy(primaryError, t)
                control = (
                    <IconButton
                        label={detail ? t('interaction.narration.failedRetryDetail', { detail }) : t('interaction.narration.failedRetry')}
                        size="sm"
                        tone="danger"
                        onClick={retry}
                    >
                        <Volume2 size={14} strokeWidth={1.75} />
                    </IconButton>
                )
            } else if (notices.length === 0) {
                control = <RequestButton onClick={onRequest} />
            }
        }
        if (!control && notices.length === 0) return null
        return (
            <span className="inline-flex flex-wrap items-center gap-1.5">
                {control}
                {noticeLines}
            </span>
        )
    }

    const position = queue.current === null ? -1 : clips.findIndex((clip) => clip.segment_index === queue.current)
    const active = queue.wantPlay && position >= 0
    const showPause = queue.phase === 'playing' || (queue.phase === 'waiting' && queue.wantPlay)
    const skippedNote = queue.skipped.length > 0 ? t('interaction.narration.skipped', { count: queue.skipped.length }) : null
    const caption = active ? `${clipLabel(clips[position], t)} · ${position + 1}/${clips.length}` : null

    return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
            {queue.phase === 'loading' ? (
                <Spinner label={t('interaction.narration.loading')} />
            ) : (
                <IconButton
                    label={showPause ? t('interaction.narration.pause') : playLabel}
                    size="sm"
                    tone={showPause ? 'active' : 'default'}
                    onClick={toggle}
                >
                    {showPause ? <Pause size={14} strokeWidth={1.75} /> : <Play size={14} strokeWidth={1.75} />}
                </IconButton>
            )}
            <AiVoiceBadge />
            <NarrationVoiceNotes
                clips={clips}
                onRefreshVoice={onRefreshVoice}
                onEditNarratorVoice={onEditNarratorVoice}
                refreshDisabled={refreshDisabled}
            />
            {canRequest && mode !== 'call' && !unavailable && !anyGenerating && (attest ? (
                <AttestButton onAttest={onAttest} />
            ) : retryCount > 0 && (
                <IconButton label={t('interaction.narration.retrySkipped', { count: retryCount })} size="sm" tone="danger" onClick={retry}>
                    <RotateCcw size={14} strokeWidth={1.75} />
                </IconButton>
            ))}
            {/* Polite live region: announces the clip in play and any skip, never interrupts. */}
            <span aria-live="polite" className="font-mono text-[10px] text-parchment-500">
                {caption}
                {skippedNote && (
                    <span className="text-blood-300">{caption ? ` · ${skippedNote}` : skippedNote}</span>
                )}
            </span>
            {noticeLines}
        </span>
    )
}
