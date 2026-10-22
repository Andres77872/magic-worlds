import { useFeatureFlags } from '@/shared/hooks/useFeatureFlags'
import { prepareLlmDispatch } from '@/infrastructure/api/llmPreparation'
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import { makeRequestId } from '@/utils/uuid'
import { isSessionPersonaError } from '@/utils/characterRoles'
import { i18n } from '@/app/i18n'
import { registerActiveVoiceCall } from '@/features/call/activeVoiceCall'
import { reduceLiveTranscript, type LiveTranscriptLine } from '@/features/call/liveTranscript'
import { VOICE_CLIENT_METRICS_VERSION, VOICE_PROTOCOL_VERSION, readClientMetricsVersion, voiceErrorCode } from '@/infrastructure/api/voiceSocket'
import type {
    VoiceAudioFormat,
    VoiceCallLimits,
    VoiceCallState,
    VoiceEndReason,
    VoiceErrorCategory,
    VoiceSegmentUploadRequest,
    VoiceSegmentUploadResponse,
    VoiceSocketClientFrame,
    VoiceSocketServerFrame,
} from '@/shared/types/voice.types'
import type { EffectiveVoice, VoiceSubstitutionReason } from '@/shared/types/voiceCatalog.types'
import type { StoredCharacterVoice } from '@/shared/types/voicePreset.types'
import { isSubstitutionReason, readEffectiveVoice } from '@/shared/voice/effectiveVoice'
import { VoicePlaybackBuffer, type VoicePlaybackState } from '../audio/voicePlaybackBuffer'
import { DEFAULT_CALL_AUDIO_FORMAT, isPlayableCallChunk } from '../audio/audioFormat'
import type { CapturedVoiceSegment } from '../audio/voiceVadWorklet'
import { segmentUploadVad } from '../audio/speechEndLag'
import { CallPlaybackTiming, type CallTimelineContext } from '../audio/callPlaybackTiming'
import { isCallsFeatureEnabled } from '@/shared/featureFlags'
import { type MicrophoneCaptureApi, type MicrophoneCaptureStatus, type VoiceVadTuning, useMicrophoneCapture } from './useMicrophoneCapture'
import { type VoiceCallSocketApi, useVoiceCallSocket } from './useVoiceCallSocket'
import { useSessionWorkspace } from './useSessionWorkspace'
import { useAttestation } from '@/features/legal/attestation/attestationContext'
import type { VoiceSocketStatus } from '@/infrastructure/api'

type VoiceStartFrame = Extract<VoiceSocketClientFrame, { type: 'voice_start' }>
type VoiceErrorFrame = Extract<VoiceSocketServerFrame, { type: 'voice_error' }>
type VoiceReadyFrame = Extract<VoiceSocketServerFrame, { type: 'voice_ready' }>
type VoiceStateSnapshotFrame = Extract<VoiceSocketServerFrame, { type: 'voice_state_snapshot' }>
type VoiceSegmentAckFrame = Extract<VoiceSocketServerFrame, { type: 'voice_segment_ack' }>
type TranscriptFinalFrame = Extract<VoiceSocketServerFrame, { type: 'transcript_final' }>
type VoiceTurnStartFrame = Extract<VoiceSocketServerFrame, { type: 'voice_turn_start' }>
type VoiceAudioChunkFrame = Extract<VoiceSocketServerFrame, { type: 'voice_audio_chunk' }>
type VoiceAudioFinalFrame = Extract<VoiceSocketServerFrame, { type: 'voice_audio_final' }>
type VoiceTurnEndFrame = Extract<VoiceSocketServerFrame, { type: 'voice_turn_end' }>
type VoiceCancelledFrame = Extract<VoiceSocketServerFrame, { type: 'voice_cancelled' }>
type VoiceEndedFrame = Extract<VoiceSocketServerFrame, { type: 'voice_ended' }>

export interface VoiceCallControllerError {
    category: VoiceErrorCategory
    /** Stable, traceable code (e.g. VOICE_BUSY) — matches the backend + console logs. */
    code?: string
    message: string
    retryAfterSeconds?: number
    /** Fatal errors end the call; non-fatal ones are transient notices that clear themselves. */
    fatal?: boolean
}

export interface UseVoiceCallControllerOptions {
    sessionId: number | null
    /**
     * Workspace R1: the chat's own workspace (`chat.organization.workspace_id`);
     * omitted, the workspace committed when the call screen opened. Consent,
     * segments, the socket and the end request all stay in it.
     */
    workspaceId?: string | null
    /** Create a draft chat after consent and successful microphone access. */
    ensureSession?: () => Promise<number>
    authKey?: string | null
    consentGranted: boolean
    consentVersion?: 'voice-v2' | 'voice-v3'
    enabled?: boolean
    clientCallId?: string
    autoBargeIn?: boolean
    vad?: VoiceVadTuning
    playbackBuffer?: VoicePlaybackBuffer
    /** The voice picked for this call only (sent on `voice_start`); null/absent: the chat's voice. */
    callVoice?: StoredCharacterVoice | null
}

export interface VoiceCallControllerApi {
    state: VoiceCallState
    socketStatus: VoiceCallSocketApi['socketStatus']
    micStatus: MicrophoneCaptureStatus
    voiceSessionId: string | null
    activeTurnId: string | null
    limits: VoiceCallLimits | null
    transcript: string | null
    assistantText: string
    /** The running transcript of this call (final user lines + streamed replies), oldest first. */
    transcriptLines: readonly LiveTranscriptLine[]
    error: VoiceCallControllerError | null
    /** Why the call ended (server `voice_ended.reason`, or `user`), once it has. */
    endReason: VoiceEndReason | null
    uploadQueueDepth: number
    elapsedSeconds: number
    /** Seconds until the server's max call length, once the call is live. */
    remainingSeconds: number | null
    isMuted: boolean
    /** Live mic input level (0..1), throttled — drives the call waveform. */
    inputLevel: number
    /** The browser blocked autoplay; `resumePlayback` must run from a user gesture. */
    autoplayBlocked: boolean
    /** Echo cancellation is off, so auto barge-in is disabled (speakers would trigger it). */
    echoCancellationOff: boolean
    /** WS-S1: the announced assistant audio (mp3 44.1 kHz when `voice_ready.audio` is missing). */
    audioFormat: VoiceAudioFormat | null
    /** WS-S1: the voice the call speaks with. */
    effectiveVoice: EffectiveVoice | null
    /** WS-S1: the card voice's name when it was replaced, else null. */
    originalVoiceName: string | null
    /** WS-S2: the substitution reason the reply chunks carry, else null. */
    substitutionReason: VoiceSubstitutionReason | null
    /** R1-BE-04: the substitute a mid-call swap speaks with (`voice_audio_chunk.voice_name`), else null. */
    replacedVoiceName: string | null
    /** The current reply's audio could not be played (unsupported format): it shows as text. */
    audioUnsupported: boolean
    startCall: () => Promise<boolean>
    endCall: () => Promise<void>
    bargeIn: () => boolean
    mute: () => void
    unmute: () => void
    resumePlayback: () => Promise<void>
    dismissError: () => void
}

/** How long to wait for the server's voice_ready after voice_start before surfacing an error. */
const VOICE_READY_TIMEOUT_MS = 15_000
/**
 * Segment cap until the server advertises its own (`max_segment_duration_ms`, 30 s by default,
 * so 29.5 s after SEGMENT_LIMIT_MARGIN_MS); builds that advertise none reject > 8 s.
 */
const DEFAULT_MAX_SEGMENT_MS = 7_500
/** Headroom below the server's max segment length (trailing silence, timing jitter). */
const SEGMENT_LIMIT_MARGIN_MS = 500
/**
 * While the character is audible, require more voiced speech before it counts as
 * an interruption, so short backchannels ("mm-hm") and echo don't cut it off
 * (LiveKit's min interruption duration is 0.5 s).
 */
const BARGE_IN_MIN_SPEECH_MS = 500
/**
 * Echo cancellation needs a moment to converge on the character's voice, so the
 * first seconds of the call's first reply never auto-interrupt (LiveKit
 * `aec_warmup_duration`). The manual Interrupt button always works.
 */
const AEC_WARMUP_MS = 3_000
const DEFAULT_MIN_SPEECH_MS = 250
/** A barge-in the server never confirms (no turn was active) stops showing after this. */
const BARGE_IN_SETTLE_MS = 2_000
/** Non-fatal notices clear themselves after this long. */
const NOTICE_TTL_MS = 8_000
/** WS-C2 playback progress cadence while a reply plays (R-22). */
const PLAYBACK_PROGRESS_MS = 500
/** Spacing between queued pre-ready uploads so they reach the server in order. */
const QUEUED_UPLOAD_SPACING_MS = 120
/** Pause before the one resend of an upload that failed at the network level. */
const UPLOAD_RETRY_DELAY_MS = 300
/**
 * The worklet reports the mic level ~30×/s; re-rendering the call screen that often is
 * wasted work. Publish at most ~12×/s, and only when the level visibly changed.
 */
