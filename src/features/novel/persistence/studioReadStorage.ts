import { API_BASE_URL } from '@/infrastructure/api/baseUrl'
import { storyStudioSceneRequest, verifyStoryStudioScene, verifyStoryStudioSource } from '@/infrastructure/api/storyStudioContract'
import { verifyStoryStudioDocument } from '@/infrastructure/api/storyContract'
import { apiStorageOrigin, accountStorageKey, type AccountStorageScope } from '@/shared/workspaceStorage'
import type { StorySceneDocument, StorySceneHeader, StoryStudioDocument, StoryStudioScene, StoryStudioSource } from '@/shared/types/storyStudio.types'
import type { StoryGeneration } from '@/shared'
import { canonicalJson } from '@/utils/json'
import { DEVICE_READ_STORE as STORE, DEVICE_READ_METADATA as USAGE, openDeviceReadDatabase as openDatabase, notifyDeviceReads as notify, subscribeDeviceReads } from './deviceReadDatabase'
import { newestCachedWorkspace, validCachedWorkspace as validWorkspace, queueDeviceWorkspace, queueDeviceWorkspaceStates, type CachedWorkspace } from './deviceWorkspaceStorage'
export type { CachedWorkspace } from './deviceWorkspaceStorage'

/** A receipt confirms prose, but does not invent a server-checked context packet. */
export interface AcknowledgedSceneCopy { projection: 'acknowledged_scene'; scene: StoryStudioDocument }
export type ConfirmedSceneCopy = StoryStudioScene | AcknowledgedSceneCopy
export interface CachedSceneRead { source: StoryStudioSource; read: ConfirmedSceneCopy; savedAt: number }
export interface CachedNovelRead {
    schema: 1
    key: string
    scope: AccountStorageScope
    workspace: CachedWorkspace
    index: StoryStudioSource
    scenes: Record<string, CachedSceneRead>
    savedAt: number
}
export type DeviceCacheStatus = 'saved' | 'unavailable' | 'limit' | 'invalid' | 'retired'
export interface DeviceCacheResult { status: DeviceCacheStatus; bytes?: number }
export interface DeviceCacheList { items: CachedNovelRead[]; unavailable: boolean; unreadable: number; bytes: number; workspaceStates?: Record<string, CachedWorkspace>; workspaceUnreadableIds?: string[]; workspaceUnreadable?: number }
export interface StudioReadStorage {
    list: (scope: AccountStorageScope) => Promise<DeviceCacheList>
    remember: (scope: AccountStorageScope, workspace: CachedWorkspace, source: StoryStudioSource, read?: ConfirmedSceneCopy, current?: () => boolean) => Promise<DeviceCacheResult>
    subscribe: (listener: () => void) => () => void
}
export const DEVICE_CACHE_ACCOUNT_BYTES = 64 * 1024 * 1024
export const DEVICE_CACHE_NOVEL_BYTES = 16 * 1024 * 1024
export const deviceCacheScope = (userHash: string): AccountStorageScope => ({ apiOrigin: apiStorageOrigin(API_BASE_URL), userHash })
export const deviceCachePrefix = (scope: AccountStorageScope) => accountStorageKey('magic-worlds:novel-reads:v1', scope) + '::'
export const deviceCacheKey = (scope: AccountStorageScope, workspaceId: string, storyId: string) => deviceCachePrefix(scope) + [workspaceId, storyId].map(encodeURIComponent).join('::')
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
/** UTF-8 length of the record's JSON, without allocating its bytes (JSON never holds lone surrogates). */
export function storedBytes(value: unknown) {
    const text = JSON.stringify(value) ?? ''
    let bytes = 0
    for (let i = 0; i < text.length; i += 1) {
        const code = text.charCodeAt(i)
        if (code < 0x80) bytes += 1
        else if (code < 0x800) bytes += 2
        else if (code >= 0xd800 && code <= 0xdbff) { bytes += 4; i += 1 }
        else bytes += 3
    }
    return bytes
}

