import { describe, expect, it } from 'vitest'
import type { ChatTtsSegmentClip } from '../../../shared'
import {
    clipPlayback,
    clipSkipReason,
    initialNarrationQueueState,
    isRetryableSkip,
    isSafetyPause,
    isTerminalNarrationCode,
    narrationErrorKey,
    narrationQueueReducer,
    type NarrationQueueAction,
    type NarrationQueueState,
} from './narrationQueue'

function ready(segment_index: number): ChatTtsSegmentClip {
    return { segment_index, status: 'completed', url: `/tts/assets/clip-${segment_index}.mp3` }
}

function failed(segment_index: number, error: ChatTtsSegmentClip['error'] = { category: 'unavailable', detail: 'Narration failed.' }): ChatTtsSegmentClip {
    return { segment_index, status: 'unavailable', error }
}

function pending(segment_index: number): ChatTtsSegmentClip {
    return { segment_index, status: 'synthesizing', job_id: `job-${segment_index}` }
}

function run(actions: NarrationQueueAction[], state: NarrationQueueState = initialNarrationQueueState): NarrationQueueState {
    return actions.reduce(narrationQueueReducer, state)
}

describe('narrationQueue clip classes', () => {
    it('plays ready clips, waits for running jobs and skips everything else', () => {
        expect(clipPlayback(ready(0))).toBe('play')
        expect(clipPlayback(pending(1))).toBe('wait')
        expect(clipPlayback(failed(2))).toBe('skip')
        expect(clipPlayback({ segment_index: 3, status: 'daily_limit_reached' })).toBe('skip')
        expect(clipPlayback({ segment_index: 4, status: 'not_narrated' })).toBe('skip')
        expect(clipPlayback(ready(5), new Set([5]))).toBe('skip')
    })

    it('names the reason of a skip', () => {
        expect(clipSkipReason({ segment_index: 0, status: 'daily_limit_reached' })).toBe('daily_limit')
        expect(clipSkipReason({ segment_index: 0, status: 'not_narrated' })).toBe('not_narrated')
        expect(clipSkipReason(failed(0, { category: 'quota', detail: 'Limit.', code: 'daily_limit_reached' }))).toBe('daily_limit')
        expect(clipSkipReason(failed(0))).toBe('failed')
    })

    it('retries transient failures and never capped, blocked or non-retryable ones', () => {
        expect(isRetryableSkip(failed(0))).toBe(true)
        expect(isRetryableSkip({ segment_index: 0, status: 'timeout' })).toBe(true)
        expect(isRetryableSkip(failed(0, { category: 'moderation_unavailable', detail: 'x', code: 'moderation_unavailable', retryable: true }))).toBe(true)
        expect(isRetryableSkip(failed(0, { category: 'failed', detail: 'x', retryable: false }))).toBe(false)
        expect(isRetryableSkip(failed(0, { category: 'voice_unavailable', detail: 'x', code: 'voice_unavailable' }))).toBe(false)
        expect(isRetryableSkip({ segment_index: 0, status: 'content_blocked' })).toBe(false)
        expect(isRetryableSkip({ segment_index: 0, status: 'quota_exceeded' })).toBe(false)
        expect(isRetryableSkip({ segment_index: 0, status: 'daily_limit_reached' })).toBe(false)
        expect(isRetryableSkip({ segment_index: 0, status: 'not_narrated' })).toBe(false)
        // Audio that could not be loaded here re-resolves through job reuse.
        expect(isRetryableSkip(ready(0), new Set([0]))).toBe(true)
        // Playable and running clips are not skips at all.
        expect(isRetryableSkip(ready(0))).toBe(false)
        expect(isRetryableSkip(pending(0))).toBe(false)
    })

    it('maps known error codes to their own copy', () => {
        expect(narrationErrorKey({ category: 'invalid', detail: 'x', code: 'workspace_archived' })).toBe('workspaceActivity.chat.workspaceArchived')
        expect(narrationErrorKey({ category: 'unavailable', detail: 'x', code: 'attestation_required' })).toBe('interaction.narration.attestRequired')
        expect(narrationErrorKey({ category: 'unavailable', detail: 'x', action: 'attest' })).toBe('interaction.narration.attestRequired')
        expect(narrationErrorKey({ category: 'unavailable', detail: 'x', code: 'moderation_unavailable' })).toBe('interaction.narration.moderationUnavailable')
        expect(narrationErrorKey({ category: 'unavailable', detail: 'x', code: 'voice_unavailable' })).toBe('interaction.narration.voiceUnavailable')
        expect(narrationErrorKey({ category: 'rate_limited', detail: 'x', code: 'rate_limited' })).toBe('voices.errors.rateLimited')
        expect(narrationErrorKey({ category: 'unavailable', detail: 'x', code: 'voice_not_eligible' })).toBe('voices.errors.freeNotEligible')
        expect(narrationErrorKey({ category: 'unavailable', detail: 'x', code: 'narration_paused' })).toBe('voices.errors.budgetUnavailable')
        expect(narrationErrorKey({ category: 'unavailable', detail: 'x', code: 'auto_narration_paused' })).toBe('interaction.narration.autoPaused')
        expect(narrationErrorKey({ category: 'failed', detail: 'x', code: 'something_new' })).toBeNull()
        expect(narrationErrorKey(undefined)).toBeNull()
    })

    describe('safety pause and geo block (R2-BE-01, R2-BE-03)', () => {
        const pause = { category: 'unavailable', detail: 'x', code: 'voice_safety_pause', retryable: false, action: 'crisis_resources', retry_after_seconds: 600 } as const
        const geo = { category: 'unavailable', detail: 'x', code: 'voice_region_unavailable', retryable: false } as const

        it('names the pause by its code or its action', () => {
            expect(isSafetyPause(pause)).toBe(true)
            expect(isSafetyPause({ category: 'unavailable', detail: 'x', code: 'voice_safety_pause' })).toBe(true)
            expect(isSafetyPause({ category: 'unavailable', detail: 'x', action: 'crisis_resources' })).toBe(true)
            expect(isSafetyPause(geo)).toBe(false)
            expect(isSafetyPause(null)).toBe(false)
        })

        it('maps both codes to their copy', () => {
            expect(narrationErrorKey(pause)).toBe('voices.errors.safetyPause')
            expect(narrationErrorKey({ category: 'unavailable', detail: 'x', action: 'crisis_resources' })).toBe('voices.errors.safetyPause')
            expect(narrationErrorKey(geo)).toBe('voices.errors.regionUnavailable')
        })

        it('treats both as terminal: never retried, even without the server flag', () => {
            expect(isTerminalNarrationCode('voice_safety_pause')).toBe(true)
            expect(isTerminalNarrationCode('voice_region_unavailable')).toBe(true)
            expect(isTerminalNarrationCode('rate_limited')).toBe(false)
            expect(isTerminalNarrationCode(undefined)).toBe(false)
            expect(isRetryableSkip(failed(0, pause))).toBe(false)
            expect(isRetryableSkip(failed(0, geo))).toBe(false)
            expect(isRetryableSkip(failed(0, { category: 'unavailable', detail: 'x', code: 'voice_safety_pause' }))).toBe(false)
            expect(isRetryableSkip(failed(0, { category: 'unavailable', detail: 'x', code: 'voice_region_unavailable' }))).toBe(false)
            expect(isRetryableSkip(failed(0, { category: 'unavailable', detail: 'x', action: 'crisis_resources' }))).toBe(false)
            // Today's transient failures stay retryable (G-1).
            expect(isRetryableSkip(failed(0))).toBe(true)
        })
    })
})

