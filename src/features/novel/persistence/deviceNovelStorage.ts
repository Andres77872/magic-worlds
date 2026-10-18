import { accountStorageKey, type AccountStorageScope } from '@/shared/workspaceStorage'
import { canonicalJson } from '@/utils/json'
import { DEVICE_READ_METADATA, notifyDeviceReads, openDeviceReadDatabase } from './deviceReadDatabase'
import { mergeNovelLifecycle, validNovelLifecycle, type NovelDeviceLifecycle } from './novelDeviceLifecycle'
import { emptyNovelLifecycle, novelLifecycleObservation } from './novelDeviceLifecycle'
import type { StoryOutline } from '@/shared'

export interface DeviceNovelScope extends AccountStorageScope { workspaceId: string; storyId: string }
interface NovelLifecycleRecord { schema: 1; kind: 'novel_lifecycle'; key: string; scope: DeviceNovelScope; state: NovelDeviceLifecycle; savedAt: number }
export interface DeviceNovelState { state: NovelDeviceLifecycle | null; unavailable: boolean; unreadable: boolean }
export type NovelRetentionStatus = 'saved' | 'retired' | 'invalid' | 'limit' | 'unavailable'
export const DEVICE_NOVEL_STATE_BYTES = 2 * 1024 * 1024, DEVICE_NOVEL_ACCOUNT_BYTES = 16 * 1024 * 1024
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const count = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength
const prefix = (scope: AccountStorageScope) => accountStorageKey('magic-worlds:novel-lifecycle-state:v1', scope) + '::'
export const deviceNovelStateKey = (scope: DeviceNovelScope) => prefix(scope) + [scope.workspaceId, scope.storyId].map(encodeURIComponent).join('::')
const usageKey = (scope: AccountStorageScope) => accountStorageKey('magic-worlds:novel-lifecycle-usage:v1', scope)
const capture = (scope: DeviceNovelScope): DeviceNovelScope => ({ apiOrigin: scope.apiOrigin, userHash: scope.userHash, workspaceId: scope.workspaceId, storyId: scope.storyId })
export function rememberDeviceNovelSource(scope: DeviceNovelScope, source: StoryOutline, current: () => boolean = () => true) {
    const observation = source.id === scope.storyId ? novelLifecycleObservation(source, scope.workspaceId) : null
    return observation ? rememberDeviceNovel(scope, observation, current) : Promise.resolve({ status: 'invalid' as const })
}
export function rememberDeviceNovelRoot(scope: DeviceNovelScope, revision: number, readOnly: boolean, current: () => boolean = () => true) {
    return rememberDeviceNovel(scope, { ...emptyNovelLifecycle(), root: { revision, readOnly } }, current)
}
export function rememberDeviceNovelErased(scope: DeviceNovelScope, current: () => boolean = () => true) {
    return rememberDeviceNovel(scope, { ...emptyNovelLifecycle(), erased: true }, current)
}
function validRecord(value: unknown, scope: DeviceNovelScope): value is NovelLifecycleRecord {
    try { return record(value) && Object.keys(value).length === 6 && value.schema === 1 && value.kind === 'novel_lifecycle' && value.key === deviceNovelStateKey(scope)
        && record(value.scope) && Object.keys(value.scope).length === 4 && canonicalJson(value.scope) === canonicalJson(scope)
        && count(value.savedAt) && validNovelLifecycle(value.state) && bytes(value) <= DEVICE_NOVEL_STATE_BYTES } catch { return false }
}
/** Separate allowance and namespace; no new native schema, manuscript rewrite or cleanup. */
export async function rememberDeviceNovel(scope: DeviceNovelScope, observation: NovelDeviceLifecycle, current: () => boolean = () => true): Promise<{ status: NovelRetentionStatus }> {
    scope = capture(scope)
    if (!current()) return { status: 'retired' }
    if (!scope.workspaceId || !scope.storyId || !validNovelLifecycle(observation)) return { status: 'invalid' }
    const incoming = structuredClone(observation)
    let database: IDBDatabase | null = null
    try {
        database = await openDeviceReadDatabase()
        return await new Promise((resolve) => {
            const transaction = database!.transaction(DEVICE_READ_METADATA, 'readwrite'), store = transaction.objectStore(DEVICE_READ_METADATA)
            const key = deviceNovelStateKey(scope), previous = store.get(key), counter = store.get(usageKey(scope))
            let pending = 2, result: NovelRetentionStatus = 'saved', changed = false
            const refuse = (status: NovelRetentionStatus) => { result = status; transaction.abort() }
            const ready = () => {
                if (--pending) return
                try {
                    if (!current()) { refuse('retired'); return }
                    const old: unknown = previous.result, usage: unknown = counter.result
                    if (old !== undefined && !validRecord(old, scope)) { refuse('invalid'); return }
                    if (usage !== undefined && (!record(usage) || usage.schema !== 1 || !count(usage.bytes))) { refuse('invalid'); return }
                    if (old !== undefined && (!record(usage) || Number(usage.bytes) < bytes(old))) { refuse('invalid'); return }
                    const state = mergeNovelLifecycle((old as NovelLifecycleRecord | undefined)?.state ?? null, incoming)
                    if (old !== undefined && canonicalJson(state) === canonicalJson((old as NovelLifecycleRecord).state)) return
                    const candidate: NovelLifecycleRecord = { schema: 1, kind: 'novel_lifecycle', key, scope, state, savedAt: Date.now() }
                    const write = (used: number) => {
                        if (!current()) { refuse('retired'); return }
                        const size = bytes(candidate), total = used - (old === undefined ? 0 : bytes(old)) + size
                        if (size > DEVICE_NOVEL_STATE_BYTES || total > DEVICE_NOVEL_ACCOUNT_BYTES) { refuse('limit'); return }
                        store.put(candidate); store.put({ schema: 1, key: usageKey(scope), bytes: total }); changed = true
                    }
                    if (usage === undefined) {
                        const request = store.count(IDBKeyRange.bound(prefix(scope), prefix(scope) + '\uffff'))
                        request.onsuccess = () => { if (request.result) refuse('invalid'); else write(0) }
                    } else write(Number((usage as Record<string, unknown>).bytes))
                } catch { refuse('invalid') }
            }
            previous.onsuccess = counter.onsuccess = ready
            transaction.oncomplete = () => { if (changed) notifyDeviceReads(); resolve({ status: result }) }
            transaction.onerror = transaction.onabort = () => resolve({ status: result === 'saved' ? 'unavailable' : result })
        })
    } catch { return { status: 'unavailable' } }
    finally { database?.close() }
}
export async function readDeviceNovel(scope: DeviceNovelScope): Promise<DeviceNovelState> {
    scope = capture(scope)
    let database: IDBDatabase | null = null
    try {
        database = await openDeviceReadDatabase()
        return await new Promise((resolve, reject) => {
            const transaction = database!.transaction(DEVICE_READ_METADATA, 'readonly'), request = transaction.objectStore(DEVICE_READ_METADATA).get(deviceNovelStateKey(scope))
            transaction.oncomplete = () => resolve(request.result === undefined ? { state: null, unavailable: false, unreadable: false }
                : validRecord(request.result, scope) ? { state: request.result.state, unavailable: false, unreadable: false } : { state: null, unavailable: false, unreadable: true })
            transaction.onerror = transaction.onabort = () => reject(transaction.error)
        })
    } catch { return { state: null, unavailable: true, unreadable: false } }
    finally { database?.close() }
}
