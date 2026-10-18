import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import type { StoryScene, StorySceneWrite, StoryManuscriptDocument, StoryVariantSnapshot } from '@/shared'
import nativeVariants from '@/test/fixtures/storyVariantsNative.json'
import { manuscript, storyScene } from '@/test/fixtures/story'
import { documentText } from '@/shared/storyDocument'
import { draftJournalKey, readCheckpoint, writeCheckpoint } from '../persistence/draftJournal'
import { resolveSceneReconciliation, reviewSceneReconciliation } from '../persistence/sceneReconciliation'
import { useSceneDraft } from './useSceneDraft'
import type { StoryWorkspace } from './useStoryWorkspace'

const updateStoryScene = vi.fn(), acceptStoryGeneration = vi.fn(), getStoryScene = vi.fn(), getStoryRevision = vi.fn(), getWorkspace = vi.fn()
let online = true, userHash = 'author-one', authenticated = true, currentWorkspace = true
vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: authenticated, userHash, accountKey: userHash, openLoginModal: vi.fn() }),
    useData: () => ({ updateStoryScene, acceptStoryGeneration }),
}))
const api = { getStoryScene, getStoryRevision, getWorkspace }
const workspace: StoryWorkspace = { workspaceId: 'reconnect-workspace', isCurrent: () => currentWorkspace,
    detachedApi: () => userHash === 'author-one' ? api as never : null }
const base = manuscript('The letter arrived.', 'letter-block')
const initial = () => storyScene({ id: 'scene', storyId: 'novel', title: 'The letter', document: base, revision: 1, metadataRevision: 1 })
let remote: StoryScene
function mount(seed = initial()) { return renderHook(() => useSceneDraft({ storyId: 'novel', scene: seed, workspace })) }
function disconnect() { act(() => { online = false; window.dispatchEvent(new Event('offline')) }) }
async function reconnect() { await act(async () => { online = true; window.dispatchEvent(new Event('online')) }) }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done }); return { promise, resolve } }
function bothParagraphs(first: string, second: string): StoryManuscriptDocument {
    const value = manuscript(first, 'first-block')
    value.content.content!.push(...manuscript(second, 'second-block').content.content!)
    return value
}

beforeEach(() => {
    vi.restoreAllMocks(); vi.clearAllMocks(); vi.useFakeTimers(); localStorage.clear()
    online = true; userHash = 'author-one'; authenticated = true; currentWorkspace = true; remote = initial()
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online)
    getStoryScene.mockImplementation(async () => structuredClone(remote))
    getWorkspace.mockResolvedValue({ id: workspace.workspaceId, archived_at: null })
    getStoryRevision.mockImplementation(async () => ({ storyId: 'novel', sceneId: 'scene', revision: 1, document: base }))
    updateStoryScene.mockImplementation(async (_story, _scene, write: StorySceneWrite) => {
        if (write.expectedRevision !== undefined && write.expectedRevision !== remote.revision
            || write.expectedMetadataRevision !== undefined && write.expectedMetadataRevision !== remote.metadataRevision) throw new ApiError(409, 'STORY_REVISION_CONFLICT')
        remote = storyScene({ ...remote, document: write.document ?? remote.document, title: write.title ?? remote.title,
            revision: remote.revision + (write.document ? 1 : 0), metadataRevision: remote.metadataRevision + (write.title ? 1 : 0) })
        return structuredClone(remote)
    })
})

it('keeps an authored acceptance offline as its exact application, then replays it before any ordinary save',async()=>{
    const version=structuredClone(nativeVariants.preview) as StoryVariantSnapshot
    version.storyId='novel';version.parent.parent.storyId='novel';version.parent.parent.sceneId='scene';version.parent.parent.baseRevision=1
    version.operation.sceneId='scene';version.operation.expectedRevision=1;version.baseDocument=base
    version.operation.document=manuscript('Authored The letter arrived.','letter-block');version.operation.anchorEdits=[{from:0,to:0,text:'Authored '}]
    acceptStoryGeneration.mockImplementation(async(_s,_g,write)=>storyScene({...initial(),document:write.document,revision:2}))
    const first=mount()
    act(()=>first.result.current.onDocumentChange(version.operation.document))
    disconnect()
    await act(async()=>expect(await first.result.current.acceptGeneration(version.parent.parent.id,version)).toBe(false))
    expect(acceptStoryGeneration).not.toHaveBeenCalled();expect(updateStoryScene).not.toHaveBeenCalled()
    act(()=>first.unmount())
    const recovered=mount()
    const pending=recovered.result.current.recovery?.pending
    expect(pending?.variant).toEqual({id:version.id,variantHash:version.variantHash})
    expect(pending?.write.document).toEqual(version.operation.document)
    expect(pending?.write.anchorEdits).toEqual(version.operation.anchorEdits)
    act(()=>recovered.result.current.resumeRecovery())
    await reconnect()
    const expected=['novel',version.parent.parent.id,{...pending!.write,sceneId:'scene',variant:pending!.variant}]
    expect(acceptStoryGeneration).toHaveBeenCalled()
    // A detached queue and the reopened writer may both recover the receipt;
    // every transport attempt must carry the same immutable request identity.
    for(const call of acceptStoryGeneration.mock.calls)expect(call).toEqual(expected)
    expect(new Set(acceptStoryGeneration.mock.calls.map(call=>call[2].requestId)).size).toBe(1)
    expect(updateStoryScene).not.toHaveBeenCalled()
})

