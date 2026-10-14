/**
 * Shape-agnostic voice checks (names fixed by D35, 03 §5.12). Every FE check
 * that used to key on `voice_id` goes through these, so V2 voices are never
 * hidden by a V1-only test. With `parseStoredVoice.ts` this is the only module
 * allowed to read `voice_id` (D35 grep gate).
 */
import type { StoredCharacterVoice } from '@/shared/types'
import { isVoiceV2 } from '@/shared/types'
import { parseStoredVoice } from './parseStoredVoice'

/** True when a recognised voice (V1 or V2) is assigned. Never throws on malformed input. */
export const hasAssignedVoice = (v: StoredCharacterVoice | null | undefined): v is StoredCharacterVoice =>
    parseStoredVoice(v) !== null

/** D35: `voice_key` for V2, `minimax:{voice_id}` for V1, `null` when no voice is assigned. */
export function voiceIdentity(v: StoredCharacterVoice | null | undefined): string | null {
    const voice = parseStoredVoice(v)
    if (!voice) return null
    return isVoiceV2(voice) ? voice.voice_key : `minimax:${voice.voice_id}`
}

/** Same voice across shapes; two unassigned voices are never "the same". */
export const isSameVoice = (a?: StoredCharacterVoice | null, b?: StoredCharacterVoice | null): boolean =>
    voiceIdentity(a) !== null && voiceIdentity(a) === voiceIdentity(b)
