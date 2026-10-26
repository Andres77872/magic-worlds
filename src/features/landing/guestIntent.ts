/**
 * The create action a guest picked on the front door before signing up, so the
 * new account lands straight in that creator instead of back on the landing.
 *
 * Session storage, not component state: sign-in remounts the landing (AppRouter
 * keys pages on the auth epoch) and Google sign-in leaves the page entirely.
 * It expires, and the landing clears it when the login modal is dismissed, so a
 * later unrelated sign-in never replays it.
 */
import type { CreateAction } from './components/landingContent'

const STORAGE_KEY = 'magic_worlds:guest-intent:v1'
const MAX_AGE_MS = 15 * 60 * 1000
const KEYS: ReadonlySet<string> = new Set<CreateAction['key']>(['character', 'world', 'item', 'adventure', 'novel', 'lorebook'])

export function rememberGuestIntent(key: CreateAction['key'], now = Date.now()): void {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ key, at: now }))
    } catch {
        // Storage unavailable (private mode): the sign-up still works, just without the hand-off.
    }
}

export function clearGuestIntent(): void {
    try {
        sessionStorage.removeItem(STORAGE_KEY)
    } catch {
        // Nothing stored.
    }
}

/** Read-and-clear: a remembered, still-fresh intent, or null. */
function readStored(): string | null {
    try {
        return sessionStorage.getItem(STORAGE_KEY)
    } catch {
        return null
    }
}

export function takeGuestIntent(now = Date.now()): CreateAction['key'] | null {
    const raw = readStored()
    if (!raw) return null
    clearGuestIntent()
    try {
        const parsed = JSON.parse(raw) as { key?: unknown; at?: unknown }
        if (typeof parsed.key !== 'string' || !KEYS.has(parsed.key) || typeof parsed.at !== 'number') return null
        if (now - parsed.at > MAX_AGE_MS || now < parsed.at) return null
        return parsed.key as CreateAction['key']
    } catch {
        return null
    }
}
