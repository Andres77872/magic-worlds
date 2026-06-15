import { useCallback, useEffect, useRef, useState } from 'react'
import { apiService } from '@/infrastructure/api'
import { makeRequestId } from '@/utils/uuid'
import { voiceErrorCode } from '@/infrastructure/api/voiceSocket'
import type {
    VoiceCallLimits,
    VoiceCallState,
    VoiceErrorCategory,
    VoiceSegmentUploadRequest,
    VoiceSocketClientFrame,
    VoiceSocketServerFrame,
    VoiceVadSource,
} from '@/shared/types/voice.types'
import { VoicePlaybackBuffer } from '../audio/voicePlaybackBuffer'
import type { CapturedVoiceSegment } from '../audio/voiceVadWorklet'
import { isFrontendVoiceModeEnabled } from '@/shared/voiceFeatureFlag'
import { type MicrophoneCaptureApi, type MicrophoneCaptureStatus, type VoiceVadTuning, useMicrophoneCapture } from './useMicrophoneCapture'
import { type VoiceCallSocketApi, useVoiceCallSocket } from './useVoiceCallSocket'

type VoiceStartFrame = Extract<VoiceSocketClientFrame, { type: 'voice_start' }>
type VoiceErrorFrame = Extract<VoiceSocketServerFrame, { type: 'voice_error' }>
type VoiceReadyFrame = Extract<VoiceSocketServerFrame, { type: 'voice_ready' }>
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
    fatal?: boolean
}

export interface UseVoiceCallControllerOptions {
    sessionId: number | null
    authKey?: string | null
    consentGranted: boolean
    consentVersion?: string
    enabled?: boolean
    clientCallId?: string
    autoBargeIn?: boolean
    preferWorklet?: boolean
    vad?: VoiceVadTuning
    playbackBuffer?: VoicePlaybackBuffer
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
    error: VoiceCallControllerError | null
    uploadQueueDepth: number
    elapsedSeconds: number
    isMuted: boolean
    /** Live mic input level (0..1), throttled — drives the call waveform. */
    inputLevel: number
    /** False when the AudioWorklet VAD failed to load and capture degraded to time-sliced. */
    vadActive: boolean
    startCall: () => Promise<boolean>
    endCall: (reason?: 'user' | 'navigation' | 'permission_lost') => Promise<void>
    bargeIn: (reason?: 'button' | 'user_speech') => boolean
    mute: () => void
    unmute: () => void
}

/** How long to wait for the server's voice_ready after voice_start before surfacing an error. */
const VOICE_READY_TIMEOUT_MS = 15_000

const TERMINAL_ERROR_CATEGORIES = new Set<VoiceErrorCategory>([
    'disabled',
    'consent_required',
    'consent_stale',
    'quota_exceeded',
    'auth',
    'not_found',
])

