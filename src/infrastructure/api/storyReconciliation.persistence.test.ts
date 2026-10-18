import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { verifyStoryScene, matchesStoryWrite } from './storyContract'
import { verifyWorkspace } from './workspaceContract'
import { reviewSceneReconciliation, resolveSceneReconciliation } from '@/features/novel/persistence/sceneReconciliation'

const path = process.env.NOVEL_RECONCILIATION_PERSISTENCE
it.runIf(Boolean(path))('accepts native merge/history/replay reads and reproduces the reviewed candidate', () => {
    const wire = JSON.parse(readFileSync(path!, 'utf8'))
    const storyId = wire.reopened.storyId, sceneId = wire.reopened.id
    for (const name of ['baseSaved', 'accountSaved', 'mergedSaved', 'reopened', 'later', 'archived']) {
        expect(verifyStoryScene(wire[name], storyId, sceneId)).toBe(true)
    }
    expect(matchesStoryWrite(wire.mergedSaved, wire.mergeWrite)).toBe(true)
    const review = reviewSceneReconciliation(wire.base, wire.device, wire.account)!
    expect(resolveSceneReconciliation(review, {})).toEqual(wire.merged)
    expect(wire.reopened.document).toEqual(wire.merged)
    expect(wire.later.revision).toBeGreaterThan(wire.reopened.revision)
    expect(verifyWorkspace(wire.workspace)).toBe(true)
    expect(wire.workspace.archived_at).toBeTruthy()
    expect(wire.otherNovelUnchanged).toBe(true)
    expect(wire.projectDatabaseTestWrites).toBe(false)
})
