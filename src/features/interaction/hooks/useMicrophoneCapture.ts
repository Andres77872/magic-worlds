import { useCallback, useEffect, useRef, useState } from 'react'
import type { VoiceVadAggressiveness, VoiceVadSource } from '@/shared/types/voice.types'
import {
    type CapturedVoiceSegment,
    VoiceVadWorkletSegmenter,
    type VoiceVadWorkletMessage,
} from '../audio/voiceVadWorklet'

export type MicrophoneCaptureStatus =
    | 'idle'
    | 'consent_required'
    | 'requesting_permission'
    | 'capturing'
    | 'permission_denied'
    | 'unsupported'
    | 'error'

export interface VoiceVadTuning {
    /** Silence (ms) before a turn ends. Default ~800ms (natural pause). */
    silenceMsToEnd?: number
    /** Minimum detected speech (ms) before a turn fires — ignores coughs/clicks. */
    minSpeechMs?: number
    /** Max single-segment length (ms). */
    maxSegmentMs?: number
    /** RMS energy threshold for speech. */
    speechThreshold?: number
}

export interface UseMicrophoneCaptureOptions {
    consentGranted: boolean
    onSegment?: (segment: CapturedVoiceSegment) => void
    onVadState?: (state: 'speech_start' | 'speech_end' | 'silence', details?: { seq?: number; at_ms: number; rms?: number }) => void
    /** Live input level (0..1), throttled — drives the call meter/waveform. */
    onLevel?: (level: number) => void
    /** Called once if the AudioWorklet VAD can't load and capture degrades to time-sliced. */
    onVadFallback?: () => void
    preferWorklet?: boolean
    aggressiveness?: VoiceVadAggressiveness
    vad?: VoiceVadTuning
}

export interface MicrophoneCaptureApi {
    status: MicrophoneCaptureStatus
    error: string | null
    source: VoiceVadSource | null
    isMuted: boolean
    nextSeq: number
    start: () => Promise<boolean>
    stop: () => void
    mute: () => void
    unmute: () => void
}

type BrowserAudioContext = typeof AudioContext

function canUseAudioWorklet(): boolean {
    const AudioContextCtor = resolveAudioContext()
    return Boolean(AudioContextCtor && typeof AudioWorkletNode !== 'undefined')
}

function canUseMediaRecorder(): boolean {
    return typeof MediaRecorder !== 'undefined'
        && (typeof MediaRecorder.isTypeSupported !== 'function' || MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))
}

function resolveAudioContext(): BrowserAudioContext | undefined {
    return globalThis.AudioContext ?? (globalThis as typeof globalThis & { webkitAudioContext?: BrowserAudioContext }).webkitAudioContext
}

async function hashBlobSha256(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer()
    if (globalThis.crypto?.subtle) {
        const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer)
        return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    }
    return `${blob.size.toString(16).padStart(8, '0')}`.repeat(8).slice(0, 64)
}

/** Default processed capture (browser AEC/NS/AGC). Best for calls when it actually works. */
const PROCESSED_AUDIO_CONSTRAINTS: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
/** Raw capture — used as a fallback. On Linux+Chrome the WebRTC APM can hand back a
 *  live-but-silent stream; disabling AEC/NS/AGC recovers real mic audio. */
