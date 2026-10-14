import { describe, expect, it } from 'vitest'
import { audioExtension, isPcmAudio, pcmSampleRate, pcmToWav, playableAudioBlob } from './pcmAudio'

async function bytesOf(blob: Blob): Promise<Uint8Array> {
    return new Uint8Array(await blob.arrayBuffer())
}

const ascii = (bytes: Uint8Array, start: number, length: number) => String.fromCharCode(...bytes.slice(start, start + length))

describe('pcmAudio (R1-FE-06)', () => {
    it('wraps 16-bit mono PCM in a 44-byte RIFF/WAVE header', async () => {
        const pcm = new Uint8Array([1, 0, 2, 0, 3, 0])
        const wav = pcmToWav(pcm, { sampleRate: 24000 })
        expect(wav.type).toBe('audio/wav')
        const bytes = await bytesOf(wav)
        const view = new DataView(bytes.buffer)
        expect(bytes.byteLength).toBe(44 + 6)
        expect(ascii(bytes, 0, 4)).toBe('RIFF')
        expect(view.getUint32(4, true)).toBe(36 + 6)
        expect(ascii(bytes, 8, 8)).toBe('WAVEfmt ')
        expect(view.getUint32(16, true)).toBe(16)
        expect(view.getUint16(20, true)).toBe(1) // PCM
        expect(view.getUint16(22, true)).toBe(1) // mono
        expect(view.getUint32(24, true)).toBe(24000)
        expect(view.getUint32(28, true)).toBe(48000) // byte rate
        expect(view.getUint16(32, true)).toBe(2) // block align
        expect(view.getUint16(34, true)).toBe(16)
        expect(ascii(bytes, 36, 4)).toBe('data')
        expect(view.getUint32(40, true)).toBe(6)
        expect(Array.from(bytes.slice(44))).toEqual([1, 0, 2, 0, 3, 0])
    })

    it('drops a trailing partial sample', async () => {
        const bytes = await bytesOf(pcmToWav(new Uint8Array([1, 0, 2]), { sampleRate: 22050 }))
        expect(bytes.byteLength).toBe(46)
        expect(new DataView(bytes.buffer).getUint32(40, true)).toBe(2)
        expect(new DataView(bytes.buffer).getUint32(24, true)).toBe(22050)
    })

    it('recognises raw PCM by content type or by a pcm_* request without a container type', () => {
        expect(isPcmAudio('audio/pcm')).toBe(true)
        expect(isPcmAudio('audio/L16;rate=24000')).toBe(true)
        expect(isPcmAudio('application/octet-stream', 'pcm_24000')).toBe(true)
        expect(isPcmAudio('', 'pcm_24000')).toBe(true)
        expect(isPcmAudio('audio/wav', 'pcm_24000')).toBe(false)
        expect(isPcmAudio('audio/wav;codec=pcm_s16le')).toBe(false)
        expect(isPcmAudio('audio/mpeg', 'mp3_44100_128')).toBe(false)
    })

    it('reads the sample rate from the content type, else the format, else 24 kHz', () => {
        expect(pcmSampleRate('audio/pcm; rate=16000', 'pcm_24000')).toBe(16000)
        expect(pcmSampleRate('audio/pcm', 'pcm_22050')).toBe(22050)
        expect(pcmSampleRate('audio/pcm')).toBe(24000)
    })

    it('makes PCM playable and passes MP3 and WAV through unchanged', async () => {
        const mp3 = new Blob([new Uint8Array([0xff, 0xfb])], { type: 'audio/mpeg' })
        expect(await playableAudioBlob(mp3, 'audio/mpeg', 'mp3_44100_128')).toBe(mp3)
        const wav = new Blob([new Uint8Array([0x52])], { type: 'audio/wav' })
        expect(await playableAudioBlob(wav, 'audio/wav', 'wav_44100')).toBe(wav)
        const pcm = new Blob([new Uint8Array([0, 1, 0, 1])], { type: 'audio/pcm' })
        const playable = await playableAudioBlob(pcm, 'audio/pcm', 'pcm_24000')
        expect(playable.type).toBe('audio/wav')
        expect(playable.size).toBe(48)
    })

    it('names downloads by what was served', () => {
        expect(audioExtension('audio/pcm', 'pcm_24000')).toBe('pcm')
        expect(audioExtension('audio/wav', 'wav_44100')).toBe('wav')
        expect(audioExtension('audio/x-wav')).toBe('wav')
        expect(audioExtension('application/octet-stream', 'wav_24000')).toBe('wav')
        expect(audioExtension('audio/mpeg', 'mp3_44100_128')).toBe('mp3')
        expect(audioExtension('audio/ogg')).toBe('ogg')
        expect(audioExtension('')).toBe('mp3')
    })
})
