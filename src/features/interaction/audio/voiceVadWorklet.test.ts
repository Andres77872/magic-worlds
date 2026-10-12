import { describe, expect, it } from 'vitest'
import { buildPcm16WavSegment, createPcm16WavBlob } from './voiceVadWorklet'

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

describe('voiceVadWorklet WAV encoding', () => {
    it('writes typed and plain samples as the same little-endian PCM16 WAV', async () => {
        const samples = [0, 1, -1, 32_767, -32_768, 12_345, -12_345]
        const typed = await createPcm16WavBlob(Int16Array.from(samples)).arrayBuffer()
        const plain = await createPcm16WavBlob(samples).arrayBuffer()

        expect(new Uint8Array(typed)).toEqual(new Uint8Array(plain))
        const view = new DataView(typed)
        expect(view.getUint32(24, true)).toBe(16_000)
        expect(view.getUint32(40, true)).toBe(samples.length * 2)
        samples.forEach((sample, index) => expect(view.getInt16(44 + index * 2, true)).toBe(sample))
    })

    it('copies only the viewed samples of a typed subarray', async () => {
        const backing = Int16Array.from([9, 9, 100, -200, 300, 9])
        const wav = await createPcm16WavBlob(backing.subarray(2, 5)).arrayBuffer()

        expect(Array.from(new Int16Array(wav.slice(44)))).toEqual([100, -200, 300])
    })

    it('clamps plain samples outside the PCM16 range', async () => {
        const wav = await createPcm16WavBlob([40_000, -40_000, 1.6]).arrayBuffer()

        expect(Array.from(new Int16Array(wav.slice(44)))).toEqual([32_767, -32_768, 2])
    })

    it('hashes exactly the bytes it uploads', async () => {
        const segment = await buildPcm16WavSegment({ seq: 1, startedAtMs: 0, samples: Int16Array.from([1, 2, 3, -4]) })
        const uploaded = await segment.audio.arrayBuffer()

        expect(segment.byte_length).toBe(44 + 8)
        expect(segment.audio_sha256).toBe(await sha256Hex(uploaded))
    })
})
