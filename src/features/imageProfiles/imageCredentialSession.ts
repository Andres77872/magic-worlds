/**
 * Provider keys for personal (BYOK) image profiles, held for this tab only.
 *
 * One key per provider (fal, OpenRouter), in memory: never written to browser
 * storage and never sent anywhere but a generation request over HTTPS. Keys are
 * dropped when the signed-in owner changes (sign-out, expiry, another account,
 * another API) and when another tab changes the session.
 */
import { authSession } from '@/infrastructure/api/authSession'
import { API_BASE_URL } from '@/infrastructure/api/baseUrl'
import type { ImageProvider } from '@/shared/types/imageProfile.types'

const keys = new Map<ImageProvider, string>()
const listeners = new Set<() => void>()
let version = 0

function hasControlCharacter(value: string): boolean {
    return [...value].some(char => { const code = char.charCodeAt(0); return code < 0x20 || code === 0x7f })
}

function changed(): void { version++; for (const listener of listeners) listener() }

function clear(): void {
    if (keys.size === 0) return
    keys.clear()
    changed()
}

function currentOwner(): string | null {
    const owner = authSession.getSnapshot()
    if (owner.sessionPhase !== 'authenticated' || !owner.userHash || !owner.token) return null
    return JSON.stringify([owner.accountKey, owner.userHash, API_BASE_URL])
}

let rememberedOwner = currentOwner()
function synchronize(): void {
    const owner = currentOwner()
    if (owner !== rememberedOwner) clear()
    rememberedOwner = owner
}
authSession.subscribe(synchronize)
if (typeof window !== 'undefined') {
    window.addEventListener('storage', event => {
        if (event.key === null || event.key === 'magic_worlds:token' || event.key === 'magic_worlds:user') clear()
    })
}

/** Providers with a key, as a stable string for useSyncExternalStore. */
export function heldProvidersSnapshot(): string {
    return (['fal', 'openrouter'] as const).filter(provider => keys.has(provider)).join(',')
}

/** Whether this deployment can carry a provider key at all. */
export function byokTransportAvailable(): boolean {
    return API_BASE_URL.startsWith('https://')
}

export const imageCredentialSession = {
    subscribe(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener) } },
    getVersion(): number { return version },
    has(provider: ImageProvider): boolean { synchronize(); return keys.has(provider) },
    /** Throws IMAGE_CREDENTIAL_HTTPS_REQUIRED, IMAGE_SESSION_UNAVAILABLE or IMAGE_CREDENTIAL_INVALID. */
    remember(provider: ImageProvider, key: string): void {
        synchronize()
        if (!byokTransportAvailable()) throw new Error('IMAGE_CREDENTIAL_HTTPS_REQUIRED')
        if (rememberedOwner === null) throw new Error('IMAGE_SESSION_UNAVAILABLE')
        if (!key || key.length > 4096 || key !== key.trim() || hasControlCharacter(key)) throw new Error('IMAGE_CREDENTIAL_INVALID')
        keys.set(provider, key)
        changed()
    },
    /** The request credentials for a provider, or undefined when no key is held. */
    credentials(provider: ImageProvider): { api_key: string } | undefined {
        synchronize()
        if (!byokTransportAvailable()) return undefined
        const key = keys.get(provider)
        return key ? { api_key: key } : undefined
    },
    forget(provider?: ImageProvider): void {
        synchronize()
        if (provider === undefined) { clear(); return }
        if (keys.delete(provider)) changed()
    },
    clear,
}
