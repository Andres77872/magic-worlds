import { accountStorageKey, type AccountStorageScope } from '@/shared/workspaceStorage'
import { preferWorkspaceState } from '@/shared/workspaceLifecycle'
import { canonicalJson } from '@/utils/json'
import { DEVICE_READ_METADATA, notifyDeviceReads, openDeviceReadDatabase } from './deviceReadDatabase'

export interface CachedWorkspace { id: string; name: string; isDefault: boolean; archived: boolean; rowVersion?: number }
interface WorkspaceRecord { schema: 1; kind: 'workspace_lifecycle'; key: string; scope: AccountStorageScope; workspace: CachedWorkspace & { rowVersion: number }; savedAt: number }
export interface DeviceWorkspaceStates { states: Record<string, CachedWorkspace>; unreadableIds: string[]; unreadable: number; unavailable: boolean }
export type WorkspaceRetentionStatus = 'saved' | 'unavailable' | 'invalid' | 'limit' | 'retired'
export const DEVICE_WORKSPACE_ACCOUNT_BYTES = 4 * 1024 * 1024, DEVICE_WORKSPACE_RECORD_BYTES = 8 * 1024
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const count = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength
export const deviceWorkspacePrefix = (scope: AccountStorageScope) => accountStorageKey('magic-worlds:novel-workspace-state:v1', scope) + '::'
export const deviceWorkspaceKey = (scope: AccountStorageScope, id: string) => deviceWorkspacePrefix(scope) + encodeURIComponent(id)
const usageKey = (scope: AccountStorageScope) => accountStorageKey('magic-worlds:novel-workspace-usage:v1', scope)
const range = (scope: AccountStorageScope) => IDBKeyRange.bound(deviceWorkspacePrefix(scope), deviceWorkspacePrefix(scope) + '\uffff')
export function validCachedWorkspace(value: unknown): value is CachedWorkspace {
    return record(value) && typeof value.id === 'string' && value.id.length > 0 && typeof value.name === 'string'
        && typeof value.isDefault === 'boolean' && typeof value.archived === 'boolean'
        && (value.rowVersion === undefined || count(value.rowVersion) && Number(value.rowVersion) > 0)
}
export function newestCachedWorkspace(previous: CachedWorkspace | undefined, incoming: CachedWorkspace): CachedWorkspace {
    return !previous || preferWorkspaceState(previous, incoming) ? incoming : previous
}
function validWorkspaceRecord(value: unknown, scope: AccountStorageScope, id: string): value is WorkspaceRecord {
    try {
        return record(value) && Object.keys(value).length === 6 && value.schema === 1 && value.kind === 'workspace_lifecycle' && value.key === deviceWorkspaceKey(scope, id)
            && record(value.scope) && Object.keys(value.scope).length === 2 && value.scope.apiOrigin === scope.apiOrigin && value.scope.userHash === scope.userHash
            && validCachedWorkspace(value.workspace) && Object.keys(value.workspace).length === 5 && value.workspace.id === id && value.workspace.rowVersion !== undefined
            && count(value.savedAt) && bytes(value) <= DEVICE_WORKSPACE_RECORD_BYTES
    } catch { return false }
}
interface RetainedWorkspace { status: 'saved'; workspace: CachedWorkspace; changed: boolean }
/** Queue all work synchronously inside the caller's active native transaction. */
export function queueDeviceWorkspace(transaction: IDBTransaction, scope: AccountStorageScope, incoming: CachedWorkspace, current: () => boolean,
    done: (result: RetainedWorkspace | { status: Exclude<WorkspaceRetentionStatus, 'saved' | 'unavailable'> }) => void) {
    const store = transaction.objectStore(DEVICE_READ_METADATA), key = deviceWorkspaceKey(scope, incoming.id)
    const previous = store.get(key), counter = store.get(usageKey(scope))
    let outstanding = 2
    const ready = () => {
        if (--outstanding) return
        try {
            if (!current()) { done({ status: 'retired' }); return }
            const old: unknown = previous.result, usage: unknown = counter.result
            if (old !== undefined && !validWorkspaceRecord(old, scope, incoming.id)) { done({ status: 'invalid' }); return }
            const chosen = newestCachedWorkspace((old as WorkspaceRecord | undefined)?.workspace, incoming)
            // Earlier app copies remain valid, but never supply an invented version.
            if (chosen.rowVersion === undefined) { done({ status: 'saved', workspace: chosen, changed: false }); return }
            if (usage !== undefined && (!record(usage) || usage.schema !== 1 || !count(usage.bytes))) { done({ status: 'invalid' }); return }
            if (old !== undefined && (!record(usage) || Number(usage.bytes) < bytes(old))) { done({ status: 'invalid' }); return }
            const retained = { id: chosen.id, name: chosen.name, isDefault: chosen.isDefault, archived: chosen.archived, rowVersion: chosen.rowVersion }
            if (old !== undefined && canonicalJson(retained) === canonicalJson((old as WorkspaceRecord).workspace)) { done({ status: 'saved', workspace: retained, changed: false }); return }
            const candidate: WorkspaceRecord = { schema: 1, kind: 'workspace_lifecycle', key,
                scope: { apiOrigin: scope.apiOrigin, userHash: scope.userHash }, workspace: retained, savedAt: Date.now() }
            const candidateBytes = bytes(candidate)
            const write = (used: number) => {
                if (!current()) { done({ status: 'retired' }); return }
                const total = used - (old === undefined ? 0 : bytes(old)) + candidateBytes
                if (candidateBytes > DEVICE_WORKSPACE_RECORD_BYTES || total > DEVICE_WORKSPACE_ACCOUNT_BYTES) { done({ status: 'limit' }); return }
                store.put(candidate); store.put({ schema: 1, key: usageKey(scope), bytes: total })
                done({ status: 'saved', workspace: candidate.workspace, changed: true })
            }
            if (usage === undefined) {
                const existing = store.count(range(scope))
                existing.onsuccess = () => { if (existing.result) done({ status: 'invalid' }); else write(0) }
            } else write(Number((usage as Record<string, unknown>).bytes))
        } catch { done({ status: 'invalid' }) }
    }
    previous.onsuccess = counter.onsuccess = ready
}
/** Real checked workspace lists can update restrictions without another scene read. */
export async function rememberDeviceWorkspaces(scope: AccountStorageScope, workspaces: readonly CachedWorkspace[], current: () => boolean = () => true): Promise<{ status: WorkspaceRetentionStatus }> {
    scope = { apiOrigin: scope.apiOrigin, userHash: scope.userHash }
    if (!current()) return { status: 'retired' }
    if (workspaces.length > 4096 || new Set(workspaces.map((item) => item.id)).size !== workspaces.length
        || !workspaces.every((item) => validCachedWorkspace(item) && item.rowVersion !== undefined)) return { status: 'invalid' }
    if (!workspaces.length) return { status: 'saved' }
    let database: IDBDatabase | null = null
    try {
        const captured = structuredClone(workspaces)
        database = await openDeviceReadDatabase()
        return await new Promise((resolve) => {
            const transaction = database!.transaction(DEVICE_READ_METADATA, 'readwrite')
            let index = 0, changed = false, result: WorkspaceRetentionStatus = 'saved'
            const next = () => {
                if (index === captured.length) return
                queueDeviceWorkspace(transaction, scope, captured[index++], current, (value) => {
                    if (value.status !== 'saved') { result = value.status; transaction.abort(); return }
                    changed ||= value.changed; next()
                })
            }
            next()
            transaction.oncomplete = () => { if (changed) notifyDeviceReads(); resolve({ status: result }) }
            transaction.onerror = transaction.onabort = () => resolve({ status: result === 'saved' ? 'unavailable' : result })
        })
    } catch { return { status: 'unavailable' } }
    finally { database?.close() }
}
/** Existing record bytes stay separate from the list's presentation metadata. */
export function queueDeviceWorkspaceStates(transaction: IDBTransaction, scope: AccountStorageScope): DeviceWorkspaceStates {
    const result: DeviceWorkspaceStates = { states: Object.create(null) as Record<string, CachedWorkspace>, unreadableIds: [], unreadable: 0, unavailable: false }
    const request = transaction.objectStore(DEVICE_READ_METADATA).openCursor(range(scope))
    request.onsuccess = () => {
        const cursor = request.result
        if (!cursor) return
        let id: string | null = null
        try { id = decodeURIComponent(String(cursor.key).slice(deviceWorkspacePrefix(scope).length)) } catch { /* Preserve an unreadable key. */ }
        if (id && validWorkspaceRecord(cursor.value, scope, id)) result.states[id] = cursor.value.workspace
        else { result.unreadable += 1; if (id) result.unreadableIds.push(id) }
        cursor.continue()
    }
    return result
}
export async function listDeviceWorkspaces(scope: AccountStorageScope): Promise<DeviceWorkspaceStates> {
    scope = { apiOrigin: scope.apiOrigin, userHash: scope.userHash }
    let database: IDBDatabase | null = null
    try {
        database = await openDeviceReadDatabase()
        return await new Promise((resolve, reject) => {
            const transaction = database!.transaction(DEVICE_READ_METADATA, 'readonly'), result = queueDeviceWorkspaceStates(transaction, scope)
            transaction.oncomplete = () => resolve(result)
            transaction.onerror = transaction.onabort = () => reject(transaction.error)
        })
    } catch { return { states: Object.create(null) as Record<string, CachedWorkspace>, unreadableIds: [], unreadable: 0, unavailable: true } }
    finally { database?.close() }
}
