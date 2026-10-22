/**
 * callPlaybackTiming.ts — the client's per-turn timeline of a call (R4 marks, R01).
 *
 * Two outputs, both on the main-thread `performance.now()` clock:
 * - `mw.voice.first_audible`: a User Timing mark at the first `playing` of each turn;
 * - one `voice_turn_client_metrics` record per server turn, emitted once when the turn settles
 *   (protocol v2 §3, docs/call_realtime/phase0/01_protocol_v2.md): upload, ack, turn start, first
 *   chunk, first audible, stalls and barge-in as whole-ms intervals. The emitter decides whether
 *   it reaches the server (only one that advertised the frame).
 *
 * Settle rules (§3.1): a barge-in on the turn → `interrupted`; `voice_cancelled` → `cancelled`;
 * after `voice_turn_end`, playback idle after playing → `played`; nothing played after a short
 * wait for late audio → `no_audio`, or `blocked` / `unsupported` when that is why. Open turns are
 * settled by `flush()` at call end, and SETTLE_CAP_MS after `voice_turn_end` at the latest.
 */
import type { VoiceTurnClientMetricsFrame, VoiceTurnClientOutcome } from '@/shared/types/voice.types'
import { speechEndLagMs } from './speechEndLag'
import type { VoicePlaybackPath, VoicePlaybackState } from './voicePlaybackBuffer'

/** Local browser marks for R4. `playing` is a playback proxy, not a hardware audio measurement. */
export const FIRST_AUDIBLE_MARK = 'mw.voice.first_audible'
const MAX_RECORDS = 64
/** After `voice_turn_end`, a turn with nothing audible waits this long for late audio before it settles. */
export const LATE_AUDIO_GRACE_MS = 1_500
/** A turn whose playback is still not idle this long after `voice_turn_end` settles anyway. */
export const SETTLE_CAP_MS = 120_000

// Field bounds of the v1 frame (§3.2).
const MAX_INTERVAL_MS = 600_000
const MAX_OUTPUT_LATENCY_MS = 2_000
const MAX_BARGE_IN_MS = 60_000
const MAX_PLAYED_MS = 2 ** 31 - 1
const MAX_CHUNKS = 100_000
const MAX_STALLS = 10_000

type TurnPlayback = 'none' | VoicePlaybackState['status']

interface SegmentTiming {
    /** t0: the segment's last voiced audio (`speech_end_perf_ms`); none for a max-length cut. */
    speechEndMs?: number
    sentMs?: number
    /** `voice_segment_ack{status:"received"}`. */
    ackMs?: number
}

interface TurnTiming {
    voiceSessionId: string
    turnId: string
    segmentSeq?: number
    /** The opening segment's record (kept by reference: a later ack still counts). */
    segment?: SegmentTiming
    speechEndMs?: number
    startedMs: number
    marked: boolean
    /** Barged in on or cancelled: later playback is not the turn's first audible. */
    cancelled: boolean
    settled: boolean
    chunks: number
    firstChunkMs?: number
    playingMs?: number
    path?: VoicePlaybackPath
    playback: TurnPlayback
    stalls: number
    stallMs: number
    stallStartedMs?: number
    autoplayBlocked: boolean
    /** Blocked before it first played: its `playing` waited for the caller's tap. */
    waitedForTap: boolean
    unsupported: boolean
    lastPlayedMs?: number
    endedMs?: number
    graceTimer?: ReturnType<typeof setTimeout>
    capTimer?: ReturnType<typeof setTimeout>
}

export interface FirstAudibleTiming {
    voice_session_id: string
    turn_id: string
    segment_seq?: number
    turn_start_to_first_audible_ms: number
    speech_end_to_first_audible_ms?: number
}

/** Call-level facts, read when a turn settles. */
export interface CallTimelineContext {
    aec?: 'on' | 'off' | 'unknown'
    /** The capture AudioContext's output latency in ms; null when the browser exposes none. */
    outputLatencyMs?: number | null
}

