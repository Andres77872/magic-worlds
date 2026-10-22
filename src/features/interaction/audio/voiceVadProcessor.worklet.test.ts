import { afterEach, describe, expect, it, vi } from 'vitest'
import workletSource from './voiceVadProcessor.worklet.js?raw'

// The worklet is plain JS evaluated in an AudioWorkletGlobalScope. Evaluate its source with
// that scope's globals (AudioWorkletProcessor, registerProcessor, sampleRate) stubbed.

type PortMessage = { type: string } & Record<string, unknown>
type SegmentMessage = { type: 'segment'; samples: Int16Array; sample_rate: number; started_at_ms: number; speech_ms: number; silence_ms: number }

interface TestProcessor {
    port: { postMessage: ReturnType<typeof vi.fn>; onmessage: ((event: { data: unknown }) => void) | null }
    process(inputs: Float32Array[][]): boolean
}
type ProcessorCtor = new (options?: { processorOptions?: Record<string, unknown> }) => TestProcessor

const QUANTUM = 128

class FakeAudioWorkletProcessor {
    port = { postMessage: vi.fn(), onmessage: null }
}

function loadProcessor(rate: number): ProcessorCtor {
    const registered: { name?: string; ctor?: ProcessorCtor } = {}
    vi.stubGlobal('AudioWorkletProcessor', FakeAudioWorkletProcessor)
    vi.stubGlobal('registerProcessor', (name: string, ctor: ProcessorCtor) => {
        registered.name = name
        registered.ctor = ctor
    })
    vi.stubGlobal('sampleRate', rate)
    new Function(workletSource)()
    expect(registered.name).toBe('voice-vad-processor')
    return registered.ctor!
}

function createProcessor(rate: number, processorOptions: Record<string, unknown> = {}): TestProcessor {
    const Processor = loadProcessor(rate)
    return new Processor({ processorOptions })
}

/** Sample count for `seconds`, rounded up to whole render quanta. */
function quantaLength(rate: number, seconds: number): number {
    return Math.ceil((rate * seconds) / QUANTUM) * QUANTUM
}

function silence(rate: number, seconds: number): Float32Array {
    return new Float32Array(quantaLength(rate, seconds))
}

function tone(rate: number, seconds: number, frequency = 440, amplitude = 0.3): Float32Array {
    const samples = new Float32Array(quantaLength(rate, seconds))
    for (let index = 0; index < samples.length; index += 1) {
        samples[index] = amplitude * Math.sin((2 * Math.PI * frequency * index) / rate)
    }
    return samples
}

/** Deterministic uniform noise with the given RMS (a fan / air-conditioner stand-in). */
function noise(rate: number, seconds: number, rms: number, seed = 12345): Float32Array {
    const samples = new Float32Array(quantaLength(rate, seconds))
    const amplitude = rms * Math.sqrt(3)
    let state = seed >>> 0
    for (let index = 0; index < samples.length; index += 1) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0
        samples[index] = amplitude * ((state / 0xffffffff) * 2 - 1)
    }
    return samples
}

function concat(...parts: Float32Array[]): Float32Array {
    const out = new Float32Array(parts.reduce((sum, part) => sum + part.length, 0))
    let offset = 0
    for (const part of parts) {
        out.set(part, offset)
        offset += part.length
    }
    return out
}

interface Posted {
    /** Index of the render quantum during which the message was posted. */
    frame: number
    message: PortMessage
    transfer?: Transferable[]
}

/** Feeds `signal` quantum by quantum; returns every message posted, tagged with its quantum. */
function drive(processor: TestProcessor, signal: Float32Array, startFrame = 0): Posted[] {
    const posted: Posted[] = []
    const calls = processor.port.postMessage.mock.calls
    for (let offset = 0, frame = startFrame; offset + QUANTUM <= signal.length; offset += QUANTUM, frame += 1) {
        const before = calls.length
        processor.process([[signal.subarray(offset, offset + QUANTUM)]])
        for (const [message, transfer] of calls.slice(before)) posted.push({ frame, message, transfer })
    }
    return posted
}

function segments(posted: Posted[]): Array<Posted & { message: SegmentMessage }> {
    return posted.filter((entry): entry is Posted & { message: SegmentMessage } => entry.message.type === 'segment')
}

