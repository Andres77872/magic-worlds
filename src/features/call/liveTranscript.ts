/**
 * The running transcript of the live call: every final user line (STT) and every
 * character reply as it streams, in order. Captions show only the current turn;
 * this keeps the whole conversation so the call screen can show it and the end
 * panel can recap it. It is a view of the socket frames only — the saved
 * transcript (Calls history) stays the server's.
 *
 * Fed by `useVoiceCallController` through `reduceLiveTranscript`:
 * - `transcript_final` adds the user line. A newer utterance that superseded an
 *   unanswered one arrives with the merged text, so it replaces that line instead
 *   of repeating it;
 * - `voice_turn_start` opens the character line, deltas append to it;
 * - a truncation (`kept_chars`, code points as the BFF counts) cuts it where
 *   playback stopped and marks it interrupted, as does a barge-in or a cancel;
 * - a failed turn that said nothing drops its empty line.
 */
import { stripSpeechMarkupV1 } from '@/shared/voice/speechMarkup'

export interface LiveTranscriptLine {
    /** `${role}:${turnId}` — stable React key. */
    id: string
    turnId: string
    role: 'user' | 'assistant'
    text: string
    /** Character line still receiving text. */
    streaming: boolean
    /** Character line cut short (barge-in, cancel, truncation). */
    interrupted: boolean
}

export type LiveTranscriptEvent =
    | { type: 'reset' }
    | { type: 'user_final'; turnId: string; text: string }
    | { type: 'assistant_start'; turnId: string }
    | { type: 'assistant_delta'; turnId: string; content: string }
    | { type: 'assistant_truncate'; turnId: string; keptChars: number }
    | { type: 'assistant_end'; turnId: string; status: 'completed' | 'interrupted' | 'failed' }
    | { type: 'assistant_interrupted'; turnId: string }
    /** The call is over: nothing streams any more. */
    | { type: 'settle' }

/** A long call keeps its most recent lines; the saved transcript has them all. */
export const LIVE_TRANSCRIPT_MAX_LINES = 200

const EMPTY: readonly LiveTranscriptLine[] = Object.freeze([])

function normalize(text: string): string {
    return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

function lineId(role: LiveTranscriptLine['role'], turnId: string): string {
    return `${role}:${turnId}`
}

function cap(lines: LiveTranscriptLine[]): LiveTranscriptLine[] {
    return lines.length > LIVE_TRANSCRIPT_MAX_LINES ? lines.slice(lines.length - LIVE_TRANSCRIPT_MAX_LINES) : lines
}

function updateAssistant(
    lines: readonly LiveTranscriptLine[],
    turnId: string,
    update: (line: LiveTranscriptLine) => LiveTranscriptLine | null,
): readonly LiveTranscriptLine[] {
    const index = lines.findIndex((line) => line.role === 'assistant' && line.turnId === turnId)
    if (index < 0) return lines
    const next = update(lines[index])
    if (next === lines[index]) return lines
    const copy = [...lines]
    if (next) copy[index] = next
    else copy.splice(index, 1)
    return copy
}

export function reduceLiveTranscript(lines: readonly LiveTranscriptLine[], event: LiveTranscriptEvent): readonly LiveTranscriptLine[] {
    switch (event.type) {
        case 'reset':
            return lines.length ? EMPTY : lines
        case 'settle':
            return lines.some((line) => line.streaming) ? lines.map((line) => (line.streaming ? { ...line, streaming: false } : line)) : lines
        case 'user_final': {
            const text = event.text.trim()
            if (!text) return lines
            const existing = lines.findIndex((line) => line.role === 'user' && line.turnId === event.turnId)
            if (existing >= 0) {
                if (lines[existing].text === text) return lines
                const copy = [...lines]
                copy[existing] = { ...copy[existing], text }
                return copy
            }
            const last = lines[lines.length - 1]
            // The server merged an unanswered utterance into this turn: the new text contains it.
            if (last?.role === 'user' && normalize(text).includes(normalize(last.text))) {
                return [...lines.slice(0, -1), { ...last, id: lineId('user', event.turnId), turnId: event.turnId, text }]
            }
            return cap([...lines, { id: lineId('user', event.turnId), turnId: event.turnId, role: 'user', text, streaming: false, interrupted: false }])
        }
        case 'assistant_start': {
            if (lines.some((line) => line.role === 'assistant' && line.turnId === event.turnId)) return lines
            // Any older reply still marked streaming is over once a new one starts.
            const settled = lines.map((line) => (line.streaming ? { ...line, streaming: false } : line))
            return cap([...settled, { id: lineId('assistant', event.turnId), turnId: event.turnId, role: 'assistant', text: '', streaming: true, interrupted: false }])
        }
        case 'assistant_delta':
            if (!event.content) return lines
            return updateAssistant(lines, event.turnId, (line) => (line.interrupted ? line : { ...line, text: `${line.text}${event.content}` }))
        case 'assistant_truncate': {
            if (!Number.isInteger(event.keptChars) || event.keptChars < 0) return lines
            return updateAssistant(lines, event.turnId, (line) => {
                const points = Array.from(line.text)
                if (points.length <= event.keptChars && line.interrupted) return line
                return { ...line, text: points.slice(0, event.keptChars).join(''), interrupted: true, streaming: false }
            })
        }
        case 'assistant_interrupted':
            return updateAssistant(lines, event.turnId, (line) => (line.interrupted && !line.streaming ? line : { ...line, interrupted: true, streaming: false }))
        case 'assistant_end':
            return updateAssistant(lines, event.turnId, (line) => {
                if (event.status === 'failed' && !line.text.trim()) return null
                const interrupted = line.interrupted || event.status === 'interrupted'
                if (!line.streaming && interrupted === line.interrupted) return line
                return { ...line, streaming: false, interrupted }
            })
    }
}

/**
 * A line as shown: character lines without the speech markup the model writes for
 * the voice (`<#0.5#>`, `(laughs)`); a streaming line may end mid-token, so it is
 * stripped as a partial.
 */
export function lineDisplayText(line: LiveTranscriptLine): string {
    return line.role === 'assistant' ? stripSpeechMarkupV1(line.text, { partial: line.streaming }) : line.text
}
