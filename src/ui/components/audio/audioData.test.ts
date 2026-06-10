import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAudioDataCaches, getAudioBlob, getAudioPeaks, PEAK_BUCKETS, pseudoPeaks } from './audioData'

function okBlobResponse(): Response {
    return {
        ok: true,
        status: 200,
        blob: async () => new Blob(['audio-bytes']),
    } as unknown as Response
}

/** Fake AudioContext whose decode returns a buffer with one loud spike. */
function stubAudioContext(samples: Float32Array, channels = 1) {
    class FakeAudioContext {
        async decodeAudioData(_buf: ArrayBuffer) {
            return {
                numberOfChannels: channels,
                length: samples.length,
                getChannelData: () => samples,
            } as unknown as AudioBuffer
        }
        async close() {}
    }
    vi.stubGlobal('AudioContext', FakeAudioContext)
}

beforeEach(() => {
    clearAudioDataCaches()
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('getAudioBlob', () => {
    it('dedupes concurrent and repeated calls into one fetch', async () => {
        const fetchMock = vi.fn(async () => okBlobResponse())
        vi.stubGlobal('fetch', fetchMock)

        const [a, b] = await Promise.all([getAudioBlob('https://x/1.mp3'), getAudioBlob('https://x/1.mp3')])
        await getAudioBlob('https://x/1.mp3')

        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(a).toBe(b)
    })

    it('evicts a failed fetch so the next call retries', async () => {
        const fetchMock = vi
            .fn()
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValueOnce(okBlobResponse())
        vi.stubGlobal('fetch', fetchMock)

        await expect(getAudioBlob('https://x/2.mp3')).rejects.toThrow('offline')
        await expect(getAudioBlob('https://x/2.mp3')).resolves.toBeInstanceOf(Blob)
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('rejects on a non-OK response', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 }) as unknown as Response))
        await expect(getAudioBlob('https://x/3.mp3')).rejects.toThrow('404')
    })

    it('evicts the oldest track when the cache cap is reached', async () => {
        const fetchMock = vi.fn(async () => okBlobResponse())
        vi.stubGlobal('fetch', fetchMock)

        for (let i = 0; i < 13; i++) await getAudioBlob(`https://x/cap-${i}.mp3`)
        // Track 0 was evicted → refetches; track 12 is still cached.
        await getAudioBlob('https://x/cap-0.mp3')
        await getAudioBlob('https://x/cap-12.mp3')

        expect(fetchMock).toHaveBeenCalledTimes(14)
    })
})

describe('getAudioPeaks', () => {
    it('normalizes peaks to the loudest bucket with a 0.08 floor', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => okBlobResponse()))
        const samples = new Float32Array(PEAK_BUCKETS * 10)
        samples[5] = 0.5 // bucket 0 — the loudest
        samples[15] = 0.25 // bucket 1 — half as loud
        stubAudioContext(samples)

        const peaks = await getAudioPeaks('https://x/peaks.mp3')

        expect(peaks).toHaveLength(PEAK_BUCKETS)
        expect(peaks[0]).toBe(1)
        expect(peaks[1]).toBeCloseTo(0.5)
        // Silent buckets floor at 0.08 so bars stay visible.
        expect(peaks[10]).toBe(0.08)
    })

    it('rejects when Web Audio is unavailable (caller falls back to pseudoPeaks)', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => okBlobResponse()))
        // jsdom has no AudioContext by default — ensure it stays undefined.
        await expect(getAudioPeaks('https://x/no-webaudio.mp3')).rejects.toThrow('Web Audio is unavailable')
    })
})

describe('pseudoPeaks', () => {
    it('is deterministic for a seed and distinct across seeds', () => {
        const a1 = pseudoPeaks('asset-1')
        const a2 = pseudoPeaks('asset-1')
        const b = pseudoPeaks('asset-2')
        expect(a1).toEqual(a2)
        expect(a1).not.toEqual(b)
        expect(a1).toHaveLength(PEAK_BUCKETS)
        for (const value of a1) {
            expect(value).toBeGreaterThan(0.1)
            expect(value).toBeLessThan(1)
        }
    })
})
