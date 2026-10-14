/**
 * Speech markup in voice-call replies on the chat (R1-FE-05; D23, 03 §5.5,
 * 10 §2.4 #16-#17): the display layer strips markup v1 (`<#0.4#>` pauses and
 * the `(laughs)` / `(sighs)` interjections, `stripSpeechMarkupV1`) from the
 * text of a call reply spoken by the ElevenLabs streaming client. The gate is
 * the turn's own provenance, as the BFF stores it: `metadata.conversation_mode`
 * is `voice_call` and `metadata.voice.tts_provider` is `elevenlabs_streaming`.
 * A call reply stored with any other provider (rows from before the voice
 * purge), a text reply, a player turn and a live turn (no stored metadata)
 * render exactly as stored: the same strings and segment objects.
 *
 * `allCallReplies` widens the gate to every call reply, so those older rows of
 * 10 §2.4 #16-#17 (stored `<#x#>` markers) are stripped too. Off (the default)
 * they stay as stored.
 */
import type { ChatResponseSegment, TurnEntry } from '@/shared'
import { stripSpeechMarkupV1 } from '@/shared/voice/speechMarkup'

/** `metadata.voice.tts_provider` of a call turn the ElevenLabs streaming client spoke (BFF `callbot_execution`). */
export const ELEVENLABS_CALL_TTS_PROVIDER = 'elevenlabs_streaming'

/** Whether a turn is a reply of a voice call, whichever provider spoke it. */
export function isCallReply(turn: Pick<TurnEntry, 'type' | 'metadata'>): boolean {
    return turn.type === 'ai' && turn.metadata?.conversation_mode === 'voice_call'
}

/** Whether a turn is a reply of a voice call the ElevenLabs streaming client spoke. */
export function isElevenLabsCallReply(turn: Pick<TurnEntry, 'type' | 'metadata'>): boolean {
    if (!isCallReply(turn)) return false
    const voice = turn.metadata?.voice
    return Boolean(voice && typeof voice === 'object' && (voice as Record<string, unknown>).tts_provider === ELEVENLABS_CALL_TTS_PROVIDER)
}

export interface CallTurnDisplay {
    content: string
    segments: ChatResponseSegment[] | undefined
}

/**
 * The text a turn shows: an ElevenLabs call reply (with `allCallReplies`, any
 * call reply) without speech markup v1 (a streaming one also hides a token cut
 * mid-way), any other turn as stored.
 */
export function callTurnDisplay(
    turn: Pick<TurnEntry, 'type' | 'metadata' | 'content' | 'segments' | 'isStreaming'>,
    options: { allCallReplies?: boolean } = {},
): CallTurnDisplay {
    const strip = options.allCallReplies ? isCallReply(turn) : isElevenLabsCallReply(turn)
    if (!strip) return { content: turn.content, segments: turn.segments }
    const partial = Boolean(turn.isStreaming)
    return {
        content: stripSpeechMarkupV1(turn.content, { partial }),
        segments: turn.segments?.map((segment) => ({ ...segment, content: stripSpeechMarkupV1(segment.content, { partial: partial && Boolean(segment.streaming) }) })),
    }
}
