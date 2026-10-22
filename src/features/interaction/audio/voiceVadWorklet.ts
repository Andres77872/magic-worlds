/**
 * voiceVadWorklet.ts — the MAIN-THREAD half of the voice VAD.
 *
 * Holds the segment types, the worklet message/option contract, WAV/sha helpers, and
 * `VoiceVadWorkletSegmenter` (which turns worklet `segment` messages into uploadable
 * `CapturedVoiceSegment`s and stamps each with its end of speech, from the `speech_end` that
 * closed it). The AudioWorklet processor itself lives in the sibling plain-JS
 * file `voiceVadProcessor.worklet.js` (loaded via addModule) — it MUST be plain JS so it
 * loads in dev AND prod, so the types below mirror it by hand.
 */
import type { VoiceAudioEncoding, VoiceVadAggressiveness, VoiceVadSource } from '@/shared/types/voice.types'

/** Name the processor registers under (`registerProcessor` in voiceVadProcessor.worklet.js). */
export const VOICE_VAD_PROCESSOR_NAME = 'voice-vad-processor'
/** Sample rate of every segment the worklet posts (it resamples whatever the context runs at). */
export const VOICE_VAD_SAMPLE_RATE = 16_000
/**
 * Worklet default for `maxSegmentMs` (pre-roll included). A call raises it to the server's
 * advertised `max_segment_duration_ms` minus 500 ms (29.5 s with the 30 s default).
 */
export const VOICE_VAD_DEFAULT_MAX_SEGMENT_MS = 7_500
/** Worklet default for `preRollMs`: audio kept from before the speech onset. */
export const VOICE_VAD_DEFAULT_PRE_ROLL_MS = 300

export interface VoiceVadTuning {
    /**
     * Silence (ms) after the last voiced audio before a turn ends (the hang-over). The call
     * screen sets 550; 800 is only the worklet fallback (450 for `strict`, which no caller sends).
     */
    silenceMsToEnd?: number
    /** Minimum detected speech (ms) before a turn fires — ignores coughs/clicks. */
    minSpeechMs?: number
    /** Max single-segment length (ms), pre-roll included. Default 7500. */
    maxSegmentMs?: number
    /** RMS energy floor for speech; the adaptive noise floor can only raise it. */
    speechThreshold?: number
}

/** `processorOptions` accepted by the worklet constructor. */
export interface VoiceVadProcessorOptions extends VoiceVadTuning {
    aggressiveness?: VoiceVadAggressiveness
    /** Audio (ms) kept from before the speech onset and prepended to the segment. Default 300. */
    preRollMs?: number
    /** Interval (ms) between `level` messages. Default 50. */
    levelIntervalMs?: number
}

/** Main thread → worklet: retune a live processor; applies from the next render quantum. */
export type VoiceVadConfigureMessage = { type: 'configure' } & VoiceVadTuning

/**
 * Worklet → main thread. `speech_start` comes once `minSpeechMs` of speech accumulated;
 * `onset_lag_ms` is the audio since the utterance's first voiced frame (its onset).
 */
export type VoiceVadProcessorMessage =
    | { type: 'vad'; state: 'speech_start'; at_ms: number; rms: number; onset_lag_ms: number }
    | VoiceVadSpeechEndMessage
    | { type: 'level'; rms: number }
    | { type: 'segment'; samples: Int16Array; sample_rate: number; started_at_ms: number; speech_ms: number; silence_ms: number }

/**
 * Worklet → main thread, right after the segment it closed. `ended_by_silence` is false for
 * a max-length cut (the user is still talking); `silence_tail_ms` is the quiet the worklet
 * waited after the last voiced audio before closing the turn (the hang-over), 0 for a cut.
 */
export interface VoiceVadSpeechEndMessage {
    type: 'vad'
    state: 'speech_end'
    at_ms: number
    rms: number
    ended_by_silence: boolean
    silence_tail_ms: number
}

export interface CapturedVoiceSegment {
    seq: number
    started_at_ms: number
    duration_ms: number
    encoding: VoiceAudioEncoding
    sample_rate: number
    channels: 1
    byte_length: number
    audio_sha256: string
    vad: {
        speech_ms: number
        silence_ms: number
        rms: number
        peak: number
        source: VoiceVadSource
        aggressiveness: VoiceVadAggressiveness
    }
    audio: Blob
    /**
     * The user's end of speech on the main-thread clock (`performance.now()`), R0-BE-37:
     * when the closing `speech_end` arrived minus its `silence_tail_ms`, so the VAD
     * hang-over counts as waiting. Set by {@link VoiceVadWorkletSegmenter.noteSpeechEnd},
     * possibly after the segment was emitted; absent until then, and never for a
     * max-length cut (the user had not stopped). Never uploaded as is: see `speechEndLag.ts`.
     */
    speech_end_perf_ms?: number
}

export interface Pcm16SegmentInput {
    seq: number
    startedAtMs: number
    samples: Int16Array | readonly number[]
    sampleRate?: number
    speechMs?: number
    silenceMs?: number
    source?: VoiceVadSource
    aggressiveness?: VoiceVadAggressiveness
}