const LEVEL_UPDATE_INTERVAL_MS = 80
const LEVEL_UPDATE_EPSILON = 0.02

const TERMINAL_ERROR_CATEGORIES = new Set<VoiceErrorCategory>([
    'disabled',
    'consent_required',
    'consent_stale',
    'quota_exceeded',
    'auth',
    'not_found',
])

/**
 * `voice_error{code:'attestation_required'}` (D26): the call start is the socket
 * handshake, so no 428 is possible. Terminal by code whatever the category; the
 * attestation prompt opens and the user starts the call again (09 §2.2, §4.6).
 */
const ATTESTATION_REQUIRED_CODE = 'attestation_required'

/** Rejection reasons that just mean "nothing intelligible was said" — never shown. */
const SILENT_REJECTIONS = new Set(['no_speech', 'too_short'])

/** Lifecycles in which the call holds (or may soon hold) a server call and its quota. */
const REGISTERED_LIFECYCLES = new Set<string>(['requesting_permission', 'connecting', 'live', 'ending'])
/** A call that is starting or running and that nothing is ending yet. */
const ACTIVE_LIFECYCLES = new Set<string>(['requesting_permission', 'connecting', 'live'])

type CallLifecycle =
    | 'disabled'
    | 'idle'
    | 'consent_required'
    | 'requesting_permission'
    | 'connecting'
    | 'live'
    | 'ending'
    | 'ended'
    | 'error'

/** Server-side progress of the latest user turn. */
type TurnPhase = 'none' | 'uploading' | 'transcribing' | 'thinking' | 'streaming'

interface DerivedStateInput {
    lifecycle: CallLifecycle
    reconnecting: boolean
    bargingIn: boolean
    userSpeaking: boolean
    playback: VoicePlaybackState['status']
    turnPhase: TurnPhase
}

/**
 * The visible call state, derived from independent sources instead of being set
 * imperatively by each frame: "speaking" follows actual playback (not server
 * frames), so a late HTTP response or `voice_turn_end` can never flip the UI to
 * "Transcribing" while the character is still audible.
 */
/** A stall mid-reply (after audio was heard in the same turn) still reads as playing. */
function audiblePlaybackStatus(
    status: VoicePlaybackState['status'],
    turnId: string | null,
    audibleTurnId: string | null,
): VoicePlaybackState['status'] {
    return status === 'buffering' && audibleTurnId !== null && audibleTurnId === turnId ? 'playing' : status
}

export function deriveVoiceCallState(input: DerivedStateInput): VoiceCallState {
    if (input.lifecycle !== 'live') return input.lifecycle
    if (input.reconnecting) return 'reconnecting'
    if (input.bargingIn) return 'barge_in'
    if (input.playback === 'playing' || input.playback === 'blocked') return 'assistant_speaking'
    if (input.userSpeaking) return 'user_speaking'
    switch (input.turnPhase) {
        case 'uploading':
            return 'uploading_segment'
        case 'transcribing':
            return 'transcribing'
        case 'thinking':
        case 'streaming':
            return 'assistant_thinking'
        case 'none':
            return input.playback === 'buffering' ? 'assistant_thinking' : 'listening'
    }
}

