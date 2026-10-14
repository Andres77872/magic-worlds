/**
 * voiceVadProcessor.worklet.js — the AudioWorklet half of the voice VAD.
 *
 * This MUST be plain JavaScript (no TypeScript syntax, no imports): it is loaded
 * verbatim by `audioWorklet.addModule(new URL(...))`, so Vite copies it as-is with a
 * JS MIME type in BOTH dev and prod. Its message/option types are mirrored by hand in
 * `voiceVadWorklet.ts`.
 *
 * Per render quantum it:
 *   1. resamples the input to 16 kHz (pass-through when the context already runs at
 *      16 kHz). Firefox can't feed a getUserMedia stream into a 16 kHz context, so 44.1 /
 *      48 kHz input is a normal case — the resampler handles any ratio exactly;
 *   2. gates speech on per-frame RMS against max(speechThreshold, 3 × adaptive noise
 *      floor), with a lower threshold to *stay* in speech (hysteresis), so a steady
 *      background noise (fan) can't hold a segment open until the max-length cut;
 *   3. keeps the last `preRollMs` of audio while idle and prepends it when speech starts,
 *      so soft onsets aren't clipped;
 *   4. posts one `segment` on a natural pause (`silenceMsToEnd`) or at `maxSegmentMs`
 *      (pre-roll included). Blips with less than `minSpeechMs` of voiced audio never
 *      announce a turn and are discarded. A pause-ended segment keeps only
 *      `TRAILING_SILENCE_KEEP_MS` of the pause.
 * It also streams a throttled `level` (smoothed RMS) for the live call meter.
 *
 * processorOptions: aggressiveness, silenceMsToEnd, minSpeechMs, maxSegmentMs,
 *   speechThreshold, preRollMs, levelIntervalMs.
 *
 * Messages received from the main thread:
 *   { type: 'configure', maxSegmentMs?, minSpeechMs?, silenceMsToEnd?, speechThreshold? }
 *
 * Messages posted to the main thread:
 *   { type: 'vad', state: 'speech_start', at_ms, rms }
 *   { type: 'vad', state: 'speech_end', at_ms, rms, ended_by_silence, silence_tail_ms }
 *     // right after the segment it closed. `ended_by_silence` is false for a max-length cut
 *     // (the user is still talking); `silence_tail_ms` is the quiet waited after the last
 *     // voiced audio (the end-of-turn hang-over), 0 for a cut.
 *   { type: 'segment', samples: Int16Array, sample_rate: 16000, started_at_ms, speech_ms, silence_ms }
 *   { type: 'level', rms }   // throttled, 0..1
 */

const TARGET_SAMPLE_RATE = 16000
const RENDER_QUANTUM = 128

const DEFAULT_MAX_SEGMENT_MS = 7500
const DEFAULT_PRE_ROLL_MS = 300
const DEFAULT_LEVEL_INTERVAL_MS = 50
// A pause-ended segment is sent with only this much of its trailing quiet: enough for
// soft word endings, without uploading and transcribing the whole end-of-turn wait.
const TRAILING_SILENCE_KEEP_MS = 200

// Resampler low-pass: odd tap count (symmetric, integer group delay); cutoff at 90% of the
// 8 kHz output Nyquist.
const RESAMPLER_TAPS = 33
const RESAMPLER_CUTOFF = 0.9

// Speech gate = max(speechThreshold, noiseFloor × NOISE_FLOOR_MULTIPLIER); staying in speech
// only needs STAY_IN_SPEECH_RATIO of that.
const NOISE_FLOOR_MULTIPLIER = 3
const STAY_IN_SPEECH_RATIO = 0.8
// Cap so a long loud stretch can't make the gate deaf to normal speech.
const NOISE_FLOOR_MAX = 0.05
// Noise-floor EMA time constants. While idle it follows non-speech frames (~1 s); inside a
// segment it only creeps up (~4 s), which is what lets a stationary noise that opened a
// segment close it again — real speech keeps dipping between words, and dips pull the floor
// down quickly.
const NOISE_FLOOR_RISE_MS = 1000
const NOISE_FLOOR_CREEP_MS = 4000
const NOISE_FLOOR_FALL_MS = 200
// The first moments after capture starts only learn the floor (fast), so noise that is
// already present never opens a segment.
const CALIBRATION_MS = 400
const CALIBRATION_TAU_MS = 100

