import { canonicalJson } from '@/utils/json'
import { generateUUID } from '@/utils/uuid'
import { accountStorageKey } from '@/shared/workspaceStorage'
import { manuscript, novel, storyChapter, storyScene } from './story'
import { studioIndex, studioSceneRead } from './storyStudio'
import { deviceCachePrefix, studioReadStorage } from '@/features/novel/persistence/studioReadStorage'
import { DEVICE_READ_METADATA, openDeviceReadDatabase } from '@/features/novel/persistence/deviceReadDatabase'
import { deviceWorkspaceKey, listDeviceWorkspaces, rememberDeviceWorkspaces } from '@/features/novel/persistence/deviceWorkspaceStorage'

/** Opt-in native proof; every write belongs to a newly allocated fictional author. */
export async function proveNativeWorkspaceLifecycle() {
    const scope = { apiOrigin: location.origin, userHash: 'native-workspace-lifecycle-' + generateUUID() }
    const workspace = { id: 'native-lifecycle-desk', name: 'Writing desk', isDefault: false, archived: false, rowVersion: 1 }
    const fixture = (id: string) => {
        const scene = storyScene({ id: id + '-scene', storyId: id, document: manuscript('Confirmed prose for ' + id, 'native-letter') })
        const index = studioIndex(novel({ id, organization: { workspace_id: workspace.id }, chapters: [storyChapter({ storyId: id, scenes: [scene] })] }))
        return { scene, index, read: studioSceneRead(index, scene) }
    }
    const first = fixture('native-lifecycle-first'), second = fixture('native-lifecycle-second')
    const legacyScope = { apiOrigin: location.origin, userHash: 'novel-cold-browser-fictional-author-20261017' }
    const legacyBefore = await studioReadStorage.list(legacyScope)
    let checks = 0
    const require = (condition: boolean, message: string) => { if (!condition) throw new Error(message); checks += 1 }
    require((await studioReadStorage.remember(scope, workspace, first.index, first.read)).status === 'saved', 'First native copy failed')
    require((await studioReadStorage.remember(scope, workspace, second.index, second.read)).status === 'saved', 'Second native copy failed')
    const before = await studioReadStorage.list(scope), frozen = canonicalJson(before.items)
    require(before.items.length === 2, 'Native copies did not reopen')
    const archive = { ...workspace, rowVersion: 9, archived: true }, late = { ...workspace, rowVersion: 8 }
    await Promise.all([rememberDeviceWorkspaces(scope, [archive]), rememberDeviceWorkspaces(scope, [late])])
    const archived = await studioReadStorage.list(scope)
    require(archived.workspaceStates?.[workspace.id]?.archived === true && archived.workspaceStates[workspace.id].rowVersion === 9, 'Late workspace read undid an archive')
    require(canonicalJson(archived.items) === frozen && archived.bytes === before.bytes, 'Workspace-only retention rewrote manuscript copies')
    const mutableScope = { ...scope }, mutableWorkspace = { ...late }
    const pending = studioReadStorage.remember(mutableScope, mutableWorkspace, first.index, first.read)
    mutableScope.userHash += '-other'; mutableWorkspace.rowVersion = 99; mutableWorkspace.archived = false
    require((await pending).status === 'saved', 'Owned delayed scene read failed')
    const retained = await studioReadStorage.list(scope)
    require(retained.items.find((item) => item.index.id === first.index.id)?.workspace.rowVersion === 9, 'Delayed scene metadata regressed')
    require((await studioReadStorage.list(mutableScope)).items.length === 0, 'Mutable caller scope moved the copy')
    require((await rememberDeviceWorkspaces(scope, [{ ...workspace, rowVersion: 10 }])).status === 'saved', 'Checked restore was not retained')
    require((await listDeviceWorkspaces(scope)).states[workspace.id]?.archived === false, 'Newer restore did not clear the archive')
    for (const other of [{ ...scope, userHash: scope.userHash + '-other' }, { ...scope, apiOrigin: 'https://another-writing.example' }])
        require(Object.keys((await listDeviceWorkspaces(other)).states).length === 0, 'Workspace state crossed its author/API scope')
    const restored = canonicalJson(await listDeviceWorkspaces(scope))
    const large = Array.from({ length: 600 }, (_, index) => ({ ...workspace, id: 'native-large-' + index, name: 'a'.repeat(7500) }))
    const limited = await rememberDeviceWorkspaces(scope, [{ ...archive, rowVersion: 11 }, ...large])
    require(limited.status === 'limit', 'The workspace allowance was not enforced')
    require(canonicalJson(await listDeviceWorkspaces(scope)) === restored, 'A refused batch partially changed known restrictions')
    const database = await openDeviceReadDatabase()
    require(database.version === 1 && database.objectStoreNames.length === 2, 'Existing device storage was upgraded or replaced')
    const read = (key: string) => new Promise<unknown>((resolve, reject) => {
        const transaction = database.transaction(DEVICE_READ_METADATA, 'readonly'), request = transaction.objectStore(DEVICE_READ_METADATA).get(key)
        transaction.oncomplete = () => resolve(request.result)
        transaction.onerror = transaction.onabort = () => reject(transaction.error)
    })
    const original = await read(deviceWorkspaceKey(scope, workspace.id)) as Record<string, unknown>
    const usage = await read(accountStorageKey('magic-worlds:novel-workspace-usage:v1', scope)) as { bytes: number }
    require(usage.bytes === new TextEncoder().encode(JSON.stringify(original)).byteLength, 'Native workspace usage is inconsistent')
    const proseUsage = await read(deviceCachePrefix(scope)) as { bytes: number }
    require(proseUsage.bytes === (await studioReadStorage.list(scope)).bytes, 'Workspace metadata altered prose usage')
    const damaged = { ...original, schema: 999 }
    await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(DEVICE_READ_METADATA, 'readwrite')
        transaction.objectStore(DEVICE_READ_METADATA).put(damaged)
        transaction.oncomplete = () => resolve()
        transaction.onerror = transaction.onabort = () => reject(transaction.error)
    })
    require((await listDeviceWorkspaces(scope)).unreadableIds.includes(workspace.id), 'Unreadable restrictions were silently ignored')
    require((await studioReadStorage.list(scope)).items.length === 2, 'Unreadable workspace metadata hid the saved manuscripts')
    require((await rememberDeviceWorkspaces(scope, [{ ...workspace, rowVersion: 12 }])).status === 'invalid', 'Unreadable metadata was automatically replaced')
    require(canonicalJson(await read(deviceWorkspaceKey(scope, workspace.id))) === canonicalJson(damaged), 'Unreadable evidence was not preserved')
    const legacyAfter = await studioReadStorage.list(legacyScope)
    require(!legacyAfter.unavailable && canonicalJson(legacyBefore.items) === canonicalJson(legacyAfter.items) && legacyBefore.bytes === legacyAfter.bytes, 'Earlier fictional copies changed')
    database.close()
    return { checks, projectWrites: 0, removedRecords: 0, manuscriptCopiesPreserved: 2, earlierFictionalCopiesPreserved: legacyBefore.items.length, nativeDatabaseVersion: 1, refusedWorkspaceBatch: 600 }
}
