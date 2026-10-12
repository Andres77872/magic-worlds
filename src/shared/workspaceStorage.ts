/**
 * Durable browser-storage keys for Workspace R1 (document 08 "Browser storage
 * carried over" and the selected-URL algorithm).
 *
 * Content hints (assistant focus, saved library filters, ...) are keyed by the
 * stable triple API origin + userHash + workspaceId. The transient auth
 * `accountKey` sequence is never a durable identity. Account/global
 * preferences (language, gallery view mode, sidebar, playlist, cookie consent,
 * auth token) and keys already scoped by a stable record ID stay as they are.
 */

export interface AccountStorageScope {
    /** The BFF origin (see `apiStorageOrigin`); one browser may talk to several. */
    apiOrigin: string
    /** The stable per-user hash (`useAuth().userHash`), never the accountKey. */
    userHash: string
}

export interface WorkspaceStorageScope extends AccountStorageScope {
    workspaceId: string
}

const SEPARATOR = '::'

function part(value: string): string {
    return encodeURIComponent(value)
}

/** Normalizes a configured API base URL to the origin used in storage keys. */
export function apiStorageOrigin(apiBaseUrl: string): string {
    try {
        return new URL(apiBaseUrl).origin
    } catch {
        return apiBaseUrl.replace(/\/+$/, '')
    }
}

/** A per-account key (e.g. the last-used workspace): `<base>::<origin>::<userHash>`. */
export function accountStorageKey(base: string, scope: AccountStorageScope): string {
    return [base, part(scope.apiOrigin), part(scope.userHash)].join(SEPARATOR)
}

/** A per-workspace content key: `<base>::<origin>::<userHash>::<workspaceId>`. */
export function workspaceStorageKey(base: string, scope: WorkspaceStorageScope): string {
    return [base, part(scope.apiOrigin), part(scope.userHash), part(scope.workspaceId)].join(SEPARATOR)
}

/** The last workspace this account selected in this browser (flag `true` only). */
export const LAST_WORKSPACE_STORAGE_BASE = 'magic-worlds:last-workspace'

/** Base of the app-assistant focus shelf (formerly `magic-worlds-assistant-focus:<accountKey>`). */
export const ASSISTANT_FOCUS_STORAGE_BASE = 'magic-worlds-assistant-focus'

const MIGRATION_MARKER_BASE = 'magic-worlds:workspace-storage-migrated'
const MIGRATION_VERSION = '1'

/**
 * One pre-R1 content entry family. `legacyKeys` lists the old keys that belong
 * to `userHash`, best candidate first; the first that `accept`s is moved.
 */
interface PreR1StorageEntry {
    base: string
    legacyKeys: (storage: Storage, userHash: string, currentAccountKey: string | null) => string[]
    accept: (raw: string) => boolean
}

function keysWithPrefix(storage: Storage, prefix: string): string[] {
    const keys: string[] = []
    for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index)
        if (key !== null && key.startsWith(prefix)) keys.push(key)
    }
    return keys
}

function isJsonArray(raw: string): boolean {
    try {
        return Array.isArray(JSON.parse(raw))
    } catch {
        return false
    }
}

/**
 * Pre-R1 content entries. The assistant focus shelf was keyed by the transient
 * `user:<userHash>:<sequence>` accountKey, so a user may own several; the one
 * the current tab reads wins, then the reload-time sequence 0, then the rest.
 */
export const PRE_R1_STORAGE_ENTRIES: readonly PreR1StorageEntry[] = [
    {
        base: ASSISTANT_FOCUS_STORAGE_BASE,
        legacyKeys: (storage, userHash, currentAccountKey) => {
            const prefix = `${ASSISTANT_FOCUS_STORAGE_BASE}:user:${userHash}:`
            const sequence = (key: string) => {
                const value = Number(key.slice(prefix.length))
                return Number.isInteger(value) && value >= 0 ? value : Number.POSITIVE_INFINITY
            }
            const current = currentAccountKey ? `${ASSISTANT_FOCUS_STORAGE_BASE}:${currentAccountKey}` : null
            return keysWithPrefix(storage, prefix)
                .filter((key) => Number.isFinite(sequence(key)))
                .sort((a, b) => (a === current ? -1 : b === current ? 1 : sequence(a) - sequence(b)))
        },
        accept: isJsonArray,
    },
]

export interface PreR1StorageMigration extends AccountStorageScope {
    /** The protected default workspace; legacy content is never assigned elsewhere. */
    defaultWorkspaceId: string
    /** The current transient accountKey, used only to pick the best legacy shelf. */
    currentAccountKey?: string | null
}

function defaultStorage(): Storage | null {
    try {
        return typeof window === 'undefined' ? null : window.localStorage
    } catch {
        return null
    }
}

/**
 * Moves this user's pre-R1 content entries into the protected default
 * workspace's keys exactly once per API origin + user, then deletes the old
 * keys. Never overwrites an entry the default workspace already has. Returns
 * whether it ran (false when already done or storage is unavailable).
 */
export function migratePreR1WorkspaceStorage(
    migration: PreR1StorageMigration,
    storage: Storage | null = defaultStorage(),
    entries: readonly PreR1StorageEntry[] = PRE_R1_STORAGE_ENTRIES,
): boolean {
    if (!storage) return false
    try {
        const marker = accountStorageKey(MIGRATION_MARKER_BASE, migration)
        if (storage.getItem(marker) === MIGRATION_VERSION) return false
        for (const entry of entries) {
            const legacy = entry.legacyKeys(storage, migration.userHash, migration.currentAccountKey ?? null)
            const destination = workspaceStorageKey(entry.base, {
                apiOrigin: migration.apiOrigin,
                userHash: migration.userHash,
                workspaceId: migration.defaultWorkspaceId,
            })
            if (storage.getItem(destination) === null) {
                for (const key of legacy) {
                    const raw = storage.getItem(key)
                    if (raw !== null && entry.accept(raw)) {
                        storage.setItem(destination, raw)
                        break
                    }
                }
            }
            for (const key of legacy) storage.removeItem(key)
        }
        storage.setItem(marker, MIGRATION_VERSION)
        return true
    } catch {
        // Blocked/full storage: the hints simply start fresh; content is server-side.
        return false
    }
}
