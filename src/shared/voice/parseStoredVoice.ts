/**
 * The V1 parser (09 §3.1–§3.2). With `voiceIdentity.ts` it is the only module
 * allowed to read `voice_id` (D35 grep gate, `voiceIdGate.test.ts`).
 *
 * Lossless by contract (03 §5.1.2, D11, D32): a recognised stored voice is
 * returned as the SAME object — no copy, no whitelist, no trim — so an
 * unchanged save re-sends it byte-identical. A trimmed or rebuilt V1 value
 * would read as a voice "change", which the BFF rejects for V1 (§5.10).
 */
import type { CharacterVoiceLegacyV1, CharacterVoiceV2, StoredCharacterVoice } from '@/shared/types'

/**
 * V2 when `schema_version === 2` (needs a non-empty `voice_key`); otherwise V1
 * (needs a non-empty `voice_id`). `null` means "no assigned voice" and is for
 * display only: write paths re-send the stored value instead (09 §3.2).
 */
export function parseStoredVoice(raw: unknown): StoredCharacterVoice | null {
    if (!raw || typeof raw !== 'object') return null
    const v = raw as Record<string, unknown>
    if (v.schema_version === 2) return typeof v.voice_key === 'string' && v.voice_key ? (raw as CharacterVoiceV2) : null
    return typeof v.voice_id === 'string' && v.voice_id.length > 0 ? (raw as CharacterVoiceLegacyV1) : null
}

/**
 * The stored voice to keep on a write path (09 §3.2, D32): any non-null object
 * is returned as the SAME object, recognised or not, so a save never turns a
 * stored voice the client does not understand into `null`. The BFF's shape
 * validation decides what is valid. Display code still goes through
 * {@link parseStoredVoice} / `hasAssignedVoice`, which read an unrecognised
 * value as "no assigned voice".
 */
export function keepStoredVoice(raw: unknown): StoredCharacterVoice | undefined {
    return typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as StoredCharacterVoice) : undefined
}
