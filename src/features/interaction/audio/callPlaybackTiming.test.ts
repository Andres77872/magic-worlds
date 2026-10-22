import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VoiceTurnClientMetricsFrame } from '@/shared/types/voice.types'
import { CallPlaybackTiming, LATE_AUDIO_GRACE_MS, SETTLE_CAP_MS, type CallTurnTimelineOptions } from './callPlaybackTiming'

describe('correlated browser playback timing', () => {
    it('marks the first playing event once, including VAD delay, with no content', () => {
        const emit = vi.fn()
        const timing = new CallPlaybackTiming(emit)
        timing.segmentSent('call', 3, 100)
        timing.segmentSent('call', 3, 999) // A network resend never restarts its clock.
        timing.turnStarted('call', 'reply', 3, 600)
        timing.turnStarted('call', 'reply', 3, 700)
        timing.playing('call', 'reply', 900)
        timing.playing('call', 'reply', 1000)
        expect(emit).toHaveBeenCalledExactlyOnceWith({ voice_session_id: 'call', turn_id: 'reply', segment_seq: 3,
            turn_start_to_first_audible_ms: 300, speech_end_to_first_audible_ms: 800 })
    })

    it('does not correlate another session, an unstarted turn or cancelled late playback', () => {
        const emit = vi.fn()
        const timing = new CallPlaybackTiming(emit)
        timing.segmentSent('old', 1, 100)
        timing.playing('new', 'reply', 500)
        timing.turnStarted('new', 'reply', 1, 600)
        timing.cancelled('new', 'reply')
        timing.playing('new', 'reply', 900)
        expect(emit).not.toHaveBeenCalled()
        timing.turnStarted('new', 'other', 1, 1000)
        timing.playing('new', 'other', 1300)
        expect(emit).toHaveBeenCalledExactlyOnceWith({ voice_session_id: 'new', turn_id: 'other', segment_seq: 1,
            turn_start_to_first_audible_ms: 300 })
    })

    it('bounds retained records and resets before the next call', () => {
        const emit = vi.fn()
        const timing = new CallPlaybackTiming(emit)
        for (let seq = 1; seq <= 65; seq++) {
            timing.segmentSent('call', seq, seq)
            timing.turnStarted('call', String(seq), seq, 100)
        }
        timing.playing('call', '1', 1000)
        expect(emit).not.toHaveBeenCalled()
        timing.clear()
        timing.playing('call', '65', 1000)
        expect(emit).not.toHaveBeenCalled()
    })
})

