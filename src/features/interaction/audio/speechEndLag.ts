/**
 * speechEndLag.ts — the client half of the "user stops speaking → first audio" baseline
 * (R0-BE-37, D06/D28).
 *
 * A call segment upload's `vad.speech_end_lag_ms` is the time on the main-thread clock
 * (`performance.now()`) from the user's end of speech to the moment the upload is sent: whole
 * milliseconds, clamped to 0..{@link SPEECH_END_LAG_MAX_MS}. The end of speech is the last
 * voiced audio, i.e. the arrival of the worklet's `speech_end` minus its `silence_tail_ms`,
 * so the lag includes the VAD silence hang-over (`silenceMsToEnd`), as the BFF's metric
 * defines it, plus hashing and any wait for `voice_ready`. Not counted: mic input latency
 * and the worklet → main thread message hop (a few ms). A max-length cut (the user is still
 * talking) carries no lag. The BFF places the end of speech on its own clock from its
 * receive time.
 *
 * Every upload that saw its end of speech carries the field: the BFF has accepted it
 * since R0-BE-37 (I-68: no route or feature detection any more).
 */
import type { VoiceSegmentUploadRequest } from '@/shared/types'
import type { CapturedVoiceSegment } from './voiceVadWorklet'

/** Upper bound of `speech_end_lag_ms` (the BFF's accepted range is 0..120000). */
export const SPEECH_END_LAG_MAX_MS = 120_000

/**
 * Whole ms from `speechEndAtMs` (the end of speech) to `sentAtMs`, both `performance.now()`,
 * clamped to 0..{@link SPEECH_END_LAG_MAX_MS}; null when there is no usable end of speech.
 */
export function speechEndLagMs(speechEndAtMs: number | null | undefined, sentAtMs: number): number | null {
    if (typeof speechEndAtMs !== 'number' || !Number.isFinite(speechEndAtMs) || !Number.isFinite(sentAtMs)) return null
    return Math.min(SPEECH_END_LAG_MAX_MS, Math.max(0, Math.round(sentAtMs - speechEndAtMs)))
}

/**
 * The `vad` metadata of a segment upload sent at `sentAtMs`: the segment's own metadata plus
 * `speech_end_lag_ms`, or the metadata untouched when no end of speech is stamped on the
 * segment (not seen yet, or a max-length cut).
 */
export function segmentUploadVad(
    segment: Pick<CapturedVoiceSegment, 'vad' | 'speech_end_perf_ms'>,
    options: { sentAtMs: number },
): VoiceSegmentUploadRequest['vad'] {
    const lag = speechEndLagMs(segment.speech_end_perf_ms, options.sentAtMs)
    return lag === null ? segment.vad : { ...segment.vad, speech_end_lag_ms: lag }
}