function clampPcm16(value) {
    return Math.max(-32768, Math.min(32767, Math.round(value)))
}

function toPcm16(sample) {
    const clamped = Math.max(-1, Math.min(1, sample || 0))
    return clampPcm16(clamped < 0 ? clamped * 32768 : clamped * 32767)
}

function roundMetric(value) {
    return Math.round(value * 1000) / 1000
}

function isNumberAtLeast(value, min) {
    return typeof value === 'number' && Number.isFinite(value) && value >= min
}

function msToSamples(ms) {
    return Math.round((ms / 1000) * TARGET_SAMPLE_RATE)
}

/** Hamming-windowed sinc low-pass, unity DC gain. `cutoff` is in cycles per input sample. */
function buildLowPass(length, cutoff) {
    const taps = new Float64Array(length)
    const middle = (length - 1) / 2
    let sum = 0
    for (let n = 0; n < length; n += 1) {
        const x = n - middle
        const sinc = x === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * x) / (Math.PI * x)
        const window = 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (length - 1))
        taps[n] = sinc * window
        sum += taps[n]
    }
    for (let n = 0; n < length; n += 1) taps[n] /= sum
    return taps
}

/**
 * Streaming fractional resampler. Each output sample sits at input position `k × step`
 * (step = sourceRate / 16000, e.g. 2.75625 at 44.1 kHz). The FIR low-pass is evaluated only
 * at the two input samples either side of that position, and the output is linearly
 * interpolated between those two filtered neighbours. The last `taps` input samples carry
 * over to the next quantum, so N seconds in always gives N × 16000 samples out (no
 * integer-ratio pitch/speed shift).
 */
class StreamingResampler {
    constructor(sourceRate, targetRate) {
        this.passThrough = Math.abs(sourceRate - targetRate) < 0.5
        this.step = sourceRate / targetRate
        this.taps = buildLowPass(RESAMPLER_TAPS, (RESAMPLER_CUTOFF * Math.min(sourceRate, targetRate)) / 2 / sourceRate)
        this.history = this.taps.length
        // work[0, history) = tail of the previous quantum; the new quantum is copied after it.
        this.work = new Float64Array(this.history + RENDER_QUANTUM)
        this.consumed = 0 // input samples consumed before the current quantum
        this.produced = 0 // output samples produced so far
    }

    /** Upper bound of output samples for an input quantum of `length` samples. */
    capacityFor(length) {
        return this.passThrough ? length : Math.ceil(length / this.step) + 2
    }

    /** Resamples `input` into `output` (length >= capacityFor) and returns the count written. */
    process(input, output) {
        const length = input.length
        if (this.passThrough) {
            for (let index = 0; index < length; index += 1) output[index] = input[index]
            return length
        }
        const history = this.history
        if (this.work.length < history + length) {
            const grown = new Float64Array(history + length)
            grown.set(this.work.subarray(0, history))
            this.work = grown
        }
        this.work.set(input, history)
        const base = this.consumed - history // absolute input index of work[0]
        const last = this.consumed + length - 1
        let count = 0
        for (;;) {
            const position = this.produced * this.step
            const index = Math.floor(position)
            if (index + 1 > last) break
            const local = index - base
            const frac = position - index
            const left = this.filterAt(local)
            output[count] = frac > 0 ? left + (this.filterAt(local + 1) - left) * frac : left
            count += 1
            this.produced += 1
        }
        // The combined stream is history + length long; keep its last `history` samples.
        this.work.copyWithin(0, length, length + history)
        this.consumed += length
        return count
    }

