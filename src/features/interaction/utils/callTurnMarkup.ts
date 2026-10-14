/**
 * Speech markup in voice-call replies on the chat (R1-FE-05; D23, 03 §5.5,
 * 10 §2.4 #16-#17): the display layer strips markup v1 (`<#0.4#>` pauses and
 * the `(laughs)` / `(sighs)` interjections, `stripSpeechMarkupV1`) from the
 * text of a saved call reply, as the Calls page transcript does
 * (`CallTranscriptView`). The gate is the turn's own provenance, as the BFF
 * stores it: an AI turn whose `metadata.conversation_mode` is `voice_call`.
 * A text reply, a player turn and a live turn (no stored metadata) render
 * exactly as stored: the same strings and segment objects.
 */
import type { ChatResponseSegment, TurnEntry } from '@/shared'
import { stripSpeechMarkupV1 } from '@/shared/voice/speechMarkup'

/** Whether a turn is a reply of a voice call. */
export function isCallReply(turn: Pick<TurnEntry, 'type' | 'metadata'>): boolean {
    return turn.type === 'ai' && turn.metadata?.conversation_mode === 'voice_call'
}

export interface CallTurnDisplay {
    content: string
    segments: ChatResponseSegment[] | undefined
}

/**
 * The text a turn shows: a call reply without speech markup v1 (a streaming
 * one also hides a token cut mid-way), any other turn as stored.
 */
export function callTurnDisplay(
    turn: Pick<TurnEntry, 'type' | 'metadata' | 'content' | 'segments' | 'isStreaming'>,
): CallTurnDisplay {
    if (!isCallReply(turn)) return { content: turn.content, segments: turn.segments }
    const partial = Boolean(turn.isStreaming)
    return {
        content: stripSpeechMarkupV1(turn.content, { partial }),
        segments: turn.segments?.map((segment) => ({ ...segment, content: stripSpeechMarkupV1(segment.content, { partial: partial && Boolean(segment.streaming) }) })),
    }
}
