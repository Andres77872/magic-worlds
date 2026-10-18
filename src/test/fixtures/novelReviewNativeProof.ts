import { generateUUID } from '@/utils/uuid'
import { manuscript, storyScene } from './story'
import { reconciliationSource } from '@/features/novel/hooks/useReconciliationProgress'
import { listSavedReconciliations, reconciliationJournal, reconciliationKey, reconciliationSceneScope, type ReconciliationCheckpoint, type ReconciliationSource } from '@/features/novel/persistence/reconciliationJournal'
import { canonicalJson } from '@/utils/json'

/** Opt-in native proof; only a fresh fictional author namespace is written. */
export async function proveNativeReviewProgress() {
    const scope = { apiOrigin: 'https://novel-review-fixture.example', userHash: 'native-review-proof-' + generateUUID(), workspaceId: 'native-review-desk' }
    const source = reconciliationSource({ id: 'native-review', ownerKey: 'fictional-author', sequence: 1, deviceTitle: 'The sealed letter',
        baseDocument: manuscript('The seal was warm.', 'native-letter'), deviceDocument: manuscript('Mara broke the seal.', 'native-letter'),
        account: storyScene({ revision: 2, title: 'The sealed letter', document: manuscript('Someone had opened the letter.', 'native-letter') }) })
    const checkpoint = (writer: string, sequence: number, value: 'device' | 'account', writtenAt: number, snapshot: ReconciliationSource = source): ReconciliationCheckpoint => ({ schema: 1,
        key: reconciliationKey(scope, writer), sceneScope: reconciliationSceneScope(scope, source.storyId, source.sceneId), source: snapshot,
        value: { choices: { 'native-letter': value }, order: value, title: value }, sequence, writtenAt })
    let checks = 0
    const require = (value: boolean, message: string) => { if (!value) throw new Error(message); checks += 1 }
    require(await reconciliationJournal.save(scope, checkpoint('first', 2, 'device', 1)) === 'saved', 'Native review save failed')
    require((await reconciliationJournal.load(scope, source)).checkpoint?.value.choices['native-letter'] === 'device', 'Native review did not reopen')
    require(await reconciliationJournal.save(scope, checkpoint('second', 1, 'account', 2)) === 'saved', 'Independent review failed')
    require(await reconciliationJournal.save(scope, checkpoint('first', 1, 'account', 3)) === 'superseded', 'Late review write replaced newer progress')
    const before = await reconciliationJournal.load(scope, source)
    require(before.checkpoint?.key === reconciliationKey(scope, 'second'), 'Independent progress was overwritten')
    const library = await listSavedReconciliations(scope)
    require(!library.unavailable && library.items.length === 1 && library.items[0].checkpoint.key === before.checkpoint?.key, 'Review requires an unrelated scene cache')
    const sameSequence = await reconciliationJournal.save(scope, checkpoint('second', 1, 'device', 4))
    require(sameSequence === 'invalid', 'A changed equal-sequence intent replaced earlier progress')
    require((await reconciliationJournal.load(scope, { ...source, accountRevision: source.accountRevision + 1 })).checkpoint === null, 'Changed account head reused old choices')
    for (const other of [{ ...scope, userHash: scope.userHash + '-other' }, { ...scope, workspaceId: 'another-desk' }, { ...scope, apiOrigin: 'https://other-review.example' }])
        require((await reconciliationJournal.load(other, source)).checkpoint === null, 'Review progress crossed its owned scope')
    const huge = manuscript('界'.repeat(2_000_000), 'native-letter'), oversized = { ...source, base: huge, device: huge, account: huge }
    require(await reconciliationJournal.save(scope, checkpoint('oversized', 1, 'device', 5, oversized)) === 'limit', 'Oversized review was not refused')
    require(canonicalJson(await reconciliationJournal.load(scope, source)) === canonicalJson(before), 'Refused review changed earlier records')
    return { checks, projectWrites: 0, removedRecords: 0, keptWriters: 2 }
}