export interface CallTurnTimelineOptions {
    /** Receives each settled turn once, with the call it belongs to. */
    onTurnMetrics?: (frame: VoiceTurnClientMetricsFrame, voiceSessionId: string) => void
    /** The turn's played audio now (`VoicePlaybackBuffer.playedMs`); null when unknown. */
    playedMs?: (voiceSessionId: string, turnId: string) => number | null | undefined
    callContext?: () => CallTimelineContext
    /** Clock for timer-driven settles; default `performance.now()`. */
    now?: () => number
}

interface SettleDetails {
    playedMs?: number | null
    bargeInOnsetMs?: number
}

function boundedSet<K, V>(map: Map<K, V>, key: K, value: V, onEvict?: (evicted: V) => void) {
    map.set(key, value)
    if (map.size <= MAX_RECORDS) return
    const oldest = map.keys().next().value!
    const evicted = map.get(oldest)!
    map.delete(oldest)
    onEvict?.(evicted)
}

function emitMark(detail: FirstAudibleTiming) {
    if (typeof performance.mark !== 'function') return
    // Observers receive each new mark; retain only the latest in the global buffer.
    performance.clearMarks(FIRST_AUDIBLE_MARK)
    performance.mark(FIRST_AUDIBLE_MARK, { detail })
}

function isTime(value: number | null | undefined): value is number {
    return typeof value === 'number' && Number.isFinite(value)
}

function clampWhole(value: number, max: number): number {
    return Math.min(max, Math.max(0, Math.round(value)))
}

/** Whole ms from `from` to `to`, clamped to 0..`max`; undefined when either end is unknown. */
function span(from: number | undefined, to: number | undefined, max = MAX_INTERVAL_MS): number | undefined {
    return isTime(from) && isTime(to) ? clampWhole(to - from, max) : undefined
}

/** `fields` without its undefined entries: a missing field means "did not happen" or "not measurable". */
function definedOnly<T extends Record<string, unknown>>(fields: T): Partial<T> {
    return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as Partial<T>
}

/** The outcome of a turn that ended without a barge-in or a cancel. */
function endedOutcome(turn: TurnTiming): VoiceTurnClientOutcome {
    if (turn.playingMs !== undefined) return 'played'
    if (turn.unsupported) return 'unsupported'
    if (turn.autoplayBlocked) return 'blocked'
    return 'no_audio'
}

export class CallPlaybackTiming {
    private readonly segments = new Map<string, SegmentTiming>()
    private readonly turns = new Map<string, TurnTiming>()
    private readonly emit: (detail: FirstAudibleTiming) => void
    private readonly options: CallTurnTimelineOptions

    constructor(emit: (detail: FirstAudibleTiming) => void = emitMark, options: CallTurnTimelineOptions = {}) {
        this.emit = emit
        this.options = options
    }

    /** Segment `seq` was uploaded at `sentAtMs`; `speechEndMs` is its t0. A resend keeps the first. */
    segmentSent(voiceSessionId: string, seq: number, speechEndMs: number | undefined, sentAtMs?: number) {
        const key = `${voiceSessionId}:${seq}`
        if (this.segments.has(key)) return
        boundedSet(this.segments, key, {
            speechEndMs: isTime(speechEndMs) && speechEndMs >= 0 ? speechEndMs : undefined,
            sentMs: isTime(sentAtMs) ? sentAtMs : undefined,
        })
    }

    /** `voice_segment_ack`: only `received` (the upload reached the server) is timed. */
    segmentAcked(voiceSessionId: string, seq: number, status: string, now: number) {
        if (status !== 'received' || !isTime(now)) return
        const segment = this.segments.get(`${voiceSessionId}:${seq}`)
        if (segment && segment.ackMs === undefined) segment.ackMs = now
    }