/**
 * Stored form (schema 2). Every scene copy keeps the outline it was read under, and in a long novel those outlines
 * are mostly the same 1 MB index. Each distinct outline is stored once and scene copies name it by key; the
 * in-memory `CachedNovelRead` is unchanged. Schema 1 records stay readable and are rewritten on their next save.
 */
interface StoredSceneRead { sourceKey: string; read: ConfirmedSceneCopy; savedAt: number }
interface StoredNovelRead {
    schema: 2
    key: string
    scope: AccountStorageScope
    workspace: CachedWorkspace
    indexKey: string
    sources: Record<string, StoryStudioSource>
    scenes: Record<string, StoredSceneRead>
    savedAt: number
}
// Cached copies are never mutated after they are read or merged, so an outline's key can follow the object.
const sourceKeys = new WeakMap<object, string>()
function textHash(text: string) {
    let a = 0xdeadbeef, b = 0x41c6ce57
    for (let i = 0; i < text.length; i += 1) {
        const code = text.charCodeAt(i)
        a = Math.imul(a ^ code, 2654435761); b = Math.imul(b ^ code, 1597334677)
    }
    a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909)
    b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909)
    return (4294967296 * (2097151 & b) + (a >>> 0)).toString(36)
}
/** Equal outlines share a key: the server's revision digest plus a hash and the length of the exact JSON. */
function sourceKey(source: StoryStudioSource) {
    let key = sourceKeys.get(source)
    if (!key) {
        const text = JSON.stringify(source)
        key = [source.sourceVersion ?? 'state', textHash(text), text.length].join(':')
        sourceKeys.set(source, key)
    }
    return key
}
export function packCachedNovel(value: CachedNovelRead): StoredNovelRead {
    const sources = new Map<string, StoryStudioSource>()
    const keep = (source: StoryStudioSource) => {
        const key = sourceKey(source)
        if (!sources.has(key)) sources.set(key, source)
        return key
    }
    const indexKey = keep(value.index)
    const scenes = Object.fromEntries(Object.entries(value.scenes).map(([id, entry]) => [id, { sourceKey: keep(entry.source), read: entry.read, savedAt: entry.savedAt }]))
    return { schema: 2, key: value.key, scope: value.scope, workspace: value.workspace, indexKey, sources: Object.fromEntries(sources), scenes, savedAt: value.savedAt }
}
/** The in-memory form of a stored record; schema 1 passes through unchanged and anything malformed becomes null. */
export function unpackCachedNovel(value: unknown): unknown {
    if (!record(value) || value.schema !== 2) return value
    const { sources, scenes } = value
    if (Object.keys(value).length !== 8 || !record(sources) || !record(scenes) || typeof value.indexKey !== 'string') return null
    const source = (key: unknown) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(sources, key) && record(sources[key]) ? sources[key] as unknown as StoryStudioSource : null
    const index = source(value.indexKey)
    if (!index) return null
    const used = new Set<string>([value.indexKey])
    const entries: [string, CachedSceneRead][] = []
    for (const [id, entry] of Object.entries(scenes)) {
        if (!record(entry) || Object.keys(entry).length !== 3 || !source(entry.sourceKey)) return null
        used.add(entry.sourceKey as string)
        entries.push([id, { source: source(entry.sourceKey)!, read: entry.read as ConfirmedSceneCopy, savedAt: entry.savedAt as number }])
    }
    // An outline no copy uses is not part of any record this code writes.
    if (Object.keys(sources).some((key) => !used.has(key))) return null
    for (const key of used) sourceKeys.set(source(key)!, key)
    return { schema: 1, key: value.key, scope: value.scope, workspace: value.workspace, index, scenes: Object.fromEntries(entries), savedAt: value.savedAt }
}
const scopeEqual = (a: AccountStorageScope, b: AccountStorageScope) => a.apiOrigin === b.apiOrigin && a.userHash === b.userHash
function ownedSource(value: unknown, workspaceId: string): value is StoryStudioSource {
    return verifyStoryStudioSource(value) && value.organization?.workspace_id === workspaceId
}
export function acknowledgedSceneCopy(value: StorySceneDocument): AcknowledgedSceneCopy | null {
    const { generationHistory, ...scene } = value as StorySceneDocument & { generationHistory?: StoryGeneration[] }
    const document = { ...scene, projection: 'scene_document', latestGenerationTrace: value.latestGenerationTrace ?? generationHistory?.[0]?.contextTrace ?? null }
    return verifyStoryStudioDocument(document, value.storyId, value.id) ? { projection: 'acknowledged_scene', scene: document } : null
}
function validSceneCopy(value: unknown, source: StoryStudioSource, head: StorySceneHeader): value is ConfirmedSceneCopy {
    if (verifyStoryStudioScene(value, source, head)) return true
    return record(value) && Object.keys(value).length === 2 && value.projection === 'acknowledged_scene'
        && verifyStoryStudioDocument(value.scene, source.id, head.id) && value.scene.chapterId === head.chapterId
        && value.scene.revision === head.revision && value.scene.metadataRevision === head.metadataRevision && value.scene.contentHash === head.contentHash
}
/** Offline selection may use a receipt's prose only under the same known source vector. */
export function matchingCachedScene(entry: CachedSceneRead, source: StoryStudioSource, head: StorySceneHeader): StoryStudioDocument | null {
    const previousHead = entry.source.chapters.flatMap((chapter) => chapter.scenes).find((scene) => scene.id === head.id)
    if (!previousHead || !validSceneCopy(entry.read, source, head)) return null
    const previous = storyStudioSceneRequest(entry.source, previousHead), current = storyStudioSceneRequest(source, head)
    return previous && current && canonicalJson(previous) === canonicalJson(current) ? entry.read.scene : null
}
export function validCachedNovel(value: unknown, scope: AccountStorageScope): value is CachedNovelRead {
    try { return checkCachedNovel(value, scope) } catch { return false }
}
function checkCachedNovel(value: unknown, scope: AccountStorageScope): value is CachedNovelRead {
    if (!record(value) || value.schema !== 1 || !record(value.scope) || !scopeEqual(value.scope as unknown as AccountStorageScope, scope)
        || !validWorkspace(value.workspace) || !record(value.scenes)) return false
    const workspaceId = value.workspace.id
    // Copies read under one outline share it; each distinct outline object is verified once.
    const verified = new Set<unknown>()
    const owned = (source: unknown): source is StoryStudioSource => {
        if (verified.has(source)) return true
        if (!ownedSource(source, workspaceId)) return false
        verified.add(source); return true
    }
    if (!owned(value.index) || value.key !== deviceCacheKey(scope, workspaceId, value.index.id)
        || !Number.isSafeInteger(value.savedAt) || Number(value.savedAt) < 0) return false
    for (const [id, entry] of Object.entries(value.scenes)) {
        if (!record(entry) || !owned(entry.source) || entry.source.id !== value.index.id
            || !Number.isSafeInteger(entry.savedAt) || Number(entry.savedAt) < 0) return false
        const head = entry.source.chapters.flatMap((chapter) => chapter.scenes).find((scene) => scene.id === id)
        if (!head || !validSceneCopy(entry.read, entry.source, head)) return false
    }
    return storedBytes(packCachedNovel(value as unknown as CachedNovelRead)) <= DEVICE_CACHE_NOVEL_BYTES
}
function rootAtLeast(next: StoryStudioSource, old: StoryStudioSource) {
    return next.metadataRevision >= old.metadataRevision && next.structureRevision >= old.structureRevision && next.contextRevision >= old.contextRevision
}
/** A late read cannot replace a newer confirmed head; independent old scene copies remain readable. */
export function mergeCachedRead(scope: AccountStorageScope, workspace: CachedWorkspace, source: StoryStudioSource, read: ConfirmedSceneCopy | undefined,
    previous: CachedNovelRead | null, now = Date.now()): CachedNovelRead | null {
    return mergeRead(scope, workspace, source, read, previous, now, false)
}
function mergeRead(scope: AccountStorageScope, workspace: CachedWorkspace, source: StoryStudioSource, read: ConfirmedSceneCopy | undefined,
    previous: CachedNovelRead | null, now: number, previousChecked: boolean): CachedNovelRead | null {
    if (!validWorkspace(workspace) || !ownedSource(source, workspace.id) || !Number.isSafeInteger(now) || now < 0) return null
    const head = read && source.chapters.flatMap((chapter) => chapter.scenes).find((scene) => scene.id === read.scene.id)
    if (read && (!head || !validSceneCopy(read, source, head as StorySceneHeader))) return null
    if (previous && (!previousChecked && !validCachedNovel(previous, scope) || previous.key !== deviceCacheKey(scope, workspace.id, source.id))) return null
    const scenes = { ...previous?.scenes }
    if (read) {
        const old = scenes[read.scene.id]
        if (!old || rootAtLeast(source, old.source) && read.scene.revision >= old.read.scene.revision && read.scene.metadataRevision >= old.read.scene.metadataRevision)
            scenes[read.scene.id] = { source, read, savedAt: now }
    }
    let index = source
    if (previous) {
        const nextHeads = new Map(source.chapters.flatMap((chapter) => chapter.scenes).map((scene) => [scene.id, scene]))
        const regressed = previous.index.chapters.flatMap((chapter) => chapter.scenes).some((old) => {
            const next = nextHeads.get(old.id)
            return next && (next.revision < old.revision || next.metadataRevision < old.metadataRevision)
        })
        if (!rootAtLeast(source, previous.index) || regressed) index = previous.index
    }
    const merged: CachedNovelRead = { schema: 1, key: deviceCacheKey(scope, workspace.id, source.id), scope, workspace: newestCachedWorkspace(previous?.workspace, workspace), index, scenes, savedAt: now }
    const copy = structuredClone(merged)
    // The clone keeps shared outlines shared; their known keys follow them.
    const follow = (from: StoryStudioSource, to: StoryStudioSource) => { const key = sourceKeys.get(from); if (key) sourceKeys.set(to, key) }
    follow(merged.index, copy.index)
    for (const [id, entry] of Object.entries(merged.scenes)) follow(entry.source, copy.scenes[id].source)
    return copy
}