export function useVoiceCallController(options: UseVoiceCallControllerOptions): VoiceCallControllerApi {
    useFeatureFlags()
    const [createdSessionId, setCreatedSessionId] = useState<number | null>(null)
    const sessionId = createdSessionId ?? options.sessionId
    const sessionIdRef = useRef(sessionId)
    useEffect(() => { sessionIdRef.current = sessionId }, [sessionId])
    const optionsRef = useRef(options)
    useEffect(() => { optionsRef.current = options })
    const featureEnabled = isCallsFeatureEnabled() && (options.enabled ?? true)
    const mountedRef = useRef(true)
    // Workspace R1: every request of this call rides the chat's own workspace.
    const callWorkspace = useSessionWorkspace(options.workspaceId)
    const apiRef = useRef(callWorkspace.api)
    const workspaceIdRef = useRef(callWorkspace.workspaceId)
    // D26: null outside the attestation provider (isolated renders and tests).
    const attestation = useAttestation()
    const attestationRef = useRef(attestation)
    useEffect(() => { attestationRef.current = attestation }, [attestation])
    useEffect(() => {
        apiRef.current = callWorkspace.api
        workspaceIdRef.current = callWorkspace.workspaceId
    }, [callWorkspace.api, callWorkspace.workspaceId])
    /** An end the server has not acknowledged yet (keeps the call registered for a retry). */
    const pendingEndRef = useRef<{ sessionId: number; voiceSessionId: string } | null>(null)
    const registrationRef = useRef<(() => void) | null>(null)
    const endForSwitchRef = useRef<() => Promise<void>>(async () => undefined)

    const lifecycleRef = useRef<CallLifecycle>(featureEnabled ? 'idle' : 'disabled')
    const turnPhaseRef = useRef<TurnPhase>('none')
    const userSpeakingRef = useRef(false)
    const playbackStatusRef = useRef<VoicePlaybackState['status']>('idle')
    const playbackTurnIdRef = useRef<string | null>(null)
    /** Turn whose audio has actually been heard; a later stall in that turn is still "speaking". */
    const audibleTurnIdRef = useRef<string | null>(null)
    const bargingInRef = useRef(false)
    const reconnectingRef = useRef(false)
    const stateRef = useRef<VoiceCallState>(featureEnabled ? 'idle' : 'disabled')

    const [state, setState] = useState<VoiceCallState>(featureEnabled ? 'idle' : 'disabled')
    const [lifecycle, setLifecycleState] = useState<CallLifecycle>(featureEnabled ? 'idle' : 'disabled')
    const [voiceSessionId, setVoiceSessionId] = useState<string | null>(null)
    const [activeTurnId, setActiveTurnId] = useState<string | null>(null)
    const [limits, setLimits] = useState<VoiceCallLimits | null>(null)
    const [transcript, setTranscript] = useState<string | null>(null)
    const [assistantText, setAssistantText] = useState('')
    const [transcriptLines, dispatchTranscript] = useReducer(reduceLiveTranscript, [])
    const [error, setError] = useState<VoiceCallControllerError | null>(null)
    const [endReason, setEndReason] = useState<VoiceEndReason | null>(null)
    const [uploadQueueDepth, setUploadQueueDepth] = useState(0)
    const [elapsedSeconds, setElapsedSeconds] = useState(0)
    const [inputLevel, setInputLevel] = useState(0)
    const lastLevelRef = useRef({ value: 0, at: 0 })
    const [autoplayBlocked, setAutoplayBlocked] = useState(false)
    // R1 call audio (WS-S1/S2): set from `voice_ready`.
    const [audioFormat, setAudioFormat] = useState<VoiceAudioFormat | null>(null)
    const [effectiveVoice, setEffectiveVoice] = useState<EffectiveVoice | null>(null)
    const [originalVoiceName, setOriginalVoiceName] = useState<string | null>(null)
    const [substitutionReason, setSubstitutionReason] = useState<VoiceSubstitutionReason | null>(null)
    const [replacedVoiceName, setReplacedVoiceName] = useState<string | null>(null)
    const [audioUnsupported, setAudioUnsupported] = useState(false)
    const unsupportedTurnRef = useRef<string | null>(null)
    /** The turn whose reply text `assistantText` shows (captions are cut to `kept_chars` on truncation). */
    const captionTurnIdRef = useRef<string | null>(null)
    const playbackProgressRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const clientCallIdRef = useRef(options.clientCallId ?? createClientCallId())
    const voiceSessionIdRef = useRef<string | null>(null)
    const activeTurnIdRef = useRef<string | null>(null)
    const pendingSegmentsRef = useRef<CapturedVoiceSegment[]>([])
    const inFlightUploadsRef = useRef<Map<number, AbortController>>(new Map())
    const profilePreparationRef = useRef<AbortController | null>(null)
    const handledRejectionsRef = useRef<Set<number>>(new Set())
    const serverTurnActiveRef = useRef(false)
    /** Turn id the server is currently working on (from transcript_final / turn_start). */
    const serverTurnIdRef = useRef<string | null>(null)
    const socketRef = useRef<VoiceCallSocketApi | null>(null)
    const captureRef = useRef<MicrophoneCaptureApi | null>(null)
    const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const callStartedAtRef = useRef<number | null>(null)
    const readyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const errorRef = useRef<VoiceCallControllerError | null>(null)
    const bargeInTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const wakeLockRef = useRef<WakeLockSentinel | null>(null)
    const firstPlaybackAtRef = useRef<number | null>(null)
    const playbackRef = useRef<VoicePlaybackBuffer | null>(null)
    /** This call's `voice_ready` advertised `voice_turn_client_metrics` v1 (protocol v2); reset per call. */
    const clientMetricsRef = useRef(false)
    /**
     * Speech onset (`performance.now()`) of the utterance in progress: the VAD `speech_start`
     * dated back by its `onset_lag_ms`. An auto barge-in's onset.
     */
    const speechStartAtRef = useRef<number | null>(null)
    const playbackTimingRef = useRef(new CallPlaybackTiming())

    // The turn timeline reads the live player, capture and socket, so it is wired once mounted.
    useEffect(() => {
        playbackTimingRef.current = new CallPlaybackTiming(undefined, {
            // R01: one record per settled turn, best-effort, only to a server that advertised it
            // and only on the call the turn belongs to.
            onTurnMetrics: (frame, turnVoiceSessionId) => {
                if (!clientMetricsRef.current || turnVoiceSessionId !== voiceSessionIdRef.current) return
                socketRef.current?.turnMetrics?.(frame)
            },
            playedMs: (_voiceSessionId, turnId) => playbackRef.current?.playedMs?.(turnId),
            callContext: () => readCallContext(captureRef.current),
        })
    }, [])

    // The buffer is owned per mount: unmount disposes it (detaching its audio events),
    // so a StrictMode re-mount must get a fresh one or "speaking" would never fire.
    useEffect(() => {
        const buffer = optionsRef.current.playbackBuffer ?? new VoicePlaybackBuffer()
        playbackRef.current = buffer
        return () => {
            buffer.dispose()
            if (playbackRef.current === buffer) playbackRef.current = null
        }
    }, [])

    const recompute = useCallback(() => {
        const next = deriveVoiceCallState({
            lifecycle: lifecycleRef.current,
            reconnecting: reconnectingRef.current,
            bargingIn: bargingInRef.current,
            userSpeaking: userSpeakingRef.current,
            playback: audiblePlaybackStatus(playbackStatusRef.current, playbackTurnIdRef.current, audibleTurnIdRef.current),
            turnPhase: turnPhaseRef.current,
        })
        if (next === stateRef.current) return
        stateRef.current = next
        if (mountedRef.current) setState(next)
    }, [])

    /** Keep the tab's active-call registration in step with the lifecycle (see `activeVoiceCall`). */
    const syncCallRegistration = useCallback(() => {
        const holdsCall = REGISTERED_LIFECYCLES.has(lifecycleRef.current) || pendingEndRef.current !== null
        if (holdsCall && !registrationRef.current && mountedRef.current) {
            registrationRef.current = registerActiveVoiceCall({
                workspaceId: workspaceIdRef.current,
                end: () => endForSwitchRef.current(),
            })
        } else if (!holdsCall && registrationRef.current) {
            registrationRef.current()
            registrationRef.current = null
        }
    }, [])

    const setLifecycle = useCallback((next: CallLifecycle) => {
        lifecycleRef.current = next
        if (mountedRef.current) setLifecycleState(next)
        recompute()
        syncCallRegistration()
    }, [recompute, syncCallRegistration])

    const setTurnPhase = useCallback((next: TurnPhase) => {
        turnPhaseRef.current = next
        recompute()
    }, [recompute])

    /** Settle the turn phase once nothing is uploading and no server turn is running. */
    const settleTurnPhase = useCallback(() => {
        if (inFlightUploadsRef.current.size === 0 && !serverTurnActiveRef.current) setTurnPhase('none')
    }, [setTurnPhase])

    const updateUploadQueueDepth = useCallback(() => {
        if (mountedRef.current) setUploadQueueDepth(pendingSegmentsRef.current.length + inFlightUploadsRef.current.size)
    }, [])

    const clearCallTimer = useCallback(() => {
        if (callTimerRef.current) {
            clearInterval(callTimerRef.current)
            callTimerRef.current = null
        }
    }, [])

    const clearReadyTimeout = useCallback(() => {
        if (readyTimeoutRef.current) {
            clearTimeout(readyTimeoutRef.current)
            readyTimeoutRef.current = null
        }
    }, [])

    const clearBargeIn = useCallback(() => {
        if (bargeInTimerRef.current) {
            clearTimeout(bargeInTimerRef.current)
            bargeInTimerRef.current = null
        }
        if (!bargingInRef.current) return
        bargingInRef.current = false
        recompute()
    }, [recompute])

    const startCallTimer = useCallback(() => {
        clearCallTimer()
        callStartedAtRef.current = Date.now()
        setElapsedSeconds(0)
        callTimerRef.current = setInterval(() => {
            if (mountedRef.current && callStartedAtRef.current !== null) {
                setElapsedSeconds(Math.max(0, Math.floor((Date.now() - callStartedAtRef.current) / 1000)))
            }
        }, 1000)
    }, [clearCallTimer])

    const setControllerError = useCallback((next: VoiceCallControllerError | null) => {
        if (noticeTimerRef.current) {
            clearTimeout(noticeTimerRef.current)
            noticeTimerRef.current = null
        }
        errorRef.current = next
        if (mountedRef.current) setError(next)
        if (next && !next.fatal) {
            noticeTimerRef.current = setTimeout(() => {
                noticeTimerRef.current = null
                if (errorRef.current === next) errorRef.current = null
                if (mountedRef.current) setError((current) => (current === next ? null : current))
            }, NOTICE_TTL_MS)
        }
    }, [])

    /**
     * A failed turn arrives as a typed `voice_error`, then `voice_turn_end{failed}`, then the
     * upload's HTTP error. Keep the first (most specific) notice instead of a generic one.
     */
    const setNoticeUnlessShowing = useCallback((next: VoiceCallControllerError) => {
        if (errorRef.current) return
        setControllerError(next)
    }, [setControllerError])

    /** Drop a transient notice once the conversation visibly moves on. */
    const clearNotice = useCallback(() => {
        if (errorRef.current && !errorRef.current.fatal) errorRef.current = null
        if (mountedRef.current) setError((current) => (current && !current.fatal ? null : current))
    }, [])

    const acquireWakeLock = useCallback(async () => {
        if (wakeLockRef.current || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
        try {
            const sentinel = await navigator.wakeLock.request('screen')
            if (lifecycleRef.current === 'live' && mountedRef.current) {
                wakeLockRef.current = sentinel
                sentinel.addEventListener('release', () => {
                    if (wakeLockRef.current === sentinel) wakeLockRef.current = null
                })
            } else {
                void sentinel.release().catch(() => undefined)
            }
        } catch {
            // Wake lock is best-effort (denied in low-power mode, unsupported browsers).
        }
    }, [])

    const releaseWakeLock = useCallback(() => {
        const sentinel = wakeLockRef.current
        wakeLockRef.current = null
        if (sentinel) void sentinel.release().catch(() => undefined)
    }, [])

    const abortUploads = useCallback(() => {
        inFlightUploadsRef.current.forEach((controller) => controller.abort())
        inFlightUploadsRef.current.clear()
        pendingSegmentsRef.current = []
        updateUploadQueueDepth()
    }, [updateUploadQueueDepth])

    const stopPlaybackProgress = useCallback(() => {
        if (playbackProgressRef.current) {
            clearInterval(playbackProgressRef.current)
            playbackProgressRef.current = null
        }
    }, [])

    /** WS-C2: while a reply plays, report how much of it played every 500 ms. */
    const startPlaybackProgress = useCallback((turnId: string) => {
        stopPlaybackProgress()
        playbackProgressRef.current = setInterval(() => {
            const played = playbackRef.current?.playedMs?.(turnId)
            if (typeof played !== 'number') return
            socketRef.current?.playback?.(turnId, played)
            const currentVoiceSessionId = voiceSessionIdRef.current
            if (currentVoiceSessionId) recordTimeline(() => playbackTimingRef.current.progress(currentVoiceSessionId, turnId, played))
        }, PLAYBACK_PROGRESS_MS)
    }, [stopPlaybackProgress])

    const stopLocalResources = useCallback((stopOptions?: { closeSocket?: boolean; cancelPlayback?: boolean }) => {
        profilePreparationRef.current?.abort()
        profilePreparationRef.current = null
        // R01: turns still open are reported now, while the socket may still be open.
        recordTimeline(() => playbackTimingRef.current.flush(performance.now()))
        playbackTimingRef.current.clear()
        clientMetricsRef.current = false
        speechStartAtRef.current = null
        stopPlaybackProgress()
        captureRef.current?.stop()
        abortUploads()
        if (stopOptions?.cancelPlayback !== false) playbackRef.current?.cancel({
            voice_session_id: voiceSessionIdRef.current ?? undefined,
            turn_id: activeTurnIdRef.current ?? undefined,
        })
        if (stopOptions?.closeSocket !== false) socketRef.current?.close()
        clearCallTimer()
        clearReadyTimeout()
        clearBargeIn()
        releaseWakeLock()
        dispatchTranscript({ type: 'settle' })
        serverTurnActiveRef.current = false
        serverTurnIdRef.current = null
        userSpeakingRef.current = false
        reconnectingRef.current = false
        turnPhaseRef.current = 'none'
        // The call is over: nothing reaches its voice session any more — no segment of a
        // "Call again" upload, no second HTTP end at unmount (S-1). Callers that still need
        // the id (the end request) read it before calling this.
        voiceSessionIdRef.current = null
        if (mountedRef.current) setVoiceSessionId(null)
    }, [abortUploads, clearBargeIn, clearCallTimer, clearReadyTimeout, releaseWakeLock, stopPlaybackProgress])

    const mapError = useCallback((unknownError: unknown, fallback: VoiceCallControllerError): VoiceCallControllerError => {
        if (typeof unknownError !== 'object' || unknownError === null) return fallback
        const raw = unknownError as { category?: unknown; code?: unknown; message?: unknown; retryAfterSeconds?: unknown; retry_after_seconds?: unknown; fatal?: unknown }
        const serverCategory = isVoiceErrorCategory(raw.category) ? raw.category : null
        const category = serverCategory ?? fallback.category
        return {
            category,
            // A server-categorized error keeps its own code; the client fallback
            // code only labels failures the server never classified.
            code: typeof raw.code === 'string' ? raw.code : serverCategory ? voiceErrorCode(serverCategory) : fallback.code ?? voiceErrorCode(category),
            message: typeof raw.message === 'string' ? raw.message : fallback.message,
            retryAfterSeconds: typeof raw.retryAfterSeconds === 'number'
                ? raw.retryAfterSeconds
                : typeof raw.retry_after_seconds === 'number'
                  ? raw.retry_after_seconds
                  : fallback.retryAfterSeconds,
            fatal: typeof raw.fatal === 'boolean' ? raw.fatal : fallback.fatal,
        }
    }, [])

    /** Apply the server's segment limit to the running VAD. */
    const applySegmentLimit = useCallback((nextLimits: VoiceCallLimits | null | undefined) => {
        const max = nextLimits?.max_segment_duration_ms
        if (typeof max !== 'number' || !Number.isFinite(max) || max <= SEGMENT_LIMIT_MARGIN_MS * 2) return
        captureRef.current?.configure({ maxSegmentMs: max - SEGMENT_LIMIT_MARGIN_MS })
    }, [])

    const handleRejection = useCallback((seq: number, reason: string | undefined) => {
        if (handledRejectionsRef.current.has(seq)) return
        handledRejectionsRef.current.add(seq)
        if (!SILENT_REJECTIONS.has(reason ?? '')) {
            setControllerError({
                category: reason === 'quota' ? 'quota_exceeded' : 'unsupported_media',
                code: `VOICE_SEGMENT_${(reason ?? 'rejected').toUpperCase()}`,
                message: reason ?? 'Voice segment was rejected.',
                fatal: false,
            })
        }
        settleTurnPhase()
    }, [setControllerError, settleTurnPhase])

    const uploadSegment = useCallback(async (segment: CapturedVoiceSegment) => {
        const currentVoiceSessionId = voiceSessionIdRef.current
        const currentSessionId = sessionIdRef.current
        if (!currentVoiceSessionId || currentSessionId === null || reconnectingRef.current && lifecycleRef.current !== 'live') {
            pendingSegmentsRef.current.push(segment)
            updateUploadQueueDepth()
            return
        }

        socketRef.current?.noteSegmentSeq(segment.seq)
        const sentAtMs = performance.now()
        recordTimeline(() => playbackTimingRef.current.segmentSent(currentVoiceSessionId, segment.seq, segment.speech_end_perf_ms, sentAtMs))
        const controller = new AbortController()
        inFlightUploadsRef.current.set(segment.seq, controller)
        updateUploadQueueDepth()
        setTurnPhase('uploading')
        const body: VoiceSegmentUploadRequest = {
            voice_session_id: currentVoiceSessionId,
            client_call_id: clientCallIdRef.current,
            seq: segment.seq,
            started_at_ms: segment.started_at_ms,
            duration_ms: segment.duration_ms,
            encoding: segment.encoding,
            sample_rate: segment.sample_rate,
            channels: segment.channels,
            audio_sha256: segment.audio_sha256,
            // Measured at the first send; the one network resend below reuses this body.
            vad: segmentUploadVad(segment, { sentAtMs }),
            audio: segment.audio,
        }

        try {
            const api = apiRef.current
            if (!api) throw new Error('Voice call workspace is unavailable.')
            const send = async (request: VoiceSegmentUploadRequest): Promise<VoiceSegmentUploadResponse> => {
                try {
                    return await api.uploadVoiceSegment(currentSessionId, request, { signal: controller.signal })
                } catch (networkError) {
                    // fetch rejects with a TypeError when no response arrived (a dropped or
                    // stale connection). One resend is safe: the Idempotency-Key makes a
                    // segment the server already has a `duplicate`, never a second turn.
                    if (!(networkError instanceof TypeError) || controller.signal.aborted) throw networkError
                    await delay(UPLOAD_RETRY_DELAY_MS)
                    if (controller.signal.aborted || lifecycleRef.current !== 'live') throw networkError
                    return api.uploadVoiceSegment(currentSessionId, request, { signal: controller.signal })
                }
            }
            const response = await send(body)
            // `cancelled` means a newer utterance superseded this one (its words
            // were merged into that turn); `accepted`/`duplicate` turns are driven
            // by socket frames. Only rejections need handling here.
            if (response.status === 'rejected') handleRejection(segment.seq, response.reason)
        } catch (uploadError) {
            if (controller.signal.aborted || lifecycleRef.current !== 'live') return
            console.error('[voice-call][VOICE_UPLOAD_FAILED] voice segment upload failed', { seq: segment.seq })
            setNoticeUnlessShowing(mapError(uploadError, { category: 'provider_submission', code: 'VOICE_UPLOAD_FAILED', message: 'Voice segment upload failed.', fatal: false }))
        } finally {
            inFlightUploadsRef.current.delete(segment.seq)
            updateUploadQueueDepth()
            // The POST resolves only after the server turn finished, so with no
            // other upload in flight the turn is over even if a frame was lost.
            if (inFlightUploadsRef.current.size === 0) {
                serverTurnActiveRef.current = false
                serverTurnIdRef.current = null
                if (lifecycleRef.current === 'live') setTurnPhase('none')
            }
        }
    }, [handleRejection, mapError, setNoticeUnlessShowing, setTurnPhase, updateUploadQueueDepth])

    const flushPendingSegments = useCallback(async () => {
        const pending = pendingSegmentsRef.current.splice(0).sort((a, b) => a.seq - b.seq)
        updateUploadQueueDepth()
        // Sequential dispatch keeps arrival order == seq order; the server merges
        // an utterance that was split across segments into one turn.
        for (const [index, segment] of pending.entries()) {
            if (index > 0) await delay(QUEUED_UPLOAD_SPACING_MS)
            if (lifecycleRef.current !== 'live') return
            void uploadSegment(segment)
        }
    }, [updateUploadQueueDepth, uploadSegment])

    /** `bargeInOnsetMs`: the speech onset behind an automatic barge-in (none for the button). */
    const sendBargeIn = useCallback((bargeInOnsetMs?: number): boolean => {
        const currentVoiceSessionId = voiceSessionIdRef.current
        if (!currentVoiceSessionId) return false
        // WS-C1: name the interrupted turn and how much of it played, read before the
        // cancel resets the player. With no turn playing the frame is the bare one.
        const interruptedTurnId = activeTurnIdRef.current
        const frame: Extract<VoiceSocketClientFrame, { type: 'voice_barge_in' }> = { type: 'voice_barge_in', reason: 'barge_in' }
        if (interruptedTurnId) {
            frame.turn_id = interruptedTurnId
            const played = playbackRef.current?.playedMs?.(interruptedTurnId)
            if (typeof played === 'number' && Number.isFinite(played) && played >= 0) frame.played_ms = Math.round(played)
            recordTimeline(() => playbackTimingRef.current.interrupted(currentVoiceSessionId, interruptedTurnId, performance.now(), {
                playedMs: frame.played_ms,
                bargeInOnsetMs,
            }))
            dispatchTranscript({ type: 'assistant_interrupted', turnId: interruptedTurnId })
        }
        stopPlaybackProgress()
        playbackRef.current?.cancel({ voice_session_id: currentVoiceSessionId, turn_id: activeTurnIdRef.current ?? undefined })
        activeTurnIdRef.current = null
        if (mountedRef.current) setActiveTurnId(null)
        bargingInRef.current = true
        recompute()
        if (bargeInTimerRef.current) clearTimeout(bargeInTimerRef.current)
        bargeInTimerRef.current = setTimeout(() => {
            bargeInTimerRef.current = null
            bargingInRef.current = false
            recompute()
        }, BARGE_IN_SETTLE_MS)
        return socketRef.current?.bargeIn(frame) ?? false
    }, [recompute, stopPlaybackProgress])

    /** Interrupt the character when the user talks over audible playback. */
    const maybeAutoBargeIn = useCallback(() => {
        if (lifecycleRef.current !== 'live' || optionsRef.current.autoBargeIn === false) return
        const capture = captureRef.current
        // Without echo cancellation the character's own voice from the speakers
        // would trigger this — the manual Interrupt button still works.
        if (capture?.rawFallbackActive || capture?.echoCancellation === false) return
        // Only interrupt what the user can hear: buffering before the first audio is not speech yet.
        if (audiblePlaybackStatus(playbackStatusRef.current, playbackTurnIdRef.current, audibleTurnIdRef.current) !== 'playing') return
        const firstPlaybackAt = firstPlaybackAtRef.current
        if (firstPlaybackAt !== null && Date.now() - firstPlaybackAt < AEC_WARMUP_MS) return
        sendBargeIn(speechStartAtRef.current ?? undefined)
    }, [sendBargeIn])

    const handlePlaybackState = useCallback((playbackState: VoicePlaybackState) => {
        const previous = playbackStatusRef.current
        playbackStatusRef.current = playbackState.status
        playbackTurnIdRef.current = playbackState.turnId
        if (playbackState.status === 'playing') audibleTurnIdRef.current = playbackState.turnId
        else if (playbackState.status === 'idle') audibleTurnIdRef.current = null
        if (mountedRef.current) setAutoplayBlocked(playbackState.status === 'blocked')
        const stateTurnId = playbackState.turnId
        if (stateTurnId) {
            recordTimeline(() => playbackTimingRef.current.playbackState(
                playbackState,
                performance.now(),
                playbackState.status === 'playing' ? playbackRef.current?.playbackPath?.(stateTurnId) : undefined,
            ))
        }
        if (playbackState.status === 'playing' && playbackState.turnId) {
            if (previous !== 'playing' || !playbackProgressRef.current) startPlaybackProgress(playbackState.turnId)
        } else if (playbackState.status !== 'playing') {
            stopPlaybackProgress()
        }
        if (playbackState.status === 'playing' && previous !== 'playing') {
            firstPlaybackAtRef.current ??= Date.now()
            captureRef.current?.configure({ minSpeechMs: Math.max(BARGE_IN_MIN_SPEECH_MS, optionsRef.current.vad?.minSpeechMs ?? 0) })
            // Audio became audible while the user is mid-utterance: don't talk over them.
            if (userSpeakingRef.current) maybeAutoBargeIn()
        } else if (playbackState.status === 'idle' && previous !== 'idle') {
            captureRef.current?.configure({ minSpeechMs: optionsRef.current.vad?.minSpeechMs ?? DEFAULT_MIN_SPEECH_MS })
            if (!serverTurnActiveRef.current) {
                activeTurnIdRef.current = null
                if (mountedRef.current) setActiveTurnId(null)
            }
        }
        recompute()
    }, [maybeAutoBargeIn, recompute, startPlaybackProgress, stopPlaybackProgress])

    useEffect(() => playbackRef.current?.addStateListener(handlePlaybackState), [handlePlaybackState])
    // R01: element stalls of the playing turn.
    useEffect(() => playbackRef.current?.addMediaEventListener?.((event) => {
        recordTimeline(() => playbackTimingRef.current.mediaEvent(event.type, event.voiceSessionId, event.turnId, performance.now()))
    }), [])

    const handleReady = useCallback((frame: VoiceReadyFrame) => {
        clearReadyTimeout()
        // Protocol v2: a frame newer than v1 goes only to a server that advertised it.
        clientMetricsRef.current = readClientMetricsVersion(frame) === VOICE_CLIENT_METRICS_VERSION
        voiceSessionIdRef.current = frame.voice_session_id
        setVoiceSessionId(frame.voice_session_id)
        setLimits(frame.limits)
        applySegmentLimit(frame.limits)
        // WS-S1: every call announces its audio; a frame without it (an older BFF build)
        // plays the default mp3 44.1 kHz format.
        const announced = frame.audio && typeof frame.audio === 'object' ? frame.audio : DEFAULT_CALL_AUDIO_FORMAT
        playbackRef.current?.setAudioFormat?.(announced)
        setAudioFormat(announced)
        setEffectiveVoice(readEffectiveVoice(frame.effective_voice))
        setOriginalVoiceName(typeof frame.original_voice_name === 'string' && frame.original_voice_name.trim() ? frame.original_voice_name.trim() : null)
        // A new call (e.g. "Call again" on the same screen) starts with no chunk reason and no notice.
        setSubstitutionReason(null)
        setReplacedVoiceName(null)
        unsupportedTurnRef.current = null
        setAudioUnsupported(false)
        handledRejectionsRef.current.clear()
        startCallTimer()
        setLifecycle('live')
        void acquireWakeLock()
        void flushPendingSegments()
    }, [acquireWakeLock, applySegmentLimit, clearReadyTimeout, flushPendingSegments, setLifecycle, startCallTimer])

    const handleStateSnapshot = useCallback((frame: VoiceStateSnapshotFrame) => {
        // The call survived a dropped connection. Frames sent while we were away
        // are gone; if the server is back to listening, drop the half-played turn.
        reconnectingRef.current = false
        if (frame.state === 'listening' && (serverTurnActiveRef.current || playbackStatusRef.current !== 'idle')) {
            playbackRef.current?.cancel({ voice_session_id: frame.voice_session_id, turn_id: activeTurnIdRef.current ?? undefined })
            serverTurnActiveRef.current = false
            serverTurnIdRef.current = null
            activeTurnIdRef.current = null
            if (mountedRef.current) setActiveTurnId(null)
        }
        if (frame.state === 'listening') settleTurnPhase()
        recompute()
        void flushPendingSegments()
    }, [flushPendingSegments, recompute, settleTurnPhase])

    const handleSocketStatus = useCallback((status: VoiceSocketStatus) => {
        if (lifecycleRef.current !== 'live' || status !== 'connecting' || reconnectingRef.current) return
        reconnectingRef.current = true
        recompute()
    }, [recompute])

    const handleSegmentAck = useCallback((frame: VoiceSegmentAckFrame) => {
        recordTimeline(() => playbackTimingRef.current.segmentAcked(frame.voice_session_id, frame.seq, frame.status, performance.now()))
        if (frame.status === 'rejected') {
            handleRejection(frame.seq, frame.reason)
            return
        }
        if (turnPhaseRef.current === 'uploading') setTurnPhase('transcribing')
    }, [handleRejection, setTurnPhase])

    const handleTranscriptFinal = useCallback((frame: TranscriptFinalFrame) => {
        clearNotice()
        serverTurnActiveRef.current = true
        serverTurnIdRef.current = frame.turn_id
        setTranscript(frame.text)
        dispatchTranscript({ type: 'user_final', turnId: frame.turn_id, text: frame.text })
        setTurnPhase('thinking')
    }, [clearNotice, setTurnPhase])

    const handleTurnStart = useCallback((frame: VoiceTurnStartFrame) => {
        recordTimeline(() => playbackTimingRef.current.turnStarted(frame.voice_session_id, frame.turn_id, frame.segment_seq, performance.now()))
        serverTurnActiveRef.current = true
        serverTurnIdRef.current = frame.turn_id
        activeTurnIdRef.current = frame.turn_id
        setActiveTurnId(frame.turn_id)
        setAssistantText('')
        dispatchTranscript({ type: 'assistant_start', turnId: frame.turn_id })
        captionTurnIdRef.current = frame.turn_id
        if (unsupportedTurnRef.current !== null) {
            unsupportedTurnRef.current = null
            setAudioUnsupported(false)
        }
        playbackRef.current?.startTurn(frame.voice_session_id, frame.turn_id)
        setTurnPhase('thinking')
    }, [setTurnPhase])

    const handleAudioChunk = useCallback((frame: VoiceAudioChunkFrame) => {
        const playable = isPlayableCallChunk(frame)
        recordTimeline(() => playbackTimingRef.current.audioChunk(frame.voice_session_id, frame.turn_id, performance.now(), playable))
        // Every chunk carries the key (WS-S2): an explicit null (or a missing key) clears an earlier reason.
        const reason = isSubstitutionReason(frame.substitution_reason) ? frame.substitution_reason : null
        setSubstitutionReason((current) => (current === reason ? current : reason))
        // R1-BE-04: only the chunks after a mid-call swap name the substitute; read raw (not in the shared frame type).
        const rawName = (frame as { voice_name?: unknown }).voice_name
        const voiceName = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : null
        setReplacedVoiceName((current) => (current === voiceName ? current : voiceName))
        // A chunk the player cannot decode is dropped (by the buffer too): the reply stays as text.
        if (!playable) {
            if (unsupportedTurnRef.current !== frame.turn_id) {
                unsupportedTurnRef.current = frame.turn_id
                setAudioUnsupported(true)
            }
            return
        }
        // Chunks of a turn the user already interrupted are dropped by the buffer;
        // they must not resurrect the "speaking" state (or a second barge-in).
        if (!playbackRef.current?.appendChunk(frame)) return
        if (activeTurnIdRef.current !== frame.turn_id) {
            activeTurnIdRef.current = frame.turn_id
            setActiveTurnId(frame.turn_id)
        }
        if (turnPhaseRef.current !== 'streaming') setTurnPhase('streaming')
    }, [setTurnPhase])

    const handleAudioFinal = useCallback((frame: VoiceAudioFinalFrame) => {
        playbackRef.current?.finalize(frame)
    }, [])

    /** WS-S3/S4: the server cut the reply where playback stopped; the captions follow (code points, as the BFF counts). */
    const truncateCaption = useCallback((turnId: string | undefined, truncated: boolean | undefined, keptChars: number | undefined) => {
        if (truncated !== true || !turnId) return
        if (typeof keptChars !== 'number' || !Number.isInteger(keptChars) || keptChars < 0) return
        dispatchTranscript({ type: 'assistant_truncate', turnId, keptChars })
        if (turnId !== captionTurnIdRef.current) return
        setAssistantText((current) => {
            const points = Array.from(current)
            return points.length > keptChars ? points.slice(0, keptChars).join('') : current
        })
    }, [])

    const handleTurnEnd = useCallback((frame: VoiceTurnEndFrame) => {
        recordTimeline(() => playbackTimingRef.current.turnEnded(frame.voice_session_id, frame.turn_id, performance.now()))
        truncateCaption(frame.turn_id, frame.truncated, frame.kept_chars)
        dispatchTranscript({ type: 'assistant_end', turnId: frame.turn_id, status: frame.status })
        // The end of a turn that was already superseded must not settle the new one.
        if (serverTurnIdRef.current !== null && frame.turn_id !== serverTurnIdRef.current) return
        serverTurnActiveRef.current = false
        serverTurnIdRef.current = null
        clearBargeIn()
        if (frame.status === 'failed') {
            setNoticeUnlessShowing({ category: 'internal', code: 'VOICE_TURN_FAILED', message: 'Voice turn failed.', fatal: false })
        }
        settleTurnPhase()
    }, [clearBargeIn, setNoticeUnlessShowing, settleTurnPhase, truncateCaption])

    const handleCancelled = useCallback((frame: VoiceCancelledFrame) => {
        const cancelledTurnId = frame.turn_id
        if (cancelledTurnId) recordTimeline(() => playbackTimingRef.current.cancelled(frame.voice_session_id, cancelledTurnId, frame.reason, performance.now()))
        truncateCaption(frame.turn_id, frame.truncated, frame.kept_chars)
        if (frame.turn_id && (frame.reason === 'barge_in' || frame.truncated === true)) dispatchTranscript({ type: 'assistant_interrupted', turnId: frame.turn_id })
        playbackRef.current?.cancel(frame)
        if (!frame.turn_id || frame.turn_id === activeTurnIdRef.current) {
            activeTurnIdRef.current = null
            setActiveTurnId(null)
        }
        // The cancelled turn is over server-side; a superseding turn re-opens the
        // phase with its own transcript_final.
        if (!frame.turn_id || frame.turn_id === serverTurnIdRef.current) {
            serverTurnActiveRef.current = false
            serverTurnIdRef.current = null
        }
        clearBargeIn()
        settleTurnPhase()
        recompute()
    }, [clearBargeIn, recompute, settleTurnPhase, truncateCaption])

    const handleSocketError = useCallback((frame: VoiceErrorFrame) => {
        const nextError: VoiceCallControllerError = {
            category: frame.category,
            code: frame.code || voiceErrorCode(frame.category),
            message: frame.message,
            retryAfterSeconds: frame.retry_after_seconds,
            fatal: frame.fatal === true || TERMINAL_ERROR_CATEGORIES.has(frame.category) || frame.code === ATTESTATION_REQUIRED_CODE,
        }
        setControllerError(nextError)
        // No retry: the call ends, and the user restarts it after attesting.
        if (frame.code === ATTESTATION_REQUIRED_CODE) void attestationRef.current?.requestAttestation()
        if (nextError.fatal) {
            stopLocalResources({ closeSocket: true })
            setLifecycle('error')
            return
        }
        // A non-fatal error ends the current turn, never the call.
        serverTurnActiveRef.current = false
        serverTurnIdRef.current = null
        clearBargeIn()
        settleTurnPhase()
    }, [clearBargeIn, setControllerError, setLifecycle, settleTurnPhase, stopLocalResources])

    const handleEnded = useCallback((frame: VoiceEndedFrame) => {
        stopLocalResources({ closeSocket: true })
        if (mountedRef.current) setEndReason(frame.reason)
        setLifecycle('ended')
    }, [setLifecycle, stopLocalResources])

    const handleVadState = useCallback((vadState: 'speech_start' | 'speech_end' | 'silence', details?: { onset_lag_ms?: number }) => {
        // NOTE: we intentionally do NOT send a `voice_vad` frame. Turns are driven
        // by the uploaded segments (the server merges a split utterance); barge-in
        // uses the supported `voice_barge_in` frame. Keep local state only.
        if (vadState === 'speech_start') {
            userSpeakingRef.current = true
            // Announced only after `minSpeechMs` of speech: date the onset back to its first voiced frame.
            speechStartAtRef.current = performance.now() - (details?.onset_lag_ms ?? 0)
            maybeAutoBargeIn()
        } else {
            userSpeakingRef.current = false
        }
        recompute()
    }, [maybeAutoBargeIn, recompute])

    const handleCapturedSegment = useCallback((segment: CapturedVoiceSegment) => {
        if (import.meta.env.DEV) {
            // Client metrics use the SAME formula the server VAD checks, so this shows
            // exactly which gate fails (server needs rms>=0.012, peak>=0.025, dur>=250ms).
            console.info('[voice-call][SEG]', {
                seq: segment.seq,
                rms: segment.vad.rms,
                peak: segment.vad.peak,
                speech_ms: segment.vad.speech_ms,
                silence_ms: segment.vad.silence_ms,
                duration_ms: segment.duration_ms,
                bytes: segment.byte_length,
            })
        }
        void uploadSegment(segment)
    }, [uploadSegment])

    // Declared before the socket hook on purpose: React runs unmount cleanups in declaration
    // order, and the socket hook's closes the socket. Leaving the call screen reports the open
    // turns (R01) and ends the call over the socket as `navigation` (R02) while it is still open;
    // the unmount below still sends the HTTP end. A call already ending sent its own voice_end.
    useEffect(() => () => {
        if (!voiceSessionIdRef.current || lifecycleRef.current !== 'live') return
        recordTimeline(() => playbackTimingRef.current.flush(performance.now()))
        socketRef.current?.end('navigation')
    }, [])

    const socket = useVoiceCallSocket(sessionId, {
        onReady: handleReady,
        onStateSnapshot: handleStateSnapshot,
        onSocketStatus: handleSocketStatus,
        onSegmentAck: handleSegmentAck,
        onTranscriptFinal: handleTranscriptFinal,
        onTurnStart: handleTurnStart,
        onAssistantDelta: (frame) => {
            if (frame.turn_id !== activeTurnIdRef.current) return
            setAssistantText((current) => `${current}${frame.content}`)
            dispatchTranscript({ type: 'assistant_delta', turnId: frame.turn_id, content: frame.content })
        },
        onAudioChunk: handleAudioChunk,
        onAudioFinal: handleAudioFinal,
        onTurnEnd: handleTurnEnd,
        onCancelled: handleCancelled,
        onError: handleSocketError,
        onEnded: handleEnded,
    }, options.authKey, undefined, callWorkspace.workspaceId)

    const handleLevel = useCallback((level: number) => {
        const last = lastLevelRef.current
        const now = performance.now()
        const settled = level === 0 && last.value !== 0
        if (!settled && (now - last.at < LEVEL_UPDATE_INTERVAL_MS || Math.abs(level - last.value) < LEVEL_UPDATE_EPSILON)) return
        lastLevelRef.current = { value: level, at: now }
        if (mountedRef.current) setInputLevel(level)
    }, [])

    const capture = useMicrophoneCapture({
        consentGranted: featureEnabled && options.consentGranted,
        onSegment: handleCapturedSegment,
        onVadState: handleVadState,
        onLevel: handleLevel,
        vad: { maxSegmentMs: DEFAULT_MAX_SEGMENT_MS, ...options.vad },
    })
    // Callbacks read the latest hook APIs through refs; refresh them before any event runs.
    useLayoutEffect(() => {
        socketRef.current = socket
        captureRef.current = capture
    })
    const echoCancellationOff = capture.rawFallbackActive || capture.echoCancellation === false

    // Surface microphone failures that happen mid-call (no signal, device unplugged).
    useEffect(() => {
        if (lifecycleRef.current !== 'live') return
        if (capture.errorCode === 'no_input') {
            setControllerError({ category: 'unsupported_media', code: 'VOICE_NO_INPUT', message: 'No microphone signal detected.', fatal: false })
        } else if (capture.errorCode === 'device_lost') {
            setControllerError({ category: 'unsupported_media', code: 'VOICE_DEVICE_LOST', message: 'The microphone was disconnected.', fatal: false })
        }
    }, [capture.errorCode, setControllerError])

    useEffect(() => {
        if (!featureEnabled) setLifecycle('disabled')
        else if (lifecycleRef.current === 'disabled') setLifecycle('idle')
    }, [featureEnabled, setLifecycle])

    const startCall = useCallback(async (): Promise<boolean> => {
        // Still inside the click: let the audio element play later (iOS autoplay).
        playbackRef.current?.unlock()
        firstPlaybackAtRef.current = null
        setControllerError(null)
        setEndReason(null)
        setTranscript(null)
        setAssistantText('')
        dispatchTranscript({ type: 'reset' })
        if (!featureEnabled) {
            setLifecycle('disabled')
            return false
        }
        if ((sessionId === null && !options.ensureSession) || options.authKey === null) {
            setControllerError({ category: 'auth', message: 'Authentication is required before starting a voice call.', fatal: true })
            setLifecycle('error')
            return false
        }
        if (!options.consentGranted) {
            setLifecycle('consent_required')
            return false
        }

        // Request browser microphone access immediately after the explicit consent
        // click. Do not put a network round-trip between the user gesture and
        // getUserMedia; backend consent is still saved before voice_start/segments.
        // A new call supersedes any earlier one server-side.
        pendingEndRef.current = null
        setLifecycle('requesting_permission')
        const captureStarted = await captureRef.current?.start()
        // Ended (or switched away) while the permission prompt was open.
        if (lifecycleRef.current !== 'requesting_permission') {
            captureRef.current?.stop()
            return false
        }
        if (!captureStarted) {
            const category = captureRef.current?.status === 'permission_denied'
                ? 'permission_denied'
                : 'unsupported_media'
            console.error(`[voice-call][${voiceErrorCode(category)}] microphone capture failed`, { status: captureRef.current?.status })
            setControllerError({ category, code: voiceErrorCode(category), message: category === 'permission_denied' ? 'Microphone permission was denied.' : 'Voice capture is not supported.', fatal: true })
            setLifecycle('error')
            return false
        }

        let currentSessionId = sessionId
        try {
            const api = apiRef.current
            if (!api) throw new Error('Voice call workspace is unavailable.')
            if (currentSessionId === null) {
                currentSessionId = await options.ensureSession!()
                if (!mountedRef.current) { stopLocalResources({ closeSocket: true }); return false }
                sessionIdRef.current = currentSessionId
                setCreatedSessionId(currentSessionId)
            }
            // A 428 (D26) opens the attestation prompt and retries the consent once.
            const consentSessionId = currentSessionId
            const saveConsent = () => options.consentVersion === 'voice-v3'
                ? api.saveVoiceConsent(consentSessionId, { consentVersion: 'voice-v3' })
                : api.saveVoiceConsent(consentSessionId)
            const consent = await (attestationRef.current?.withAttestation(saveConsent) ?? saveConsent())
            if (!mountedRef.current || lifecycleRef.current !== 'requesting_permission') { stopLocalResources({ closeSocket: true }); return false }
            setLimits(consent.limits)
            applySegmentLimit(consent.limits)
        } catch (consentError) {
            stopLocalResources({ closeSocket: true })
            if (isSessionPersonaError(consentError)) {
                setControllerError({ category: 'conflict', code: 'SESSION_PERSONA_INVALID', message: i18n.t('ui.personaPicker.invalidPersona'), fatal: true })
            } else {
                console.error('[voice-call][VOICE_CONSENT_REQUIRED] voice consent could not be saved', consentError)
                setControllerError(mapError(consentError, { category: 'consent_required', code: 'VOICE_CONSENT_REQUIRED', message: 'Voice consent could not be saved.', fatal: true }))
            }
            setLifecycle('error')
            return false
        }

        const preparation = new AbortController()
        profilePreparationRef.current?.abort()
        profilePreparationRef.current = preparation
        let llm: VoiceStartFrame['llm']
        try {
            const materialize = await prepareLlmDispatch('callbot', preparation.signal)
            if (!mountedRef.current || lifecycleRef.current !== 'requesting_permission') return false
            const prepared = materialize()
            if (prepared.credentials) throw new Error('FEATURE_BYOK_DISABLED')
            llm = { selection: prepared.selection, expected_revision_id: prepared.expected_revision_id }
        } catch (profileError) {
            if (preparation.signal.aborted) return false
            stopLocalResources({ closeSocket: true })
            setControllerError(mapError(profileError, { category: 'provider_submission', code: 'call_model_unavailable', message: 'The call profile could not be verified.', fatal: true }))
            setLifecycle('error')
            return false
        } finally {
            if (profilePreparationRef.current === preparation) profilePreparationRef.current = null
        }

        // A fresh client_call_id per start makes every "Call" an unambiguously new call
        // (the backend supersedes any leftover active session). A caller-pinned id wins.
        clientCallIdRef.current = options.clientCallId ?? createClientCallId()
        voiceSessionIdRef.current = null
        setVoiceSessionId(null)
        clientMetricsRef.current = false
        console.info('[voice-call][CONNECTING] starting voice call', { sessionId: currentSessionId, clientCallId: clientCallIdRef.current })
        setLifecycle('connecting')
        socketRef.current?.start(buildVoiceStartFrame({ clientCallId: clientCallIdRef.current, voice: optionsRef.current.callVoice ?? null, llm }))
        // If voice_ready never arrives, captured segments queue silently and the call sits
        // on "Connecting" forever — surface an error instead of waiting endlessly.
        clearReadyTimeout()
        readyTimeoutRef.current = setTimeout(() => {
            if (!mountedRef.current || voiceSessionIdRef.current !== null) return
            console.error('[voice-call][VOICE_READY_TIMEOUT] voice service did not become ready in time')
            setControllerError({ category: 'internal', code: 'VOICE_READY_TIMEOUT', message: 'The voice service did not respond. Please try again.', fatal: true })
            stopLocalResources({ closeSocket: true })
            setLifecycle('error')
        }, VOICE_READY_TIMEOUT_MS)
        return true
    }, [applySegmentLimit, clearReadyTimeout, featureEnabled, mapError, options.authKey, options.clientCallId, options.consentGranted, options.consentVersion, options.ensureSession, sessionId, setControllerError, setLifecycle, stopLocalResources])

    /** Local teardown of a call the user (or a workspace switch) ends; false when it already ended. */
    const teardownForEnd = useCallback((): boolean => {
        if (lifecycleRef.current === 'ended' || lifecycleRef.current === 'ending') return false
        setLifecycle('ending')
        const currentSessionId = sessionIdRef.current
        const currentVoiceSessionId = voiceSessionIdRef.current
        if (currentSessionId !== null && currentVoiceSessionId) {
            pendingEndRef.current = { sessionId: currentSessionId, voiceSessionId: currentVoiceSessionId }
        }
        // R01: open turns are reported before `voice_end`, while the call still takes them.
        recordTimeline(() => playbackTimingRef.current.flush(performance.now()))
        socketRef.current?.end()
        stopLocalResources({ closeSocket: true })
        voiceSessionIdRef.current = null
        activeTurnIdRef.current = null
        if (mountedRef.current) {
            setVoiceSessionId(null)
            setActiveTurnId(null)
        }
        return true
    }, [setLifecycle, stopLocalResources])

    /** Confirm a pending end with the server (`ended` / `not_found` both mean the quota is released). */
    const acknowledgeEnd = useCallback(async () => {
        const pending = pendingEndRef.current
        if (pending) {
            const api = apiRef.current
            if (!api) throw new Error('Voice call workspace is unavailable.')
            await api.endVoiceCall(pending.sessionId, { voiceSessionId: pending.voiceSessionId, reason: 'user' }, { keepalive: true })
            if (pendingEndRef.current === pending) pendingEndRef.current = null
        }
        syncCallRegistration()
    }, [syncCallRegistration])

    const endCall = useCallback(async () => {
        if (!teardownForEnd()) return
        try {
            await acknowledgeEnd()
        } catch {
            // Local teardown is mandatory even if the backend escape hatch fails; the
            // unconfirmed end stays registered so a workspace switch retries it.
        }
        if (mountedRef.current) setEndReason('user')
        setLifecycle('ended')
    }, [acknowledgeEnd, setLifecycle, teardownForEnd])

    // The switch coordinator's end (`endActiveVoiceCall`): it must hear about a failed
    // acknowledgement, so unlike the End button it rethrows; calling it again retries.
    useEffect(() => {
        endForSwitchRef.current = async () => {
            if (teardownForEnd()) {
                if (mountedRef.current) setEndReason('user')
                setLifecycle('ended')
            }
            await acknowledgeEnd()
        }
    }, [acknowledgeEnd, setLifecycle, teardownForEnd])

    // A committed switch away from the call's workspace closes its socket; end the call
    // too (normally the coordinator already did, before committing).
    useEffect(() => {
        if (callWorkspace.active || !REGISTERED_LIFECYCLES.has(lifecycleRef.current)) return
        void endForSwitchRef.current().catch(() => undefined)
    }, [callWorkspace.active])

    const bargeIn = useCallback((): boolean => {
        if (lifecycleRef.current !== 'live') return false
        return sendBargeIn()
    }, [sendBargeIn])

    const mute = useCallback(() => captureRef.current?.mute(), [])
    const unmute = useCallback(() => captureRef.current?.unmute(), [])
    const resumePlayback = useCallback(async () => {
        await playbackRef.current?.resume()
    }, [])
    const dismissError = useCallback(() => setControllerError(null), [setControllerError])

    const endForLostAuth = useCallback(() => {
        setControllerError({ category: 'auth', message: 'Your session has expired. Please log in again.', fatal: true })
        stopLocalResources({ closeSocket: true })
        setLifecycle('error')
    }, [setControllerError, setLifecycle, stopLocalResources])

    useEffect(() => {
        const onAuthExpired = () => {
            if (lifecycleRef.current === 'idle' || lifecycleRef.current === 'ended' || lifecycleRef.current === 'disabled') return
            endForLostAuth()
        }
        window.addEventListener('auth:expired', onAuthExpired)
        return () => window.removeEventListener('auth:expired', onAuthExpired)
    }, [endForLostAuth])

    // Auth can also go away with no `auth:expired` event (sign-out, another tab). The socket
    // hook then closes the socket quietly, so the call ends here too instead of keeping the
    // mic, the wake lock and the uploads running (S-2).
    useEffect(() => {
        if (options.authKey !== null || !ACTIVE_LIFECYCLES.has(lifecycleRef.current)) return
        endForLostAuth()
    }, [endForLostAuth, options.authKey])

    // Mobile: keep the screen awake for the call, and end the call when the page
    // is torn down (tab close / navigation) with a request that outlives it.
    useEffect(() => {
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible' && lifecycleRef.current === 'live') void acquireWakeLock()
        }
        const onPageHide = () => {
            // Unloaded or frozen into the bfcache, the page keeps neither the mic nor the
            // socket, and nothing resumes a restored call: hang up either way (S-4). The end
            // request is a keepalive one, issued synchronously, so it outlives the page.
            if (!ACTIVE_LIFECYCLES.has(lifecycleRef.current)) return
            void endCall()
        }
        document.addEventListener('visibilitychange', onVisibilityChange)
        window.addEventListener('pagehide', onPageHide)
        return () => {
            document.removeEventListener('visibilitychange', onVisibilityChange)
            window.removeEventListener('pagehide', onPageHide)
        }
    }, [acquireWakeLock, endCall])

    useEffect(() => {
        mountedRef.current = true
        return () => {
            mountedRef.current = false
            const currentSessionId = sessionIdRef.current
            const currentVoiceSessionId = voiceSessionIdRef.current
            stopLocalResources({ closeSocket: true })
            if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
            if (currentSessionId !== null && currentVoiceSessionId) {
                void apiRef.current?.endVoiceCall(currentSessionId, { voiceSessionId: currentVoiceSessionId, reason: 'user' }, { keepalive: true }).catch(() => undefined)
            }
            registrationRef.current?.()
            registrationRef.current = null
        }
    }, [stopLocalResources])

    return {
        state,
        socketStatus: socket.socketStatus,
        micStatus: capture.status,
        voiceSessionId,
        activeTurnId,
        limits,
        transcript,
        assistantText,
        transcriptLines,
        error,
        endReason,
        uploadQueueDepth,
        elapsedSeconds,
        remainingSeconds: limits && lifecycle === 'live'
            ? Math.max(0, limits.max_call_seconds - elapsedSeconds)
            : null,
        isMuted: capture.isMuted,
        inputLevel,
        autoplayBlocked,
        echoCancellationOff,
        audioFormat,
        effectiveVoice,
        originalVoiceName,
        substitutionReason,
        replacedVoiceName,
        audioUnsupported,
        startCall,
        endCall,
        bargeIn,
        mute,
        unmute,
        resumePlayback,
        dismissError,
    }
}

