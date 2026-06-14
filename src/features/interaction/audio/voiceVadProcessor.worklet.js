/**
 * voiceVadProcessor.worklet.js — the AudioWorklet half of the voice VAD.
 *
 * This MUST be plain JavaScript (no TypeScript syntax, no imports): it is loaded
 * verbatim by `audioWorklet.addModule(new URL(...))`, so Vite copies it as-is with a
 * JS MIME type in BOTH dev and prod. (The previous single-`.ts`-file approach shipped
 * raw TypeScript in production, which the browser couldn't parse — silently falling
 * back to the no-VAD MediaRecorder path.)
 *
 * It detects speech via per-frame RMS energy, buffers the (downsampled-to-16kHz) PCM
 * while the user speaks, and on a natural pause (~0.8s of silence) posts one `segment`
 * message. Brief blips shorter than `minSpeechMs` are ignored (never announce a turn).
 * It also streams a throttled `level` (smoothed RMS) for the live call meter.
 *
 * Messages posted to the main thread:
 *   { type: 'vad', state: 'speech_start' | 'speech_end', at_ms, rms }
 *   { type: 'segment', samples: Int16Array, sample_rate, started_at_ms, speech_ms, silence_ms }
 *   { type: 'level', rms }   // throttled, 0..1
 */

const TARGET_SAMPLE_RATE = 16000
const RENDER_QUANTUM = 128

function clampPcm16(value) {
    return Math.max(-32768, Math.min(32767, Math.round(value)))
}

function roundMetric(value) {
    return Math.round(value * 1000) / 1000
}

class VoiceVadProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super()
        const opts = (options && options.processorOptions) || {}
        // The render rate of this worklet (the AudioContext sampleRate — typically 48000).
        this.sourceSampleRate = typeof sampleRate === 'number' && sampleRate > 0 ? sampleRate : 48000
        this.frameMs = (RENDER_QUANTUM / this.sourceSampleRate) * 1000
        this.downsampleRatio = Math.max(1, Math.round(this.sourceSampleRate / TARGET_SAMPLE_RATE))

        const aggressive = opts.aggressiveness === 'strict'
        // RMS gate for speech (0..1). getUserMedia runs with AGC + noiseSuppression, which
        // can hold quiet/distant mics just under a higher gate so real speech is never
        // detected — keep this low so normal speech reliably crosses it. Override per call
        // via processorOptions.speechThreshold (UseMicrophoneCaptureOptions.vad).
        this.speechThreshold = typeof opts.speechThreshold === 'number' ? opts.speechThreshold : 0.01
        // Natural ~0.8s pause ends a turn (snappier ~0.45s for 'strict').
        const silenceMsToEnd = typeof opts.silenceMsToEnd === 'number' ? opts.silenceMsToEnd : aggressive ? 450 : 800
        const minSpeechMs = typeof opts.minSpeechMs === 'number' ? opts.minSpeechMs : 250
        const maxSegmentMs = typeof opts.maxSegmentMs === 'number' ? opts.maxSegmentMs : 10000
        const levelIntervalMs = typeof opts.levelIntervalMs === 'number' ? opts.levelIntervalMs : 33

        this.silenceFramesToEnd = Math.max(1, Math.round(silenceMsToEnd / this.frameMs))
        this.minSpeechSamples = Math.round((minSpeechMs / 1000) * TARGET_SAMPLE_RATE)
        this.maxSamples = Math.round((maxSegmentMs / 1000) * TARGET_SAMPLE_RATE)
        this.levelFrameInterval = Math.max(1, Math.round(levelIntervalMs / this.frameMs))

        this.buffer = []
        this.speaking = false
        this.announced = false
        this.silenceFrames = 0
        this.frameIndex = 0
        this.speechSamples = 0
        this.silenceSamples = 0
        this.smoothedLevel = 0
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
        const hasSpeech = rms >= this.speechThreshold

        // Smooth + throttle a live level for the UI meter (normalized-ish 0..1).
        this.smoothedLevel = this.smoothedLevel * 0.8 + Math.min(1, rms * 6) * 0.2
        if (this.frameIndex % this.levelFrameInterval === 0) {
            this.port.postMessage({ type: 'level', rms: roundMetric(this.smoothedLevel) })
        }

        if (hasSpeech && !this.speaking) {
            this.speaking = true
            this.silenceFrames = 0
        }

        if (this.speaking) {
            this.appendDownsampled(channel)
            const downsampled = Math.round(channel.length / this.downsampleRatio)
            if (hasSpeech) {
                this.silenceFrames = 0
                this.speechSamples += downsampled
            } else {
                this.silenceFrames += 1
                this.silenceSamples += downsampled
            }

            // Only announce a real turn once enough speech has accumulated, so coughs/
            // clicks never fire a turn (and never a false barge-in).
            if (!this.announced && this.speechSamples >= this.minSpeechSamples) {
                this.announced = true
                this.port.postMessage({ type: 'vad', state: 'speech_start', at_ms: this.elapsedMs(), rms: roundMetric(rms) })
            }

            if (this.silenceFrames >= this.silenceFramesToEnd || this.buffer.length >= this.maxSamples) {
                this.flushSegment(rms)
            }
        }

        this.frameIndex += 1
        return true
    }

    appendDownsampled(channel) {
        const ratio = this.downsampleRatio
        // Pass-through when the context already runs at the target rate (the browser did the
        // resampling). Otherwise box-average each group of `ratio` samples — a cheap
        // anti-alias filter. Naive decimation (picking 1 of N) aliased speech badly enough
        // that the STT returned empty transcripts.
        if (ratio <= 1) {
            for (let index = 0; index < channel.length; index += 1) {
                const sample = Math.max(-1, Math.min(1, channel[index] || 0))
                this.buffer.push(clampPcm16(sample < 0 ? sample * 32768 : sample * 32767))
            }
            return
        }
        for (let index = 0; index + ratio <= channel.length; index += ratio) {
            let sum = 0
            for (let k = 0; k < ratio; k += 1) sum += channel[index + k] || 0
            const sample = Math.max(-1, Math.min(1, sum / ratio))
            this.buffer.push(clampPcm16(sample < 0 ? sample * 32768 : sample * 32767))
        }
    }

    flushSegment(rms) {
        const announced = this.announced
        const samples = this.buffer.length ? Int16Array.from(this.buffer.splice(0)) : new Int16Array(0)
        const speechMs = Math.round((this.speechSamples / TARGET_SAMPLE_RATE) * 1000)
        const silenceMs = Math.round((this.silenceSamples / TARGET_SAMPLE_RATE) * 1000)

        // Reset turn state regardless of whether we emit.
        this.speaking = false
        this.announced = false
        this.silenceFrames = 0
        this.speechSamples = 0
        this.silenceSamples = 0

        // Discard sub-threshold blips that never became a real turn.
        if (!announced || samples.length === 0) return

        this.port.postMessage({
            type: 'segment',
            samples,
            sample_rate: TARGET_SAMPLE_RATE,
            started_at_ms: Math.max(0, this.elapsedMs() - Math.round((samples.length / TARGET_SAMPLE_RATE) * 1000)),
            speech_ms: speechMs,
            silence_ms: silenceMs,
        })
        this.port.postMessage({ type: 'vad', state: 'speech_end', at_ms: this.elapsedMs(), rms: roundMetric(rms) })
    }

    elapsedMs() {
        return Math.round(((this.frameIndex * RENDER_QUANTUM) / this.sourceSampleRate) * 1000)
    }
}

registerProcessor('voice-vad-processor', VoiceVadProcessor)
