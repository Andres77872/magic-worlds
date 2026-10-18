import { manuscript, novel, storyChapter, storyScene } from './story'
import { studioIndex, studioSceneRead } from './storyStudio'
import { DEVICE_CACHE_NOVEL_BYTES, deviceCacheScope, studioReadStorage } from '@/features/novel/persistence/studioReadStorage'
import { canonicalJson } from '@/utils/json'

/** Opt-in Storybook proof; every record has a fresh fictional author namespace. */
export async function proveNativeDeviceCache() {
    const scope = deviceCacheScope('novel-device-native-proof-' + crypto.randomUUID())
    const workspace = { id: 'fictional-native-desk', name: 'Native test desk', isDefault: true, archived: false }
    const a = storyScene({ id: 'native-first', document: manuscript('The first confirmed passage.', 'native-first-block') })
    const b = storyScene({ id: 'native-second', order: 1, document: manuscript('The second confirmed passage.', 'native-second-block') })
    const index = studioIndex(novel({ organization: { workspace_id: workspace.id }, chapters: [storyChapter({ scenes: [a, b] })] }))
    const results = await Promise.all([studioReadStorage.remember(scope, workspace, index, studioSceneRead(index, a)), studioReadStorage.remember(scope, workspace, index, studioSceneRead(index, b))])
    const require = (condition: boolean, message: string) => { if (!condition) throw new Error(message) }
    require(results.every((item) => item.status === 'saved'), 'Concurrent native commits failed')
    const saved = await studioReadStorage.list(scope)
    require(!saved.unavailable && saved.items.length === 1 && Object.keys(saved.items[0].scenes).length === 2, 'Concurrent commits lost a scene')
    require(results.some((item) => item.bytes === saved.bytes), 'Atomic usage counter differs from native records')
    const before = canonicalJson(saved)
    const retired = await studioReadStorage.remember(scope, workspace, index, studioSceneRead(index, a), () => false)
    require(retired.status === 'retired' && canonicalJson(await studioReadStorage.list(scope)) === before, 'Retired owner changed native records')
    const foreign = await studioReadStorage.list({ ...scope, userHash: scope.userHash + '-other' })
    require(foreign.items.length === 0 && !foreign.unavailable, 'Another author read native copies')
    const invalid = await studioReadStorage.remember(scope, workspace, index, { ...studioSceneRead(index, a), source: { ...studioSceneRead(index, a).source, revision: 20 } })
    require(invalid.status === 'invalid' && canonicalJson(await studioReadStorage.list(scope)) === before, 'Invalid read changed native records')

    const quotaScope = { ...scope, userHash: scope.userHash + '-quota' }
    const scenes = Array.from({ length: 20 }, (_, i) => storyScene({ id: 'quota-' + i, order: i, document: manuscript('x'.repeat(400_000), 'quota-block-' + i) }))
    const largeIndex = studioIndex(novel({ organization: { workspace_id: workspace.id }, chapters: [storyChapter({ scenes })] }))
    let retained = 0, limited = false
    for (const scene of scenes) {
        const result = await studioReadStorage.remember(quotaScope, workspace, largeIndex, studioSceneRead(largeIndex, scene))
        if (result.status === 'limit') { limited = true; break }
        require(result.status === 'saved', 'Native storage failed before the controlled allowance'); retained += 1
    }
    const bounded = await studioReadStorage.list(quotaScope)
    require(limited && retained > 0 && retained < scenes.length, 'Novel allowance did not stop growing copies')
    require(!bounded.unavailable && bounded.bytes <= DEVICE_CACHE_NOVEL_BYTES && Object.keys(bounded.items[0].scenes).length === retained, 'Allowance failure removed earlier copies')
    require(bounded.items[0].scenes[scenes[0].id].read.scene.plainText === scenes[0].plainText, 'Allowance failure changed earlier prose')
    return { checks: 7, retainedQuotaScenes: retained, retainedBytes: bounded.bytes, projectWrites: 0, removedRecords: 0 }
}