const range = (scope: AccountStorageScope) => IDBKeyRange.bound(deviceCachePrefix(scope), deviceCachePrefix(scope) + '\uffff')

/** Confirmed read copies only. No draft, request, eviction, deletion or API operation belongs here. */
export const studioReadStorage: StudioReadStorage = {
    subscribe: subscribeDeviceReads,
    async list(scope) {
        scope = { apiOrigin: scope.apiOrigin, userHash: scope.userHash }
        let db: IDBDatabase | null = null
        try {
            db = await openDatabase()
            return await new Promise<DeviceCacheList>((resolve, reject) => {
                const transaction = db!.transaction([STORE, USAGE], 'readonly'), request = transaction.objectStore(STORE).openCursor(range(scope))
                const workspaces = queueDeviceWorkspaceStates(transaction, scope)
                const result: DeviceCacheList = { items: [], unavailable: false, unreadable: 0, bytes: 0 }
                request.onsuccess = () => {
                    const cursor = request.result
                    if (!cursor) return
                    const stored: unknown = cursor.value, value = unpackCachedNovel(stored)
                    if (validCachedNovel(value, scope)) { result.items.push(value); result.bytes += storedBytes(stored) }
                    else result.unreadable += 1
                    cursor.continue()
                }
                transaction.oncomplete = () => { result.items.sort((a, b) => b.savedAt - a.savedAt || a.key.localeCompare(b.key)); resolve({ ...result, workspaceStates: workspaces.states, workspaceUnreadableIds: workspaces.unreadableIds, workspaceUnreadable: workspaces.unreadable }) }
                transaction.onerror = transaction.onabort = () => reject(transaction.error)
            })
        } catch { return { items: [], unavailable: true, unreadable: 0, bytes: 0 } }
        finally { db?.close() }
    },
    async remember(scope, workspace, source, read, current = () => true) {
        if (!current()) return { status: 'retired' }
        const initial = mergeCachedRead(scope, workspace, source, read, null)
        if (!initial) return { status: 'invalid' }
        const sceneId = read?.scene.id
        scope = initial.scope; workspace = initial.workspace; source = initial.index
        read = sceneId ? initial.scenes[sceneId].read : undefined
        let db: IDBDatabase | null = null
        try {
            db = await openDatabase()
            return await new Promise<DeviceCacheResult>((resolve) => {
                // The record and its bounded usage counter commit together. Read
                // callbacks queue every dependent request before the transaction
                // can deactivate, including when two tabs write concurrently.
                const transaction = db!.transaction([STORE, USAGE], 'readwrite'), store = transaction.objectStore(STORE), usage = transaction.objectStore(USAGE)
                const request = store.get(initial.key), counter = usage.get(deviceCachePrefix(scope))
                let outcome: DeviceCacheResult = { status: 'unavailable' }, refused = false, remaining = 2
                const refuse = (status: DeviceCacheStatus) => { outcome = { status }; refused = true; transaction.abort() }
                const ready = () => {
                    remaining -= 1
                    if (remaining) return
                    try {
                        if (!current()) { refuse('retired'); return }
                        const stored: unknown = request.result, meta: unknown = counter.result
                        const previous = stored === undefined ? undefined : unpackCachedNovel(stored)
                        if (stored !== undefined && !validCachedNovel(previous, scope)) { refuse('invalid'); return }
                        if (meta !== undefined && (!record(meta) || meta.schema !== 1 || !Number.isSafeInteger(meta.bytes) || Number(meta.bytes) < 0)) { refuse('invalid'); return }
                        // Usage counts what is stored, so a schema 1 record is measured as it was written.
                        const previousBytes = stored === undefined ? 0 : storedBytes(stored)
                        const write = (bytes: number) => {
                            if (!current()) { refuse('retired'); return }
                            if (bytes < previousBytes) { refuse('invalid'); return }
                            queueDeviceWorkspace(transaction, scope, workspace, current, (retained) => {
                                if (retained.status !== 'saved') { refuse(retained.status); return }
                                const candidate = mergeRead(scope, retained.workspace, source, read, (previous as CachedNovelRead | undefined) ?? null, Date.now(), true)
                                if (!candidate) { refuse('invalid'); return }
                                const packed = packCachedNovel(candidate)
                                const candidateBytes = storedBytes(packed), total = bytes - previousBytes + candidateBytes
                                if (candidateBytes > DEVICE_CACHE_NOVEL_BYTES || total > DEVICE_CACHE_ACCOUNT_BYTES) { refuse('limit'); return }
                                store.put(packed); usage.put({ key: deviceCachePrefix(scope), schema: 1, bytes: total })
                                outcome = { status: 'saved', bytes: total }
                            })
                        }
                        if (meta === undefined) {
                            // Only a genuinely new account starts at zero. Preserve
                            // an inconsistent existing namespace for manual recovery.
                            const count = store.count(range(scope))
                            count.onsuccess = () => { if (count.result === 0) write(0); else refuse('invalid') }
                        } else write(Number((meta as Record<string, unknown>).bytes))
                    } catch { refuse('invalid') }
                }
                request.onsuccess = counter.onsuccess = ready
                transaction.oncomplete = () => { resolve(outcome); notify() }
                transaction.onerror = transaction.onabort = () => resolve(refused ? outcome : { status: 'unavailable' })
            })
        } catch { return { status: 'unavailable' } }
        finally { db?.close() }
    },
}