describe('narrationQueueReducer', () => {
    it('skips a failed middle clip and keeps playing the turn (D30 #3)', () => {
        const clips = [ready(0), failed(1), ready(2)]
        let state = run([{ type: 'play', clips }])
        expect(state).toMatchObject({ current: 0, phase: 'loading', wantPlay: true, loadToken: 1 })

        state = run([{ type: 'playing' }, { type: 'paused', ended: true }, { type: 'ended', clips }], state)
        expect(state).toMatchObject({ current: 2, phase: 'loading', wantPlay: true, skipped: [1], loadToken: 2 })

        state = run([{ type: 'playing' }, { type: 'paused', ended: true }, { type: 'ended', clips }], state)
        expect(state).toMatchObject({ current: null, phase: 'idle', wantPlay: false, skipped: [1] })
    })

    it('skips capped and not-narrated tails without stalling', () => {
        const clips = [ready(0), { segment_index: 1, status: 'daily_limit_reached' as const }, { segment_index: 2, status: 'not_narrated' as const }]
        const state = run([{ type: 'play', clips }, { type: 'playing' }, { type: 'ended', clips }])
        expect(state).toMatchObject({ current: null, phase: 'idle', wantPlay: false, skipped: [1, 2] })
    })

    it('starts at the first playable clip when the head of the turn failed', () => {
        const clips = [failed(0), ready(1)]
        expect(run([{ type: 'play', clips }])).toMatchObject({ current: 1, phase: 'loading', skipped: [0] })
    })

    it('waits for a running clip and resumes when its audio lands, or skips it when it fails', () => {
        const clips = [ready(0), pending(1), ready(2)]
        let state = run([{ type: 'play', clips }, { type: 'playing' }, { type: 'ended', clips }])
        expect(state).toMatchObject({ current: 1, phase: 'waiting', wantPlay: true })

        // Unrelated frames keep it waiting.
        expect(run([{ type: 'clipsChanged', clips }], state)).toBe(state)

        const landed = [ready(0), ready(1), ready(2)]
        expect(run([{ type: 'clipsChanged', clips: landed }], state)).toMatchObject({ current: 1, phase: 'loading' })

        const lost = [ready(0), failed(1), ready(2)]
        state = run([{ type: 'clipsChanged', clips: lost }], state)
        expect(state).toMatchObject({ current: 2, phase: 'loading', skipped: [1] })
    })

    it('clears play state and intent on a pause it did not cause, so the button never sticks (D30 #2)', () => {
        const clips = [ready(0), ready(1)]
        let state = run([{ type: 'play', clips }, { type: 'playing' }])
        expect(state).toMatchObject({ phase: 'playing', wantPlay: true })

        // Another audio surface took focus and paused the element.
        state = run([{ type: 'paused', ended: false }], state)
        expect(state).toMatchObject({ current: 0, phase: 'idle', wantPlay: false })

        // A later `ended` (nothing was playing) does not restart the turn.
        expect(run([{ type: 'ended', clips }], state)).toMatchObject({ phase: 'idle', wantPlay: false })

        // Resuming keeps the cursor clip.
        state = run([{ type: 'resume' }, { type: 'playing' }], state)
        expect(state).toMatchObject({ current: 0, phase: 'playing', wantPlay: true })
    })

    it('ignores the pause of a clip transition', () => {
        const clips = [ready(0), ready(1)]
        const loading = run([{ type: 'play', clips }])
        expect(run([{ type: 'paused', ended: false }], loading)).toBe(loading)
        const playing = run([{ type: 'playing' }], loading)
        expect(run([{ type: 'paused', ended: true }], playing)).toBe(playing)
    })

    it('cancels a pending start or wait on pause', () => {
        const clips = [pending(0)]
        const waiting = run([{ type: 'play', clips }])
        expect(waiting).toMatchObject({ phase: 'waiting', wantPlay: true })
        const paused = run([{ type: 'pause' }], waiting)
        expect(paused).toMatchObject({ current: 0, phase: 'idle', wantPlay: false })
        // A landed clip no longer starts playback by itself.
        expect(run([{ type: 'clipsChanged', clips: [ready(0)] }], paused)).toBe(paused)
    })

    it('skips a clip whose audio could not be loaded until a retry', () => {
        const clips = [ready(0), ready(1)]
        let state = run([{ type: 'play', clips }, { type: 'loadFailed', clips }])
        expect(state).toMatchObject({ current: 1, phase: 'loading', loadFailed: [0], skipped: [0] })

        state = run([{ type: 'playing' }, { type: 'ended', clips }], state)
        expect(state).toMatchObject({ current: null, phase: 'idle' })
        // A new pass starts fresh but still skips the unloadable clip.
        expect(run([{ type: 'play', clips }], state)).toMatchObject({ current: 1, skipped: [0] })

        state = run([{ type: 'retry' }], state)
        expect(state).toMatchObject({ loadFailed: [], skipped: [] })
        expect(run([{ type: 'play', clips }], state)).toMatchObject({ current: 0, phase: 'loading' })
    })

    it('ends idle when nothing in the turn can play', () => {
        const clips = [failed(0), { segment_index: 1, status: 'not_narrated' as const }]
        expect(run([{ type: 'play', clips }])).toMatchObject({ current: null, phase: 'idle', wantPlay: false, skipped: [0, 1] })
        expect(run([{ type: 'play', clips: [] }])).toBe(initialNarrationQueueState)
    })

    it('follows segment_index, not array position, when a late clip arrives', () => {
        const clips = [ready(0), ready(2)]
        let state = run([{ type: 'play', clips }, { type: 'playing' }])
        // Segment 1 shows up while segment 0 plays: it is next, then segment 2.
        const withLate = [ready(0), ready(1), ready(2)]
        state = run([{ type: 'clipsChanged', clips: withLate }, { type: 'ended', clips: withLate }], state)
        expect(state).toMatchObject({ current: 1, phase: 'loading' })
        state = run([{ type: 'playing' }, { type: 'ended', clips: withLate }], state)
        expect(state).toMatchObject({ current: 2, phase: 'loading' })
    })
})
