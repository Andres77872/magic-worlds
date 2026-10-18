import { manuscript, storyScene } from '@/test/fixtures/story'
import { documentText } from '@/shared/storyDocument'
import { applyStoryAnchorEdits } from '@/shared/storyAnchorEdits'
import { act, renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StoryScene, StorySceneWrite, StoryVariantSnapshot } from '@/shared'
import nativeVariants from '@/test/fixtures/storyVariantsNative.json'
const updateStoryScene = vi.fn()
const acceptStoryGeneration = vi.fn()
const openLoginModal = vi.fn()
let authenticated = true
let userHash = 'author-one'
vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: authenticated, userHash, openLoginModal }),
    useData: () => ({ updateStoryScene, acceptStoryGeneration }),
}))
import { ApiError } from '@/infrastructure/api'
import { TEST_WORKSPACE_ID, WorkspaceTestProvider, createWorkspaceTestState, testWorkspace } from '@/shared/hooks/testing/workspaceTestUtils'
import { draftJournalKey, readCheckpoint } from '../persistence/draftJournal'
import { useSceneDraft } from './useSceneDraft'
import type { StoryWorkspace } from './useStoryWorkspace'
const CURRENT: StoryWorkspace = { workspaceId: TEST_WORKSPACE_ID, isCurrent: () => true, detachedApi: () => null }
const scene = (patch: Partial<StoryScene> = {}):StoryScene => storyScene({id:'ch1',storyId:'s1',title:'Scene 1',document:manuscript('The gate held.'),...patch})
const acknowledgement = (write: StorySceneWrite) => scene({
    ...write, revision: write.expectedRevision ? write.expectedRevision + 1 : 1,
    metadataRevision: write.expectedMetadataRevision ? write.expectedMetadataRevision + 1 : 1,
})
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r }); return { promise, resolve } }
function mount(workspace = CURRENT) { return renderHook(() => useSceneDraft({ storyId: 's1', scene: scene(), workspace })) }
function authoredVersion():StoryVariantSnapshot {
    const value=structuredClone(nativeVariants.preview) as StoryVariantSnapshot
    value.storyId='s1';value.parent.parent.storyId='s1';value.parent.parent.sceneId='ch1';value.parent.parent.chapterId='chapter1'
    value.parent.parent.baseRevision=1;value.operation.sceneId='ch1';value.operation.expectedRevision=1
    value.baseDocument=scene().document;value.operation.document=manuscript('Authored The gate held.')
    value.operation.anchorEdits=[{from:0,to:0,text:'Authored '}]
    return value
}
beforeEach(() => {
    vi.clearAllMocks(); vi.useFakeTimers(); window.localStorage.clear(); authenticated = true; userHash = 'author-one'
    updateStoryScene.mockImplementation(async (_s, _c, write) => acknowledgement(write))
    acceptStoryGeneration.mockImplementation(async (_s, _g, write) => acknowledgement(write))
})
afterEach(() => { vi.useRealTimers() })