    /** Low-passed value at work[end] (causal FIR over work[end - taps + 1 .. end]). */
    filterAt(end) {
        const taps = this.taps
        const work = this.work
        let sum = 0
        for (let k = 0; k < taps.length; k += 1) sum += taps[k] * work[end - k]
        return sum
    }
}

class VoiceVadProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super()
        const opts = (options && options.processorOptions) || {}
        // The render rate of this worklet (the AudioContext sampleRate: 16000 when the browser
        // honoured the requested rate, otherwise typically 44100/48000).
        this.sourceSampleRate = typeof sampleRate === 'number' && sampleRate > 0 ? sampleRate : 48000
        this.frameMs = (RENDER_QUANTUM / this.sourceSampleRate) * 1000
        this.resampler = new StreamingResampler(this.sourceSampleRate, TARGET_SAMPLE_RATE)
        this.resampled = new Float64Array(this.resampler.capacityFor(RENDER_QUANTUM))
        this.pcm = new Int16Array(this.resampled.length)

        const levelIntervalMs = isNumberAtLeast(opts.levelIntervalMs, 1) ? opts.levelIntervalMs : DEFAULT_LEVEL_INTERVAL_MS
        this.levelFrameInterval = Math.max(1, Math.round(levelIntervalMs / this.frameMs))
        const preRollMs = isNumberAtLeast(opts.preRollMs, 0) ? opts.preRollMs : DEFAULT_PRE_ROLL_MS
        this.preRoll = new Int16Array(msToSamples(preRollMs))
        this.preRollStart = 0
        this.preRollLength = 0

        this.floorAlpha = {
            rise: this.alphaFor(NOISE_FLOOR_RISE_MS),
            creep: this.alphaFor(NOISE_FLOOR_CREEP_MS),
            fall: this.alphaFor(NOISE_FLOOR_FALL_MS),
            calibrate: this.alphaFor(CALIBRATION_TAU_MS),
        }
        this.calibrationFrames = Math.round(CALIBRATION_MS / this.frameMs)

        // Preallocated segment buffer; grown only when `maxSegmentMs` is raised.
        this.segment = new Int16Array(0)
        this.segmentLength = 0
        this.speaking = false
        this.announced = false
        this.silenceFrames = 0
        this.speechSamples = 0
        this.trailingSilentSamples = 0
        this.frameIndex = 0
        this.smoothedLevel = 0
        this.noiseFloor = 0
        this.lastRms = 0

        // RMS gate for speech (0..1). getUserMedia runs with AGC + noiseSuppression, which
        // can hold quiet/distant mics just under a higher gate so real speech is never
        // detected — keep this low; the adaptive noise floor raises the effective gate in
        // noisy rooms. Natural ~0.8s pause ends a turn (snappier ~0.45s for 'strict').
        this.configure({
            speechThreshold: 0.01,
            silenceMsToEnd: opts.aggressiveness === 'strict' ? 450 : 800,
            minSpeechMs: 250,
            maxSegmentMs: DEFAULT_MAX_SEGMENT_MS,
        })
        this.configure(opts)

        this.port.onmessage = (event) => {
            const data = event && event.data
            if (data && data.type === 'configure') this.configure(data)
        }
    }

    /** Applies tuning; omitted/invalid fields keep their current value. */
    configure(config) {
        if (isNumberAtLeast(config.speechThreshold, 0)) this.speechThreshold = config.speechThreshold
        if (isNumberAtLeast(config.minSpeechMs, 0)) this.minSpeechSamples = msToSamples(config.minSpeechMs)
        if (isNumberAtLeast(config.silenceMsToEnd, 1)) {
            this.silenceFramesToEnd = Math.max(1, Math.round(config.silenceMsToEnd / this.frameMs))
        }
        if (isNumberAtLeast(config.maxSegmentMs, 1)) {
            this.maxSamples = Math.max(RENDER_QUANTUM, msToSamples(config.maxSegmentMs))
            if (this.segment.length < this.maxSamples) {
                const grown = new Int16Array(this.maxSamples)
                grown.set(this.segment.subarray(0, this.segmentLength))
                this.segment = grown
            }
            // A running segment that already reached a lowered max is cut now.
            if (this.speaking && this.segmentLength >= this.maxSamples) this.flushSegment(this.lastRms, false)
        }
    }

    process(inputs) {
        const channel = inputs[0] && inputs[0][0]
        if (!channel) return true

        let sumSquares = 0
        for (let i = 0; i < channel.length; i += 1) {
            const sample = channel[i]
            sumSquares += sample * sample
        }
        const rms = Math.sqrt(sumSquares / Math.max(channel.length, 1))
        this.lastRms = rms

        // Smooth + throttle a live level for the UI meter (normalized-ish 0..1).
        this.smoothedLevel = this.smoothedLevel * 0.8 + Math.min(1, rms * 6) * 0.2
        if (this.frameIndex % this.levelFrameInterval === 0) {
            this.port.postMessage({ type: 'level', rms: roundMetric(this.smoothedLevel) })
        }

        const count = this.resampleQuantum(channel)
        const calibrating = this.frameIndex < this.calibrationFrames
        const gate = Math.max(this.speechThreshold, this.noiseFloor * NOISE_FLOOR_MULTIPLIER)
        const voiced = !calibrating && rms >= (this.speaking ? gate * STAY_IN_SPEECH_RATIO : gate)
        this.trackNoiseFloor(rms, calibrating)

        if (voiced && !this.speaking) this.startSegment()
        if (this.speaking) this.appendToSegment(count, voiced, rms)
        else this.pushPreRoll(this.pcm, 0, count)

        this.frameIndex += 1
        return true
    }

    resampleQuantum(channel) {
        if (this.resampled.length < this.resampler.capacityFor(channel.length)) {
            this.resampled = new Float64Array(this.resampler.capacityFor(channel.length))
            this.pcm = new Int16Array(this.resampled.length)
        }
        const count = this.resampler.process(channel, this.resampled)
        for (let index = 0; index < count; index += 1) this.pcm[index] = toPcm16(this.resampled[index])
        return count
    }

    trackNoiseFloor(rms, calibrating) {
        let alpha
        if (calibrating) alpha = this.floorAlpha.calibrate
        else if (rms < this.noiseFloor) alpha = this.floorAlpha.fall
        else if (this.speaking) alpha = this.floorAlpha.creep
        else alpha = this.floorAlpha.rise
        this.noiseFloor = Math.min(NOISE_FLOOR_MAX, this.noiseFloor + (rms - this.noiseFloor) * alpha)
    }

    startSegment() {
        this.speaking = true
        this.announced = false
        this.silenceFrames = 0
        this.speechSamples = 0
        this.trailingSilentSamples = 0
        // Prepend the pre-roll (oldest first). Cap it so a tiny maxSegmentMs still leaves room
        // for speech.
        const take = Math.min(this.preRollLength, Math.floor(this.maxSamples / 2))
        const capacity = this.preRoll.length
        let read = (this.preRollStart + this.preRollLength - take) % Math.max(capacity, 1)
        for (let index = 0; index < take; index += 1) {
            this.segment[index] = this.preRoll[read]
            read = (read + 1) % capacity
        }
        this.segmentLength = take
        this.preRollStart = 0
        this.preRollLength = 0
    }

    appendToSegment(count, voiced, rms) {
        let offset = 0
        while (offset < count) {
            const take = Math.min(count - offset, this.maxSamples - this.segmentLength)
            this.segment.set(this.pcm.subarray(offset, offset + take), this.segmentLength)
            this.segmentLength += take
            offset += take
            if (voiced) this.speechSamples += take
            this.trailingSilentSamples = voiced ? 0 : this.trailingSilentSamples + take

            // Only announce a real turn once enough speech has accumulated, so coughs/
            // clicks never fire a turn (and never a false barge-in).
            if (!this.announced && voiced && this.speechSamples >= this.minSpeechSamples) {
                this.announced = true
                this.port.postMessage({ type: 'vad', state: 'speech_start', at_ms: this.elapsedMs(), rms: roundMetric(rms) })
            }

            if (this.segmentLength >= this.maxSamples) {
                this.flushSegment(rms, false)
                // The cut lands mid-speech: the rest of this quantum seeds the next pre-roll.
                this.pushPreRoll(this.pcm, offset, count)
                return
            }
        }

        this.silenceFrames = voiced ? 0 : this.silenceFrames + 1
        if (this.silenceFrames >= this.silenceFramesToEnd) this.flushSegment(rms, true)
    }

    pushPreRoll(source, from, to) {
        const capacity = this.preRoll.length
        if (capacity === 0) return
        for (let index = Math.max(from, to - capacity); index < to; index += 1) {
            this.preRoll[(this.preRollStart + this.preRollLength) % capacity] = source[index]
            if (this.preRollLength < capacity) this.preRollLength += 1
            else this.preRollStart = (this.preRollStart + 1) % capacity
        }
    }

    /**
     * Posts the current segment (when it announced a turn) and resets turn state.
     * `endedBySilence` re-seeds the pre-roll from the segment's quiet tail, which may hold the
     * soft onset of the next utterance; after a max-length cut nothing already sent is
     * re-used (that would duplicate words).
     */
    flushSegment(rms, endedBySilence) {
        const total = this.segmentLength
        const length = Math.min(total, this.maxSamples)
        const announced = this.announced
        const speechSamples = Math.min(this.speechSamples, length)
        // Only the start of the pause is sent; the full quiet tail still re-seeds the pre-roll.
        const trimmed = endedBySilence ? Math.max(0, this.trailingSilentSamples - msToSamples(TRAILING_SILENCE_KEEP_MS)) : 0
        const sent = Math.max(speechSamples, length - trimmed)
        // The hang-over: quiet since the last voiced audio, waited before closing the turn.
        const silenceTailSamples = endedBySilence ? Math.min(this.trailingSilentSamples, length) : 0

        // Reset turn state regardless of whether we emit.
        this.speaking = false
        this.announced = false
        this.silenceFrames = 0
        this.speechSamples = 0
        this.trailingSilentSamples = 0
        this.segmentLength = 0

        if (total > length) this.pushPreRoll(this.segment, length, total)
        else if (endedBySilence || !announced) this.pushPreRoll(this.segment, 0, length)

        // Discard sub-threshold blips that never became a real turn.
        if (!announced || length === 0) return

        const samples = this.segment.slice(0, sent)
        this.port.postMessage({
            type: 'segment',
            samples,
            sample_rate: TARGET_SAMPLE_RATE,
            started_at_ms: Math.max(0, this.elapsedMs() - Math.round((length / TARGET_SAMPLE_RATE) * 1000)),
            speech_ms: Math.round((speechSamples / TARGET_SAMPLE_RATE) * 1000),
            // Everything sent that wasn't voiced: pre-roll, pauses between words, the kept
            // start of the trailing silence.
            silence_ms: Math.round(((sent - speechSamples) / TARGET_SAMPLE_RATE) * 1000),
        }, [samples.buffer])
        this.port.postMessage({
            type: 'vad',
            state: 'speech_end',
            at_ms: this.elapsedMs(),
            rms: roundMetric(rms),
            ended_by_silence: endedBySilence,
            silence_tail_ms: Math.round((silenceTailSamples / TARGET_SAMPLE_RATE) * 1000),
        })
    }

    alphaFor(timeConstantMs) {
        return 1 - Math.exp(-this.frameMs / timeConstantMs)
    }

    elapsedMs() {
        return Math.round(((this.frameIndex * RENDER_QUANTUM) / this.sourceSampleRate) * 1000)
    }
}

registerProcessor('voice-vad-processor', VoiceVadProcessor)
