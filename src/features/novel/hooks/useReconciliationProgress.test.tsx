import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { manuscript, storyScene } from '@/test/fixtures/story'
import { reviewSceneReconciliation } from '../persistence/sceneReconciliation'
import { canonicalJson } from '@/utils/json'
import { reconciliationKey, reconciliationSceneScope, type ReconciliationCheckpoint, type ReconciliationJournal } from '../persistence/reconciliationJournal'
import type { SceneConflictReview } from './useSceneDraft'
import { reconciliationSource, useReconciliationProgress } from './useReconciliationProgress'

const scope = { apiOrigin: 'https://writing.example', userHash: 'author', workspaceId: 'desk' }
const makeReview = (patch: Partial<SceneConflictReview> = {}): SceneConflictReview => ({ id: 'review-one', ownerKey: 'author:one', sequence: 2, recoveryScope: scope,
    baseDocument: manuscript('A letter waited.', 'letter'), deviceDocument: manuscript('My changed letter.', 'letter'), deviceTitle: 'The letter',
    account: storyScene({ title: 'The letter', revision: 2, document: manuscript('Their changed letter.', 'letter') }), ...patch })
let stored: ReconciliationCheckpoint[]
const journal: ReconciliationJournal = {
    load: vi.fn<ReconciliationJournal['load']>(async (owner, source) => ({ checkpoint: stored.filter((item) => item.sceneScope === reconciliationSceneScope(owner, source.storyId, source.sceneId) && canonicalJson(item.source) === canonicalJson(source)).slice(-1)[0] ?? null, unavailable: false, unreadable: 0 })),
    save: vi.fn<ReconciliationJournal['save']>(async (_owner, checkpoint) => { stored.push(structuredClone(checkpoint)); return 'saved' }),
}
function mount(review = makeReview()) {
    return renderHook(({ review }) => useReconciliationProgress(review, reviewSceneReconciliation(review.baseDocument, review.deviceDocument, review.account.document), journal), { initialProps: { review } })
}
beforeEach(() => { stored = []; vi.clearAllMocks() })
it('restores choices after a real unmount and a new transient review identity without applying any account action', async () => {
    const first = mount(); await waitFor(() => expect(first.result.current.status).toBe('clean'))
    act(() => first.result.current.update({ choices: { letter: 'device' }, order: 'account', title: 'account' }))
    await waitFor(() => expect(first.result.current.status).toBe('saved'))
    const oldKey = stored[0].key; first.unmount()
    const second = mount(makeReview({ id: 'review-after-reload', ownerKey: 'author:new-epoch', sequence: 17 }))
    await waitFor(() => expect(second.result.current.status).toBe('recovered'))
    expect(second.result.current.value).toEqual({ choices: { letter: 'device' }, order: 'account', title: 'account' })
    act(() => second.result.current.update({ ...second.result.current.value, choices: { letter: 'account' } }))
    await waitFor(() => expect(second.result.current.status).toBe('saved'))
    expect(stored[1].key).not.toBe(oldKey)
    expect(stored[0].value.choices.letter).toBe('device')
})
it.each(['account', 'device', 'base', 'workspace', 'author'] as const)('requires a fresh choice when the %s source changes', async (changed) => {
    const review = makeReview(), source = reconciliationSource(review)
    stored = [{ schema: 1, key: reconciliationKey(scope, 'older-writer'), sceneScope: reconciliationSceneScope(scope, source.storyId, source.sceneId), source,
        value: { choices: { letter: 'device' }, order: 'device', title: 'device' }, sequence: 3, writtenAt: 1 }]
    const patch: Partial<SceneConflictReview> = changed === 'account' ? { account: { ...review.account, revision: 3 } }
        : changed === 'device' ? { deviceDocument: manuscript('Newer local writing.', 'letter') }
        : changed === 'base' ? { baseDocument: null }
        : { recoveryScope: { ...scope, ...(changed === 'workspace' ? { workspaceId: 'other' } : { userHash: 'another-author' }) } }
    const view = mount(makeReview(patch)); await waitFor(() => expect(view.result.current.status).toBe('clean'))
    expect(view.result.current.value.choices).toEqual({})
    expect(stored).toHaveLength(1)
})
it('ignores a delayed recovery result after the source changes and retains uncommitted choices on storage failure', async () => {
    let resolve!: (value: Awaited<ReturnType<ReconciliationJournal['load']>>) => void
    const late: ReconciliationJournal = { ...journal, load: vi.fn<ReconciliationJournal['load']>(() => new Promise((done) => { resolve = done })), save: vi.fn<ReconciliationJournal['save']>(async () => 'limit') }
    const firstReview = makeReview(), source = reconciliationSource(firstReview)
    const view = renderHook(({ review }) => useReconciliationProgress(review, reviewSceneReconciliation(review.baseDocument, review.deviceDocument, review.account.document), late), { initialProps: { review: firstReview } })
    const firstResolve = resolve
    view.rerender({ review: makeReview({ recoveryScope: { ...scope, userHash: 'other' } }) })
    await act(async () => firstResolve({ checkpoint: { schema: 1, key: reconciliationKey(scope, 'previous'), sceneScope: reconciliationSceneScope(scope, source.storyId, source.sceneId), source,
        value: { choices: { letter: 'account' }, order: 'device', title: 'device' }, sequence: 1, writtenAt: 1 }, unavailable: false, unreadable: 0 }))
    expect(view.result.current.status).toBe('loading'); expect(view.result.current.value.choices).toEqual({})
    await act(async () => resolve({ checkpoint: null, unavailable: false, unreadable: 0 }))
    act(() => view.result.current.update({ choices: { letter: 'device' }, order: 'device', title: 'device' }))
    await waitFor(() => expect(view.result.current.status).toBe('failed'))
    expect(view.result.current.value.choices).toEqual({ letter: 'device' })
    await act(async () => expect(await view.result.current.flush()).toBe(false))
    const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
})