describe('revision-owned scene save queue', () => {
    it('retains the exact authored version through a lost acknowledgement, remount and later typing',async()=>{
        const version=authoredVersion(),generationId=version.parent.parent.id
        acceptStoryGeneration.mockRejectedValueOnce(new Error('Reply lost'))
        const first=mount()
        act(()=>first.result.current.onDocumentChange(version.operation.document))
        await act(async()=>{expect(await first.result.current.acceptGeneration(generationId,version)).toBe(false)})
        const original=structuredClone(acceptStoryGeneration.mock.calls[0][2])
        expect(original.variant).toEqual({id:version.id,variantHash:version.variantHash})
        expect(original.anchorEdits).toEqual(version.operation.anchorEdits)
        act(()=>first.result.current.onDocumentChange(manuscript('Later author writing.')))
        // Keep the failed immutable request during unmount's save attempt too.
        acceptStoryGeneration.mockRejectedValueOnce(new Error('Still disconnected'))
        await act(async()=>{first.unmount();await Promise.resolve()})
        const recovered=mount()
        expect(recovered.result.current.recovery?.pending?.variant).toEqual(original.variant)
        act(()=>recovered.result.current.resumeRecovery())
        await act(async()=>{expect(await recovered.result.current.flush()).toBe(true)})
        expect(acceptStoryGeneration.mock.calls[2][2]).toEqual(original)
        expect(updateStoryScene).toHaveBeenCalledExactlyOnceWith('s1','ch1',expect.objectContaining({expectedRevision:2,document:manuscript('Later author writing.')}))
    })
    it.each([null,[]])('preserves the authored %j mapping rather than replacing it with the editor replacement trace',async(anchorEdits)=>{
        const version=authoredVersion()
        version.operation.document=version.baseDocument;version.operation.anchorEdits=anchorEdits
        const {result}=mount()
        await act(async()=>{expect(await result.current.acceptGeneration(version.parent.parent.id,version)).toBe(true)})
        const sent=acceptStoryGeneration.mock.calls[0][2]
        if(anchorEdits===null)expect(sent).not.toHaveProperty('anchorEdits')
        else expect(sent.anchorEdits).toEqual([])
        expect(sent.document).toEqual(version.operation.document)
        expect(updateStoryScene).not.toHaveBeenCalled()
    })
    it.each(['document','base','scene','revision','parent'])('blocks a changed authored %s without dispatch or ordinary-save fallback',async(change)=>{
        const version=authoredVersion(),{result}=mount()
        act(()=>{result.current.setSuspended(true);result.current.onDocumentChange(version.operation.document)})
        if(change==='document')act(()=>result.current.onDocumentChange(manuscript('Unreviewed writing.')))
        if(change==='base')version.baseDocument=manuscript('Another base.')
        if(change==='scene')version.operation.sceneId='foreign'
        if(change==='revision'){version.operation.expectedRevision=2;version.parent.parent.baseRevision=2}
        await act(async()=>{expect(await result.current.acceptGeneration(change==='parent'?'foreign-parent':version.parent.parent.id,version)).toBe(false)})
        expect(acceptStoryGeneration).not.toHaveBeenCalled();expect(updateStoryScene).not.toHaveBeenCalled()
    })
    it('retains a definitely rejected authored operation separately through recovery and later typing',async()=>{
        const version=authoredVersion(),generationId=version.parent.parent.id
        acceptStoryGeneration.mockRejectedValueOnce(new ApiError(409,'STORY_VARIANT_DECISION_CHANGED',{code:'STORY_VARIANT_DECISION_CHANGED'}))
        const first=mount()
        act(()=>first.result.current.onDocumentChange(version.operation.document))
        await act(async()=>{expect(await first.result.current.acceptGeneration(generationId,version)).toBe(false)})
        expect(first.result.current.applicationRejection).toMatchObject({reason:'candidate_changed',generationId,
            variant:{id:version.id,variantHash:version.variantHash},write:{document:version.operation.document,anchorEdits:version.operation.anchorEdits}})
        act(()=>first.result.current.onDocumentChange(manuscript('Later private writing.')))
        act(()=>first.unmount())
        const recovered=mount()
        expect(recovered.result.current.recovery?.applicationRejection?.variant).toEqual({id:version.id,variantHash:version.variantHash})
        act(()=>recovered.result.current.resumeRecovery())
        await act(async()=>{vi.advanceTimersByTime(15000);expect(await recovered.result.current.flush()).toBe(false)})
        expect(recovered.result.current.body).toBe('Later private writing.')
        expect(updateStoryScene).not.toHaveBeenCalled()
    })
    it('keeps the original uncertain application after a later permission error, rather than declaring it unapplied',async()=>{
        acceptStoryGeneration.mockRejectedValueOnce(new Error('Lost reply')).mockRejectedValueOnce(new ApiError(403,'Access changed',{code:'WORKSPACE_FORBIDDEN'}))
        const {result}=mount()
        act(()=>result.current.onDocumentChange(manuscript('Reviewed application.')))
        await act(async()=>{expect(await result.current.acceptGeneration('generation-1')).toBe(false)})
        const original=acceptStoryGeneration.mock.calls[0][2]
        await act(async()=>{expect(await result.current.flush()).toBe(false)})
        expect(result.current.applicationRejection).toBeNull()
        act(()=>result.current.onDocumentChange(manuscript('Later typing.')))
        await act(async()=>{vi.advanceTimersByTime(15000)})
        expect(acceptStoryGeneration).toHaveBeenCalledTimes(2)
        expect(updateStoryScene).not.toHaveBeenCalled()
        await act(async()=>{expect(await result.current.flush()).toBe(true)})
        expect(acceptStoryGeneration.mock.calls[1][2]).toEqual(original)
        expect(acceptStoryGeneration.mock.calls[2][2]).toEqual(original)
        expect(updateStoryScene).toHaveBeenCalledExactlyOnceWith('s1','ch1',expect.objectContaining({document:manuscript('Later typing.'),expectedRevision:2}))
    })
    it('does not dispatch an application until its exact request is durably journaled',async()=>{
        const {result}=mount()
        act(()=>result.current.onDocumentChange(manuscript('Reviewed application.')))
        const blocked=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('Quota')})
        await act(async()=>{expect(await result.current.acceptGeneration('generation-1')).toBe(false)})
        expect(acceptStoryGeneration).not.toHaveBeenCalled()
        expect(result.current.storageFailed).toBe(true)
        expect(result.current.applicationRejection).toBeNull()
        blocked.mockRestore()
        await act(async()=>{expect(await result.current.flush()).toBe(true)})
        expect(acceptStoryGeneration).toHaveBeenCalledOnce()
        expect(updateStoryScene).not.toHaveBeenCalled()
    })
    it.each([['STORY_ASSISTANT_SOURCE_CHANGED','sources_changed'],['STORY_REVISION_CONFLICT','writing_changed'],['STORY_PROPOSAL_CONFLICT','candidate_changed']])('keeps a definite %s application failure out of normal saves and preserves later typing',async(code,reason)=>{
        acceptStoryGeneration.mockRejectedValueOnce(new ApiError(409,code,{code}))
        const {result,unmount}=mount()
        act(()=>result.current.onDocumentChange(manuscript('The proposed passage.')))
        await act(async()=>{expect(await result.current.acceptGeneration('generation-1')).toBe(false)})
        const {sceneId:sentScene,...write}=acceptStoryGeneration.mock.calls[0][2]
        expect(sentScene).toBe('ch1')
        expect(result.current.applicationRejection).toEqual({reason,generationId:'generation-1',write})
        act(()=>result.current.onDocumentChange(manuscript('Later author writing.')))
        await act(async()=>{vi.advanceTimersByTime(15000);expect(await result.current.flush()).toBe(false)})
        expect(updateStoryScene).not.toHaveBeenCalled()
        expect(result.current.body).toBe('Later author writing.')
        act(()=>unmount())
        const recovered=mount()
        expect(recovered.result.current.recovery?.applicationRejection).toEqual({reason,generationId:'generation-1',write})
        act(()=>recovered.result.current.resumeRecovery())
        await act(async()=>{expect(await recovered.result.current.flush()).toBe(false)})
        expect(recovered.result.current.applicationRejection?.generationId).toBe('generation-1')
        expect(updateStoryScene).not.toHaveBeenCalled()
    })
    it('sends immutable exact edit traces and rebases only the unsent tail after acknowledgement',async()=>{
        const first=deferred<StoryScene>();updateStoryScene.mockReturnValueOnce(first.promise)
        const {result}=mount()
        act(()=>result.current.onDocumentChange(manuscript('Old The gate held.'),[{from:0,to:0,text:'Old '}]))
        let pending!:Promise<boolean>;act(()=>{pending=result.current.flush()})
        await act(async()=>{await Promise.resolve()})
        const sent=updateStoryScene.mock.calls[0][2] as StorySceneWrite
        act(()=>result.current.onDocumentChange(manuscript('New Old The gate held.'),[{from:0,to:0,text:'New '}]))
        expect(sent.anchorEdits).toEqual([{from:0,to:0,text:'Old '}])
        await act(async()=>{first.resolve(scene({document:manuscript('Old The gate held.'),revision:2}));expect(await pending).toBe(true)})
        const next=updateStoryScene.mock.calls[1][2] as StorySceneWrite
        expect(next.anchorEdits).toEqual([{from:0,to:0,text:'New '}]);expect(next.expectedRevision).toBe(2)
        expect(applyStoryAnchorEdits('Old The gate held.',next.anchorEdits)).toBe('New Old The gate held.')
    })
    it('includes an acceptance trace in the same immutable generation application and retry',async()=>{
        acceptStoryGeneration.mockRejectedValueOnce(new Error('Response lost'))
        const {result}=mount()
        act(()=>result.current.onDocumentChange(manuscript('Accepted The gate held.'),[{from:0,to:0,text:'Accepted '}]))
        await act(async()=>{expect(await result.current.acceptGeneration('gen-1')).toBe(false)})
        const sent=acceptStoryGeneration.mock.calls[0][2]
        expect(sent.anchorEdits).toEqual([{from:0,to:0,text:'Accepted '}])
        await act(async()=>{expect(await result.current.flush()).toBe(true)})
        expect(acceptStoryGeneration.mock.calls[1][2]).toEqual(sent)
    })
    it('falls back to explicit orphan handling when an editor trace cannot prove the submitted prose',async()=>{
        const {result}=mount()
        act(()=>result.current.onDocumentChange(manuscript('Keep this whole new passage.'),[{from:0,to:0,text:'Forged mapping'}]))
        await act(async()=>{expect(await result.current.flush()).toBe(true)})
        expect(updateStoryScene.mock.calls[0][2].anchorEdits).toBeUndefined()
        expect(documentText(updateStoryScene.mock.calls[0][2].document)).toBe('Keep this whole new passage.')
    })
    it('keeps the editor blocked while a durable restore is unresolved and adopts a fresh confirmed head', async () => {
        const {result,rerender}=renderHook(({c,blocked})=>useSceneDraft({storyId:'s1',scene:c,workspace:CURRENT,blocked}),{initialProps:{c:scene(),blocked:true}})
        act(()=>result.current.onDocumentChange(manuscript('Blocked typing')))
        expect(result.current.body).toBe('The gate held.')
        await act(async()=>{vi.advanceTimersByTime(2000)})
        expect(updateStoryScene).not.toHaveBeenCalled()
        rerender({c:scene({document:manuscript('Confirmed restored text'),revision:2}),blocked:false})
        expect(result.current.body).toBe('Confirmed restored text')
        act(()=>result.current.onDocumentChange(manuscript('New writing after restore')))
        await act(async()=>{await result.current.flush()})
        expect(updateStoryScene).toHaveBeenLastCalledWith('s1','ch1',expect.objectContaining({expectedRevision:2}))
    })
    it('coalesces rapid edits into one debounced snapshot', async () => {
        const { result } = mount()
        act(() => result.current.onDocumentChange(manuscript('One')))
        await act(async () => { vi.advanceTimersByTime(800) })
        act(() => result.current.onDocumentChange(manuscript('Two')))
        await act(async () => { vi.advanceTimersByTime(1200) })
        expect(updateStoryScene).toHaveBeenCalledTimes(1)
        expect(updateStoryScene).toHaveBeenCalledWith('s1', 'ch1', { document: manuscript('Two'), expectedRevision: 1, requestId: expect.any(String) })
        expect(result.current.saveState).toBe('saved')
    })
    it('serializes manual/autosave overlap and acknowledges only the sent snapshot', async () => {
        const first = deferred<StoryScene>()
        updateStoryScene.mockReturnValueOnce(first.promise)
        const { result } = mount()
        act(() => result.current.onDocumentChange(manuscript('First')))
        let save!: Promise<boolean>
        act(() => { save = result.current.saveNow() })
        await act(async () => { await Promise.resolve() })
        act(() => result.current.onDocumentChange(manuscript('Latest')))
        let second!: Promise<boolean>
        act(() => { second = result.current.saveNow() })
        await act(async () => { vi.advanceTimersByTime(1200) })
        expect(updateStoryScene).toHaveBeenCalledTimes(1)
        expect(result.current.saveState).not.toBe('saved')
        await act(async () => { first.resolve(scene({ document: manuscript('First'), revision: 2 })); await save; await second })
        expect(updateStoryScene).toHaveBeenCalledTimes(2)
        expect(updateStoryScene).toHaveBeenLastCalledWith('s1', 'ch1', expect.objectContaining({ document: manuscript('Latest'), expectedRevision: 2 }))
        expect(result.current.body).toBe('Latest'); expect(result.current.saveState).toBe('saved')
    })
    it('retries an uncertain write with its original request identity before newer prose', async () => {
        updateStoryScene.mockRejectedValueOnce(new Error('Response lost'))
        const { result } = mount()
        act(() => result.current.onDocumentChange(manuscript('First')))
        await act(async () => { expect(await result.current.flush()).toBe(false) })
        const sent = updateStoryScene.mock.calls[0][2]
        act(() => result.current.onDocumentChange(manuscript('Latest')))
        await act(async () => { expect(await result.current.flush()).toBe(true) })
        expect(updateStoryScene.mock.calls[1][2]).toEqual(sent)
        expect(updateStoryScene.mock.calls[2][2]).toEqual(expect.objectContaining({ document: manuscript('Latest'), expectedRevision: 2 }))
    })
    it('does not retry a conflict automatically or discard local text', async () => {
        updateStoryScene.mockRejectedValueOnce(new ApiError(409, 'STORY_REVISION_CONFLICT'))
        const { result } = mount()
        act(() => result.current.onDocumentChange(manuscript('Retain this')))
        await act(async () => { expect(await result.current.flush()).toBe(false) })
        expect(result.current.saveState).toBe('conflict')
        await act(async () => { vi.advanceTimersByTime(15000) })
        expect(updateStoryScene).toHaveBeenCalledTimes(1)
        expect(result.current.body).toBe('Retain this')
    })
    it('reconciles trimmed titles and preserves prose when the title is invalid', async () => {
        const { result } = mount()
        act(() => result.current.setTitle('  New title  '))
        await act(async () => { expect(await result.current.flush()).toBe(true) })
        expect(result.current.title).toBe('New title')
        expect(updateStoryScene).toHaveBeenLastCalledWith('s1', 'ch1', expect.objectContaining({ title: 'New title', expectedMetadataRevision: 1 }))
        act(() => { result.current.setTitle(' '); result.current.onDocumentChange(manuscript('Prose survives')) })
        await act(async () => { expect(await result.current.flush()).toBe(false) })
        expect(result.current.titleError).toBe('blank')
        expect(updateStoryScene).toHaveBeenLastCalledWith('s1', 'ch1', expect.objectContaining({ document: manuscript('Prose survives'), expectedRevision: 1 }))
        expect(result.current.saveState).toBe('error')
    })
    it('atomically commits accepted prose and retains the exact application on network failure', async () => {
        acceptStoryGeneration.mockRejectedValueOnce(new Error('Offline'))
        const { result } = mount()
        act(() => result.current.onDocumentChange(manuscript('Accepted prose')))
        await act(async () => { expect(await result.current.acceptGeneration('gen-1')).toBe(false) })
        const commit = acceptStoryGeneration.mock.calls[0][2]
        expect(updateStoryScene).not.toHaveBeenCalled()
        await act(async () => { expect(await result.current.flush()).toBe(true) })
        expect(acceptStoryGeneration).toHaveBeenLastCalledWith('s1', 'gen-1', commit)
        expect(result.current.saveState).toBe('saved')
    })
    it('does not clobber drafts on a same-scene refetch', () => {
        const { result, rerender } = renderHook(({ c }) => useSceneDraft({ storyId: 's1', scene: c, workspace: CURRENT }), { initialProps: { c: scene() } })
        act(() => result.current.onDocumentChange(manuscript('Working')))
        rerender({ c: scene({ document: manuscript('Stale fetch') }) })
        expect(result.current.body).toBe('Working')
    })
    it('suspends autosave during review while explicit flush remains available', async () => {
        const { result } = mount()
        act(() => { result.current.setSuspended(true); result.current.onDocumentChange(manuscript('Working')) })
        await act(async () => { vi.advanceTimersByTime(5000) })
        expect(updateStoryScene).not.toHaveBeenCalled()
        await act(async () => { expect(await result.current.flush()).toBe(true) })
    })
})
describe('device recovery and scope', () => {
    it('retains the whole trace and original uncertain prefix across reload recovery',async()=>{
        updateStoryScene.mockRejectedValue(new Error('Offline'))
        const first=mount()
        act(()=>first.result.current.onDocumentChange(manuscript('Old The gate held.'),[{from:0,to:0,text:'Old '}]))
        await act(async()=>{expect(await first.result.current.flush()).toBe(false)})
        const sent=updateStoryScene.mock.calls[0][2]
        act(()=>first.result.current.onDocumentChange(manuscript('New Old The gate held.'),[{from:0,to:0,text:'New '}]))
        await act(async()=>{vi.advanceTimersByTime(150);first.unmount()})
        const next=mount()
        expect(next.result.current.recovery!.anchorEdits).toEqual([{from:0,to:0,text:'Old '},{from:0,to:0,text:'New '}])
        act(()=>next.result.current.resumeRecovery())
        updateStoryScene.mockImplementation(async(_s,_c,write)=>acknowledgement(write));updateStoryScene.mockClear()
        await act(async()=>{expect(await next.result.current.flush()).toBe(true)})
        expect(updateStoryScene.mock.calls[0][2]).toEqual(sent)
        expect(updateStoryScene.mock.calls[1][2].anchorEdits).toEqual([{from:0,to:0,text:'New '}])
    })
    it('reopens an unsynced checkpoint for an explicit recovery decision', async () => {
        updateStoryScene.mockRejectedValue(new Error('Offline'))
        const first = mount()
        act(() => first.result.current.onDocumentChange(manuscript('Recover me')))
        await act(async () => { vi.advanceTimersByTime(150) })
        expect(first.result.current.localSaved).toBe(true)
        await act(async () => first.unmount())
        const next = mount()
        expect(documentText(next.result.current.recovery!.document)).toBe('Recover me')
        expect(next.result.current.body).toBe('The gate held.')
        act(() => next.result.current.resumeRecovery())
        expect(next.result.current.body).toBe('Recover me')
    })
    it('does not expose another account checkpoint or save it as that account', async () => {
        const { result, rerender } = mount()
        act(() => result.current.onDocumentChange(manuscript('Private prose')))
        await act(async () => { vi.advanceTimersByTime(150) })
        userHash = 'author-two'; rerender()
        expect(result.current.recovery).toBeNull()
        expect(result.current.body).toBe('The gate held.')
        expect(updateStoryScene).not.toHaveBeenCalled()
    })
    it('keeps the draft accessible after auth expiry and does not send it', async () => {
        const { result, rerender } = mount()
        act(() => result.current.onDocumentChange(manuscript('Still writing')))
        authenticated = false; rerender()
        await act(async () => { expect(await result.current.flush()).toBe(false) })
        expect(result.current.body).toBe('Still writing'); expect(openLoginModal).toHaveBeenCalled()
        expect(updateStoryScene).not.toHaveBeenCalled()
    })
    it('sends an unmount tail only to the original workspace', async () => {
        let current = true
        const detached = vi.fn(async (_s, _c, write) => acknowledgement(write))
        const workspace: StoryWorkspace = { workspaceId: TEST_WORKSPACE_ID, isCurrent: () => current,
            detachedApi: () => ({ updateStoryScene: detached }) as never }
        const { result, unmount } = mount(workspace)
        act(() => result.current.onDocumentChange(manuscript('Original workspace text')))
        current = false
        await act(async () => unmount())
        expect(updateStoryScene).not.toHaveBeenCalled()
        expect(detached).toHaveBeenCalledWith('s1', 'ch1', expect.objectContaining({ document: manuscript('Original workspace text') }))
    })
    it('reports storage failure without losing the in-memory draft', async () => {
        const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota') })
        const { result } = mount()
        act(() => result.current.onDocumentChange(manuscript('Retain in memory')))
        await act(async () => { vi.advanceTimersByTime(150) })
        expect(result.current.storageFailed).toBe(true); expect(result.current.body).toBe('Retain in memory')
        storage.mockRestore()
    })
    it('clears a checkpoint only after its exact head is acknowledged', async () => {
        const { result } = mount()
        act(() => result.current.onDocumentChange(manuscript('Unsynced')))
        await act(async () => { vi.advanceTimersByTime(150) })
        const key = draftJournalKey(userHash, TEST_WORKSPACE_ID, 's1', 'ch1')
        expect(documentText(readCheckpoint(key)!.document)).toBe('Unsynced')
        await act(async () => { await result.current.flush() })
        expect(readCheckpoint(key)).toBeNull()
    })
    it('archived workspaces remain readable and never write', async () => {
        const state = createWorkspaceTestState({ workspaces: [testWorkspace(TEST_WORKSPACE_ID, 'Archived', { archived_at: '2026-10-10T00:00:00Z' })] })
        const wrapper = ({ children }: { children: ReactNode }) => createElement(WorkspaceTestProvider, { state, children })
        const { result } = renderHook(() => useSceneDraft({ storyId: 's1', scene: scene(), workspace: CURRENT }), { wrapper })
        act(() => result.current.onDocumentChange(manuscript('Ignored')))
        await act(async () => { expect(await result.current.saveNow()).toBe(false); expect(await result.current.flush()).toBe(true) })
        expect(result.current.body).toBe('The gate held.'); expect(updateStoryScene).not.toHaveBeenCalled()
    })
})