export function useVoiceCallController(options: UseVoiceCallControllerOptions): VoiceCallControllerApi {
    const featureEnabled = options.enabled ?? isFrontendVoiceModeEnabled()
    const mountedRef = useRef(true)
    const stateRef = useRef<VoiceCallState>(featureEnabled ? 'idle' : 'disabled')
    const [state, setState] = useState<VoiceCallState>(stateRef.current)
    const [voiceSessionId, setVoiceSessionId] = useState<string | null>(null)
    const [activeTurnId, setActiveTurnId] = useState<string | null>(null)
    const [limits, setLimits] = useState<VoiceCallLimits | null>(null)
    const [transcript, setTranscript] = useState<string | null>(null)
    const [assistantText, setAssistantText] = useState('')
    const [error, setError] = useState<VoiceCallControllerError | null>(null)
    const [uploadQueueDepth, setUploadQueueDepth] = useState(0)
    const [elapsedSeconds, setElapsedSeconds] = useState(0)
    const [inputLevel, setInputLevel] = useState(0)
    const [vadActive, setVadActive] = useState(true)

    const clientCallIdRef = useRef(options.clientCallId ?? createClientCallId())
    const voiceSessionIdRef = useRef<string | null>(null)
    const activeTurnIdRef = useRef<string | null>(null)
    const lastAudioSeqRef = useRef<number>(0)
    const pendingSegmentsRef = useRef<CapturedVoiceSegment[]>([])
    const inFlightUploadsRef = useRef<Set<AbortController>>(new Set())
    const socketRef = useRef<VoiceCallSocketApi | null>(null)
    const captureRef = useRef<MicrophoneCaptureApi | null>(null)
    const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const callStartedAtRef = useRef<number | null>(null)
    const readyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const playbackRef = useRef<VoicePlaybackBuffer | null>(options.playbackBuffer ?? null)
    if (!playbackRef.current) playbackRef.current = new VoicePlaybackBuffer()

    const updateState = useCallback((next: VoiceCallState) => {
        stateRef.current = next
        if (mountedRef.current) setState(next)
    }, [])

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
        if (mountedRef.current) setError(next)
    }, [])

    const abortUploads = useCallback(() => {
        inFlightUploadsRef.current.forEach((controller) => controller.abort())
        inFlightUploadsRef.current.clear()
        pendingSegmentsRef.current = []
        updateUploadQueueDepth()
    }, [updateUploadQueueDepth])

    const stopLocalResources = useCallback((options?: { closeSocket?: boolean; disposePlayback?: boolean; cancelPlayback?: boolean }) => {
        captureRef.current?.stop()
        abortUploads()
        if (options?.cancelPlayback !== false) playbackRef.current?.cancel({
            voice_session_id: voiceSessionIdRef.current ?? undefined,
            turn_id: activeTurnIdRef.current ?? undefined,
        })
        if (options?.disposePlayback) playbackRef.current?.dispose()
        if (options?.closeSocket !== false) socketRef.current?.close()
        clearCallTimer()
        clearReadyTimeout()
    }, [abortUploads, clearCallTimer, clearReadyTimeout])

    const mapError = useCallback((unknownError: unknown, fallback: VoiceCallControllerError): VoiceCallControllerError => {
        if (typeof unknownError !== 'object' || unknownError === null) return fallback
        const raw = unknownError as { category?: unknown; message?: unknown; retryAfterSeconds?: unknown; retry_after_seconds?: unknown; fatal?: unknown }
        return {
            category: isVoiceErrorCategory(raw.category) ? raw.category : fallback.category,
            message: typeof raw.message === 'string' ? raw.message : fallback.message,
            retryAfterSeconds: typeof raw.retryAfterSeconds === 'number'
                ? raw.retryAfterSeconds
                : typeof raw.retry_after_seconds === 'number'
                  ? raw.retry_after_seconds
                  : fallback.retryAfterSeconds,
            fatal: typeof raw.fatal === 'boolean' ? raw.fatal : fallback.fatal,
        }
    }, [])

    const uploadSegment = useCallback(async (segment: CapturedVoiceSegment) => {
        const currentVoiceSessionId = voiceSessionIdRef.current
        const sessionId = options.sessionId
        if (!currentVoiceSessionId || sessionId === null) {
            pendingSegmentsRef.current.push(segment)
            updateUploadQueueDepth()
            return
        }

        updateState('uploading_segment')
        socketRef.current?.sendSegmentMeta({
            type: 'voice_segment_meta',
            voice_session_id: currentVoiceSessionId,
            seq: segment.seq,
            started_at_ms: segment.started_at_ms,
            duration_ms: segment.duration_ms,
            encoding: segment.encoding,
            sample_rate: segment.sample_rate,
            channels: segment.channels,
            byte_length: segment.byte_length,
            audio_sha256: segment.audio_sha256,
            vad: segment.vad,
        })

        const controller = new AbortController()
        inFlightUploadsRef.current.add(controller)
        updateUploadQueueDepth()
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
            vad: segment.vad,
            audio: segment.audio,
        }

        try {
            const response = await apiService.uploadVoiceSegment(sessionId, body, { signal: controller.signal })
            if (response.status === 'rejected') {
                setControllerError({ category: response.reason === 'no_speech' ? 'no_speech' : 'unsupported_media', message: response.reason ?? 'Voice segment was rejected.' })
                updateState(response.reason === 'no_speech' ? 'listening' : 'error')
            } else {
                updateState('transcribing')
            }
        } catch (uploadError) {
            if (controller.signal.aborted) return
            setControllerError(mapError(uploadError, { category: 'provider_submission', message: 'Voice segment upload failed.', fatal: false }))
            updateState('error')
        } finally {
            inFlightUploadsRef.current.delete(controller)
            updateUploadQueueDepth()
        }
    }, [mapError, options.sessionId, setControllerError, updateState, updateUploadQueueDepth])

    const flushPendingSegments = useCallback(() => {
        const pending = pendingSegmentsRef.current.splice(0)
        updateUploadQueueDepth()
        pending.forEach((segment) => {
            void uploadSegment(segment)
        })
    }, [updateUploadQueueDepth, uploadSegment])

    const handleReady = useCallback((frame: VoiceReadyFrame) => {
        clearReadyTimeout()
        voiceSessionIdRef.current = frame.voice_session_id
        setVoiceSessionId(frame.voice_session_id)
        setLimits(frame.limits)
        startCallTimer()
        updateState('listening')
        flushPendingSegments()
    }, [clearReadyTimeout, flushPendingSegments, startCallTimer, updateState])

    const handleSegmentAck = useCallback((frame: VoiceSegmentAckFrame) => {
        if (frame.status === 'rejected') {
            setControllerError({ category: frame.reason === 'no_speech' ? 'no_speech' : 'unsupported_media', message: frame.reason ?? 'Voice segment was rejected.' })
            updateState(frame.reason === 'no_speech' ? 'listening' : 'error')
            return
        }
        updateState('transcribing')
    }, [setControllerError, updateState])

    const handleTranscriptFinal = useCallback((frame: TranscriptFinalFrame) => {
        setTranscript(frame.text)
        updateState('assistant_thinking')
    }, [updateState])

    const handleTurnStart = useCallback((frame: VoiceTurnStartFrame) => {
        activeTurnIdRef.current = frame.turn_id
        setActiveTurnId(frame.turn_id)
        setAssistantText('')
        playbackRef.current?.startTurn(frame.voice_session_id, frame.turn_id)
        updateState('assistant_thinking')
    }, [updateState])

    const handleAudioChunk = useCallback((frame: VoiceAudioChunkFrame) => {
        activeTurnIdRef.current = frame.turn_id
        lastAudioSeqRef.current = Math.max(lastAudioSeqRef.current, frame.seq)
        setActiveTurnId(frame.turn_id)
        playbackRef.current?.appendChunk(frame)
        updateState('assistant_speaking')
    }, [updateState])

    const handleAudioFinal = useCallback((frame: VoiceAudioFinalFrame) => {
        lastAudioSeqRef.current = Math.max(lastAudioSeqRef.current, frame.last_seq)
        playbackRef.current?.finalize(frame)
    }, [])

    const handleTurnEnd = useCallback((frame: VoiceTurnEndFrame) => {
        if (frame.status === 'failed') {
            setControllerError({ category: 'internal', message: 'Voice turn failed.', fatal: false })
            updateState('error')
            return
        }
        activeTurnIdRef.current = null
        setActiveTurnId(null)
        updateState('listening')
    }, [setControllerError, updateState])

    const handleCancelled = useCallback((frame: VoiceCancelledFrame) => {
        playbackRef.current?.cancel(frame)
        activeTurnIdRef.current = null
        setActiveTurnId(null)
        updateState('listening')
    }, [updateState])

    const handleSocketError = useCallback((frame: VoiceErrorFrame) => {
        const nextError = {
            category: frame.category,
            code: frame.code || voiceErrorCode(frame.category),
            message: frame.message,
            retryAfterSeconds: frame.retry_after_seconds,
            fatal: frame.fatal,
        }
        setControllerError(nextError)
        updateState('error')
        if (frame.fatal || TERMINAL_ERROR_CATEGORIES.has(frame.category)) {
            stopLocalResources({ closeSocket: true })
        }
    }, [setControllerError, stopLocalResources, updateState])

    const handleEnded = useCallback((_frame: VoiceEndedFrame) => {
        stopLocalResources({ closeSocket: true })
        updateState('ended')
    }, [stopLocalResources, updateState])

    const handleVadState = useCallback((vadState: 'speech_start' | 'speech_end' | 'silence', _details?: { seq?: number; at_ms: number; rms?: number }) => {
        // NOTE: we intentionally do NOT send a `voice_vad` frame. The backend voice WS only
        // accepts voice_ping/barge_in/end/resume/segment_meta and answers any other frame with
        // a `conflict` ("Unsupported voice frame for this call state") — which would flip every
        // utterance into an error. Turns are driven by the uploaded segments; barge-in below
        // uses the supported `voice_barge_in` frame. Keep local state transitions only.
        if (vadState === 'speech_start') {
            if (stateRef.current === 'assistant_speaking' && options.autoBargeIn !== false) {
                const currentVoiceSessionId = voiceSessionIdRef.current
                if (currentVoiceSessionId) {
                    playbackRef.current?.cancel({ voice_session_id: currentVoiceSessionId, turn_id: activeTurnIdRef.current ?? undefined })
                    socketRef.current?.bargeIn({
                        type: 'voice_barge_in',
                        voice_session_id: currentVoiceSessionId,
                        turn_id: activeTurnIdRef.current ?? undefined,
                        last_heard_audio_seq: lastAudioSeqRef.current || undefined,
                        reason: 'user_speech',
                    })
                    updateState('barge_in')
                }
            } else {
                updateState('user_speaking')
            }
        }
    }, [options.autoBargeIn, updateState])

    const handleCapturedSegment = useCallback((segment: CapturedVoiceSegment) => {
        // TEMP: client metrics use the SAME formula the server VAD checks, so this shows
        // exactly which gate fails (server needs rms>=0.012, peak>=0.025, dur>=250ms).
        console.info('[voice-call][SEG]', {
            rms: segment.vad.rms,
            peak: segment.vad.peak,
            speech_ms: segment.vad.speech_ms,
            silence_ms: segment.vad.silence_ms,
            duration_ms: segment.duration_ms,
            bytes: segment.byte_length,
            source: segment.vad.source,
        })
        void uploadSegment(segment)
    }, [uploadSegment])

    const socket = useVoiceCallSocket(options.sessionId, {
        onReady: handleReady,
        onSegmentAck: handleSegmentAck,
        onTranscriptFinal: handleTranscriptFinal,
        onTurnStart: handleTurnStart,
        onAssistantDelta: (frame) => setAssistantText((current) => `${current}${frame.content}`),
        onAudioChunk: handleAudioChunk,
        onAudioFinal: handleAudioFinal,
        onTurnEnd: handleTurnEnd,
        onCancelled: handleCancelled,
        onError: handleSocketError,
        onEnded: handleEnded,
    }, options.authKey)
    socketRef.current = socket

    const capture = useMicrophoneCapture({
        consentGranted: featureEnabled && options.consentGranted,
        onSegment: handleCapturedSegment,
        onVadState: handleVadState,
        onLevel: setInputLevel,
        onVadFallback: () => setVadActive(false),
        preferWorklet: options.preferWorklet,
        vad: options.vad,
    })
    captureRef.current = capture

    useEffect(() => {
        if (!featureEnabled) updateState('disabled')
        else if (stateRef.current === 'disabled') updateState('idle')
    }, [featureEnabled, updateState])

    const startCall = useCallback(async (): Promise<boolean> => {
        setControllerError(null)
        if (!featureEnabled) {
            updateState('disabled')
            return false
        }
        if (options.sessionId === null || options.authKey === null) {
            setControllerError({ category: 'auth', message: 'Authentication is required before starting a voice call.', fatal: true })
            updateState('error')
            return false
        }
        if (!options.consentGranted) {
            updateState('consent_required')
            return false
        }

        // Request browser microphone access immediately after the explicit consent
        // click. Do not put a network round-trip between the user gesture and
        // getUserMedia; backend consent is still saved before voice_start/segments.
        updateState('requesting_permission')
        const captureStarted = await captureRef.current?.start()
        if (!captureStarted) {
            const category = captureRef.current?.status === 'permission_denied'
                ? 'permission_denied'
                : 'unsupported_media'
            console.error(`[voice-call][${voiceErrorCode(category)}] microphone capture failed`, { status: captureRef.current?.status })
            setControllerError({ category, code: voiceErrorCode(category), message: category === 'permission_denied' ? 'Microphone permission was denied.' : 'Voice capture is not supported.', fatal: true })
            updateState(category === 'permission_denied' ? 'error' : 'error')
            return false
        }

        let consentVersion = options.consentVersion ?? 'voice-v1'
        try {
            const consent = await apiService.saveVoiceConsent(options.sessionId)
            consentVersion = consent.consent_version || consentVersion
            setLimits(consent.limits)
        } catch (consentError) {
            console.error('[voice-call][VOICE_CONSENT_REQUIRED] voice consent could not be saved', consentError)
            stopLocalResources({ closeSocket: true })
            setControllerError(mapError(consentError, { category: 'consent_required', code: 'VOICE_CONSENT_REQUIRED', message: 'Voice consent could not be saved.', fatal: true }))
            updateState('error')
            return false
        }

        // A fresh client_call_id per start makes every "Call" an unambiguously new call
        // (the backend supersedes any leftover active session). A caller-pinned id wins.
        clientCallIdRef.current = options.clientCallId ?? createClientCallId()
        console.info('[voice-call][CONNECTING] starting voice call', { sessionId: options.sessionId, clientCallId: clientCallIdRef.current })
        updateState('connecting')
        socketRef.current?.start(buildVoiceStartFrame({ consentVersion, clientCallId: clientCallIdRef.current }))
        // If voice_ready never arrives, captured segments queue silently and the call sits
        // on "Connecting/Listening" forever — surface an error instead of waiting endlessly.
        clearReadyTimeout()
        readyTimeoutRef.current = setTimeout(() => {
            if (!mountedRef.current || voiceSessionIdRef.current !== null) return
            console.error('[voice-call][VOICE_READY_TIMEOUT] voice service did not become ready in time')
            setControllerError({ category: 'internal', code: 'VOICE_READY_TIMEOUT', message: 'The voice service did not respond. Please try again.', fatal: false })
            stopLocalResources({ closeSocket: true })
            updateState('error')
        }, VOICE_READY_TIMEOUT_MS)
        return true
    }, [clearReadyTimeout, featureEnabled, mapError, options.authKey, options.clientCallId, options.consentGranted, options.consentVersion, options.sessionId, setControllerError, stopLocalResources, updateState])

    const endCall = useCallback(async (reason: 'user' | 'navigation' | 'permission_lost' = 'user') => {
        updateState('ending')
        const currentSessionId = options.sessionId
        const currentVoiceSessionId = voiceSessionIdRef.current
        socketRef.current?.end(reason)
        stopLocalResources({ closeSocket: true })
        voiceSessionIdRef.current = null
        activeTurnIdRef.current = null
        setVoiceSessionId(null)
        setActiveTurnId(null)
        if (currentSessionId !== null && currentVoiceSessionId) {
            try {
                await apiService.endVoiceCall(currentSessionId, { voiceSessionId: currentVoiceSessionId, reason })
            } catch {
                // Local teardown is mandatory even if the backend escape hatch fails.
            }
        }
        updateState('ended')
    }, [options.sessionId, stopLocalResources, updateState])

    const bargeIn = useCallback((reason: 'button' | 'user_speech' = 'button'): boolean => {
        const currentVoiceSessionId = voiceSessionIdRef.current
        if (!currentVoiceSessionId) return false
        playbackRef.current?.cancel({ voice_session_id: currentVoiceSessionId, turn_id: activeTurnIdRef.current ?? undefined })
        updateState('barge_in')
        return socketRef.current?.bargeIn({
            type: 'voice_barge_in',
            voice_session_id: currentVoiceSessionId,
            turn_id: activeTurnIdRef.current ?? undefined,
            last_heard_audio_seq: lastAudioSeqRef.current || undefined,
            reason,
        }) ?? false
    }, [updateState])

    const mute = useCallback(() => captureRef.current?.mute(), [])
    const unmute = useCallback(() => captureRef.current?.unmute(), [])

    useEffect(() => {
        const onAuthExpired = () => {
            setControllerError({ category: 'auth', message: 'Your session has expired. Please log in again.', fatal: true })
            stopLocalResources({ closeSocket: true })
            updateState('error')
        }
        window.addEventListener('auth:expired', onAuthExpired)
        return () => window.removeEventListener('auth:expired', onAuthExpired)
    }, [setControllerError, stopLocalResources, updateState])

    useEffect(() => {
        mountedRef.current = true
        return () => {
            mountedRef.current = false
            const currentSessionId = options.sessionId
            const currentVoiceSessionId = voiceSessionIdRef.current
            stopLocalResources({ closeSocket: true, disposePlayback: true })
            if (currentSessionId !== null && currentVoiceSessionId) {
                void apiService.endVoiceCall(currentSessionId, { voiceSessionId: currentVoiceSessionId, reason: 'navigation' }).catch(() => undefined)
            }
        }
    }, [options.sessionId, stopLocalResources])

    return {
        state,
        socketStatus: socket.socketStatus,
        micStatus: capture.status,
        voiceSessionId,
        activeTurnId,
        limits,
        transcript,
        assistantText,
        error,
        uploadQueueDepth,
        elapsedSeconds,
        isMuted: capture.isMuted,
        inputLevel,
        vadActive,
        startCall,
        endCall,
        bargeIn,
        mute,
        unmute,
    }
}

