/**
 * Raw PCM lab audio (R1-FE-06). An ElevenLabs `pcm_<rate>` render is headerless
 * signed 16-bit little-endian mono, which no browser plays. The console wraps it
 * in a RIFF/WAVE header for playback only; a download keeps the raw bytes as
 * `.pcm`. MP3 and WAV renders pass through unchanged.
 */

/** ElevenLabs PCM is always 16-bit mono; 24 kHz is the console's PCM option. */
export const PCM_DEFAULT_SAMPLE_RATE = 24000
const WAV_HEADER_BYTES = 44

/** Content types a raw PCM answer may carry (`audio/pcm`, `audio/L16`, `audio/x-pcm`, `audio/raw`). */
const PCM_CONTENT_TYPE = /^\s*audio\/(?:pcm|l16|x-pcm|raw)\b/i
/** Containers the browser plays as they are. */
const CONTAINER_CONTENT_TYPE = /^\s*audio\/(?:mpeg|mp3|wav|wave|x-wav|vnd\.wave|ogg|opus|webm|aac|mp4|flac)\b/i
const PCM_FORMAT = /^pcm_(\d{4,6})$/

/**
 * True for a raw PCM answer: a PCM content type, or a `pcm_*` request answered
 * without a known container type.
 */
export function isPcmAudio(contentType: string | null | undefined, outputFormat?: string | null): boolean {
    const type = contentType ?? ''
    if (PCM_CONTENT_TYPE.test(type)) return true
    return Boolean(outputFormat && PCM_FORMAT.test(outputFormat) && !CONTAINER_CONTENT_TYPE.test(type))
}

/** The sample rate of a PCM answer: the content type's `rate=` parameter, else the `pcm_<rate>` format, else 24 kHz. */
export function pcmSampleRate(contentType: string | null | undefined, outputFormat?: string | null): number {
    const fromType = /(?:^|;)\s*rate\s*=\s*(\d{4,6})\b/i.exec(contentType ?? '')
    const fromFormat = outputFormat ? PCM_FORMAT.exec(outputFormat) : null
    const rate = Number(fromType?.[1] ?? fromFormat?.[1])
    return Number.isInteger(rate) && rate > 0 ? rate : PCM_DEFAULT_SAMPLE_RATE
}

export interface PcmFormat {
    sampleRate: number
    channels?: number
    bitsPerSample?: number
}

/**
 * Wraps PCM samples in a 44-byte RIFF/WAVE (format 1) header. A trailing
 * partial sample frame is dropped, so the data chunk is always whole frames.
 */
export function pcmToWav(pcm: ArrayBuffer | Uint8Array, { sampleRate, channels = 1, bitsPerSample = 16 }: PcmFormat): Blob {
    const bytes = pcm instanceof Uint8Array ? pcm : new Uint8Array(pcm)
    const blockAlign = channels * (bitsPerSample / 8)
    const dataLength = bytes.byteLength - (bytes.byteLength % blockAlign)
    const header = new ArrayBuffer(WAV_HEADER_BYTES)
    const view = new DataView(header)
    const ascii = (offset: number, text: string) => {
        for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index))
    }
    ascii(0, 'RIFF')
    view.setUint32(4, 36 + dataLength, true)
    ascii(8, 'WAVE')
    ascii(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, channels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * blockAlign, true)
    view.setUint16(32, blockAlign, true)
    view.setUint16(34, bitsPerSample, true)
    ascii(36, 'data')
    view.setUint32(40, dataLength, true)
    return new Blob([header, bytes.slice(0, dataLength)], { type: 'audio/wav' })
}

async function blobBytes(blob: Blob): Promise<ArrayBuffer> {
    if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer()
    return new Response(blob).arrayBuffer()
}

/** A Blob the browser can play: PCM is wrapped as WAV; anything else is returned as it is. */
export async function playableAudioBlob(blob: Blob, contentType: string | null | undefined, outputFormat?: string | null): Promise<Blob> {
    if (!isPcmAudio(contentType, outputFormat)) return blob
    return pcmToWav(await blobBytes(blob), { sampleRate: pcmSampleRate(contentType, outputFormat) })
}

/** The download extension: `pcm` for raw PCM, `wav`, `ogg`, `opus`, else `mp3`. */
export function audioExtension(contentType: string | null | undefined, outputFormat?: string | null): string {
    const type = (contentType ?? '').toLowerCase()
    if (isPcmAudio(type, outputFormat)) return 'pcm'
    if (type.includes('wav')) return 'wav'
    if (type.includes('ogg')) return 'ogg'
    if (type.includes('opus')) return 'opus'
    if (!CONTAINER_CONTENT_TYPE.test(type) && outputFormat?.startsWith('wav_')) return 'wav'
    return 'mp3'
}