function vadStates(posted: Posted[]): string[] {
    return posted.filter((entry) => entry.message.type === 'vad').map((entry) => entry.message.state as string)
}

function toPcm16(sample: number): number {
    const clamped = Math.max(-1, Math.min(1, sample))
    // `+ 0` normalizes -0 (an Int16Array stores it as 0).
    return Math.max(-32768, Math.min(32767, Math.round(clamped < 0 ? clamped * 32768 : clamped * 32767))) + 0
}

function zeroCrossings(samples: Int16Array): number {
    let count = 0
    for (let index = 1; index < samples.length; index += 1) {
        if ((samples[index - 1] < 0) !== (samples[index] < 0)) count += 1
    }
    return count
}

describe('voiceVadProcessor.worklet', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it.each([44_100, 48_000])('resamples %i Hz to 16 kHz without a speed or pitch shift', (rate) => {
        const processor = createProcessor(rate, { preRollMs: 0, maxSegmentMs: 1_000 })
        const lead = silence(rate, 0.5)
        const posted = drive(processor, concat(lead, tone(rate, 2, 440)))

        const [first] = segments(posted)
        expect(first.message.sample_rate).toBe(16_000)
        expect(first.message.samples).toBeInstanceOf(Int16Array)
        expect(first.message.samples).toHaveLength(16_000)
        // 16 000 output samples (the 1 s cut) must have consumed 1 s of input, ±1 quantum.
        // The old integer-ratio decimator needed 1.088 s at 44.1 kHz (it really produced 14.7 kHz).
        const onsetFrame = lead.length / QUANTUM
        const inputSeconds = ((first.frame - onsetFrame + 1) * QUANTUM) / rate
        expect(Math.abs(inputSeconds - 1)).toBeLessThanOrEqual(QUANTUM / rate)
        // 440 Hz over 1 s keeps 880 zero crossings (a mislabelled rate would shift it).
        expect(Math.abs(zeroCrossings(first.message.samples) - 880)).toBeLessThanOrEqual(3)
    })

    it.each([44_100, 48_000])('turns N seconds of %i Hz input into N × 16 000 samples', (rate) => {
        const processor = createProcessor(rate, { preRollMs: 0, maxSegmentMs: 30_000 })
        const lead = silence(rate, 0.5)
        const posted = drive(processor, concat(lead, tone(rate, 2, 300), silence(rate, 1.5)))

        const found = segments(posted)
        expect(found).toHaveLength(1)
        const [segment] = found
        const inputFrames = segment.frame - lead.length / QUANTUM + 1
        // Of the 800 ms end-of-turn pause (whole quanta) only the first 200 ms is sent.
        const pauseFrames = Math.round(800 / ((QUANTUM / rate) * 1_000))
        const expected = ((inputFrames - pauseFrames) * QUANTUM * 16_000) / rate + 200 * 16
        expect(Math.abs(segment.message.samples.length - expected)).toBeLessThanOrEqual((QUANTUM * 16_000) / rate + 1)
        expect(Math.abs(segment.message.speech_ms - 2_000)).toBeLessThanOrEqual(10)
        expect(segment.message.speech_ms + segment.message.silence_ms).toBe(Math.round(segment.message.samples.length / 16))
    })

    it('passes 16 kHz input through untouched and transfers the segment buffer', () => {
        const processor = createProcessor(16_000, { preRollMs: 0 })
        const lead = silence(16_000, 0.5)
        const speech = tone(16_000, 0.5, 440)
        const posted = drive(processor, concat(lead, speech, silence(16_000, 1)))

        const [segment] = segments(posted)
        const samples = segment.message.samples
        for (let index = 0; index < speech.length; index += 1) {
            expect(samples[index]).toBe(toPcm16(speech[index]))
        }
        expect(segment.transfer).toEqual([samples.buffer])
        expect(vadStates(posted)).toEqual(['speech_start', 'speech_end'])
    })

    it('prepends the pre-roll captured before the speech onset', () => {
        const processor = createProcessor(16_000, { preRollMs: 300 })
        const quiet = tone(16_000, 0.5, 97, 0.002)
        const speech = tone(16_000, 0.5, 440)
        const posted = drive(processor, concat(quiet, speech, silence(16_000, 1)))

        const [segment] = segments(posted)
        const samples = segment.message.samples
        const preRoll = 4_800
        for (let index = 0; index < preRoll; index += 1) {
            expect(samples[index]).toBe(toPcm16(quiet[quiet.length - preRoll + index]))
        }
        expect(samples[preRoll]).toBe(toPcm16(speech[0]))
        // Only the first 200 ms of the 800 ms end-of-turn pause is sent.
        expect(samples.length).toBe(preRoll + speech.length + 200 * 16)
        expect(segment.message.speech_ms).toBe(speech.length / 16)
        // Pre-roll counts as non-speech audio in the segment.
        expect(segment.message.silence_ms).toBe(300 + 200)
    })

    it('re-seeds the next pre-roll from the full pause, not just the part that was sent', () => {
        const processor = createProcessor(16_000, { preRollMs: 300 })
        const tail = tone(16_000, 0.8, 97, 0.002)
        const first = drive(processor, concat(silence(16_000, 0.5), tone(16_000, 0.5, 440), tail))
        expect(segments(first)).toHaveLength(1)

        const next = tone(16_000, 0.5, 440)
        const [segment] = segments(drive(processor, concat(next, silence(16_000, 1))))
        // The pre-roll is the end of the 800 ms pause, which was never part of a sent segment.
        const preRoll = 4_800
        for (let index = 0; index < preRoll; index += 1) {
            expect(segment.message.samples[index]).toBe(toPcm16(tail[tail.length - preRoll + index]))
        }
        expect(segment.message.samples[preRoll]).toBe(toPcm16(next[0]))
    })

    it.each([16_000, 48_000])('reports the end-of-turn hang-over on a pause-ended speech_end at %i Hz (R0-BE-37)', (rate) => {
        const processor = createProcessor(rate, { preRollMs: 0, silenceMsToEnd: 550 })
        const posted = drive(processor, concat(silence(rate, 0.5), tone(rate, 0.5, 440), silence(rate, 1)))

        const messages = posted.map((entry) => entry.message)
        const endIndex = messages.findIndex((message) => message.type === 'vad' && message.state === 'speech_end')
        // Posted right after the segment it closed.
        expect(messages[endIndex - 1].type).toBe('segment')
        const end = messages[endIndex]
        expect(end.ended_by_silence).toBe(true)
        // The quiet waited after the last voiced audio: 550 ms, in whole render quanta.
        const quantumMs = (QUANTUM / rate) * 1_000
        expect(Math.abs((end.silence_tail_ms as number) - 550)).toBeLessThanOrEqual(quantumMs + 1)
    })

    it.each([[16_000, 0], [16_000, 300], [48_000, 300]])('dates speech_start back to the speech onset at %i Hz with %i ms of pre-roll', (rate, preRollMs) => {
        // During playback a turn needs 500 ms of speech before it is announced.
        const processor = createProcessor(rate, { preRollMs, minSpeechMs: 500 })
        const lead = silence(rate, 0.5)
        const posted = drive(processor, concat(lead, tone(rate, 1, 440), silence(rate, 1)))

        const start = posted.find((entry) => entry.message.type === 'vad' && entry.message.state === 'speech_start')!
        // The message comes ~500 ms after the onset, and says so; the pre-roll is not speech.
        const quantumMs = (QUANTUM / rate) * 1_000
        const heard = (start.frame - lead.length / QUANTUM + 1) * quantumMs
        expect(Math.abs((start.message.onset_lag_ms as number) - 500)).toBeLessThanOrEqual(quantumMs + 1)
        expect(Math.abs((start.message.onset_lag_ms as number) - heard)).toBeLessThanOrEqual(quantumMs + 1)
    })

    it('marks the speech_end of a max-length cut as not ended by silence, with no hang-over (R0-BE-37)', () => {
        const processor = createProcessor(16_000, { preRollMs: 0, maxSegmentMs: 2_000 })
        const posted = drive(processor, concat(silence(16_000, 0.5), tone(16_000, 3, 440), silence(16_000, 1)))

        const ends = posted.map((entry) => entry.message).filter((message) => message.type === 'vad' && message.state === 'speech_end')
        expect(ends).toHaveLength(2)
        expect(ends[0]).toMatchObject({ ended_by_silence: false, silence_tail_ms: 0 })
        expect(ends[1]).toMatchObject({ ended_by_silence: true, silence_tail_ms: 800 })
    })

    it('cuts at maxSegmentMs including the pre-roll, without losing or repeating audio', () => {
        const processor = createProcessor(16_000, { preRollMs: 300, maxSegmentMs: 2_000 })
        const quiet = tone(16_000, 0.5, 97, 0.002)
        const speech = tone(16_000, 5, 440)
        const posted = drive(processor, concat(quiet, speech))

        const found = segments(posted)
        expect(found.length).toBeGreaterThanOrEqual(2)
        const first = found[0].message
        expect(first.samples).toHaveLength(32_000)
        expect(first.speech_ms).toBe(2_000 - 300)
        expect(first.samples[4_800]).toBe(toPcm16(speech[0]))
        for (const { message } of found) expect(message.samples.length).toBeLessThanOrEqual(32_000)
        expect(vadStates(posted).slice(0, 3)).toEqual(['speech_start', 'speech_end', 'speech_start'])

        // The next segment continues exactly where the cut landed.
        const second = found[1].message.samples
        const consumed = 32_000 - 4_800
        for (let index = 0; index < 256; index += 1) {
            expect(second[index]).toBe(toPcm16(speech[consumed + index]))
        }
    })

    it('applies a configure message to a live processor', () => {
        const processor = createProcessor(16_000, { preRollMs: 0 })
        const lead = silence(16_000, 0.5)
        drive(processor, concat(lead, tone(16_000, 2, 440)))
        expect(processor.port.postMessage.mock.calls.some(([message]) => message.type === 'segment')).toBe(false)

        // Lowering the max below the running segment's length flushes it immediately, cut to the new max.
        const before = processor.port.postMessage.mock.calls.length
        processor.port.onmessage?.({ data: { type: 'configure', maxSegmentMs: 1_000 } })
        const flushed = processor.port.postMessage.mock.calls.slice(before).map(([message]) => message as PortMessage)
        expect(flushed.map((message) => message.type)).toEqual(['segment', 'vad'])
        expect((flushed[0] as SegmentMessage).samples).toHaveLength(16_000)

        // Raising the max and shortening the end-of-turn silence apply from the next quantum.
        processor.port.onmessage?.({ data: { type: 'configure', maxSegmentMs: 10_000, silenceMsToEnd: 200 } })
        const posted = drive(processor, concat(silence(16_000, 1), tone(16_000, 9, 440), silence(16_000, 1)))
        const found = segments(posted)
        expect(found).toHaveLength(1)
        expect(found[0].message.speech_ms).toBe(9_000)
        expect(Math.abs(found[0].message.silence_ms - 200)).toBeLessThanOrEqual(8)
    })

    it('ignores steady background noise that is present from the start', () => {
        const processor = createProcessor(16_000)
        const posted = drive(processor, noise(16_000, 10, 0.03))
        expect(segments(posted)).toHaveLength(0)
        expect(vadStates(posted)).toEqual([])

        // Real speech over the noise is still detected.
        const after = drive(processor, concat(tone(16_000, 1, 440), noise(16_000, 1.5, 0.03, 99)), 10 * 125)
        expect(vadStates(after)).toEqual(['speech_start', 'speech_end'])
    })

    it('does not let noise that starts mid-call hold a segment open until the max cut', () => {
        const processor = createProcessor(16_000)
        const posted = drive(processor, concat(silence(16_000, 1), noise(16_000, 12, 0.03)))

        const found = segments(posted)
        // The floor adapts: at most one short segment, ended by silence well before 7.5 s…
        expect(found.length).toBeLessThanOrEqual(1)
        for (const { message } of found) expect(message.samples.length).toBeLessThan(5 * 16_000)
        // …and nothing re-opens once the noise is learned.
        const starts = posted.filter((entry) => entry.message.state === 'speech_start')
        expect(starts.length).toBeLessThanOrEqual(1)
        for (const start of starts) expect(start.frame).toBeLessThan(2 * 125)
    })

    it('posts a throttled level for the call meter', () => {
        const processor = createProcessor(48_000, { levelIntervalMs: 50 })
        const posted = drive(processor, tone(48_000, 1, 440))
        const levels = posted.filter((entry) => entry.message.type === 'level')
        expect(levels.length).toBeGreaterThanOrEqual(19)
        expect(levels.length).toBeLessThanOrEqual(21)
        expect(levels[levels.length - 1].message.rms).toBeGreaterThan(0.5)
    })
})