describe('per-turn client timeline (protocol v2 voice_turn_client_metrics)', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    /** A collector on a fake clock: `advance` moves the clock and the timers together. */
    function timeline(options: Partial<CallTurnTimelineOptions> = {}) {
        let clock = 0
        const onTurnMetrics = vi.fn<(frame: VoiceTurnClientMetricsFrame, voiceSessionId: string) => void>()
        const timing = new CallPlaybackTiming(vi.fn(), {
            onTurnMetrics,
            callContext: () => ({ aec: 'on', outputLatencyMs: 21 }),
            now: () => clock,
            ...options,
        })
        return {
            timing,
            onTurnMetrics,
            at: (ms: number) => { clock = ms },
            advance: (ms: number) => {
                clock += ms
                vi.advanceTimersByTime(ms)
            },
        }
    }

    const playingState = (turnId = 'turn-1') => ({ status: 'playing' as const, voiceSessionId: 'call', turnId })
    const state = (status: 'idle' | 'buffering' | 'blocked', turnId = 'turn-1') => ({ status, voiceSessionId: 'call', turnId })

    it('reports an interrupted turn with the spec example intervals, once', () => {
        const { timing, onTurnMetrics } = timeline({ playedMs: () => 4_180 })
        timing.segmentSent('call', 4, 1_000, 1_612)
        timing.segmentAcked('call', 4, 'received', 1_760)
        timing.segmentAcked('call', 4, 'accepted', 1_900)
        timing.turnStarted('call', 'turn-1', 4, 2_931)
        timing.audioChunk('call', 'turn-1', 3_874)
        for (let chunk = 2; chunk <= 19; chunk++) timing.audioChunk('call', 'turn-1', 3_900 + chunk)
        timing.playbackState(state('buffering'), 3_874)
        timing.playbackState(playingState(), 4_042, 'media_source')
        timing.interrupted('call', 'turn-1', 9_000, { playedMs: 4_180, bargeInOnsetMs: 8_470 })
        timing.cancelled('call', 'turn-1', 'barge_in', 9_100)
        timing.turnEnded('call', 'turn-1', 9_200)

        expect(onTurnMetrics).toHaveBeenCalledExactlyOnceWith({
            type: 'voice_turn_client_metrics', v: 1, turn_id: 'turn-1', segment_seq: 4,
            outcome: 'interrupted', speech_end_to_upload_ms: 612, upload_to_ack_ms: 148,
            speech_end_to_turn_start_ms: 1_931, speech_end_to_first_chunk_ms: 2_874,
            speech_end_to_playing_ms: 3_042, turn_start_to_first_chunk_ms: 943,
            first_chunk_to_playing_ms: 168, output_latency_ms: 21, v2v_ms: 3_063,
            played_ms: 4_180, chunks: 19, stalls: 0, stall_ms: 0,
            barge_in_onset_to_pause_ms: 530, playback_path: 'media_source', aec: 'on',
            autoplay_blocked: false,
        }, 'call')
        // The upload's own speech_end_lag_ms is the same number.
        expect(onTurnMetrics.mock.calls[0][0].speech_end_to_upload_ms).toBe(612)
    })

    it('settles played once the ended turn goes idle, counting stalls after it became audible', () => {
        const { timing, onTurnMetrics } = timeline({ playedMs: () => 6_000 })
        timing.segmentSent('call', 1, 100, 400)
        timing.turnStarted('call', 'turn-1', 1, 1_000)
        timing.audioChunk('call', 'turn-1', 1_500)
        timing.playbackState(state('buffering'), 1_500)
        timing.mediaEvent('waiting', 'call', 'turn-1', 1_550) // start-up, not a stall
        timing.playbackState(playingState(), 1_700, 'blob')
        timing.mediaEvent('playing', 'call', 'turn-1', 1_700)
        timing.mediaEvent('waiting', 'call', 'turn-1', 3_000)
        timing.mediaEvent('stalled', 'call', 'turn-1', 3_100)
        timing.mediaEvent('playing', 'call', 'turn-1', 3_400)
        timing.turnEnded('call', 'turn-1', 4_000)
        expect(onTurnMetrics).not.toHaveBeenCalled()
        timing.mediaEvent('waiting', 'call', 'turn-1', 5_000)
        timing.playbackState(state('idle'), 5_250)

        expect(onTurnMetrics).toHaveBeenCalledOnce()
        expect(onTurnMetrics.mock.calls[0][0]).toMatchObject({
            outcome: 'played', played_ms: 6_000, chunks: 1, stalls: 3, stall_ms: 650, playback_path: 'blob',
            speech_end_to_playing_ms: 1_600, v2v_ms: 1_621,
        })
        expect(onTurnMetrics.mock.calls[0][0]).not.toHaveProperty('upload_to_ack_ms')
    })

    it('settles played at voice_turn_end when the reply already played out', () => {
        const { timing, onTurnMetrics } = timeline()
        timing.turnStarted('call', 'turn-1', undefined, 1_000)
        timing.audioChunk('call', 'turn-1', 1_100)
        timing.playbackState(playingState(), 1_200, 'managed_media_source')
        timing.progress('call', 'turn-1', 2_500)
        timing.playbackState(state('idle'), 4_000)
        expect(onTurnMetrics).not.toHaveBeenCalled()
        timing.turnEnded('call', 'turn-1', 6_000)
        const [frame] = onTurnMetrics.mock.calls[0]
        expect(frame).toMatchObject({ outcome: 'played', played_ms: 2_500, playback_path: 'managed_media_source', turn_start_to_first_chunk_ms: 100 })
        // No segment, so no t0: every speech_end_* field and v2v_ms are absent.
        expect(Object.keys(frame).filter((key) => key.startsWith('speech_end_') || key === 'v2v_ms' || key === 'segment_seq')).toEqual([])
    })

    it('settles no_audio after the grace when nothing of the ended turn played', () => {
        const { timing, onTurnMetrics, advance } = timeline()
        timing.segmentSent('call', 2, 100, 500)
        timing.turnStarted('call', 'turn-1', 2, 1_000)
        timing.turnEnded('call', 'turn-1', 2_000)
        advance(LATE_AUDIO_GRACE_MS - 1)
        expect(onTurnMetrics).not.toHaveBeenCalled()
        advance(1)
        expect(onTurnMetrics).toHaveBeenCalledExactlyOnceWith({
            type: 'voice_turn_client_metrics', v: 1, turn_id: 'turn-1', segment_seq: 2, outcome: 'no_audio',
            speech_end_to_upload_ms: 400, speech_end_to_turn_start_ms: 900, output_latency_ms: 21,
            played_ms: 0, chunks: 0, stalls: 0, stall_ms: 0, playback_path: 'none', aec: 'on', autoplay_blocked: false,
        }, 'call')
    })

    it('waits for late audio that arrives during the grace', () => {
        const { timing, onTurnMetrics, advance, at } = timeline()
        timing.turnStarted('call', 'turn-1', undefined, 1_000)
        timing.turnEnded('call', 'turn-1', 2_000)
        at(2_500)
        timing.audioChunk('call', 'turn-1', 2_500)
        timing.playbackState(state('buffering'), 2_500)
        advance(5_000)
        expect(onTurnMetrics).not.toHaveBeenCalled()
        timing.playbackState(playingState(), 7_600, 'media_source')
        timing.playbackState(state('idle'), 9_000)
        expect(onTurnMetrics).toHaveBeenCalledOnce()
        expect(onTurnMetrics.mock.calls[0][0]).toMatchObject({ outcome: 'played', chunks: 1 })
    })

    it('reports a blocked turn when it ends unheard, and unsupported audio', () => {
        const { timing, onTurnMetrics, advance } = timeline()
        timing.turnStarted('call', 'turn-1', undefined, 1_000)
        timing.audioChunk('call', 'turn-1', 1_100)
        timing.playbackState(state('buffering'), 1_100)
        timing.playbackState(state('blocked'), 1_150)
        timing.turnEnded('call', 'turn-1', 3_000)
        advance(10_000)
        expect(onTurnMetrics).not.toHaveBeenCalled() // a tap could still play it
        timing.turnStarted('call', 'turn-2', undefined, 20_000)
        timing.playbackState(state('idle'), 20_000) // the next turn took the player over
        expect(onTurnMetrics.mock.calls[0][0]).toMatchObject({ turn_id: 'turn-1', outcome: 'blocked', autoplay_blocked: true, playback_path: 'none', played_ms: 0 })

        timing.audioChunk('call', 'turn-2', 20_100, false)
        timing.turnEnded('call', 'turn-2', 21_000)
        advance(LATE_AUDIO_GRACE_MS)
        expect(onTurnMetrics.mock.calls[1][0]).toMatchObject({ turn_id: 'turn-2', outcome: 'unsupported', chunks: 1 })
    })

    it('reports a resumed blocked turn as played, with autoplay_blocked', () => {
        const { timing, onTurnMetrics } = timeline()
        timing.turnStarted('call', 'turn-1', undefined, 1_000)
        timing.playbackState(state('blocked'), 1_100)
        timing.playbackState(playingState(), 4_000, 'media_source')
        timing.turnEnded('call', 'turn-1', 5_000)
        timing.playbackState(state('idle'), 9_000)
        expect(onTurnMetrics.mock.calls[0][0]).toMatchObject({ outcome: 'played', autoplay_blocked: true })
    })

    it('leaves the tap delay out: a turn blocked before it played has no start-up times', () => {
        const { timing, onTurnMetrics } = timeline()
        timing.segmentSent('call', 1, 1_000, 1_500)
        timing.turnStarted('call', 'turn-1', 1, 2_000)
        timing.audioChunk('call', 'turn-1', 2_500)
        timing.playbackState(state('blocked'), 2_600)
        timing.playbackState(playingState(), 9_000, 'media_source') // the caller tapped
        timing.turnEnded('call', 'turn-1', 10_000)
        timing.playbackState(state('idle'), 12_000)
        const [frame] = onTurnMetrics.mock.calls[0]
        expect(frame).toMatchObject({ outcome: 'played', autoplay_blocked: true, speech_end_to_first_chunk_ms: 1_500, playback_path: 'media_source' })
        for (const field of ['speech_end_to_playing_ms', 'first_chunk_to_playing_ms', 'v2v_ms']) expect(frame, field).not.toHaveProperty(field)

        // Blocked only after it was audible: its start-up was not delayed.
        timing.segmentSent('call', 2, 20_000, 20_500)
        timing.turnStarted('call', 'turn-2', 2, 21_000)
        timing.audioChunk('call', 'turn-2', 21_500)
        timing.playbackState(playingState('turn-2'), 21_600, 'blob')
        timing.playbackState(state('blocked', 'turn-2'), 23_000)
        timing.interrupted('call', 'turn-2', 24_000)
        expect(onTurnMetrics.mock.calls[1][0]).toMatchObject({ autoplay_blocked: true, speech_end_to_playing_ms: 1_600, v2v_ms: 1_621 })
    })

    it('times an automatic barge-in from the later of the speech onset and the reply becoming audible', () => {
        const { timing, onTurnMetrics } = timeline()
        timing.turnStarted('call', 'turn-1', undefined, 1_000)
        timing.playbackState(playingState(), 2_000, 'media_source')
        // The caller was already talking when the reply became audible.
        timing.interrupted('call', 'turn-1', 2_520, { bargeInOnsetMs: 1_200 })
        expect(onTurnMetrics.mock.calls[0][0]).toMatchObject({ outcome: 'interrupted', barge_in_onset_to_pause_ms: 520 })
    })

    it('maps voice_cancelled to cancelled, and a server barge-in cancel to interrupted', () => {
        const { timing, onTurnMetrics } = timeline()
        timing.turnStarted('call', 'turn-1', undefined, 1_000)
        timing.turnStarted('call', 'turn-2', undefined, 2_000)
        timing.cancelled('call', 'turn-1', 'superseded', 1_500)
        timing.cancelled('call', 'turn-2', 'barge_in', 2_500)
        timing.cancelled('call', 'turn-1', 'end_call', 3_000)
        expect(onTurnMetrics.mock.calls.map(([frame]) => [frame.turn_id, frame.outcome])).toEqual([['turn-1', 'cancelled'], ['turn-2', 'interrupted']])
        // No onset: not an automatic barge-in.
        expect(onTurnMetrics.mock.calls[1][0]).not.toHaveProperty('barge_in_onset_to_pause_ms')
    })

    it('sends v2v_ms without output_latency_ms when the browser exposes none', () => {
        const { timing, onTurnMetrics } = timeline({ callContext: () => ({ aec: 'off', outputLatencyMs: null }) })
        timing.segmentSent('call', 1, 1_000, 1_500)
        timing.turnStarted('call', 'turn-1', 1, 2_000)
        timing.playbackState(playingState(), 3_000, 'media_source')
        timing.interrupted('call', 'turn-1', 3_500)
        const [frame] = onTurnMetrics.mock.calls[0]
        expect(frame).toMatchObject({ speech_end_to_playing_ms: 2_000, v2v_ms: 2_000, aec: 'off' })
        expect(frame).not.toHaveProperty('output_latency_ms')
    })

    it('clamps every field to the frame bounds', () => {
        const { timing, onTurnMetrics } = timeline({ callContext: () => ({ outputLatencyMs: 5_000 }), playedMs: () => 2 ** 40 })
        timing.segmentSent('call', 1, 0, 700_000)
        timing.segmentAcked('call', 1, 'received', 1_400_000)
        timing.turnStarted('call', 'turn-1', 1, 1_400_000)
        timing.playbackState(playingState(), 1_400_000, 'media_source')
        timing.interrupted('call', 'turn-1', 1_480_000, { bargeInOnsetMs: 1_400_000 })
        expect(onTurnMetrics.mock.calls[0][0]).toMatchObject({
            speech_end_to_upload_ms: 120_000, // the upload lag's own bound
            upload_to_ack_ms: 600_000, speech_end_to_turn_start_ms: 600_000, speech_end_to_playing_ms: 600_000,
            output_latency_ms: 2_000, v2v_ms: 600_000, played_ms: 2 ** 31 - 1, barge_in_onset_to_pause_ms: 60_000,
            aec: 'unknown',
        })
    })

    it('settles a turn still playing SETTLE_CAP_MS after voice_turn_end as played', () => {
        const { timing, onTurnMetrics, advance, at } = timeline()
        timing.turnStarted('call', 'turn-1', undefined, 0)
        timing.playbackState(playingState(), 100, 'media_source')
        timing.mediaEvent('waiting', 'call', 'turn-1', 200)
        at(1_000)
        timing.turnEnded('call', 'turn-1', 1_000)
        advance(SETTLE_CAP_MS - 1)
        expect(onTurnMetrics).not.toHaveBeenCalled()
        advance(1)
        expect(onTurnMetrics.mock.calls[0][0]).toMatchObject({ outcome: 'played', stalls: 1, stall_ms: 120_800 })
    })

    it('flushes open turns at call end, then forgets them with their timers', () => {
        const { timing, onTurnMetrics, advance } = timeline()
        timing.turnStarted('call', 'done', undefined, 0)
        timing.cancelled('call', 'done', 'superseded', 10)
        timing.turnStarted('call', 'speaking', undefined, 100)
        timing.playbackState(playingState('speaking'), 200, 'media_source')
        timing.turnEnded('call', 'speaking', 300)
        timing.turnStarted('call', 'silent', undefined, 400)
        timing.turnEnded('call', 'silent', 500)
        timing.turnStarted('call', 'pending', undefined, 600)
        timing.flush(700)
        expect(onTurnMetrics.mock.calls.map(([frame]) => [frame.turn_id, frame.outcome])).toEqual([
            ['done', 'cancelled'], ['speaking', 'cancelled'], ['silent', 'no_audio'], ['pending', 'cancelled'],
        ])

        timing.turnStarted('call', 'late', undefined, 800)
        timing.turnEnded('call', 'late', 900)
        timing.clear()
        advance(SETTLE_CAP_MS)
        timing.flush(SETTLE_CAP_MS)
        expect(onTurnMetrics).toHaveBeenCalledTimes(4)
    })

    it('never lets the emitter or a reader throw into call handling', () => {
        const onTurnMetrics = vi.fn(() => { throw new Error('socket gone') })
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        const timing = new CallPlaybackTiming(vi.fn(), {
            onTurnMetrics,
            playedMs: () => { throw new Error('player gone') },
            callContext: () => { throw new Error('capture gone') },
        })
        timing.turnStarted('call', 'turn-1', undefined, 0)
        expect(() => timing.interrupted('call', 'turn-1', 10)).not.toThrow()
        expect(onTurnMetrics).toHaveBeenCalledOnce()
        warn.mockRestore()
    })

    it('keeps the first-audible mark for a turn that settled without a cancel', () => {
        const emit = vi.fn()
        const timing = new CallPlaybackTiming(emit, { onTurnMetrics: vi.fn() })
        timing.turnStarted('call', 'turn-1', undefined, 0)
        timing.turnEnded('call', 'turn-1', 100)
        vi.advanceTimersByTime(LATE_AUDIO_GRACE_MS)
        timing.playing('call', 'turn-1', 2_000)
        expect(emit).toHaveBeenCalledExactlyOnceWith({ voice_session_id: 'call', turn_id: 'turn-1', turn_start_to_first_audible_ms: 2_000 })
    })
})