    turnStarted(voiceSessionId: string, turnId: string, segmentSeq: number | undefined, now: number) {
        const key = `${voiceSessionId}:${turnId}`
        if (this.turns.has(key) || !Number.isFinite(now)) return
        const seq = Number.isSafeInteger(segmentSeq) && segmentSeq! > 0 ? segmentSeq : undefined
        const segment = seq === undefined ? undefined : this.segments.get(`${voiceSessionId}:${seq}`)
        boundedSet(this.turns, key, {
            voiceSessionId, turnId, segmentSeq: seq, segment, speechEndMs: segment?.speechEndMs, startedMs: now,
            marked: false, cancelled: false, settled: false, chunks: 0, playback: 'none', stalls: 0, stallMs: 0,
            autoplayBlocked: false, waitedForTap: false, unsupported: false,
        }, (evicted) => this.release(evicted))
    }

    /** A `voice_audio_chunk` of the turn arrived; `playable` false: the player cannot decode it. */
    audioChunk(voiceSessionId: string, turnId: string, now: number, playable = true) {
        const turn = this.openTurn(voiceSessionId, turnId)
        if (!turn) return
        turn.chunks += 1
        if (turn.firstChunkMs === undefined && isTime(now)) turn.firstChunkMs = now
        if (!playable) turn.unsupported = true
        // Audio after the turn's end restarts the wait for it.
        if (turn.graceTimer !== undefined) this.armGrace(turn)
    }

    /** A playback state change (VoicePlaybackBuffer); `path` is how a `playing` turn plays. */
    playbackState(state: VoicePlaybackState, now: number, path?: VoicePlaybackPath | null) {
        const { voiceSessionId, turnId } = state
        if (!voiceSessionId || !turnId) return
        if (state.status === 'playing') {
            this.playing(voiceSessionId, turnId, now, path ?? undefined)
            return
        }
        const turn = this.openTurn(voiceSessionId, turnId)
        if (!turn) return
        turn.playback = state.status
        if (state.status === 'blocked') {
            turn.autoplayBlocked = true
            if (turn.playingMs === undefined) turn.waitedForTap = true
        }
        if (state.status !== 'idle') return
        this.closeStall(turn, now)
        // Idle is final for the turn's audio: a turn the server already ended settles now.
        if (turn.endedMs !== undefined) this.settle(turn, endedOutcome(turn), now)
    }

    playing(voiceSessionId: string, turnId: string, now: number, path?: VoicePlaybackPath) {
        const turn = this.turns.get(`${voiceSessionId}:${turnId}`)
        if (!turn || turn.cancelled || !Number.isFinite(now)) return
        if (!turn.settled) {
            turn.playback = 'playing'
            this.clearGrace(turn)
            this.closeStall(turn, now)
            if (turn.playingMs === undefined && now >= turn.startedMs) {
                turn.playingMs = now
                turn.path = path
            }
        }
        if (turn.marked || now < turn.startedMs) return
        turn.marked = true
        const speechDelay = turn.speechEndMs === undefined ? undefined : now - turn.speechEndMs
        this.emit({
            voice_session_id: voiceSessionId, turn_id: turnId, segment_seq: turn.segmentSeq,
            turn_start_to_first_audible_ms: Math.round(now - turn.startedMs),
            ...(speechDelay !== undefined && speechDelay >= 0 && speechDelay <= 120_000
                ? { speech_end_to_first_audible_ms: Math.round(speechDelay) } : {}),
        })
    }

    /** An element media event of the turn: `waiting`/`stalled` count as stalls (`waiting` starts the stall clock), `playing` ends one. */
    mediaEvent(type: 'playing' | 'waiting' | 'stalled', voiceSessionId: string, turnId: string, now: number) {
        const turn = this.openTurn(voiceSessionId, turnId)
        // Only after the turn became audible: the start-up wait is `first_chunk_to_playing_ms`.
        if (!turn || turn.playingMs === undefined || !isTime(now)) return
        if (type === 'playing') {
            this.closeStall(turn, now)
            return
        }
        turn.stalls += 1
        if (type === 'waiting' && turn.stallStartedMs === undefined) turn.stallStartedMs = now
    }

    /** The turn's played audio so far (the WS-C2 cadence), for a settle after the player moved on. */
    progress(voiceSessionId: string, turnId: string, playedMs: number) {
        const turn = this.openTurn(voiceSessionId, turnId)
        if (turn && isTime(playedMs) && playedMs >= 0) turn.lastPlayedMs = playedMs
    }

