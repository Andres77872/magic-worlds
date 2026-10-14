import { describe, expect, it, vi } from 'vitest'
import { buildPcm16WavSegment, type CapturedVoiceSegment, createPcm16WavBlob, VoiceVadWorkletSegmenter } from './voiceVadWorklet'

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

describe('VoiceVadWorkletSegmenter speech_end pairing (R0-BE-37)', () => {
    function segmentMessage(samples = [0, 1_000, -1_000, 0]) {
        return { type: 'segment' as const, samples: Int16Array.from(samples), sample_rate: 16_000, started_at_ms: 0, speech_ms: 0, silence_ms: 0 }
    }

    /** The worklet's speech_end after a natural pause that waited `tailMs` of quiet. */
    function pauseEnd(tailMs: number) {
        return { type: 'vad' as const, state: 'speech_end' as const, at_ms: 0, rms: 0, ended_by_silence: true, silence_tail_ms: tailMs }
    }

    it('stamps a segment with its end of speech when the speech_end arrives while it is still being hashed', async () => {
        const onSegment = vi.fn<(segment: CapturedVoiceSegment) => void>()
        const segmenter = new VoiceVadWorkletSegmenter({ onSegment })

        // The worklet posts the segment, then its speech_end; the hash is still running.
        const pending = segmenter.handleMessage(segmentMessage())
        segmenter.noteSpeechEnd(pauseEnd(550), 1_784.5)
        const segment = await pending

        expect(onSegment).toHaveBeenCalledWith(segment)
        // The 550 ms hang-over is part of the wait: the user stopped 550 ms before the message.
        expect(segment?.speech_end_perf_ms).toBe(1_234.5)
    })

    it('stamps an already emitted segment in place, so a queued upload still reads it', async () => {
        const segmenter = new VoiceVadWorkletSegmenter({ onSegment: vi.fn() })

        const segment = await segmenter.handleMessage(segmentMessage())
        expect(segment?.speech_end_perf_ms).toBeUndefined()

        segmenter.noteSpeechEnd(pauseEnd(800), 2_800)
        expect(segment?.speech_end_perf_ms).toBe(2_000)
    })

    it('pairs back-to-back segments with their own speech_end, in order', async () => {
        const segmenter = new VoiceVadWorkletSegmenter({ onSegment: vi.fn() })

        const first = segmenter.handleMessage(segmentMessage())
        segmenter.noteSpeechEnd(pauseEnd(0), 100)
        const second = segmenter.handleMessage(segmentMessage([5, 6]))
        segmenter.noteSpeechEnd(pauseEnd(450), 1_350)

        expect((await first)?.speech_end_perf_ms).toBe(100)
        expect((await second)?.speech_end_perf_ms).toBe(900)
    })

    it('never stamps a max-length cut (the user is still talking), and the next segment keeps its own pairing', async () => {
        const segmenter = new VoiceVadWorkletSegmenter({ onSegment: vi.fn() })

        const cut = segmenter.handleMessage(segmentMessage())
        segmenter.noteSpeechEnd({ type: 'vad', state: 'speech_end', at_ms: 0, rms: 0, ended_by_silence: false, silence_tail_ms: 0 }, 500)
        const rest = segmenter.handleMessage(segmentMessage([5, 6]))
        segmenter.noteSpeechEnd(pauseEnd(800), 3_000)

        expect((await cut)?.speech_end_perf_ms).toBeUndefined()
        expect((await rest)?.speech_end_perf_ms).toBe(2_200)
    })

    it.each([
        ['no fields', {}],
        ['no silence tail', { ended_by_silence: true }],
        ['a negative tail', { ended_by_silence: true, silence_tail_ms: -5 }],
        ['a tail that is not a number', { ended_by_silence: true, silence_tail_ms: '550' }],
        ['no ended_by_silence', { silence_tail_ms: 550 }],
    ])('consumes the slot but stamps nothing for a speech_end with %s', async (_label, message) => {
        const segmenter = new VoiceVadWorkletSegmenter({ onSegment: vi.fn() })

        const first = segmenter.handleMessage(segmentMessage())
        segmenter.noteSpeechEnd(message, 1_000)
        const second = segmenter.handleMessage(segmentMessage([5, 6]))
        segmenter.noteSpeechEnd(pauseEnd(100), 2_000)

        expect((await first)?.speech_end_perf_ms).toBeUndefined()
        expect((await second)?.speech_end_perf_ms).toBe(1_900)
    })

    it('ignores a speech_end with no segment waiting, and never stamps direct emits', async () => {
        const segmenter = new VoiceVadWorkletSegmenter({ onSegment: vi.fn() })

        segmenter.noteSpeechEnd(pauseEnd(0), 50)
        const direct = await segmenter.emitPcm16([1, 2, 3])
        segmenter.noteSpeechEnd(pauseEnd(0), 60)
        const fromWorklet = segmenter.handleMessage(segmentMessage())
        segmenter.noteSpeechEnd(pauseEnd(0), 70)

        expect(direct.speech_end_perf_ms).toBeUndefined()
        expect((await fromWorklet)?.speech_end_perf_ms).toBe(70)
    })

    it('receives on performance.now() by default', async () => {
        const now = vi.spyOn(performance, 'now').mockReturnValue(4_321)
        try {
            const segmenter = new VoiceVadWorkletSegmenter({ onSegment: vi.fn() })
            const segment = segmenter.handleMessage(segmentMessage())
            segmenter.noteSpeechEnd(pauseEnd(321))
            expect((await segment)?.speech_end_perf_ms).toBe(4_000)
        } finally {
            now.mockRestore()
        }
    })
})
