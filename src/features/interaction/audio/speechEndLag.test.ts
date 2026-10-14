import { describe, expect, it } from 'vitest'
import { segmentUploadVad, SPEECH_END_LAG_MAX_MS, speechEndLagMs } from './speechEndLag'
import type { CapturedVoiceSegment } from './voiceVadWorklet'

const VAD: CapturedVoiceSegment['vad'] = { speech_ms: 450, silence_ms: 50, rms: 0.12, peak: 0.4, source: 'audio_worklet', aggressiveness: 'balanced' }

describe('speechEndLagMs', () => {
    it('measures whole milliseconds from the speech_end to the send', () => {
        expect(speechEndLagMs(1_000, 1_000)).toBe(0)
        expect(speechEndLagMs(1_000, 1_250)).toBe(250)
        expect(speechEndLagMs(1_000, 1_312.75)).toBe(313)
        expect(speechEndLagMs(1_000.25, 1_312.5)).toBe(312)
    })

    it('clamps to 0..120000', () => {
        // A send stamped before the speech_end (clock skew between callbacks) reads as 0.
        expect(speechEndLagMs(2_000, 1_999.4)).toBe(0)
        expect(speechEndLagMs(2_000, 1_500)).toBe(0)
        expect(speechEndLagMs(0, SPEECH_END_LAG_MAX_MS)).toBe(120_000)
        expect(speechEndLagMs(0, SPEECH_END_LAG_MAX_MS + 0.4)).toBe(120_000)
        expect(speechEndLagMs(0, 10 * 60_000)).toBe(120_000)
    })

    it('has no value without a usable speech_end time', () => {
        expect(speechEndLagMs(undefined, 1_000)).toBeNull()
        expect(speechEndLagMs(null, 1_000)).toBeNull()
        expect(speechEndLagMs(Number.NaN, 1_000)).toBeNull()
        expect(speechEndLagMs(1_000, Number.POSITIVE_INFINITY)).toBeNull()
    })
})

describe('segmentUploadVad', () => {
    it('adds speech_end_lag_ms when the segment saw its speech_end', () => {
        const vad = segmentUploadVad({ vad: VAD, speech_end_perf_ms: 5_000 }, { sentAtMs: 5_420.4 })

        expect(vad).toEqual({ ...VAD, speech_end_lag_ms: 420 })
        expect(Number.isInteger(vad.speech_end_lag_ms)).toBe(true)
        // The segment's own metadata is never changed.
        expect(VAD).not.toHaveProperty('speech_end_lag_ms')
    })

    it('clamps a very late send to the upper bound', () => {
        expect(segmentUploadVad({ vad: VAD, speech_end_perf_ms: 0 }, { sentAtMs: 500_000 }).speech_end_lag_ms).toBe(120_000)
    })

    it('leaves the metadata untouched when no speech_end was seen for the segment', () => {
        const vad = segmentUploadVad({ vad: VAD }, { sentAtMs: 5_420 })

        expect(vad).toBe(VAD)
        expect(JSON.stringify(vad)).not.toContain('speech_end_lag_ms')
    })
})