    /** `voice_turn_end`: settles once playback is idle, or after a wait for late audio when none played. */
    turnEnded(voiceSessionId: string, turnId: string, now: number) {
        const turn = this.openTurn(voiceSessionId, turnId)
        if (!turn || turn.endedMs !== undefined || !isTime(now)) return
        turn.endedMs = now
        if (turn.playingMs !== undefined && turn.playback === 'idle') {
            this.settle(turn, 'played', now)
            return
        }
        if (turn.playingMs === undefined && (turn.playback === 'none' || turn.playback === 'idle')) this.armGrace(turn)
        turn.capTimer = setTimeout(() => {
            turn.capTimer = undefined
            this.settle(turn, endedOutcome(turn), this.now())
        }, SETTLE_CAP_MS)
    }

    /** The caller barged in on the turn; `bargeInOnsetMs` is the speech onset of an automatic one. */
    interrupted(voiceSessionId: string, turnId: string, now: number, details: SettleDetails = {}) {
        const turn = this.turns.get(`${voiceSessionId}:${turnId}`)
        if (!turn) return
        turn.cancelled = true
        this.settle(turn, 'interrupted', now, details)
    }

    /**
     * `voice_cancelled` named the turn. A `barge_in` cancel is the caller's own interruption
     * (normally settled already by `interrupted`).
     */
    cancelled(voiceSessionId: string, turnId: string, reason?: string, now?: number) {
        const turn = this.turns.get(`${voiceSessionId}:${turnId}`)
        if (!turn) return
        turn.cancelled = true
        this.settle(turn, reason === 'barge_in' ? 'interrupted' : 'cancelled', isTime(now) ? now : this.now())
    }

    /**
     * Settles every open turn at the call's end: one the server ended with nothing played keeps
     * that outcome; any other was cut by the end of the call.
     */
    flush(now: number = this.now()) {
        for (const turn of [...this.turns.values()]) {
            if (turn.settled) continue
            this.settle(turn, turn.endedMs !== undefined && turn.playingMs === undefined ? endedOutcome(turn) : 'cancelled', now)
        }
    }

    clear() {
        for (const turn of this.turns.values()) this.release(turn)
        this.segments.clear()
        this.turns.clear()
    }

    private openTurn(voiceSessionId: string, turnId: string): TurnTiming | undefined {
        const turn = this.turns.get(`${voiceSessionId}:${turnId}`)
        return turn && !turn.settled ? turn : undefined
    }

    private armGrace(turn: TurnTiming) {
        this.clearGrace(turn)
        turn.graceTimer = setTimeout(() => {
            turn.graceTimer = undefined
            // Audio is on its way, audible or waiting for a tap: it settles when playback goes idle.
            if (turn.playback === 'buffering' || turn.playback === 'playing' || turn.playback === 'blocked') return
            this.settle(turn, endedOutcome(turn), this.now())
        }, LATE_AUDIO_GRACE_MS)
    }

    private clearGrace(turn: TurnTiming) {
        if (turn.graceTimer === undefined) return
        clearTimeout(turn.graceTimer)
        turn.graceTimer = undefined
    }

    private release(turn: TurnTiming) {
        this.clearGrace(turn)
        if (turn.capTimer !== undefined) clearTimeout(turn.capTimer)
        turn.capTimer = undefined
    }

    private closeStall(turn: TurnTiming, now: number) {
        if (turn.stallStartedMs === undefined || !isTime(now)) return
        turn.stallMs += Math.max(0, now - turn.stallStartedMs)
        turn.stallStartedMs = undefined
    }

    private settle(turn: TurnTiming, outcome: VoiceTurnClientOutcome, now: number, details: SettleDetails = {}) {
        if (turn.settled) return
        turn.settled = true
        this.release(turn)
        this.closeStall(turn, now)
        const onTurnMetrics = this.options.onTurnMetrics
        if (!onTurnMetrics) return
        try {
            onTurnMetrics(this.record(turn, outcome, now, details), turn.voiceSessionId)
        } catch (error) {
            console.warn('[voice-call][METRICS] turn metrics were not sent', error)
        }
    }