const RAW_AUDIO_CONSTRAINTS: MediaTrackConstraints = { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
/** How long after capture starts to confirm the worklet is actually receiving audio energy. */
const INPUT_LIVENESS_TIMEOUT_MS = 3_000

export function useMicrophoneCapture(options: UseMicrophoneCaptureOptions): MicrophoneCaptureApi {
    const optionsRef = useRef(options)
    useEffect(() => {
        optionsRef.current = options
    })

    const mountedRef = useRef(true)
    const streamRef = useRef<MediaStream | null>(null)
    const recorderRef = useRef<MediaRecorder | null>(null)
    const audioContextRef = useRef<AudioContext | null>(null)
    const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
    const workletNodeRef = useRef<AudioWorkletNode | null>(null)
    const segmenterRef = useRef<VoiceVadWorkletSegmenter | null>(null)
    const captureStartedAtRef = useRef(0)
    const segmentStartedAtRef = useRef(0)
    const nextSeqRef = useRef(1)
    // Liveness watchdog: detects a live-but-silent capture stream and auto-falls back to raw
    // (no AEC/NS/AGC) constraints, then surfaces a visible error if still no signal.
    const maxObservedLevelRef = useRef(0)
    const livenessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const rawRetryDoneRef = useRef(false)
    const lastLevelLogRef = useRef(0)
    const startWithConstraintsRef = useRef<((constraints: MediaTrackConstraints) => Promise<boolean>) | null>(null)
    const [status, setStatus] = useState<MicrophoneCaptureStatus>('idle')
    const [error, setError] = useState<string | null>(null)
    const [source, setSource] = useState<VoiceVadSource | null>(null)
    const [isMuted, setMuted] = useState(false)
    const [nextSeq, setNextSeq] = useState(1)

    const safeSetStatus = useCallback((next: MicrophoneCaptureStatus) => {
        if (mountedRef.current) setStatus(next)
    }, [])

    const safeSetError = useCallback((next: string | null) => {
        if (mountedRef.current) setError(next)
    }, [])

    const emitSegment = useCallback((segment: CapturedVoiceSegment) => {
        nextSeqRef.current = Math.max(nextSeqRef.current, segment.seq + 1)
        if (mountedRef.current) setNextSeq(nextSeqRef.current)
        optionsRef.current.onSegment?.(segment)
    }, [])

    const stop = useCallback(() => {
        const recorder = recorderRef.current
        recorderRef.current = null
        if (recorder && recorder.state !== 'inactive') {
            try {
                recorder.stop()
            } catch {
                // ignore teardown failures
            }
        }

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

        const stream = streamRef.current
        streamRef.current = null
        stream?.getTracks().forEach((track) => track.stop())
        segmenterRef.current = null
        captureStartedAtRef.current = 0
        segmentStartedAtRef.current = 0
        if (livenessTimerRef.current) {
            clearTimeout(livenessTimerRef.current)
            livenessTimerRef.current = null
        }
        maxObservedLevelRef.current = 0
        if (mountedRef.current) {
            setSource(null)
            setMuted(false)
            setStatus('idle')
        }
    }, [])

    const emitMediaRecorderSegment = useCallback(async (blob: Blob) => {
        if (!blob.size) return
        const startedAt = segmentStartedAtRef.current || captureStartedAtRef.current || performance.now()
        const now = performance.now()
        const durationMs = Math.max(1, Math.round(now - startedAt))
        segmentStartedAtRef.current = now
        const segment: CapturedVoiceSegment = {
            seq: nextSeqRef.current,
            started_at_ms: Math.max(0, Math.round(startedAt - captureStartedAtRef.current)),
            duration_ms: durationMs,
            encoding: 'audio/webm;codecs=opus',
            sample_rate: 48_000,
            channels: 1,
            byte_length: blob.size,
            audio_sha256: await hashBlobSha256(blob),
            vad: {
                speech_ms: durationMs,
                silence_ms: 0,
                rms: 0,
                peak: 0,
                source: 'media_recorder',
                aggressiveness: optionsRef.current.aggressiveness ?? 'balanced',
            },
            audio: blob,
        }
        emitSegment(segment)
    }, [emitSegment])

    const startMediaRecorder = useCallback((stream: MediaStream): boolean => {
        if (!canUseMediaRecorder()) return false
        const mimeType = MediaRecorder.isTypeSupported?.('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
        const recorder = new MediaRecorder(stream, { mimeType })
        recorder.ondataavailable = (event) => {
            if (event.data?.size) void emitMediaRecorderSegment(event.data)
        }
        recorderRef.current = recorder
        recorder.start(4_000)
        setSource('media_recorder')
        safeSetStatus('capturing')
        return true
    }, [emitMediaRecorderSegment, safeSetStatus])

    const startAudioWorklet = useCallback(async (stream: MediaStream): Promise<boolean> => {
        if (!canUseAudioWorklet()) return false
        const AudioContextCtor = resolveAudioContext()
        if (!AudioContextCtor) return false

        // Capture at 16 kHz directly so the browser high-quality-resamples from the mic's
        // native rate. The worklet's manual decimation aliased the audio enough that Whisper
        // returned empty transcripts ("no_speech"); a 16 kHz context makes the worklet a
        // clean pass-through. Fall back to the default rate if a fixed 16 kHz context is
        // unsupported (the worklet then box-average downsamples).
        let context: AudioContext
        try {
            context = new AudioContextCtor({ sampleRate: 16_000 })
        } catch {
            context = new AudioContextCtor()
        }
        audioContextRef.current = context
        console.info('[voice-call][CTX] created state=', context.state, 'rate=', context.sampleRate) // TEMP: remove after live mic verification
        // The context is created after the awaited getUserMedia — past the synchronous
        // user-gesture window — so browsers can leave it 'suspended'. A suspended context
        // never pulls the worklet's process(), so no level/VAD/segment is ever produced and
        // the call sits on "Listening" forever. Resume it and require it to actually start;
        // if it can't, bail so capture degrades to the time-sliced MediaRecorder path
        // instead of silently running on a dead audio graph.
        if (context.state !== 'running') {
            await context.resume().catch(() => undefined)
        }
        console.info('[voice-call][CTX] after resume state=', context.state) // TEMP: remove after live mic verification
        if (context.state !== 'running') {
            void context.close().catch(() => undefined)
            audioContextRef.current = null
            throw new Error(`AudioContext could not be resumed (state=${context.state})`)
        }
        // Plain-JS worklet so addModule works in dev AND prod (a .ts URL ships raw TS).
        await context.audioWorklet.addModule(new URL('../audio/voiceVadProcessor.worklet.js', import.meta.url))
        console.info('[voice-call][WORKLET] addModule ok') // TEMP: remove after live mic verification
        const sourceNode = context.createMediaStreamSource(stream)
        const tuning = optionsRef.current.vad ?? {}
        const workletNode = new AudioWorkletNode(context, 'voice-vad-processor', {
            processorOptions: {
                aggressiveness: optionsRef.current.aggressiveness ?? 'balanced',
                silenceMsToEnd: tuning.silenceMsToEnd,
                minSpeechMs: tuning.minSpeechMs,
                maxSegmentMs: tuning.maxSegmentMs,
                speechThreshold: tuning.speechThreshold,
            },
        })
        const gain = context.createGain()
        if ('gain' in gain) gain.gain.value = 0
        sourceNode.connect(workletNode)
        workletNode.connect(gain)
        gain.connect(context.destination)

        const segmenter = new VoiceVadWorkletSegmenter({
            onSegment: emitSegment,
            source: 'audio_worklet',
            aggressiveness: optionsRef.current.aggressiveness ?? 'balanced',
            sampleRate: 16_000,
        })
        segmenterRef.current = segmenter
        workletNode.port.onmessage = (event: MessageEvent<VoiceVadWorkletMessage | { type?: string; state?: string; seq?: number; rms?: number }>) => {
            const data = event.data
            if (data?.type === 'level') {
                const level = Math.max(0, Math.min(1, data.rms ?? 0))
                maxObservedLevelRef.current = Math.max(maxObservedLevelRef.current, level)
                const now = performance.now()
                if (now - lastLevelLogRef.current > 1_000) { // TEMP: remove after live mic verification
                    lastLevelLogRef.current = now
                    console.info('[voice-call][MIC] rms=', level.toFixed(4), 'maxSoFar=', maxObservedLevelRef.current.toFixed(4), 'ctx=', audioContextRef.current?.state)
                }
                optionsRef.current.onLevel?.(level)
                return
            }
            if (data?.type === 'vad' && typeof data.state === 'string') {
                console.info('[voice-call][VAD]', data.state, 'rms=', data.rms) // TEMP: remove after live mic verification
                optionsRef.current.onVadState?.(data.state as 'speech_start' | 'speech_end' | 'silence', {
                    seq: data.seq,
                    at_ms: Math.max(0, Math.round(performance.now() - captureStartedAtRef.current)),
                    rms: data.rms,
                })
                return
            }
            void segmenter.handleMessage(data as VoiceVadWorkletMessage).catch(() => {
                safeSetError('Microphone segment processing failed.')
                safeSetStatus('error')
            })
        }

        sourceNodeRef.current = sourceNode
        workletNodeRef.current = workletNode
        console.info('[voice-call][WORKLET] node connected, ctx=', context.state) // TEMP: remove after live mic verification
        setSource('audio_worklet')
        safeSetStatus('capturing')
        return true
    }, [emitSegment, safeSetError, safeSetStatus])

    const armLivenessWatchdog = useCallback(() => {
        if (livenessTimerRef.current) clearTimeout(livenessTimerRef.current)
        maxObservedLevelRef.current = 0
        livenessTimerRef.current = setTimeout(() => {
            livenessTimerRef.current = null
            if (!mountedRef.current) return
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
                void startWithConstraintsRef.current?.(RAW_AUDIO_CONSTRAINTS)
                return
            }
            safeSetError('No microphone signal detected. Check that the right input device is selected and that this site is allowed to use your microphone.')
        }, INPUT_LIVENESS_TIMEOUT_MS)
    }, [safeSetError])

    const startWithConstraints = useCallback(async (constraints: MediaTrackConstraints): Promise<boolean> => {
        const currentOptions = optionsRef.current
        stop()
        safeSetStatus('requesting_permission')
        let stream: MediaStream
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: constraints, video: false })
        } catch (captureError) {
            const denied = captureError instanceof DOMException && (captureError.name === 'NotAllowedError' || captureError.name === 'SecurityError')
            safeSetStatus(denied ? 'permission_denied' : 'error')
            safeSetError(denied ? 'Microphone permission was denied.' : 'Microphone capture failed.')
            return false
        }

        const firstTrack = stream.getAudioTracks()[0]
        console.info('[voice-call][MIC] track acquired', { // TEMP: remove after live mic verification
            label: firstTrack?.label,
            muted: firstTrack?.muted,
            readyState: firstTrack?.readyState,
            settings: firstTrack?.getSettings?.(),
            constraints,
        })

        streamRef.current = stream
        captureStartedAtRef.current = performance.now()
        segmentStartedAtRef.current = captureStartedAtRef.current

        try {
            if (currentOptions.preferWorklet !== false && await startAudioWorklet(stream)) {
                armLivenessWatchdog()
                return true
            }
            // Worklet path unavailable — degrade to time-sliced capture (no VAD). Make it loud.
            console.warn('[voice-call][VAD_FALLBACK] AudioWorklet VAD unavailable — using time-sliced capture (no voice detection)')
            currentOptions.onVadFallback?.()
            if (startMediaRecorder(stream)) return true
        } catch (workletError) {
            console.warn('[voice-call][VAD_FALLBACK] AudioWorklet VAD failed to load — using time-sliced capture', workletError)
            currentOptions.onVadFallback?.()
            if (startMediaRecorder(stream)) return true
        }

        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        safeSetStatus('unsupported')
        safeSetError('This browser does not support the required voice capture path.')
        return false
    }, [armLivenessWatchdog, safeSetError, safeSetStatus, startAudioWorklet, startMediaRecorder, stop])

    useEffect(() => {
        startWithConstraintsRef.current = startWithConstraints
    })

    const start = useCallback(async (): Promise<boolean> => {
        safeSetError(null)
        if (!optionsRef.current.consentGranted) {
            safeSetStatus('consent_required')
            return false
        }
        if (!navigator.mediaDevices?.getUserMedia) {
            safeSetStatus('unsupported')
            safeSetError('Microphone capture is not supported in this browser.')
            return false
        }
        rawRetryDoneRef.current = false
        return startWithConstraints(PROCESSED_AUDIO_CONSTRAINTS)
    }, [safeSetError, safeSetStatus, startWithConstraints])

    const mute = useCallback(() => {
        streamRef.current?.getAudioTracks().forEach((track) => {
            track.enabled = false
        })
        setMuted(true)
    }, [])

    const unmute = useCallback(() => {
        streamRef.current?.getAudioTracks().forEach((track) => {
            track.enabled = true
        })
        setMuted(false)
    }, [])

    useEffect(() => () => {
        mountedRef.current = false
        stop()
    }, [stop])

    return { status, error, source, isMuted, nextSeq, start, stop, mute, unmute }
}
