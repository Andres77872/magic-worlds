/**
 * The stored-voice parser (09 §3.1–§3.2).
 *
 * Lossless by contract (03 §5.1.2, D11, D32): a recognised stored voice is
 * returned as the SAME object — no copy, no whitelist, no trim — so an
 * unchanged save re-sends it byte-identical.
 */
import type { CharacterVoiceV2, StoredCharacterVoice } from '@/shared/types'

/**
 * The stored voice when `schema_version === 2` with a non-empty `voice_key`.
 * `null` means "no assigned voice" and is for display only: write paths
 * re-send the stored value instead (09 §3.2).
 */
export function parseStoredVoice(raw: unknown): StoredCharacterVoice | null {
    if (!raw || typeof raw !== 'object') return null
    const v = raw as Record<string, unknown>
    return v.schema_version === 2 && typeof v.voice_key === 'string' && v.voice_key ? (raw as CharacterVoiceV2) : null
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