export interface VoiceVadWorkletMessage {
    type: 'segment' | 'voice_segment'
    started_at_ms?: number
    startedAtMs?: number
    samples?: Int16Array | readonly number[]
    pcm16?: Int16Array | readonly number[]
    sample_rate?: number
    sampleRate?: number
    speech_ms?: number
    speechMs?: number
    silence_ms?: number
    silenceMs?: number
}

export function createPcm16WavBlob(samplesInput: Int16Array | readonly number[], sampleRate = 16_000): Blob {
    return new Blob([createPcm16WavBuffer(samplesInput, sampleRate)], { type: 'audio/wav;codec=pcm_s16le' })
}

/** True when typed arrays use little-endian byte order (every browser in practice). */
const PLATFORM_LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1

function createPcm16WavBuffer(samplesInput: Int16Array | readonly number[], sampleRate: number): ArrayBuffer {
    const bytesPerSample = 2
    const dataSize = samplesInput.length * bytesPerSample
    const buffer = new ArrayBuffer(44 + dataSize)
    const view = new DataView(buffer)

    writeAscii(view, 0, 'RIFF')
    view.setUint32(4, 36 + dataSize, true)
    writeAscii(view, 8, 'WAVE')
    writeAscii(view, 12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true) // PCM
    view.setUint16(22, 1, true) // mono
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * bytesPerSample, true)
    view.setUint16(32, bytesPerSample, true)
    view.setUint16(34, 16, true)
    writeAscii(view, 36, 'data')
    view.setUint32(40, dataSize, true)

    if (samplesInput instanceof Int16Array && PLATFORM_LITTLE_ENDIAN) {
        // Already PCM16 in WAV byte order: one bulk copy instead of a write per sample.
        new Int16Array(buffer, 44, samplesInput.length).set(samplesInput)
        return buffer
    }
    let offset = 44
    for (const sample of samplesInput) {
        view.setInt16(offset, clampPcm16(sample), true)
        offset += bytesPerSample
    }
    return buffer
}

export function calculatePcm16Metrics(samplesInput: Int16Array | readonly number[]): { rms: number; peak: number } {
    const samples = samplesInput instanceof Int16Array ? samplesInput : Int16Array.from(samplesInput)
    if (samples.length === 0) return { rms: 0, peak: 0 }
    let sumSquares = 0
    let peak = 0
    for (const sample of samples) {
        const normalized = Math.min(1, Math.abs(sample) / 32_768)
        sumSquares += normalized * normalized
        peak = Math.max(peak, normalized)
    }
    return {
        rms: roundMetric(Math.sqrt(sumSquares / samples.length)),
        peak: roundMetric(peak),
    }
}

export async function buildPcm16WavSegment(input: Pcm16SegmentInput): Promise<CapturedVoiceSegment> {
    const sampleRate = input.sampleRate ?? 16_000
    const samples = input.samples instanceof Int16Array ? input.samples : Int16Array.from(input.samples)
    const wav = createPcm16WavBuffer(samples, sampleRate)
    // Hashed from the bytes just built: reading the blob back would copy them again.
    const audioSha256 = await sha256Hex(wav)
    const blob = new Blob([wav], { type: 'audio/wav;codec=pcm_s16le' })
    const durationMs = Math.max(0, Math.round((samples.length / sampleRate) * 1000))
    const metrics = calculatePcm16Metrics(samples)
    return {
        seq: input.seq,
        started_at_ms: Math.max(0, Math.round(input.startedAtMs)),
        duration_ms: durationMs,
        encoding: 'audio/wav;codec=pcm_s16le',
        sample_rate: sampleRate,
        channels: 1,
        byte_length: blob.size,
        audio_sha256: audioSha256,
        vad: {
            speech_ms: Math.max(0, Math.round(input.speechMs ?? durationMs)),
            silence_ms: Math.max(0, Math.round(input.silenceMs ?? 0)),
            rms: metrics.rms,
            peak: metrics.peak,
            source: input.source ?? 'audio_worklet',
            aggressiveness: input.aggressiveness ?? 'balanced',
        },
        audio: blob,
    }
}

export class VoiceVadWorkletSegmenter {
    private seqCursor: number
    private readonly onSegment: (segment: CapturedVoiceSegment) => void
    private readonly source: VoiceVadSource
    private readonly aggressiveness: VoiceVadAggressiveness
    private readonly sampleRate: number
    /** Worklet segments whose closing `speech_end` has not arrived yet, oldest first. */
    private readonly awaitingSpeechEnd: SpeechEndSlot[] = []

    constructor(options: {
        onSegment: (segment: CapturedVoiceSegment) => void
        source?: VoiceVadSource
        aggressiveness?: VoiceVadAggressiveness
        sampleRate?: number
        /** First seq to assign. Carry the previous segmenter's `nextSeq` across an internal
         *  capture restart so seqs stay unique for the whole voice session. */
        startSeq?: number
    }) {
        this.seqCursor = Math.max(1, Math.floor(options.startSeq ?? 1))
        this.onSegment = options.onSegment
        this.source = options.source ?? 'audio_worklet'
        this.aggressiveness = options.aggressiveness ?? 'balanced'
        this.sampleRate = options.sampleRate ?? 16_000
    }