    private record(turn: TurnTiming, outcome: VoiceTurnClientOutcome, now: number, details: SettleDetails): VoiceTurnClientMetricsFrame {
        const context = this.callContext()
        const t0 = turn.speechEndMs
        const latency = context.outputLatencyMs
        const outputLatencyMs = isTime(latency) && latency >= 0 ? clampWhole(latency, MAX_OUTPUT_LATENCY_MS) : undefined
        const sentMs = turn.segment?.sentMs
        // A turn that waited for a tap has the caller's tap delay in its start-up: left out (v2 §3.2).
        const playingMs = turn.waitedForTap ? undefined : turn.playingMs
        const speechEndToPlayingMs = span(t0, playingMs)
        // From the later of the speech onset and the turn becoming audible: a caller already
        // talking when the audio started is reacted to from that start.
        const onsetMs = isTime(details.bargeInOnsetMs) && isTime(turn.playingMs)
            ? Math.max(details.bargeInOnsetMs, turn.playingMs)
            : details.bargeInOnsetMs
        const bargeIn = outcome === 'interrupted' ? span(onsetMs, now, MAX_BARGE_IN_MS) : undefined
        return {
            type: 'voice_turn_client_metrics',
            v: 1,
            turn_id: turn.turnId,
            ...definedOnly({ segment_seq: turn.segmentSeq }),
            outcome,
            ...definedOnly({
                // The upload's own `vad.speech_end_lag_ms`, by the same formula.
                speech_end_to_upload_ms: sentMs === undefined ? undefined : speechEndLagMs(t0, sentMs) ?? undefined,
                upload_to_ack_ms: span(sentMs, turn.segment?.ackMs),
                speech_end_to_turn_start_ms: span(t0, turn.startedMs),
                speech_end_to_first_chunk_ms: span(t0, turn.firstChunkMs),
                speech_end_to_playing_ms: speechEndToPlayingMs,
                turn_start_to_first_chunk_ms: span(turn.startedMs, turn.firstChunkMs),
                first_chunk_to_playing_ms: span(turn.firstChunkMs, playingMs),
                output_latency_ms: outputLatencyMs,
                // R01's voice-to-voice number. Without an exposed output latency it is the
                // `playing` time alone, and `output_latency_ms` is absent.
                v2v_ms: speechEndToPlayingMs === undefined ? undefined : Math.min(MAX_INTERVAL_MS, speechEndToPlayingMs + (outputLatencyMs ?? 0)),
                played_ms: this.playedMs(turn, details.playedMs),
            }),
            chunks: Math.min(MAX_CHUNKS, turn.chunks),
            stalls: Math.min(MAX_STALLS, turn.stalls),
            stall_ms: clampWhole(turn.stallMs, MAX_INTERVAL_MS),
            ...definedOnly({
                barge_in_onset_to_pause_ms: bargeIn,
                playback_path: turn.playingMs === undefined ? 'none' as const : turn.path,
            }),
            aec: context.aec ?? 'unknown',
            autoplay_blocked: turn.autoplayBlocked,
        }
    }

    /** Played audio at settle: the caller's reading, the player's, then the last progress; 0 when nothing played. */
    private playedMs(turn: TurnTiming, explicit: number | null | undefined): number | undefined {
        let reading: number | null | undefined
        try {
            reading = this.options.playedMs?.(turn.voiceSessionId, turn.turnId)
        } catch {
            reading = undefined
        }
        for (const value of [explicit, reading, turn.lastPlayedMs]) {
            if (isTime(value) && value >= 0) return clampWhole(value, MAX_PLAYED_MS)
        }
        return turn.playingMs === undefined ? 0 : undefined
    }

    private callContext(): CallTimelineContext {
        try {
            return this.options.callContext?.() ?? {}
        } catch {
            return {}
        }
    }

    private now(): number {
        try {
            return this.options.now?.() ?? performance.now()
        } catch {
            return performance.now()
        }
    }
}
