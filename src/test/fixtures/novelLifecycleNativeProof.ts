import { generateUUID } from '@/utils/uuid'
import { canonicalJson } from '@/utils/json'
import { accountStorageKey } from '@/shared/workspaceStorage'
import { manuscript, novel, storyChapter, storyScene } from './story'
import { studioIndex, studioSceneRead } from './storyStudio'
import { studioReadStorage } from '@/features/novel/persistence/studioReadStorage'
import { DEVICE_READ_METADATA, openDeviceReadDatabase } from '@/features/novel/persistence/deviceReadDatabase'
import { DEVICE_NOVEL_ACCOUNT_BYTES, deviceNovelStateKey, readDeviceNovel, rememberDeviceNovel, rememberDeviceNovelErased, rememberDeviceNovelRoot, rememberDeviceNovelSource } from '@/features/novel/persistence/deviceNovelStorage'
import { deviceSceneReadOnly, emptyNovelLifecycle } from '@/features/novel/persistence/novelDeviceLifecycle'

/** Every write belongs to a fresh fictional native namespace; never touches project data. */
export async function proveNativeNovelLifecycle() {
    const scope = { apiOrigin: location.origin, userHash: 'native-novel-lifecycle-' + generateUUID(), workspaceId: 'native-novel-desk', storyId: 'native-novel' }
    const workspace = { id: scope.workspaceId, name: 'Writing desk', isDefault: false, archived: false, rowVersion: 1 }
    const scene = storyScene({ storyId: scope.storyId, document: manuscript('The native manuscript remains unchanged.', 'native-novel-letter') })
    const source = studioIndex(novel({ id: scope.storyId, organization: { workspace_id: scope.workspaceId }, chapters: [storyChapter({ storyId: scope.storyId, scenes: [scene] })] }))
    const legacyScope = { apiOrigin: location.origin, userHash: 'novel-cold-browser-fictional-author-20261017' }, legacyBefore = await studioReadStorage.list(legacyScope)
    let checks = 0
    const require = (condition: boolean, message: string) => { if (!condition) throw new Error(message); checks += 1 }
    require((await studioReadStorage.remember(scope, workspace, source, studioSceneRead(source, scene))).status === 'saved', 'Native scene was not retained')
    const copies = await studioReadStorage.list(scope)
    require((await rememberDeviceNovelSource(scope, source)).status === 'saved', 'Native source was not retained')
    require(deviceSceneReadOnly((await readDeviceNovel(scope)).state, scene.id) === false, 'Confirmed initial scene is not writable')
    await Promise.all([rememberDeviceNovelRoot(scope, 9, true), rememberDeviceNovelRoot(scope, 8, false)])
    require((await readDeviceNovel(scope)).state?.root?.revision === 9 && deviceSceneReadOnly((await readDeviceNovel(scope)).state, scene.id) === true, 'Late root response removed archive')
    const mutableScope = { ...scope }, mutable = { ...emptyNovelLifecycle(), root: { revision: 10, readOnly: false } }
    const pending = rememberDeviceNovel(mutableScope, mutable)
    mutableScope.userHash += '-other'; mutable.root.revision = 99; mutable.root.readOnly = true
    require((await pending).status === 'saved', 'Captured restore failed')
    require((await readDeviceNovel(scope)).state?.root?.revision === 10 && deviceSceneReadOnly((await readDeviceNovel(scope)).state, scene.id) === false, 'Caller mutation changed retained restore')
    require((await readDeviceNovel(mutableScope)).state === null, 'Caller mutation moved scope')
    const unit = (revision: number, readOnly: boolean) => ({ ...emptyNovelLifecycle(), units: { [scene.chapterId]: { revision, readOnly } } })
    await rememberDeviceNovel(scope, unit(4, true)); await rememberDeviceNovel(scope, unit(3, false))
    require(deviceSceneReadOnly((await readDeviceNovel(scope)).state, scene.id) === true, 'Late ancestor read unlocked scene')
    await rememberDeviceNovel(scope, unit(5, false))
    require(deviceSceneReadOnly((await readDeviceNovel(scope)).state, scene.id) === false, 'Newer ancestor restore did not unlock scene')
    const removed = studioIndex(novel({ ...source, structureRevision: 4, chapters: [] }))
    require((await rememberDeviceNovelSource(scope, removed)).status === 'saved', 'Removed-scene index was not retained')
    require(deviceSceneReadOnly((await readDeviceNovel(scope)).state, scene.id) === true, 'Removed scene remained editable')
    await rememberDeviceNovelSource(scope, source)
    require(deviceSceneReadOnly((await readDeviceNovel(scope)).state, scene.id) === true, 'Late membership reintroduced scene')
    await rememberDeviceNovelSource(scope, { ...source, structureRevision: 5 })
    require(deviceSceneReadOnly((await readDeviceNovel(scope)).state, scene.id) === false, 'Newer membership did not restore scene')
    for (const other of [{ ...scope, userHash: scope.userHash + '-other' }, { ...scope, apiOrigin: 'https://another-writing.example' }, { ...scope, workspaceId: scope.workspaceId + '-other' }, { ...scope, storyId: scope.storyId + '-other' }])
        require((await readDeviceNovel(other)).state === null, 'Lifecycle crossed scope')
    const database = await openDeviceReadDatabase()
    require(database.version === 1 && database.objectStoreNames.length === 2, 'Existing database schema changed')
    const read = (key: string) => new Promise<unknown>((resolve, reject) => {
        const transaction = database.transaction(DEVICE_READ_METADATA, 'readonly'), request = transaction.objectStore(DEVICE_READ_METADATA).get(key)
        transaction.oncomplete = () => resolve(request.result); transaction.onerror = transaction.onabort = () => reject(transaction.error)
    })
    const put = (value: unknown) => new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(DEVICE_READ_METADATA, 'readwrite'); transaction.objectStore(DEVICE_READ_METADATA).put(value)
        transaction.oncomplete = () => resolve(); transaction.onerror = transaction.onabort = () => reject(transaction.error)
    })
    const record = await read(deviceNovelStateKey(scope)), usageKey = accountStorageKey('magic-worlds:novel-lifecycle-usage:v1', scope)
    require((await read(usageKey) as { bytes: number }).bytes === new TextEncoder().encode(JSON.stringify(record)).byteLength, 'Lifecycle usage is inconsistent')
    const enormous = { ...emptyNovelLifecycle(), units: Object.fromEntries(Array.from({ length: 600 }, (_, i) => ['native-' + i + '-'.repeat(4096), { revision: 1, readOnly: true }])) }
    require((await rememberDeviceNovel(scope, enormous)).status === 'limit', 'Oversized lifecycle was not refused')
    require(canonicalJson(await read(deviceNovelStateKey(scope))) === canonicalJson(record), 'Size refusal changed earlier state')
    const ceilingScope = { ...scope, userHash: scope.userHash + '-reserved-ceiling' }, ceilingKey = accountStorageKey('magic-worlds:novel-lifecycle-usage:v1', ceilingScope)
    const reserved = { schema: 1, key: ceilingKey, bytes: DEVICE_NOVEL_ACCOUNT_BYTES }
    await put(reserved)
    require((await rememberDeviceNovelRoot(ceilingScope, 1, true)).status === 'limit', 'Reserved author allowance did not refuse another record')
    require(canonicalJson(await read(ceilingKey)) === canonicalJson(reserved) && (await readDeviceNovel(ceilingScope)).state === null, 'Allowance refusal changed reserved state')
    require((await rememberDeviceNovelErased(scope)).status === 'saved', 'Confirmed erasure was not retained')
    const terminal = canonicalJson((await readDeviceNovel(scope)).state)
    await rememberDeviceNovelSource(scope, { ...source, metadataRevision: 99, structureRevision: 99 })
    require(canonicalJson((await readDeviceNovel(scope)).state) === terminal && deviceSceneReadOnly((await readDeviceNovel(scope)).state, scene.id) === true, 'Stale data undid terminal erasure')
    const damaged = { ...(await read(deviceNovelStateKey(scope)) as object), schema: 999 }
    await put(damaged)
    require((await readDeviceNovel(scope)).unreadable, 'Corrupt lifecycle was ignored')
    require((await rememberDeviceNovelRoot(scope, 100, false)).status === 'invalid', 'Corrupt lifecycle was replaced automatically')
    require(canonicalJson(await read(deviceNovelStateKey(scope))) === canonicalJson(damaged), 'Corrupt evidence was removed')
    const after = await studioReadStorage.list(scope), legacyAfter = await studioReadStorage.list(legacyScope)
    require(canonicalJson(after.items) === canonicalJson(copies.items) && after.bytes === copies.bytes, 'Lifecycle operations changed original manuscript records or counters')
    require(canonicalJson(legacyBefore.items) === canonicalJson(legacyAfter.items) && legacyBefore.bytes === legacyAfter.bytes, 'Earlier fictional manuscript changed')
    database.close()
    return { checks, projectWrites: 0, removedRecords: 0, manuscriptCopiesPreserved: copies.items.length, earlierFictionalCopiesPreserved: legacyBefore.items.length, nativeDatabaseVersion: 1, reservedCeilingFixture: true }
}
