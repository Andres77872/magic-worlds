/**
 * Voice checks (names fixed by D35, 03 §5.12). Every FE check of "is a voice
 * assigned" or "is it the same voice" goes through these.
 */
import type { StoredCharacterVoice } from '@/shared/types'
import { parseStoredVoice } from './parseStoredVoice'

/** True when a recognised voice is assigned. Never throws on malformed input. */
export const hasAssignedVoice = (v: StoredCharacterVoice | null | undefined): v is StoredCharacterVoice =>
    parseStoredVoice(v) !== null

/** D35: the stored `voice_key`, `null` when no voice is assigned. */
export function voiceIdentity(v: StoredCharacterVoice | null | undefined): string | null {
    return parseStoredVoice(v)?.voice_key ?? null
}

/** Same voice; two unassigned voices are never "the same". */
export const isSameVoice = (a?: StoredCharacterVoice | null, b?: StoredCharacterVoice | null): boolean =>
    voiceIdentity(a) !== null && voiceIdentity(a) === voiceIdentity(b)