    /** The seq the next segment will get. Seqs are reserved synchronously, so segments still
     *  being hashed already count. */
    get nextSeq(): number {
        return this.seqCursor
    }

    async emitPcm16(samples: Int16Array | readonly number[], options: Partial<Omit<Pcm16SegmentInput, 'seq' | 'samples'>> = {}): Promise<CapturedVoiceSegment> {
        return this.emit(samples, options, null)
    }

    async handleMessage(message: VoiceVadWorkletMessage): Promise<CapturedVoiceSegment | null> {
        if (message.type !== 'segment' && message.type !== 'voice_segment') return null
        // Queued before anything else (and before the hash's await), in arrival order, so the
        // `speech_end` posted right after this segment pairs with it whatever happens below.
        const slot: SpeechEndSlot = { atMs: null, segment: null }
        this.awaitingSpeechEnd.push(slot)
        if (this.awaitingSpeechEnd.length > MAX_AWAITING_SPEECH_END) this.awaitingSpeechEnd.shift()
        const samples = message.samples ?? message.pcm16
        if (!samples) return null
        return this.emit(samples, {
            startedAtMs: message.started_at_ms ?? message.startedAtMs ?? performance.now(),
            sampleRate: message.sample_rate ?? message.sampleRate ?? this.sampleRate,
            speechMs: message.speech_ms ?? message.speechMs,
            silenceMs: message.silence_ms ?? message.silenceMs,
        }, slot)
    }

    /**
     * The worklet's `speech_end` (R0-BE-37), received at `receivedAtMs` (main-thread clock).
     * The worklet posts every segment and then the `speech_end` that closed it on the same
     * port, so it belongs to the oldest segment still waiting for one. A pause-ended segment
     * is stamped with its end of speech, `receivedAtMs - silence_tail_ms`: one still being
     * hashed gets it when built, one already emitted gets it in place, so an upload not sent
     * yet still reads it. A max-length cut (`ended_by_silence: false`) or a message without
     * a usable tail consumes its slot but stamps nothing. A `speech_end` with no waiting
     * segment is ignored.
     */
    noteSpeechEnd(
        message: Partial<Record<keyof VoiceVadSpeechEndMessage, unknown>>,
        receivedAtMs: number = performance.now(),
    ): void {
        const slot = this.awaitingSpeechEnd.shift()
        if (!slot) return
        const tail = message.silence_tail_ms
        if (message.ended_by_silence !== true || typeof tail !== 'number' || !Number.isFinite(tail) || tail < 0) return
        const atMs = receivedAtMs - tail
        slot.atMs = atMs
        if (slot.segment) slot.segment.speech_end_perf_ms = atMs
    }

    private async emit(
        samples: Int16Array | readonly number[],
        options: Partial<Omit<Pcm16SegmentInput, 'seq' | 'samples'>>,
        slot: SpeechEndSlot | null,
    ): Promise<CapturedVoiceSegment> {
        // Reserve before the await: two segments posted back to back must not share a seq.
        const seq = this.seqCursor
        this.seqCursor += 1
        const segment = await buildPcm16WavSegment({
            seq,
            startedAtMs: options.startedAtMs ?? performance.now(),
            samples,
            sampleRate: options.sampleRate ?? this.sampleRate,
            speechMs: options.speechMs,
            silenceMs: options.silenceMs,
            source: options.source ?? this.source,
            aggressiveness: options.aggressiveness ?? this.aggressiveness,
        })
        if (slot) {
            slot.segment = segment
            if (slot.atMs !== null) segment.speech_end_perf_ms = slot.atMs
        }
        this.onSegment(segment)
        return segment
    }
}

/** A worklet segment waiting for its closing `speech_end`. */
interface SpeechEndSlot {
    atMs: number | null
    segment: CapturedVoiceSegment | null
}

/** Bound on segments waiting for a `speech_end`; the worklet sends one right after each. */
const MAX_AWAITING_SPEECH_END = 16

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
    if (globalThis.crypto?.subtle) {
        const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer)
        return hexFromBytes(new Uint8Array(digest))
    }
    return fallbackHashHex(new Uint8Array(buffer))
}

function fallbackHashHex(bytes: Uint8Array): string {
    let hash = 0x811c9dc5
    for (const byte of bytes) {
        hash ^= byte
        hash = Math.imul(hash, 0x01000193) >>> 0
    }
    return hash.toString(16).padStart(8, '0').repeat(8).slice(0, 64)
}

function hexFromBytes(bytes: Uint8Array): string {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function clampPcm16(value: number): number {
    return Math.max(-32_768, Math.min(32_767, Math.round(value)))
}

function roundMetric(value: number): number {
    return Math.round(value * 1000) / 1000
}

function writeAscii(view: DataView, offset: number, value: string): void {
    for (let index = 0; index < value.length; index += 1) {
        view.setUint8(offset + index, value.charCodeAt(index))
    }
}
