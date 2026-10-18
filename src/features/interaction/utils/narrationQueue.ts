import type { ChatTtsError, ChatTtsSegmentClip } from '../../../shared'
import { isGeneratingClipStatus } from './chatTtsTurnState'

/**
 * Pure playback queue behind the multi-voice narration player (`TurnNarration`).
 *
 * The player walks a turn's clips in `segment_index` order. Each clip has a
 * playback class (06 §9.4):
 *   - `play`: its audio is ready;
 *   - `wait`: its job is still running; playback resumes when the audio lands;
 *   - `skip`: it failed, hit the daily limit, was not narrated, or its audio
 *     could not be loaded here. It is skipped and the next clip plays, so one
 *     failed segment never halts the turn (D30 #3).
 *
 * Play/pause follows the element's own events (D30 #2): `play`/`playing` set
 * it; a `pause` that is not part of a clip transition (the element ended, or
 * the next clip is loading) clears both the state and the intent to play, so a
 * pause forced by another audio surface never leaves the button stuck.
 */

export type ClipPlayback = 'play' | 'wait' | 'skip'

/** Why a clip is skipped; `failed` covers every terminal failure. */
export type ClipSkipReason = 'failed' | 'daily_limit' | 'not_narrated'

/**
 * Retry is pointless for these codes (03 §5.8, 06 §6.6): they need another
 * action or another day. `voice_safety_pause` (PC-1) holds until the pause
 * ends and `voice_region_unavailable` (PC-2) does not change by retrying.
 */
const NON_RETRYABLE_CODES = new Set([
    'attestation_required',
    'call_reply_not_narratable',
    'content_blocked',
    'daily_limit_reached',
    'invalid_request',
    'not_narrated',
    'voice_not_eligible',
    'voice_region_unavailable',
    'voice_restricted',
    'voice_safety_pause',
    'voice_unavailable',
    'workspace_archived',
])

/** Terminal statuses a re-request can fix when the server did not say otherwise (06 §9.4). */
const RETRYABLE_STATUSES = new Set(['failed', 'timeout', 'rate_limited', 'unavailable'])

/** The turn's clips in playback order. */
export function orderClips(clips: readonly ChatTtsSegmentClip[]): ChatTtsSegmentClip[] {
    return [...clips].sort((a, b) => a.segment_index - b.segment_index)
}

export function clipPlayback(clip: ChatTtsSegmentClip, loadFailed?: ReadonlySet<number>): ClipPlayback {
    if (loadFailed?.has(clip.segment_index)) return 'skip'
    if (clip.url) return 'play'
    if (isGeneratingClipStatus(clip.status)) return 'wait'
    return 'skip'
}

export function clipSkipReason(clip: ChatTtsSegmentClip): ClipSkipReason {
    const code = clip.error?.code
    if (clip.status === 'daily_limit_reached' || code === 'daily_limit_reached') return 'daily_limit'
    if (clip.status === 'not_narrated' || code === 'not_narrated') return 'not_narrated'
    return 'failed'
}

/**
 * Whether re-sending the turn's `tts` frame can fill this skipped clip. The
 * server's `retryable` wins; otherwise a transient status without a blocking
 * code does. A clip whose audio was dropped or never loaded re-resolves
 * through job reuse, so it is retryable too.
 */
export function isRetryableSkip(clip: ChatTtsSegmentClip, loadFailed?: ReadonlySet<number>): boolean {
    if (loadFailed?.has(clip.segment_index)) return true
    if (clipPlayback(clip) !== 'skip' || clipSkipReason(clip) !== 'failed') return false
    if (typeof clip.error?.retryable === 'boolean') return clip.error.retryable
    if (isSafetyPause(clip.error) || isTerminalNarrationCode(clip.error?.code)) return false
    if (!clip.status || clip.status === 'completed') return true
    return RETRYABLE_STATUSES.has(clip.status)
}

/** True when the error asks the user to accept the age and terms attestation (D26). */
export function needsAttestation(error: ChatTtsError | null | undefined): boolean {
    return error?.action === 'attest' || error?.code === 'attestation_required'
}

/** True when voice is paused after a self-harm signal (PC-1, WN-2): show the crisis panel, never a retry. */
export function isSafetyPause(error: ChatTtsError | null | undefined): boolean {
    return error?.action === 'crisis_resources' || error?.code === 'voice_safety_pause'
}

/** Codes no re-request can fix (the clip and the turn stay settled until something else changes). */
export function isTerminalNarrationCode(code: string | null | undefined): boolean {
    return Boolean(code && NON_RETRYABLE_CODES.has(code))
}

/** i18n key of the copy for a known narration error code, or null for the generic copy. */
export function narrationErrorKey(error: ChatTtsError | null | undefined): string | null {
    if (!error) return null
    if (needsAttestation(error)) return 'interaction.narration.attestRequired'
    if (isSafetyPause(error)) return 'voices.errors.safetyPause'
    switch (error.code) {
        case 'workspace_archived':
            return 'workspaceActivity.chat.workspaceArchived'
        case 'moderation_unavailable':
            return 'interaction.narration.moderationUnavailable'
        case 'voice_unavailable':
            return 'interaction.narration.voiceUnavailable'
        case 'daily_limit_reached':
            return 'interaction.narration.dailyLimit'
        case 'not_narrated':
            return 'interaction.narration.notNarrated'
        case 'call_reply_not_narratable':
            return 'interaction.narration.callReplyReplayOnly'
        // Voice gates (09 §2.2): token bucket, Free prerequisites, kill switch or spent budget.
        case 'rate_limited':
            return 'voices.errors.rateLimited'
        case 'voice_not_eligible':
            return 'voices.errors.freeNotEligible'
        case 'narration_paused':
            return 'voices.errors.budgetUnavailable'
        // R2-BE-03 `all_voice` geo block (PC-2).
        case 'voice_region_unavailable':
            return 'voices.errors.regionUnavailable'
        // D37 95% step: only auto requests are refused; tapping play still works.
        case 'auto_narration_paused':
            return 'interaction.narration.autoPaused'
        default:
            return null
    }
}

