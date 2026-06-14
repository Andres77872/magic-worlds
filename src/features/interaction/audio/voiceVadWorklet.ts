/**
 * voiceVadWorklet.ts — the MAIN-THREAD half of the voice VAD.
 *
 * Holds the segment types, WAV/sha helpers, and `VoiceVadWorkletSegmenter` (which turns
 * worklet `segment` messages into uploadable `CapturedVoiceSegment`s). The AudioWorklet
 * processor itself lives in the sibling plain-JS file `voiceVadProcessor.worklet.js`
 * (loaded via addModule) — it MUST be plain JS so it loads in dev AND prod.
 */
import type { VoiceAudioEncoding, VoiceVadAggressiveness, VoiceVadSource } from '@/shared/types/voice.types'

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
    const samples = samplesInput instanceof Int16Array ? samplesInput : Int16Array.from(samplesInput)
    const bytesPerSample = 2
    const dataSize = samples.length * bytesPerSample
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

    let offset = 44
    for (const sample of samples) {
        view.setInt16(offset, clampPcm16(sample), true)
        offset += bytesPerSample
    }

    return new Blob([buffer], { type: 'audio/wav;codec=pcm_s16le' })
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
    const blob = createPcm16WavBlob(samples, sampleRate)
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
        audio_sha256: await sha256Hex(blob),
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
    private nextSeq = 1
    private readonly onSegment: (segment: CapturedVoiceSegment) => void
    private readonly source: VoiceVadSource
    private readonly aggressiveness: VoiceVadAggressiveness
    private readonly sampleRate: number

    constructor(options: {
        onSegment: (segment: CapturedVoiceSegment) => void
        source?: VoiceVadSource
        aggressiveness?: VoiceVadAggressiveness
        sampleRate?: number
    }) {
        this.onSegment = options.onSegment
        this.source = options.source ?? 'audio_worklet'
        this.aggressiveness = options.aggressiveness ?? 'balanced'
        this.sampleRate = options.sampleRate ?? 16_000
    }

    async emitPcm16(samples: Int16Array | readonly number[], options: Partial<Omit<Pcm16SegmentInput, 'seq' | 'samples'>> = {}): Promise<CapturedVoiceSegment> {
        const segment = await buildPcm16WavSegment({
            seq: this.nextSeq,
            startedAtMs: options.startedAtMs ?? performance.now(),
            samples,
            sampleRate: options.sampleRate ?? this.sampleRate,
            speechMs: options.speechMs,
            silenceMs: options.silenceMs,
            source: options.source ?? this.source,
            aggressiveness: options.aggressiveness ?? this.aggressiveness,
        })
        this.nextSeq += 1
        this.onSegment(segment)
        return segment
    }

    async handleMessage(message: VoiceVadWorkletMessage): Promise<CapturedVoiceSegment | null> {
        if (message.type !== 'segment' && message.type !== 'voice_segment') return null
        const samples = message.samples ?? message.pcm16
        if (!samples) return null
        return this.emitPcm16(samples, {
            startedAtMs: message.started_at_ms ?? message.startedAtMs ?? performance.now(),
            sampleRate: message.sample_rate ?? message.sampleRate ?? this.sampleRate,
            speechMs: message.speech_ms ?? message.speechMs,
            silenceMs: message.silence_ms ?? message.silenceMs,
        })
    }
}

async function sha256Hex(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer()
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
