import { useCallback, useEffect, useRef, useState } from 'react'
import type { VoiceVadAggressiveness, VoiceVadSource } from '@/shared/types/voice.types'
import {
    type CapturedVoiceSegment,
    VOICE_VAD_PROCESSOR_NAME,
    VOICE_VAD_SAMPLE_RATE,
    type VoiceVadConfigureMessage,
    type VoiceVadProcessorOptions,
    type VoiceVadTuning,
    VoiceVadWorkletSegmenter,
    type VoiceVadWorkletMessage,
} from '../audio/voiceVadWorklet'

export type { VoiceVadTuning } from '../audio/voiceVadWorklet'

export type MicrophoneCaptureStatus =
    | 'idle'
    | 'consent_required'
    | 'requesting_permission'
    | 'capturing'
    | 'permission_denied'
    | 'unsupported'
    | 'error'

/** Machine-readable cause of `error` — localize from this, not from the message. */
export type MicrophoneCaptureErrorCode =
    | 'no_input'
    | 'permission_denied'
    | 'capture_failed'
    | 'unsupported'
    | 'segment_failed'
    | 'device_lost'

export interface UseMicrophoneCaptureOptions {
    consentGranted: boolean
    onSegment?: (segment: CapturedVoiceSegment) => void
    onVadState?: (state: 'speech_start' | 'speech_end' | 'silence', details?: { seq?: number; at_ms: number; rms?: number }) => void
    /** Live input level (0..1) — at most ~15 Hz and only on changes ≥ 0.02, so it can drive React state. */
    onLevel?: (level: number) => void
    aggressiveness?: VoiceVadAggressiveness
    vad?: VoiceVadTuning
}

export interface MicrophoneCaptureApi {
    status: MicrophoneCaptureStatus
    /** Developer-facing (English) description of the last failure. */
    error: string | null
    errorCode: MicrophoneCaptureErrorCode | null
    source: VoiceVadSource | null
    isMuted: boolean
    nextSeq: number
    /** The live track's `echoCancellation` setting; null before capture or when the browser doesn't report it. */
    echoCancellation: boolean | null
    /** True once the no-input watchdog restarted capture with raw constraints (echo cancellation off). */
    rawFallbackActive: boolean
    start: () => Promise<boolean>
    stop: () => void
    mute: () => void
    unmute: () => void
    /** Retunes the live VAD; remembered for the hook's lifetime so capture restarts re-apply it. */
    configure: (tuning: Partial<VoiceVadTuning>) => void
}

type BrowserAudioContext = typeof AudioContext

/** Safari's Audio Session API (not in the TS DOM lib yet). */
type NavigatorWithAudioSession = Navigator & { audioSession?: { type: string } }

function canUseAudioWorklet(): boolean {
    const AudioContextCtor = resolveAudioContext()
    return Boolean(AudioContextCtor && typeof AudioWorkletNode !== 'undefined')
}

function resolveAudioContext(): BrowserAudioContext | undefined {
    return globalThis.AudioContext ?? (globalThis as typeof globalThis & { webkitAudioContext?: BrowserAudioContext }).webkitAudioContext
}

/** Default processed capture (browser AEC/NS/AGC). Best for calls when it actually works. */
const PROCESSED_AUDIO_CONSTRAINTS: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
/** Raw capture — used as a fallback. On Linux+Chrome the WebRTC APM can hand back a
 *  live-but-silent stream; disabling AEC/NS/AGC recovers real mic audio. */
