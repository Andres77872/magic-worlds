/**
 * The voice picked for calls with one character (call setup). It is sent on
 * `voice_start` for each call and never changes the card or the chat; the BFF
 * judges it as a new pick (catalog, plan) and refuses the call otherwise.
 *
 * Remembered per account and character in this browser, so the next call with
 * the same character starts with it. A read never throws: blocked storage or an
 * unreadable value is simply "no pick" (the chat's own voice).
 */
import { API_BASE_URL } from '@/infrastructure/api/baseUrl'
import type { StoredCharacterVoice } from '@/shared/types'
import { parseStoredVoice } from '@/shared/voice'
import { accountStorageKey, apiStorageOrigin } from '@/shared/workspaceStorage'

const CALL_VOICE_STORAGE_BASE = 'magic-worlds:call-voice:v1'

function storageKey(userHash: string, characterId: string): string {
    return `${accountStorageKey(CALL_VOICE_STORAGE_BASE, { apiOrigin: apiStorageOrigin(API_BASE_URL), userHash })}::${encodeURIComponent(characterId)}`
}

export function readCallVoicePick(userHash: string | null | undefined, characterId: string | null | undefined): StoredCharacterVoice | null {
    if (!userHash || !characterId) return null
    try {
        const raw = globalThis.localStorage?.getItem(storageKey(userHash, characterId))
        return raw ? parseStoredVoice(JSON.parse(raw)) : null
    } catch {
        return null
    }
}

/** Saves the pick; `null` forgets it (back to the chat's voice). */
export function saveCallVoicePick(userHash: string | null | undefined, characterId: string | null | undefined, voice: StoredCharacterVoice | null): void {
    if (!userHash || !characterId) return
    try {
        const key = storageKey(userHash, characterId)
        if (voice) globalThis.localStorage?.setItem(key, JSON.stringify(voice))
        else globalThis.localStorage?.removeItem(key)
    } catch {
        // Storage blocked: the pick still applies to this call screen.
    }
}