function buildVoiceStartFrame({ clientCallId, voice, llm }: { clientCallId: string; voice: StoredCharacterVoice | null; llm: VoiceStartFrame['llm'] }): VoiceStartFrame {
    const audioWorklet = canUseAudioWorklet()
    return {
        type: 'voice_start',
        client_call_id: clientCallId,
        protocol_version: VOICE_PROTOCOL_VERSION,
        ...(voice ? { voice } : {}),
        llm,
        audio: {
            preferred_encoding: 'audio/wav;codec=pcm_s16le',
            sample_rate: 16000,
            channels: 1,
            vad: { source: 'audio_worklet', aggressiveness: 'balanced' },
        },
        capabilities: {
            media_source_mp3: canStreamMp3(),
            audio_worklet: audioWorklet,
            media_recorder: false,
        },
    }
}

function canStreamMp3(): boolean {
    const managed = (globalThis as typeof globalThis & { ManagedMediaSource?: typeof MediaSource }).ManagedMediaSource
    return [globalThis.MediaSource, managed].some((ctor) => typeof ctor !== 'undefined' && ctor.isTypeSupported?.('audio/mpeg') === true)
}

function canUseAudioWorklet(): boolean {
    return Boolean((globalThis.AudioContext || (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) && typeof AudioWorkletNode !== 'undefined')
}

function createClientCallId(): string {
    return makeRequestId('voice')
}

/** The capture facts a turn record carries (R01): echo cancellation and output latency. */
function readCallContext(capture: MicrophoneCaptureApi | null): CallTimelineContext {
    if (!capture) return { aec: 'unknown' }
    const aec = capture.rawFallbackActive || capture.echoCancellation === false
        ? 'off'
        : capture.echoCancellation === true ? 'on' : 'unknown'
    return { aec, outputLatencyMs: capture.outputLatencyMs?.() ?? null }
}

/** Turn-timeline telemetry (R01) never breaks call handling. */
function recordTimeline(record: () => void): void {
    try {
        record()
    } catch (error) {
        console.warn('[voice-call][METRICS] turn timeline update failed', error)
    }
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

const VOICE_ERROR_CATEGORIES = new Set<string>([
    'disabled',
    'consent_required',
    'consent_stale',
    'permission_denied',
    'quota_exceeded',
    'busy',
    'conflict',
    'unsupported_media',
    'no_speech',
    'stt_rate_limited',
    'stt_timeout',
    'stt_failed',
    'tts_unavailable',
    'tts_stream_interrupted',
    'tts_timeout',
    'llm_timeout',
    'provider_submission',
    'upstream_contract',
    'auth',
    'not_found',
    'internal',
])

function isVoiceErrorCategory(value: unknown): value is VoiceErrorCategory {
    return typeof value === 'string' && VOICE_ERROR_CATEGORIES.has(value)
}
