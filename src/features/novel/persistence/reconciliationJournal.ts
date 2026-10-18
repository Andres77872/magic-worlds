import type { StoryManuscriptDocument } from '@/shared'
import { isStoryDocument } from '@/shared/storyDocument'
import { accountStorageKey, workspaceStorageKey, type AccountStorageScope, type WorkspaceStorageScope } from '@/shared/workspaceStorage'
import { canonicalJson } from '@/utils/json'
import type { ReconciliationSide } from './sceneReconciliation'
import {isGenerationApplicationRejection,type GenerationApplicationRejection} from './generationApplication'

export interface ReconciliationSource {
    applicationRejection?:GenerationApplicationRejection
    storyId: string
    sceneId: string
    chapterId: string
    base: StoryManuscriptDocument | null
    device: StoryManuscriptDocument
    deviceTitle: string
    account: StoryManuscriptDocument
    accountTitle: string
    accountRevision: number
    accountMetadataRevision: number
    accountContentHash: string
    accountReadOnly: boolean
}
export interface ReconciliationChoices { choices: Record<string, ReconciliationSide>; order: ReconciliationSide | ''; title: ReconciliationSide | '' }
export interface ReconciliationCheckpoint {
    schema: 1
    key: string
    sceneScope: string
    source: ReconciliationSource
    value: ReconciliationChoices
    sequence: number
    writtenAt: number
    isDefaultWorkspace?: boolean
}
export interface ReconciliationLoad { checkpoint: ReconciliationCheckpoint | null; unavailable: boolean; unreadable: number }
export type ReconciliationSave = 'saved' | 'unavailable' | 'limit' | 'invalid' | 'superseded'
export const RECONCILIATION_RECORD_BYTES = 16 * 1024 * 1024
export const RECONCILIATION_ACCOUNT_BYTES = 64 * 1024 * 1024
const DATABASE = 'magic-worlds-novel-review-forms-v1', STORE = 'reviews', USAGE = 'usage'
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0
const revision = (value: unknown) => count(value) && value > 0
const side = (value: unknown) => value === '' || value === 'device' || value === 'account'
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength
export const reconciliationPrefix = (scope: AccountStorageScope) => accountStorageKey('magic-worlds:novel-review:v1', scope) + '::'
export const reconciliationSceneScope = (scope: WorkspaceStorageScope, storyId: string, sceneId: string) => workspaceStorageKey('magic-worlds:novel-review:v1', scope) + '::' + [storyId, sceneId].map(encodeURIComponent).join('::')
export const reconciliationKey = (scope: WorkspaceStorageScope, writerId: string) => reconciliationPrefix(scope) + encodeURIComponent(writerId)
export function validReconciliationSource(value: unknown): value is ReconciliationSource {
    return record(value) && Object.keys(value).length === ('applicationRejection'in value?13:12)
        &&(!('applicationRejection'in value)||isGenerationApplicationRejection(value.applicationRejection))
        && ['storyId', 'sceneId', 'chapterId'].every((key) => typeof value[key] === 'string' && String(value[key]).length > 0 && String(value[key]).length <= 64)
        && (value.base === null || isStoryDocument(value.base)) && isStoryDocument(value.device) && isStoryDocument(value.account)
        && typeof value.deviceTitle === 'string' && typeof value.accountTitle === 'string' && revision(value.accountRevision) && revision(value.accountMetadataRevision)
        && typeof value.accountContentHash === 'string' && /^[a-f0-9]{64}$/.test(value.accountContentHash) && typeof value.accountReadOnly === 'boolean'
}
export function validReconciliationChoices(value: unknown): value is ReconciliationChoices {
    return record(value) && Object.keys(value).length === 3 && record(value.choices) && Object.values(value.choices).every((item) => item === 'device' || item === 'account')
        && side(value.order) && side(value.title)
}
export function validReconciliationCheckpoint(value: unknown, sceneScope: string, prefix: string): value is ReconciliationCheckpoint {
    try {
        return record(value) && Object.keys(value).every((key) => ['schema', 'key', 'sceneScope', 'source', 'value', 'sequence', 'writtenAt', 'isDefaultWorkspace'].includes(key))
            && (value.isDefaultWorkspace === undefined || typeof value.isDefaultWorkspace === 'boolean') && value.schema === 1 && typeof value.key === 'string' && value.key.startsWith(prefix)
            && value.sceneScope === sceneScope && validReconciliationSource(value.source) && validReconciliationChoices(value.value)
            && count(value.sequence) && count(value.writtenAt) && bytes(value) <= RECONCILIATION_RECORD_BYTES
    } catch { return false }
}
function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') { reject(new Error('Review storage unavailable')); return }
        let settled = false
        const request = indexedDB.open(DATABASE, 1)
        request.onupgradeneeded = () => {
            const store = request.result.createObjectStore(STORE, { keyPath: 'key' })
            store.createIndex('sceneScope', 'sceneScope', { unique: false })
            request.result.createObjectStore(USAGE, { keyPath: 'key' })
        }
        request.onblocked = () => { settled = true; reject(new Error('Review storage busy')) }
        request.onerror = () => { settled = true; reject(request.error) }
        request.onsuccess = () => {
            const db = request.result
            if (settled) { db.close(); return }
            db.onversionchange = () => db.close(); resolve(db)
        }
    })
}
export interface ReconciliationJournal {
    load: (scope: WorkspaceStorageScope, source: ReconciliationSource) => Promise<ReconciliationLoad>
    save: (scope: WorkspaceStorageScope, value: ReconciliationCheckpoint) => Promise<ReconciliationSave>
}
async function loadReview(scope: WorkspaceStorageScope, storyId: string, sceneId: string, source?: ReconciliationSource): Promise<ReconciliationLoad> {
    let db: IDBDatabase | null = null
    try {
        if (source && !validReconciliationSource(source)) return { checkpoint: null, unavailable: true, unreadable: 0 }
        db = await openDatabase()
        return await new Promise<ReconciliationLoad>((resolve, reject) => {
            const transaction = db!.transaction(STORE, 'readonly'), sceneScope = reconciliationSceneScope(scope, storyId, sceneId)
            const request = transaction.objectStore(STORE).index('sceneScope').openCursor(IDBKeyRange.only(sceneScope))
            const result: ReconciliationLoad = { checkpoint: null, unavailable: false, unreadable: 0 }, signature = source ? canonicalJson(source) : null
            request.onsuccess = () => {
                const cursor = request.result
                if (!cursor) return
                const value: unknown = cursor.value
                if (!validReconciliationCheckpoint(value, sceneScope, reconciliationPrefix(scope))) result.unreadable += 1
                else if ((signature === null || canonicalJson(value.source) === signature) && (!result.checkpoint || value.writtenAt > result.checkpoint.writtenAt
                    || value.writtenAt === result.checkpoint.writtenAt && value.key > result.checkpoint.key)) result.checkpoint = value
                cursor.continue()
            }
            transaction.oncomplete = () => resolve(result)
            transaction.onerror = transaction.onabort = () => reject(transaction.error)
        })
    } catch { return { checkpoint: null, unavailable: true, unreadable: 0 } }
    finally { db?.close() }
}
/** Inspection only: the result is a saved account snapshot, never current authorization. */
export const loadSavedReconciliation = (scope: WorkspaceStorageScope, storyId: string, sceneId: string) => loadReview(scope, storyId, sceneId)
export interface SavedReconciliation { scope: WorkspaceStorageScope; checkpoint: ReconciliationCheckpoint }
/** The device library can recover a review without an optional confirmed-read cache. */
export async function listSavedReconciliations(owner: AccountStorageScope): Promise<{ items: SavedReconciliation[]; unavailable: boolean; unreadable: number }> {
    let db: IDBDatabase | null = null
    try {
        db = await openDatabase()
        return await new Promise((resolve, reject) => {
            const transaction = db!.transaction(STORE, 'readonly'), prefix = reconciliationPrefix(owner)
            const request = transaction.objectStore(STORE).openCursor(IDBKeyRange.bound(prefix, prefix + '\uffff'))
            const items = new Map<string, SavedReconciliation>(); let unreadable = 0
            request.onsuccess = () => {
                const cursor = request.result
                if (!cursor) return
                const value: unknown = cursor.value
                let valid = false
                if (record(value) && typeof value.sceneScope === 'string') {
                    const parts = value.sceneScope.split('::')
                    try {
                        if (parts.length === 6) {
                            const scope = { ...owner, workspaceId: decodeURIComponent(parts[3]) }
                            if (validReconciliationCheckpoint(value, value.sceneScope, prefix)
                                && reconciliationSceneScope(scope, value.source.storyId, value.source.sceneId) === value.sceneScope) {
                                const previous = items.get(value.sceneScope)
                                if (!previous || value.writtenAt > previous.checkpoint.writtenAt || value.writtenAt === previous.checkpoint.writtenAt && value.key > previous.checkpoint.key)
                                    items.set(value.sceneScope, { scope, checkpoint: value })
                                valid = true
                            }
                        }
                    } catch { /* Keep an unreadable source for manual recovery. */ }
                }
                if (!valid) unreadable += 1
                cursor.continue()
            }
            transaction.oncomplete = () => resolve({ items: [...items.values()].sort((a, b) => b.checkpoint.writtenAt - a.checkpoint.writtenAt || a.checkpoint.key.localeCompare(b.checkpoint.key)), unavailable: false, unreadable })
            transaction.onerror = transaction.onabort = () => reject(transaction.error)
        })
    } catch { return { items: [], unavailable: true, unreadable: 0 } }
    finally { db?.close() }
}
/** Local review progress only; exact source equality is required before reuse. No delete/eviction path. */
export const reconciliationJournal: ReconciliationJournal = {
    async load(scope, source) {
        return loadReview(scope, source.storyId, source.sceneId, source)
    },
    async save(scope, value) {
        const sceneScope = reconciliationSceneScope(scope, value.source.storyId, value.source.sceneId), prefix = reconciliationPrefix(scope)
        if (!validReconciliationCheckpoint(value, sceneScope, prefix)) return bytes(value) > RECONCILIATION_RECORD_BYTES ? 'limit' : 'invalid'
        let db: IDBDatabase | null = null
        try {
            // Capture the author's exact progress before the asynchronous open.
            // Independent live reviews have independent keys; a late writer
            // never overwrites another tab or reopened editor's progress.
            const candidate = structuredClone(value), candidateBytes = bytes(candidate)
            db = await openDatabase()
            return await new Promise<ReconciliationSave>((resolve) => {
                const transaction = db!.transaction([STORE, USAGE], 'readwrite'), store = transaction.objectStore(STORE), usage = transaction.objectStore(USAGE)
                const previous = store.get(candidate.key), counter = usage.get(prefix)
                let outstanding = 2, refused = false, result: ReconciliationSave = 'unavailable'
                const refuse = (why: ReconciliationSave) => { result = why; refused = true; transaction.abort() }
                const ready = () => {
                    if (--outstanding) return
                    try {
                        const old: unknown = previous.result, meta: unknown = counter.result
                        if (old !== undefined && (!validReconciliationCheckpoint(old, sceneScope, prefix) || canonicalJson(old.source) !== canonicalJson(candidate.source))) { refuse('invalid'); return }
                        if (old !== undefined && (old as ReconciliationCheckpoint).sequence > candidate.sequence) { refuse('superseded'); return }
                        if (old !== undefined && (old as ReconciliationCheckpoint).sequence === candidate.sequence && canonicalJson((old as ReconciliationCheckpoint).value) !== canonicalJson(candidate.value)) { refuse('invalid'); return }
                        if (meta !== undefined && (!record(meta) || meta.schema !== 1 || !count(meta.bytes))) { refuse('invalid'); return }
                        const write = (used: number) => {
                            const oldBytes = old === undefined ? 0 : bytes(old)
                            if (used < oldBytes) { refuse('invalid'); return }
                            const total = used - oldBytes + candidateBytes
                            if (total > RECONCILIATION_ACCOUNT_BYTES) { refuse('limit'); return }
                            store.put(candidate); usage.put({ key: prefix, schema: 1, bytes: total }); result = 'saved'
                        }
                        if (meta === undefined) {
                            const count = store.count(IDBKeyRange.bound(prefix, prefix + '\uffff'))
                            count.onsuccess = () => { if (count.result === 0) write(0); else refuse('invalid') }
                        } else write(Number((meta as Record<string, unknown>).bytes))
                    } catch { refuse('invalid') }
                }
                previous.onsuccess = counter.onsuccess = ready
                transaction.oncomplete = () => resolve(result)
                transaction.onerror = transaction.onabort = () => resolve(refused ? result : 'unavailable')
            })
        } catch { return 'unavailable' }
        finally { db?.close() }
    },
}
