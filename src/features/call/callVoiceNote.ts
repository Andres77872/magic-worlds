/**
 * The call header's voice note (R1-FE-05, 07 §5.2): which voice the call
 * speaks with when it is not the card's own.
 *
 * - `call_voice`: the card's voice is not call-ready, so the call speaks with a
 *   call voice (`not_call_eligible`);
 * - `replaced`: the card's voice was replaced (the R-7 reasons);
 * - null otherwise, and always when the call announced no effective voice
 *   (an older BFF build, or a `voice_ready` without one).
 *
 * The reason the reply chunks carry wins over the one `voice_ready` sent (it
 * is the live one); the AI voice label never depends on any of it (P-10).
 * A replaced reason only the chunks carry is a mid-call swap (07 §10.3): no
 * new `voice_ready` names the substitute, so the announced voice is the one
 * that went away. The chunks after the swap name the substitute
 * (`voice_audio_chunk.voice_name`), so the note reads "Voice replaced: {name}";
 * without that name it names no voice.
 */
import type { EffectiveVoice } from '@/shared/types'
import { isCallVoiceReason, isReplacedReason } from '@/shared/voice/substitution'

export type CallVoiceNote =
    | { kind: 'call_voice'; name: string | null }
    | { kind: 'replaced'; name: string | null; original: string | null }

function text(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function callVoiceNote(
    effectiveVoice: EffectiveVoice | null | undefined,
    originalName: string | null | undefined,
    chunkReason?: unknown,
    chunkVoiceName?: unknown,
): CallVoiceNote | null {
    if (!effectiveVoice || typeof effectiveVoice !== 'object') return null
    const announced = effectiveVoice.substitution_reason
    const reason = chunkReason ?? announced
    const name = text(effectiveVoice.display_name)
    if (isCallVoiceReason(reason)) return { kind: 'call_voice', name }
    if (!isReplacedReason(reason)) return null
    // Live swap (R1-BE-04): the chunks after it name the substitute.
    const substitute = chunkReason != null ? text(chunkVoiceName) : null
    if (substitute) return { kind: 'replaced', name: substitute, original: text(originalName) ?? name }
    if (chunkReason != null && chunkReason !== announced) {
        // Live swap without a chunk name: the substitute is unnamed; the card's own voice is the original
        // one `voice_ready` named, or the announced voice when it was the card's.
        return { kind: 'replaced', name: null, original: text(originalName) ?? name }
    }
    return { kind: 'replaced', name, original: text(originalName) }
}