export interface NarrationQueueState {
    /** `segment_index` of the clip at the cursor; null at the top of the turn. */
    current: number | null
    /** The listener wants audio. Set by play; cleared by a pause, a failed start and the end of the turn. */
    wantPlay: boolean
    /** `loading`: fetching and starting the cursor clip; `waiting`: its job is still running. */
    phase: 'idle' | 'loading' | 'playing' | 'waiting'
    /** Bumped every time the cursor clip must be (re)loaded. */
    loadToken: number
    /** Clips skipped in the current or last pass (`segment_index`), for the caption. */
    skipped: number[]
    /** Clips whose audio could not be fetched, decoded or started here; skipped until a retry. */
    loadFailed: number[]
}

export type NarrationQueueAction =
    /** Start, or continue from the cursor clip, a pass over the turn. */
    | { type: 'play'; clips: readonly ChatTtsSegmentClip[] }
    /** The paused cursor clip continues on the element that still holds it. */
    | { type: 'resume' }
    /** The listener paused or cancelled, or the element refused to start. */
    | { type: 'pause' }
    /** Element `play` / `playing`. */
    | { type: 'playing' }
    /** Element `pause`; `ended` is the element's own flag at that moment. */
    | { type: 'paused'; ended: boolean }
    /** Element `ended`: the cursor clip played out. */
    | { type: 'ended'; clips: readonly ChatTtsSegmentClip[] }
    /** The cursor clip's audio could not be fetched, decoded or started. */
    | { type: 'loadFailed'; clips: readonly ChatTtsSegmentClip[] }
    /** New frames or a hydration changed the clips. */
    | { type: 'clipsChanged'; clips: readonly ChatTtsSegmentClip[] }
    /** Forget local load failures before the turn is requested again. */
    | { type: 'retry' }

export const initialNarrationQueueState: NarrationQueueState = {
    current: null,
    wantPlay: false,
    phase: 'idle',
    loadToken: 0,
    skipped: [],
    loadFailed: [],
}

/**
 * Moves the cursor to the first clip at (`inclusive`) or after `from` that can
 * play or must be waited for, recording every clip skipped on the way. Past the
 * last clip the pass ends and the cursor returns to the top.
 */
function settle(state: NarrationQueueState, clips: readonly ChatTtsSegmentClip[], from: number | null, inclusive: boolean): NarrationQueueState {
    const loadFailed = new Set(state.loadFailed)
    const skipped = [...state.skipped]
    for (const clip of orderClips(clips)) {
        if (from !== null && (inclusive ? clip.segment_index < from : clip.segment_index <= from)) continue
        const playback = clipPlayback(clip, loadFailed)
        if (playback === 'skip') {
            if (!skipped.includes(clip.segment_index)) skipped.push(clip.segment_index)
            continue
        }
        if (playback === 'wait') {
            const unchanged = state.current === clip.segment_index && state.phase === 'waiting' && skipped.length === state.skipped.length
            return unchanged ? state : { ...state, current: clip.segment_index, phase: 'waiting', skipped }
        }
        return { ...state, current: clip.segment_index, phase: 'loading', loadToken: state.loadToken + 1, skipped }
    }
    return { ...state, current: null, wantPlay: false, phase: 'idle', skipped }
}

export function narrationQueueReducer(state: NarrationQueueState, action: NarrationQueueAction): NarrationQueueState {
    switch (action.type) {
        case 'play': {
            if (action.clips.length === 0) return state
            // A pass from the top forgets the previous pass's skips.
            const skipped = state.current === null ? [] : state.skipped
            return settle({ ...state, wantPlay: true, skipped }, action.clips, state.current, true)
        }
        case 'resume':
            return state.current === null ? state : { ...state, wantPlay: true }
        case 'pause':
            if (!state.wantPlay && state.phase === 'idle') return state
            return { ...state, wantPlay: false, phase: 'idle' }
        case 'playing':
            if (state.current === null) return state
            return state.phase === 'playing' && state.wantPlay ? state : { ...state, phase: 'playing', wantPlay: true }
        case 'paused':
            // Part of a transition: the element fires `pause` before `ended`, and
            // a new source pauses it while the next clip loads.
            if (action.ended || state.phase === 'loading') return state
            if (!state.wantPlay && state.phase === 'idle') return state
            return { ...state, wantPlay: false, phase: 'idle' }
        case 'ended':
            if (state.current === null) return state
            if (!state.wantPlay) return { ...state, phase: 'idle' }
            return settle(state, action.clips, state.current, false)
        case 'loadFailed': {
            if (state.current === null) return state
            const loadFailed = state.loadFailed.includes(state.current) ? state.loadFailed : [...state.loadFailed, state.current]
            const skipped = state.skipped.includes(state.current) ? state.skipped : [...state.skipped, state.current]
            const next = { ...state, loadFailed, skipped }
            return state.wantPlay ? settle(next, action.clips, state.current, false) : { ...next, phase: 'idle' }
        }
        case 'clipsChanged':
            if (state.phase !== 'waiting' || !state.wantPlay) return state
            return settle(state, action.clips, state.current, true)
        case 'retry':
            return state.loadFailed.length === 0 && state.skipped.length === 0 ? state : { ...state, loadFailed: [], skipped: [] }
        default:
            return state
    }
}
