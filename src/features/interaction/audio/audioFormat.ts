/**
 * Call audio format guard (R1-FE-05, WS-S1/S2). The BFF announces the assistant
 * audio format in `voice_ready.audio` (`audio/mpeg`, `mp3`, 44100 Hz, mono) and
 * every chunk repeats its rate and codec. A frame without `audio` (an older BFF
 * build) keeps the default MediaSource path.
 *
 * Every field is untrusted on read: a chunk this client cannot play is dropped
 * (the reply stays as text) instead of being fed to the decoder. The sample
 * rate always comes from the frame; nothing here picks one.
 */
import type { VoiceAudioFormat } from '@/shared/types/voice.types'

/** The only container the call player decodes. */
export const CALL_AUDIO_CONTENT_TYPE = 'audio/mpeg'
export const CALL_AUDIO_CODEC = 'mp3'
/** MPEG layer III rates a call may announce (D08). */
export const CALL_AUDIO_SAMPLE_RATES: ReadonlySet<number> = new Set([22_050, 24_000, 44_100])

/**
 * What a call plays when `voice_ready.audio` is missing or malformed (an older BFF
 * build): the format every call announces today. Tolerant read only.
 */
export const DEFAULT_CALL_AUDIO_FORMAT: Readonly<VoiceAudioFormat> = Object.freeze({
    content_type: CALL_AUDIO_CONTENT_TYPE,
    codec: CALL_AUDIO_CODEC,
    sample_rate: 44100,
    channels: 1,
})

/** The format fields of a `voice_audio_chunk` (or of `voice_ready.audio`), as received. */
export interface CallAudioFields {
    content_type?: unknown
    codec?: unknown
    sample_rate?: unknown
    channels?: unknown
}

/** True for an `audio/mpeg` mono chunk at a known rate whose codec is mp3 or not stated. */
export function isPlayableCallChunk(frame: CallAudioFields | null | undefined): boolean {
    if (!frame) return false
    if (typeof frame.content_type !== 'string' || frame.content_type.trim().toLowerCase() !== CALL_AUDIO_CONTENT_TYPE) return false
    if (frame.codec !== undefined && frame.codec !== null && frame.codec !== CALL_AUDIO_CODEC) return false
    if (typeof frame.sample_rate !== 'number' || !CALL_AUDIO_SAMPLE_RATES.has(frame.sample_rate)) return false
    return frame.channels === 1
}

export type CallAudioSink = 'mse' | 'blob'

type TypeSupport = (contentType: string) => boolean

/** `MediaSource` or Safari's `ManagedMediaSource` support for a content type. */
function mediaSourceSupports(contentType: string): boolean {
    const managed = (globalThis as { ManagedMediaSource?: typeof MediaSource }).ManagedMediaSource
    return [globalThis.MediaSource, managed].some((ctor) => {
        try {
            return typeof ctor !== 'undefined' && typeof ctor.isTypeSupported === 'function' && ctor.isTypeSupported(contentType)
        } catch {
            return false
        }
    })
}

/**
 * Where a call's replies play: streamed through MediaSource (`mse`), or as
 * sequential Blob groups (`blob`) when the announced type is one MediaSource
 * refuses. No announcement keeps the default (`mse`, which still falls back
 * to Blobs per turn when MediaSource is missing or fails).
 */
export function chooseCallAudioSink(audio?: Partial<VoiceAudioFormat> | null, supports: TypeSupport = mediaSourceSupports): CallAudioSink {
    if (!audio) return 'mse'
    const contentType = typeof audio.content_type === 'string' ? audio.content_type.trim() : ''
    if (!contentType) return 'mse'
    return supports(contentType) ? 'mse' : 'blob'
}
