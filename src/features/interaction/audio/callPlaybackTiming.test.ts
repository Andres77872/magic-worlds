import { describe, expect, it, vi } from 'vitest'
import { CallPlaybackTiming } from './callPlaybackTiming'

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