const RAW_AUDIO_CONSTRAINTS: MediaTrackConstraints = { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
/** How long after capture starts to confirm the worklet is actually receiving audio energy. */
const INPUT_LIVENESS_TIMEOUT_MS = 3_000
/** `onLevel` throttle: at most ~15 Hz, and only when the level moved noticeably. */
const LEVEL_EMIT_INTERVAL_MS = 1_000 / 15
const LEVEL_EMIT_MIN_DELTA = 0.02

function readEchoCancellation(track: MediaStreamTrack | undefined): boolean | null {
    const value = track?.getSettings?.().echoCancellation as unknown
    return typeof value === 'boolean' ? value : null
}

function definedTuning(tuning: Partial<VoiceVadTuning>): VoiceVadTuning {
    const out: VoiceVadTuning = {}
    if (tuning.silenceMsToEnd !== undefined) out.silenceMsToEnd = tuning.silenceMsToEnd
    if (tuning.minSpeechMs !== undefined) out.minSpeechMs = tuning.minSpeechMs
    if (tuning.maxSegmentMs !== undefined) out.maxSegmentMs = tuning.maxSegmentMs
    if (tuning.speechThreshold !== undefined) out.speechThreshold = tuning.speechThreshold
    return out
}

/**
 * Creates a running AudioContext with the VAD worklet module loaded. `sampleRate` is a
 * request: if the constructor rejects it, the context runs at the device rate instead
 * (`forcedRate` false). Returns null when the capture went stale while awaiting.
 */
async function openWorkletContext(
    AudioContextCtor: BrowserAudioContext,
    sampleRate: number | undefined,
    register: (context: AudioContext) => void,
    isStale: () => boolean,
): Promise<{ context: AudioContext; forcedRate: boolean } | null> {
    let context: AudioContext
    let forcedRate = false
    if (sampleRate) {
        try {
            context = new AudioContextCtor({ sampleRate })
            forcedRate = true
        } catch {
            context = new AudioContextCtor()
        }
    } else {
        context = new AudioContextCtor()
    }
    register(context)
    if (import.meta.env.DEV) console.info('[voice-call][CTX] created state=', context.state, 'rate=', context.sampleRate)
    try {
        // The context is created after the awaited getUserMedia — past the synchronous
        // user-gesture window — so browsers can leave it 'suspended'. A suspended context
        // never pulls the worklet's process(), so no level/VAD/segment is ever produced and
        // the call sits on "Listening" forever. Resume it and require it to actually start.
        if (context.state !== 'running') {
            await context.resume().catch(() => undefined)
        }
        if (isStale()) return null
        if (context.state !== 'running') {
            throw new Error(`AudioContext could not be resumed (state=${context.state})`)
        }
        // Plain-JS worklet so addModule works in dev AND prod (a .ts URL ships raw TS).
        await context.audioWorklet.addModule(new URL('../audio/voiceVadProcessor.worklet.js', import.meta.url))
        if (isStale()) return null
        if (import.meta.env.DEV) console.info('[voice-call][WORKLET] addModule ok, rate=', context.sampleRate)
        return { context, forcedRate }
    } catch (error) {
        void context.close().catch(() => undefined)
        throw error
    }
}

export function useMicrophoneCapture(options: UseMicrophoneCaptureOptions): MicrophoneCaptureApi {
    const optionsRef = useRef(options)
    useEffect(() => {
        optionsRef.current = options
    })

    const mountedRef = useRef(true)
    const streamRef = useRef<MediaStream | null>(null)
    const audioContextRef = useRef<AudioContext | null>(null)
    const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
    const workletNodeRef = useRef<AudioWorkletNode | null>(null)
    const segmenterRef = useRef<VoiceVadWorkletSegmenter | null>(null)
    const captureStartedAtRef = useRef(0)
    const nextSeqRef = useRef(1)
    // Seqs reserved by segmenters of earlier captures in this session (internal restarts must
    // continue the numbering — the server rejects a reused seq).
    const seqCursorRef = useRef(1)
    // Bumped by every teardown: async work from an older capture checks it and bails.
    const captureGenRef = useRef(0)
    // Bumped by a user-facing start()/stop(): segments of an ended session are dropped.
    const sessionGenRef = useRef(0)
    const mutedRef = useRef(false)
    const constraintsRef = useRef<MediaTrackConstraints>(PROCESSED_AUDIO_CONSTRAINTS)
    const tuningOverridesRef = useRef<VoiceVadTuning>({})
    const errorCodeRef = useRef<MicrophoneCaptureErrorCode | null>(null)
    const detachTrackListenersRef = useRef<(() => void) | null>(null)
    const deviceRestartAttemptedRef = useRef(false)
    const lastLevelEmitRef = useRef({ at: Number.NEGATIVE_INFINITY, value: 0 })
    const previousAudioSessionTypeRef = useRef<string | null>(null)
    // Liveness watchdog: detects a live-but-silent capture stream and auto-falls back to raw
    // (no AEC/NS/AGC) constraints, then surfaces a visible error if still no signal. It is
    // paused while muted (a disabled track reads exactly zero) and resumes on unmute.
    const maxObservedLevelRef = useRef(0)
    const livenessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const livenessPendingRef = useRef(false)
    const rawRetryDoneRef = useRef(false)
    const lastLevelLogRef = useRef(0)
    const startWithConstraintsRef = useRef<((constraints: MediaTrackConstraints) => Promise<boolean>) | null>(null)
    const [status, setStatus] = useState<MicrophoneCaptureStatus>('idle')
    const [error, setError] = useState<string | null>(null)
    const [errorCode, setErrorCode] = useState<MicrophoneCaptureErrorCode | null>(null)
    const [source, setSource] = useState<VoiceVadSource | null>(null)
    const [isMuted, setMuted] = useState(false)
    const [nextSeq, setNextSeq] = useState(1)
    const [echoCancellation, setEchoCancellation] = useState<boolean | null>(null)
    const [rawFallbackActive, setRawFallbackActive] = useState(false)

    const safeSetStatus = useCallback((next: MicrophoneCaptureStatus) => {
        if (mountedRef.current) setStatus(next)
    }, [])

    const fail = useCallback((code: MicrophoneCaptureErrorCode, message: string, nextStatus?: MicrophoneCaptureStatus) => {
        errorCodeRef.current = code
        if (!mountedRef.current) return
        setErrorCode(code)
        setError(message)
        if (nextStatus) setStatus(nextStatus)
    }, [])

    const clearError = useCallback(() => {
        errorCodeRef.current = null
        if (!mountedRef.current) return
        setErrorCode(null)
        setError(null)
    }, [])

    const emitSegment = useCallback((segment: CapturedVoiceSegment) => {
        nextSeqRef.current = Math.max(nextSeqRef.current, segment.seq + 1)
        if (mountedRef.current) setNextSeq(nextSeqRef.current)
        optionsRef.current.onSegment?.(segment)
    }, [])

    const clearLivenessTimer = useCallback(() => {
        if (livenessTimerRef.current) {
            clearTimeout(livenessTimerRef.current)
            livenessTimerRef.current = null
        }
    }, [])

    /** Releases the current capture graph. Keeps session state (mute, seqs, tuning) so an
     *  internal restart continues where it left off. */
    const teardown = useCallback(() => {
        captureGenRef.current += 1
        const worklet = workletNodeRef.current
        workletNodeRef.current = null
        if (worklet) {
            worklet.port.onmessage = null
            try {
                worklet.disconnect()
            } catch {
                // ignore
            }
        }

        const sourceNode = sourceNodeRef.current
        sourceNodeRef.current = null
        if (sourceNode) {
            try {
                sourceNode.disconnect()
            } catch {
                // ignore
            }
        }

        const context = audioContextRef.current
        audioContextRef.current = null
        if (context && context.state !== 'closed') {
            void context.close().catch(() => undefined)
        }

        // Detach `ended` first: stopping our own tracks is not a device loss.
        detachTrackListenersRef.current?.()
        detachTrackListenersRef.current = null
        const stream = streamRef.current
        streamRef.current = null
        stream?.getTracks().forEach((track) => track.stop())

        const segmenter = segmenterRef.current
        segmenterRef.current = null
        if (segmenter) seqCursorRef.current = Math.max(seqCursorRef.current, segmenter.nextSeq)
        captureStartedAtRef.current = 0
        clearLivenessTimer()
        livenessPendingRef.current = false
        maxObservedLevelRef.current = 0
    }, [clearLivenessTimer])

    const stop = useCallback(() => {
        teardown()
        sessionGenRef.current += 1
        mutedRef.current = false
        const audioSession = (navigator as NavigatorWithAudioSession).audioSession
        if (audioSession && previousAudioSessionTypeRef.current !== null) {
            try {
                audioSession.type = previousAudioSessionTypeRef.current
            } catch {
                // ignore
            }
        }
        previousAudioSessionTypeRef.current = null
        if (mountedRef.current) {
            setSource(null)
            setMuted(false)
            setEchoCancellation(null)
            setRawFallbackActive(false)
            setStatus('idle')
        }
    }, [teardown])

    const handleLevel = useCallback((rms: number | undefined) => {
        const level = Math.max(0, Math.min(1, rms ?? 0))
        maxObservedLevelRef.current = Math.max(maxObservedLevelRef.current, level)
        if (level > 0) {
            // Signal is flowing: a later device loss gets its own restart attempt, and a
            // stale "no microphone signal" error no longer applies.
            deviceRestartAttemptedRef.current = false
            if (errorCodeRef.current === 'no_input') clearError()
        }
        const now = performance.now()
        if (import.meta.env.DEV && now - lastLevelLogRef.current > 1_000) {
            lastLevelLogRef.current = now
            console.info('[voice-call][MIC] rms=', level.toFixed(4), 'maxSoFar=', maxObservedLevelRef.current.toFixed(4), 'ctx=', audioContextRef.current?.state)
        }
        const last = lastLevelEmitRef.current
        if (now - last.at < LEVEL_EMIT_INTERVAL_MS || Math.abs(level - last.value) < LEVEL_EMIT_MIN_DELTA) return
        lastLevelEmitRef.current = { at: now, value: level }
        optionsRef.current.onLevel?.(level)
    }, [clearError])

    const startAudioWorklet = useCallback(async (stream: MediaStream, gen: number): Promise<boolean> => {
        if (!canUseAudioWorklet()) return false
        const AudioContextCtor = resolveAudioContext()
        if (!AudioContextCtor) return false
        const isStale = () => gen !== captureGenRef.current
        const register = (context: AudioContext) => {
            audioContextRef.current = context
        }

        // Ask for a 16 kHz context so the browser does the high-quality resampling from the
        // mic's native rate and the worklet is a pass-through.
        let opened = await openWorkletContext(AudioContextCtor, VOICE_VAD_SAMPLE_RATE, register, isStale)
        if (!opened) return false
        let sourceNode: MediaStreamAudioSourceNode
        try {
            sourceNode = opened.context.createMediaStreamSource(stream)
        } catch (sourceError) {
            // Firefox (≤ 147, ESR 140) can't connect a getUserMedia stream to a context running
            // at a non-default rate. Rebuild at the device rate; the worklet resamples to 16 kHz.
            if (!opened.forcedRate) throw sourceError
            console.warn('[voice-call][CTX] 16 kHz context rejected the mic stream; retrying at the device rate', sourceError)
            void opened.context.close().catch(() => undefined)
            audioContextRef.current = null
            opened = await openWorkletContext(AudioContextCtor, undefined, register, isStale)
            if (!opened) return false
            sourceNode = opened.context.createMediaStreamSource(stream)
        }
        const context = opened.context

        const tuning: VoiceVadTuning = { ...optionsRef.current.vad, ...tuningOverridesRef.current }
        const aggressiveness = optionsRef.current.aggressiveness ?? 'balanced'
        const processorOptions: VoiceVadProcessorOptions = {
            aggressiveness,
            silenceMsToEnd: tuning.silenceMsToEnd,
            minSpeechMs: tuning.minSpeechMs,
            maxSegmentMs: tuning.maxSegmentMs,
            speechThreshold: tuning.speechThreshold,
        }
        const workletNode = new AudioWorkletNode(context, VOICE_VAD_PROCESSOR_NAME, { processorOptions })
        const gain = context.createGain()
        if ('gain' in gain) gain.gain.value = 0
        sourceNode.connect(workletNode)
        workletNode.connect(gain)
        gain.connect(context.destination)

        const sessionGen = sessionGenRef.current
        const segmenter = new VoiceVadWorkletSegmenter({
            onSegment: (segment) => {
                // A segment still hashing when the user hung up belongs to the ended session.
                if (sessionGen === sessionGenRef.current) emitSegment(segment)
            },
            source: 'audio_worklet',
            aggressiveness,
            sampleRate: VOICE_VAD_SAMPLE_RATE,
            startSeq: Math.max(seqCursorRef.current, nextSeqRef.current),
        })
        segmenterRef.current = segmenter
        workletNode.port.onmessage = (event: MessageEvent<VoiceVadWorkletMessage | { type?: string; state?: string; seq?: number; rms?: number }>) => {
            const data = event.data
            if (data?.type === 'level') {
                handleLevel((data as { rms?: number }).rms)
                return
            }
            if (data?.type === 'vad' && 'state' in data && typeof data.state === 'string') {
                if (import.meta.env.DEV) console.info('[voice-call][VAD]', data.state, 'rms=', data.rms)
                optionsRef.current.onVadState?.(data.state as 'speech_start' | 'speech_end' | 'silence', {
                    seq: data.seq,
                    at_ms: Math.max(0, Math.round(performance.now() - captureStartedAtRef.current)),
                    rms: data.rms,
                })
                return
            }
            void segmenter.handleMessage(data as VoiceVadWorkletMessage).catch(() => {
                fail('segment_failed', 'Microphone segment processing failed.', 'error')
            })
        }

        sourceNodeRef.current = sourceNode
        workletNodeRef.current = workletNode
        if (import.meta.env.DEV) console.info('[voice-call][WORKLET] node connected, ctx=', context.state, 'rate=', context.sampleRate)
        if (mountedRef.current) setSource('audio_worklet')
        safeSetStatus('capturing')
        return true
    }, [emitSegment, fail, handleLevel, safeSetStatus])

    const armLivenessWatchdog = useCallback(() => {
        clearLivenessTimer()
        maxObservedLevelRef.current = 0
        livenessTimerRef.current = setTimeout(() => {
            livenessTimerRef.current = null
            // Muted: a disabled track reads exactly zero — that is not a dead stream. unmute()
            // re-arms a full window.
            if (!mountedRef.current || mutedRef.current) return
            livenessPendingRef.current = false
            const track = streamRef.current?.getAudioTracks?.()[0]
            // A live mic — even silent — leaks a noise floor (level >= 0.001). Exactly-zero
            // energy (or a muted source) over the window means the stream is dead: a known
            // Linux+Chrome failure where the WebRTC APM hands back a silent capture stream.
            const dead = maxObservedLevelRef.current === 0 || track?.muted === true
            if (!dead) return
            console.warn('[voice-call][NO_INPUT] no mic signal after', INPUT_LIVENESS_TIMEOUT_MS, 'ms', {
                ctx: audioContextRef.current?.state,
                muted: track?.muted,
                readyState: track?.readyState,
                label: track?.label,
                settings: track?.getSettings?.(),
            })
            if (!rawRetryDoneRef.current) {
                rawRetryDoneRef.current = true
                console.warn('[voice-call][NO_INPUT] retrying capture with raw constraints (no AEC/NS/AGC)')
                setRawFallbackActive(true)
                void startWithConstraintsRef.current?.(RAW_AUDIO_CONSTRAINTS)
                return
            }
            fail('no_input', 'No microphone signal detected. Check that the right input device is selected and that this site is allowed to use your microphone.')
        }, INPUT_LIVENESS_TIMEOUT_MS)
    }, [clearLivenessTimer, fail])

    const handleTrackEnded = useCallback((gen: number) => {
        if (gen !== captureGenRef.current || !mountedRef.current) return
        console.warn('[voice-call][MIC] input track ended (device unplugged or access revoked)')
        const deviceLost = () => {
            teardown()
            fail('device_lost', 'The microphone was disconnected.', 'error')
        }
        if (deviceRestartAttemptedRef.current) {
            deviceLost()
            return
        }
        deviceRestartAttemptedRef.current = true
        const session = sessionGenRef.current
        const restart = startWithConstraintsRef.current
        if (!restart) {
            deviceLost()
            return
        }
        void restart(constraintsRef.current).then((ok) => {
            if (!ok && mountedRef.current && session === sessionGenRef.current) deviceLost()
        })
    }, [fail, teardown])

    const startWithConstraints = useCallback(async (constraints: MediaTrackConstraints): Promise<boolean> => {
        teardown()
        const gen = captureGenRef.current
        const isStale = () => gen !== captureGenRef.current
        constraintsRef.current = constraints
        safeSetStatus('requesting_permission')

        // Safari: declare a two-way call so capture and playback share the voice-processing
        // route instead of the media-playback one.
        const audioSession = (navigator as NavigatorWithAudioSession).audioSession
        if (audioSession && audioSession.type !== 'play-and-record') {
            try {
                previousAudioSessionTypeRef.current ??= audioSession.type
                audioSession.type = 'play-and-record'
            } catch {
                // ignore
            }
        }

        let stream: MediaStream
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: constraints, video: false })
        } catch (captureError) {
            if (isStale()) return false
            const denied = captureError instanceof DOMException && (captureError.name === 'NotAllowedError' || captureError.name === 'SecurityError')
            if (denied) fail('permission_denied', 'Microphone permission was denied.', 'permission_denied')
            else fail('capture_failed', 'Microphone capture failed.', 'error')
            return false
        }
        if (isStale()) {
            // Stopped (or restarted) while the permission prompt was open.
            stream.getTracks().forEach((track) => track.stop())
            return false
        }

        const audioTracks = stream.getAudioTracks()
        // Mute survives restarts: a new track must never come up live behind a muted UI.
        audioTracks.forEach((track) => {
            track.enabled = !mutedRef.current
        })
        const firstTrack = audioTracks[0]
        if (import.meta.env.DEV) {
            console.info('[voice-call][MIC] track acquired', {
                label: firstTrack?.label,
                muted: firstTrack?.muted,
                readyState: firstTrack?.readyState,
                settings: firstTrack?.getSettings?.(),
                constraints,
            })
        }

        streamRef.current = stream
        captureStartedAtRef.current = performance.now()
        try {
            if (await startAudioWorklet(stream, gen)) {
                if (isStale()) return false
                const onEnded = () => handleTrackEnded(gen)
                audioTracks.forEach((track) => track.addEventListener('ended', onEnded))
                detachTrackListenersRef.current = () => audioTracks.forEach((track) => track.removeEventListener('ended', onEnded))
                if (mountedRef.current) setEchoCancellation(readEchoCancellation(firstTrack))
                livenessPendingRef.current = true
                if (!mutedRef.current) armLivenessWatchdog()
                return true
            }
        } catch (workletError) {
            if (isStale()) return false
            console.warn('[voice-call][WORKLET_REQUIRED] AudioWorklet VAD failed to load', workletError)
        }
        if (isStale()) return false

        teardown()
        if (mountedRef.current) setSource(null)
        fail('unsupported', 'This browser does not support the required voice capture path.', 'unsupported')
        return false
    }, [armLivenessWatchdog, fail, handleTrackEnded, safeSetStatus, startAudioWorklet, teardown])

    useEffect(() => {
        startWithConstraintsRef.current = startWithConstraints
    })

    const start = useCallback(async (): Promise<boolean> => {
        clearError()
        if (!optionsRef.current.consentGranted) {
            safeSetStatus('consent_required')
            return false
        }
        if (!navigator.mediaDevices?.getUserMedia) {
            fail('unsupported', 'Microphone capture is not supported in this browser.', 'unsupported')
            return false
        }
        // A user-facing start opens a new capture session: seqs restart at 1 and the raw /
        // device-restart fallbacks get a fresh budget. Mute is kept unless stop() reset it.
        // Tear down first so a still-running capture can't carry its seqs into the new session.
        teardown()
        sessionGenRef.current += 1
        rawRetryDoneRef.current = false
        deviceRestartAttemptedRef.current = false
        seqCursorRef.current = 1
        nextSeqRef.current = 1
        lastLevelEmitRef.current = { at: Number.NEGATIVE_INFINITY, value: 0 }
        if (mountedRef.current) {
            setNextSeq(1)
            setRawFallbackActive(false)
        }
        return startWithConstraints(PROCESSED_AUDIO_CONSTRAINTS)
    }, [clearError, fail, safeSetStatus, startWithConstraints, teardown])

    const mute = useCallback(() => {
        mutedRef.current = true
        streamRef.current?.getAudioTracks().forEach((track) => {
            track.enabled = false
        })
        // Pause the liveness check (FE-10): a muted track's exact-zero level would read as a
        // dead stream and trigger a raw-constraints restart.
        clearLivenessTimer()
        setMuted(true)
    }, [clearLivenessTimer])

    const unmute = useCallback(() => {
        mutedRef.current = false
        streamRef.current?.getAudioTracks().forEach((track) => {
            track.enabled = true
        })
        if (livenessPendingRef.current && streamRef.current && !livenessTimerRef.current) armLivenessWatchdog()
        setMuted(false)
    }, [armLivenessWatchdog])

    const configure = useCallback((tuning: Partial<VoiceVadTuning>) => {
        const next = definedTuning(tuning)
        tuningOverridesRef.current = { ...tuningOverridesRef.current, ...next }
        const message: VoiceVadConfigureMessage = { type: 'configure', ...next }
        workletNodeRef.current?.port.postMessage(message)
    }, [])

    useEffect(() => {
        mountedRef.current = true
        return () => {
            mountedRef.current = false
            stop()
        }
    }, [stop])

    return {
        status,
        error,
        errorCode,
        source,
        isMuted,
        nextSeq,
        echoCancellation,
        rawFallbackActive,
        start,
        stop,
        mute,
        unmute,
        configure,
    }
}
