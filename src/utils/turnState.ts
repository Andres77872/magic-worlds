/**
 * Normalises the turn list out of an adventure session's `adventure_last_turn`
 * JSON string. The magic-worlds-api returns this field in several shapes:
 *
 *  - canonical projection (GET /adventure-sessions/{id}):
 *        { messages, turns, version, source: "canonical_projection" }
 *  - wrapped legacy cache (after a PUT, returned by GET /adventure-sessions/):
 *        { source: "legacy_cache", legacy: { turns: [...] } }
 *  - the client's own legacy write (older sessions):  { turns: [...] }
 *  - empty / uninitialised:  "{}"  |  ""  |  null
 *
 * All of them normalise to a TurnEntry[]. Returning [] on anything unexpected
 * keeps callers from crashing on a malformed or wrapped payload.
 */

import type { TurnEntry } from '@/shared'

export function parseTurnState(raw?: string | null): TurnEntry[] {
    if (!raw) return []
    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch {
        return []
    }
    if (!parsed || typeof parsed !== 'object') return []
    const obj = parsed as { turns?: unknown; legacy?: { turns?: unknown } }
    const turns = Array.isArray(obj.turns)
        ? obj.turns
        : Array.isArray(obj.legacy?.turns)
          ? obj.legacy!.turns
          : []
    return turns as TurnEntry[]
}