it('reopens a rejected application, retains its exact identity and later writing, and only restores fresh account text after a verified copy',async()=>{
    acceptStoryGeneration.mockRejectedValueOnce(new ApiError(409,'Context changed',{code:'STORY_ASSISTANT_SOURCE_CHANGED'}))
    const first=mount()
    act(()=>first.result.current.onDocumentChange(manuscript('Proposed writing.','letter-block')))
    await act(async()=>{expect(await first.result.current.acceptGeneration('generation-1')).toBe(false)})
    act(()=>first.result.current.onDocumentChange(manuscript('Later device writing.','letter-block')))
    act(()=>first.unmount())
    remote=storyScene({...initial(),revision:3,document:manuscript('Fresh account writing.','letter-block')})
    const next=mount(remote)
    expect(next.result.current.applicationRejection?.reason).toBe('sources_changed')
    await act(async()=>{await next.result.current.compareConflict()})
    const review=next.result.current.conflictReview!
    expect(review.applicationRejection?.generationId).toBe('generation-1')
    expect(documentText(review.deviceDocument)).toBe('Later device writing.')
    expect(documentText(review.applicationRejection!.write.document)).toBe('Proposed writing.')
    expect(review.account.revision).toBe(3)
    act(()=>{expect(next.result.current.resolveConflict('local')).toBe(false);expect(next.result.current.resolveConflict('merge',{document:review.deviceDocument,title:review.deviceTitle})).toBe(false)})
    const blocked=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('Quota')})
    act(()=>expect(next.result.current.resolveConflict('server')).toBe(false))
    expect(next.result.current.applicationRejection).not.toBeNull()
    blocked.mockRestore()
    act(()=>expect(next.result.current.resolveConflict('server')).toBe(true))
    expect(next.result.current.applicationRejection).toBeNull()
    expect(next.result.current.body).toBe('Fresh account writing.')
    expect(next.result.current.retainedDrafts[0].applicationRejection?.generationId).toBe('generation-1')
    expect(documentText(next.result.current.retainedDrafts[0].document)).toBe('Later device writing.')
    expect(updateStoryScene).not.toHaveBeenCalled()
    act(()=>next.unmount())
    const reopened=mount(remote)
    expect(reopened.result.current.recovery).toBeNull()
    expect(reopened.result.current.retainedDrafts).toHaveLength(1)
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('offline scene writes and reconnect review', () => {
    it('keeps a device-only queue local even when the browser is online and an API client exists', async () => {
        const localWorkspace: StoryWorkspace = { ...workspace, deviceOnly: true }
        const view = renderHook(() => useSceneDraft({ storyId: 'novel', scene: initial(), workspace: localWorkspace }))
        act(() => view.result.current.onDocumentChange(manuscript('Only on this device.', 'letter-block')))
        await act(async () => { expect(await view.result.current.flush()).toBe(false); vi.advanceTimersByTime(20_000) })
        act(() => expect(view.result.current.preserveLocal()).toBe(true))
        await act(async () => { expect(await view.result.current.acceptGeneration('generation')).toBe(false); await view.result.current.compareConflict() })
        expect(documentText(readCheckpoint(draftJournalKey(userHash, workspace.workspaceId, 'novel', 'scene'))!.document)).toBe('Only on this device.')
        expect(updateStoryScene).not.toHaveBeenCalled(); expect(acceptStoryGeneration).not.toHaveBeenCalled()
        expect(getStoryScene).not.toHaveBeenCalled(); expect(getWorkspace).not.toHaveBeenCalled()
        expect(view.result.current.saveState).toBe('offline')
    })
    it('refuses local navigation when storage acknowledges but fails to retain the current prose', () => {
        const view = renderHook(() => useSceneDraft({ storyId: 'novel', scene: initial(), workspace: { ...workspace, deviceOnly: true } }))
        act(() => view.result.current.onDocumentChange(manuscript('Writing must survive navigation.', 'letter-block')))
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {})
        act(() => expect(view.result.current.preserveLocal()).toBe(false))
        expect(view.result.current.storageFailed).toBe(true)
    })
    it('keeps an unsupported stored request in manual recovery without executing or deleting it', async () => {
        const key = draftJournalKey(userHash, workspace.workspaceId, 'novel', 'scene')!
        const raw = JSON.stringify({ schema: 2, title: 'The letter', document: manuscript('Recover this private prose.', 'letter-block'), baseRevision: 1, baseMetadataRevision: 1, sequence: 1,
            pending: { generationId: 'unknown / generation', write: { requestId: 'unverified', expectedRevision: 1, document: base } }, writtenAt: 1 })
        localStorage.setItem(key, raw)
        const { result } = mount()
        expect(result.current.recovery!.pendingInvalid).toBe(true)
        act(() => result.current.resumeRecovery())
        await act(async () => { vi.advanceTimersByTime(10_000) })
        expect(result.current.recovery).not.toBeNull()
        expect(updateStoryScene).not.toHaveBeenCalled(); expect(acceptStoryGeneration).not.toHaveBeenCalled()
        act(() => result.current.useServerVersion())
        expect(localStorage.getItem(key)).toBe(raw)
    })
    it('keeps a reopened writer’s newer journal when an older save resolves late in the same tab', async () => {
        const pending = deferred<StoryScene>(); updateStoryScene.mockReturnValueOnce(pending.promise)
        const first = mount()
        act(() => first.result.current.onDocumentChange(manuscript('First submitted version.', 'letter-block')))
        let operation!: Promise<boolean>; act(() => { operation = first.result.current.flush() })
        await act(async () => { await Promise.resolve(); first.unmount() })
        const second = mount()
        expect(second.result.current.recovery).not.toBeNull()
        act(() => { second.result.current.resumeRecovery(); second.result.current.setSuspended(true) })
        act(() => second.result.current.onDocumentChange(manuscript('Newer writing in the reopened scene.', 'letter-block')))
        await act(async () => { vi.advanceTimersByTime(150) })
        const accepted = storyScene({ ...initial(), revision: 2, document: manuscript('First submitted version.', 'letter-block') })
        await act(async () => { remote = accepted; pending.resolve(accepted); expect(await operation).toBe(true) })
        const recovered = readCheckpoint(draftJournalKey(userHash, workspace.workspaceId, 'novel', 'scene'))!
        expect(documentText(recovered.document)).toBe('Newer writing in the reopened scene.')
        expect(recovered.pending!.write.document).toEqual(manuscript('First submitted version.', 'letter-block'))
        expect(second.result.current.body).toBe('Newer writing in the reopened scene.')
    })

    it('preserves older-format browser records when a current scene opens', () => {
        localStorage.setItem('magic-worlds:novel-draft:v1:retained-legacy', 'Keep this original record')
        mount()
        expect(localStorage.getItem('magic-worlds:novel-draft:v1:retained-legacy')).toBe('Keep this original record')
    })
    it('checkpoints offline prose, pauses writes and never queues a paid generation acceptance', async () => {
        const { result } = mount(); disconnect()
        act(() => result.current.onDocumentChange(manuscript('Device-only writing 🦋', 'letter-block')))
        await act(async () => { vi.advanceTimersByTime(15_000) })
        expect(result.current.online).toBe(false)
        expect(result.current.saveState).toBe('offline')
        expect(result.current.localSaved).toBe(true)
        await act(async () => { expect(await result.current.flush()).toBe(false); expect(await result.current.acceptGeneration('generation')).toBe(false) })
        expect(updateStoryScene).not.toHaveBeenCalled(); expect(acceptStoryGeneration).not.toHaveBeenCalled()
        const saved = readCheckpoint(draftJournalKey(userHash, workspace.workspaceId, 'novel', 'scene'))!
        expect(documentText(saved.document)).toBe('Device-only writing 🦋')
        expect(saved.pending).toBeNull(); expect(saved.baseRevision).toBe(1)
    })

    it('checks the owned head before synchronizing an unsent offline draft', async () => {
        const events: string[] = []
        getStoryScene.mockImplementation(async () => { events.push('read'); return structuredClone(remote) })
        const original = updateStoryScene.getMockImplementation()!
        updateStoryScene.mockImplementation(async (...args) => { events.push('write'); return original(...args) })
        const { result } = mount(); disconnect()
        act(() => result.current.onDocumentChange(manuscript('The reply came at dawn.', 'letter-block')))
        await reconnect()
        await act(async () => { expect(await result.current.flush()).toBe(true) })
        expect(events).toEqual(['read', 'write'])
        expect(updateStoryScene).toHaveBeenCalledWith('novel', 'scene', expect.objectContaining({ expectedRevision: 1 }))
        expect(result.current.saveState).toBe('saved')
    })

    it('keeps both versions for reviewed rich-block merge when the account advanced offline', async () => {
        const original = bothParagraphs('The letter arrived.', 'Mara opened it.')
        remote = storyScene({ ...initial(), document: original })
        const { result } = mount(remote); disconnect()
        act(() => result.current.onDocumentChange(bothParagraphs('The letter arrived before dawn.', 'Mara opened it.')))
        remote = storyScene({ ...remote, document: bothParagraphs('The letter arrived.', 'Mara recognized the seal.'), revision: 2 })
        await reconnect()
        expect(updateStoryScene).not.toHaveBeenCalled()
        expect(result.current.saveState).toBe('conflict')
        await act(async () => { await result.current.compareConflict() })
        const review = result.current.conflictReview!
        const candidate = resolveSceneReconciliation(reviewSceneReconciliation(review.baseDocument, review.deviceDocument, review.account.document)!, {})!
        act(() => { expect(result.current.resolveConflict('merge', { document: candidate, title: review.deviceTitle })).toBe(true) })
        expect(result.current.retainedDrafts).toHaveLength(1)
        expect(documentText(result.current.retainedDrafts[0].document)).toContain('Mara opened it.')
        await act(async () => { expect(await result.current.flush()).toBe(true) })
        expect(updateStoryScene).toHaveBeenCalledWith('novel', 'scene', expect.objectContaining({ expectedRevision: 2, document: candidate }))
        expect(documentText(remote.document)).toBe('The letter arrived before dawn.\n\nMara recognized the seal.')
    })

    it('replays an uncertain request first, then detects newer account writing before sending the local tail', async () => {
        const originalWrite = deferred<StoryScene>()
        updateStoryScene.mockReturnValueOnce(originalWrite.promise)
        const { result } = mount()
        act(() => result.current.onDocumentChange(manuscript('First submitted prose.', 'letter-block')))
        let first!: Promise<boolean>; act(() => { first = result.current.flush() })
        await act(async () => { await Promise.resolve() })
        const sent = structuredClone(updateStoryScene.mock.calls[0][2])
        disconnect()
        // The server accepted this request, but the client lost its response.
        const accepted = storyScene({ ...initial(), document: sent.document, revision: 2 })
        remote = storyScene({ ...accepted, document: manuscript('Later account prose.', 'letter-block'), revision: 3 })
        await act(async () => { originalWrite.resolve(Promise.reject(new TypeError('Failed to fetch')) as never); expect(await first).toBe(false) })
        act(() => result.current.onDocumentChange(manuscript('Latest unsent device prose.', 'letter-block')))
        updateStoryScene.mockResolvedValueOnce(accepted)
        await reconnect()
        expect(updateStoryScene).toHaveBeenCalledTimes(2)
        expect(updateStoryScene.mock.calls[1][2]).toEqual(sent)
        expect(getStoryScene).toHaveBeenCalledTimes(1)
        expect(result.current.saveState).toBe('conflict')
        expect(result.current.body).toBe('Latest unsent device prose.')
        expect(documentText(remote.document)).toBe('Later account prose.')
    })

    it('rejects a comparison result after the account changed and preserves the original device journal', async () => {
        const pending = deferred<StoryScene>(); getStoryScene.mockReturnValueOnce(pending.promise)
        const view = mount(); disconnect()
        act(() => view.result.current.onDocumentChange(manuscript('First account private prose.', 'letter-block')))
        await reconnect()
        userHash = 'another-author'; view.rerender()
        await act(async () => { pending.resolve(storyScene({ ...initial(), document: manuscript('Old response private prose.', 'letter-block'), revision: 2 })) })
        expect(view.result.current.body).toBe('The letter arrived.')
        expect(view.result.current.conflictReview).toBeNull(); expect(updateStoryScene).not.toHaveBeenCalled()
        expect(documentText(readCheckpoint(draftJournalKey('author-one', workspace.workspaceId, 'novel', 'scene'))!.document)).toBe('First account private prose.')
    })

    it('refuses a server-archived head without attempting a prose write', async () => {
        const { result } = mount(); disconnect()
        act(() => result.current.onDocumentChange(manuscript('Retain this device draft.', 'letter-block')))
        remote = { ...remote, inheritance: { values: { includeInAI: true, includeInExport: true }, origins: {}, readOnly: true } }
        await reconnect()
        expect(result.current.saveState).toBe('error')
        expect(result.current.body).toBe('Retain this device draft.')
        expect(updateStoryScene).not.toHaveBeenCalled()
    })

    it('checks workspace archive independently of scene inheritance', async () => {
        const { result } = mount(); disconnect()
        act(() => result.current.onDocumentChange(manuscript('Device writing remains private.', 'letter-block')))
        getWorkspace.mockResolvedValue({ id: workspace.workspaceId, archived_at: '2026-10-16T12:00:00Z' })
        expect(remote.inheritance?.readOnly).not.toBe(true)
        await reconnect()
        expect(getWorkspace).toHaveBeenCalledWith(workspace.workspaceId)
        expect(result.current.saveState).toBe('error')
        expect(updateStoryScene).not.toHaveBeenCalled()
        expect(result.current.body).toBe('Device writing remains private.')
    })

    it('cannot apply a reviewed choice unless the separate device copy was actually retained', async () => {
        const { result } = mount()
        act(() => result.current.onDocumentChange(manuscript('Keep my original version.', 'letter-block')))
        remote = storyScene({ ...initial(), revision: 2, document: manuscript('New account version.', 'letter-block') })
        await act(async () => { expect(await result.current.flush()).toBe(false); await result.current.compareConflict() })
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota') })
        act(() => { expect(result.current.resolveConflict('server')).toBe(false) })
        expect(result.current.retentionFailed).toBe(true)
        expect(result.current.conflictReview).not.toBeNull()
        expect(result.current.body).toBe('Keep my original version.')
        expect(result.current.retainedDrafts).toEqual([])
    })

    it('rejects stale review choices after new typing or another reviewed source', async () => {
        const { result } = mount()
        act(() => result.current.onDocumentChange(manuscript('Working draft.', 'letter-block')))
        remote = storyScene({ ...initial(), revision: 2 })
        await act(async () => { await result.current.flush(); await result.current.compareConflict() })
        const oldResolve = result.current.resolveConflict
        act(() => result.current.onDocumentChange(manuscript('Newer typing while reviewing.', 'letter-block')))
        act(() => { expect(oldResolve('server')).toBe(false) })
        expect(result.current.reviewStale).toBe(true)
        await act(async () => { await result.current.compareConflict() })
        act(() => { expect(oldResolve('server')).toBe(false) })
        expect(result.current.body).toBe('Newer typing while reviewing.')
        expect(result.current.retainedDrafts).toEqual([])
    })

    it('loads the actual immutable base for an older recovered draft instead of guessing from the latest account text', async () => {
        const key = draftJournalKey(userHash, workspace.workspaceId, 'novel', 'scene')!
        writeCheckpoint(key, { schema: 2, title: 'The letter', document: manuscript('Recovered device prose.', 'letter-block'), baseRevision: 1, baseMetadataRevision: 1, sequence: 4, pending: null })
        remote = storyScene({ ...initial(), revision: 3, document: manuscript('Latest saved account prose.', 'letter-block') })
        const { result } = mount(remote)
        act(() => result.current.resumeRecovery())
        await act(async () => { await result.current.flush(); await result.current.compareConflict() })
        expect(getStoryRevision).toHaveBeenCalledWith('novel', 'scene', 1)
        expect(result.current.conflictReview!.baseDocument).toEqual(base)
        expect(result.current.conflictReview!.account.revision).toBe(3)
    })

    it('requires review when both titles changed, while preserving Unicode title fidelity', async () => {
        const { result } = mount(); disconnect()
        act(() => result.current.setTitle('🦋'.repeat(255)))
        remote = storyScene({ ...remote, title: 'Account title', metadataRevision: 2 })
        await reconnect()
        expect(result.current.saveState).toBe('conflict'); expect(updateStoryScene).not.toHaveBeenCalled()
        await act(async () => { await result.current.compareConflict() })
        act(() => { expect(result.current.resolveConflict('local')).toBe(true) })
        await act(async () => { expect(await result.current.flush()).toBe(true) })
        expect(updateStoryScene).toHaveBeenCalledWith('novel', 'scene', expect.objectContaining({ expectedMetadataRevision: 2, title: '🦋'.repeat(255) }))
    })
})