function buildVoiceStartFrame({ consentVersion, clientCallId }: { consentVersion: string; clientCallId: string }): VoiceStartFrame {
    const audioWorklet = canUseAudioWorklet()
    const mediaRecorder = typeof MediaRecorder !== 'undefined'
    const vadSource: VoiceVadSource = audioWorklet ? 'audio_worklet' : 'media_recorder'
    return {
        type: 'voice_start',
        client_call_id: clientCallId,
        consent_version: consentVersion,
        audio: {
            preferred_encoding: audioWorklet ? 'audio/wav;codec=pcm_s16le' : 'audio/webm;codecs=opus',
            sample_rate: 16000,
            channels: 1,
            vad: { source: vadSource, aggressiveness: 'balanced' },
        },
        capabilities: {
            media_source_mp3: typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported?.('audio/mpeg') === true,
            audio_worklet: audioWorklet,
            media_recorder: mediaRecorder,
        },
    }
}

function canUseAudioWorklet(): boolean {
    return Boolean((globalThis.AudioContext || (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) && typeof AudioWorkletNode !== 'undefined')
}

function createClientCallId(): string {
    return makeRequestId('voice')
}

function isVoiceErrorCategory(value: unknown): value is VoiceErrorCategory {
    return typeof value === 'string' && [
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
    ].includes(value)
}
