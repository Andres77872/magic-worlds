/**
 * What a character chat's own voices play as (`GET /voices/effective?ref_type=session`,
 * D35), shared by the chat header and the chat sidebar so one chat costs one
 * read. Entries live 60 s for new readers (nothing polls). Failed reads are not kept.
 *
 * An entry is dropped, so every mounted reader reads again, when:
 * - the header's own D36 refresh succeeds (`invalidateSessionVoices`);
 * - a reader sees another chat record for its key than the last one seen
 *   (`noteSessionRevision`). DataProvider upserts the chat after every D36
 *   refresh, whichever entry point ran it (the header, a clip's "Voice
 *   replaced" note, the call end panel), so those reach the header too.
 *
 * Every signed-in caller reads it (I-68: no cohort); a 404 or any other failed
 * read is not kept and reads as "nothing to show".
 */
import type { ApiService } from '@/infrastructure/api'
import type { EffectiveVoice } from '@/shared/types'
import { readEffectiveVoice } from '@/shared/voice'

export type SessionVoices = ReadonlyMap<string, EffectiveVoice>

type SessionVoiceReader = Partial<Pick<ApiService, 'getEffectiveVoice'>>

export const SESSION_VOICES_TTL_MS = 60_000

const entries = new Map<string, { at: number; promise: Promise<SessionVoices> }>()
/** The chat record each key was last read for (identity only). */
const revisions = new Map<string, unknown>()
const listeners = new Set<() => void>()
let version = 0

export function sessionVoicesKey(workspaceId: string, sessionId: number): string {
    return `${workspaceId}|${sessionId}`
}

function toSessionVoices(response: unknown): SessionVoices {
    const voices = new Map<string, EffectiveVoice>()
    const items = (response as { voices?: unknown } | null)?.voices
    if (!Array.isArray(items)) return voices
    for (const item of items) {
        const path = (item as { json_path?: unknown } | null)?.json_path
        const effective = readEffectiveVoice((item as { effective_voice?: unknown } | null)?.effective_voice)
        if (typeof path === 'string' && effective) voices.set(path, effective)
    }
    return voices
}

/** The chat's voices by json path (`character.voice`, `persona.voice`, …); one read per key while fresh. */
export function loadSessionVoices(api: SessionVoiceReader, key: string, sessionId: number): Promise<SessionVoices> {
    const hit = entries.get(key)
    if (hit && Date.now() - hit.at < SESSION_VOICES_TTL_MS) return hit.promise
    const promise = Promise.resolve()
        .then(() => {
            if (typeof api.getEffectiveVoice !== 'function') throw new Error('No effective-voice reader')
            return api.getEffectiveVoice('session', String(sessionId))
        })
        .then(toSessionVoices)
    entries.set(key, { at: Date.now(), promise })
    promise.catch(() => {
        if (entries.get(key)?.promise === promise) entries.delete(key)
    })
    return promise
}

/**
 * Records the chat record a reader holds for this key. Another record than the
 * last one seen (an upserted chat) drops the entry, so the read that follows is
 * fresh; readers that see the same record in the same commit then share it. The
 * first record seen for a key only registers.
 */
export function noteSessionRevision(key: string, revision: unknown): void {
    if (revision === undefined) return
    if (revisions.has(key) && revisions.get(key) !== revision) entries.delete(key)
    revisions.set(key, revision)
}

/** Drops a chat's entry and tells every mounted reader to read again. */
export function invalidateSessionVoices(key: string): void {
    entries.delete(key)
    version += 1
    for (const listener of listeners) listener()
}

export function subscribeSessionVoices(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

export function sessionVoicesVersion(): number {
    return version
}

/** Tests only. */
export function clearSessionVoicesCache(): void {
    entries.clear()
    revisions.clear()
}
