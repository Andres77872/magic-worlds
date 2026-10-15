/** Local browser marks for R4. `playing` is a playback proxy, not a hardware audio measurement. */
export const FIRST_AUDIBLE_MARK = 'mw.voice.first_audible'
const MAX_RECORDS = 64

interface TurnTiming {
    voiceSessionId: string
    turnId: string
    segmentSeq?: number
    speechEndMs?: number
    startedMs: number
    marked: boolean
    cancelled: boolean
}

export interface FirstAudibleTiming {
    voice_session_id: string
    turn_id: string
    segment_seq?: number
    turn_start_to_first_audible_ms: number
    speech_end_to_first_audible_ms?: number
}

function boundedSet<K, V>(map: Map<K, V>, key: K, value: V) {
    map.set(key, value)
    if (map.size > MAX_RECORDS) map.delete(map.keys().next().value!)
}

function emitMark(detail: FirstAudibleTiming) {
    if (typeof performance.mark !== 'function') return
    // Observers receive each new mark; retain only the latest in the global buffer.
    performance.clearMarks(FIRST_AUDIBLE_MARK)
    performance.mark(FIRST_AUDIBLE_MARK, { detail })
}

export class CallPlaybackTiming {
    private readonly speechEnds = new Map<string, number>()
    private readonly turns = new Map<string, TurnTiming>()
    private readonly emit: (detail: FirstAudibleTiming) => void

    constructor(emit: (detail: FirstAudibleTiming) => void = emitMark) {
        this.emit = emit
    }

    segmentSent(voiceSessionId: string, seq: number, speechEndMs: number | undefined) {
        if (typeof speechEndMs === 'number' && Number.isFinite(speechEndMs) && speechEndMs >= 0) {
            const key = `${voiceSessionId}:${seq}`
            if (!this.speechEnds.has(key)) boundedSet(this.speechEnds, key, speechEndMs)
        }
    }

    turnStarted(voiceSessionId: string, turnId: string, segmentSeq: number | undefined, now: number) {
        const key = `${voiceSessionId}:${turnId}`
        if (this.turns.has(key) || !Number.isFinite(now)) return
        const seq = Number.isSafeInteger(segmentSeq) && segmentSeq! > 0 ? segmentSeq : undefined
        boundedSet(this.turns, key, {
            voiceSessionId, turnId, segmentSeq: seq, startedMs: now,
            speechEndMs: seq === undefined ? undefined : this.speechEnds.get(`${voiceSessionId}:${seq}`),
            marked: false, cancelled: false,
        })
    }

    playing(voiceSessionId: string, turnId: string, now: number) {
        const turn = this.turns.get(`${voiceSessionId}:${turnId}`)
        if (!turn || turn.marked || turn.cancelled || !Number.isFinite(now) || now < turn.startedMs) return
        turn.marked = true
        const speechDelay = turn.speechEndMs === undefined ? undefined : now - turn.speechEndMs
        this.emit({
            voice_session_id: voiceSessionId, turn_id: turnId, segment_seq: turn.segmentSeq,
            turn_start_to_first_audible_ms: Math.round(now - turn.startedMs),
            ...(speechDelay !== undefined && speechDelay >= 0 && speechDelay <= 120_000
                ? { speech_end_to_first_audible_ms: Math.round(speechDelay) } : {}),
        })
    }

    cancelled(voiceSessionId: string, turnId: string) {
        const turn = this.turns.get(`${voiceSessionId}:${turnId}`)
        if (turn) turn.cancelled = true
    }

    clear() {
        this.speechEnds.clear()
        this.turns.clear()
    }
}
