import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { AssistantConversation, AssistantStreamEvent, AssistantTurnResponse } from '@/shared/types/assistant.types'
import type { StoryStudioIndex } from '@/shared/types/storyStudio.types'
import type { NovelAssistantTurnPreview } from '@/shared/types/storyAssistant.types'
import wire from '@/test/fixtures/novelAssistantTurn.json'
import refined from '@/test/fixtures/novelAssistantRefinement.json'
import type {NovelRefinementContext,NovelAssistantRecord} from '@/shared/types/storyAssistant.types'
import { assistantTurnFixture } from '@/test/assistantFixtures'
import { authorVariantFixture } from '@/test/fixtures/authorVariants'
import type {NovelRefinementSource} from '@/shared/types/storyAssistant.types'
import { listAssistantDrafts } from '../persistence/assistantDraftJournal'
import type { NovelAssistantSource } from './useNovelAssistantSource'

const mocks = vi.hoisted(() => ({
    auth: { userHash: 'novel-assistant-author', isAuthenticated: true },
    createAssistantConversation: vi.fn(), listAssistantConversations: vi.fn(), getAssistantConversation: vi.fn(),
    getAssistantTurn: vi.fn(), deleteAssistantConversation: vi.fn(), streamAssistantMessage: vi.fn(), withWorkspace: vi.fn(),
}))
vi.mock('@/app/hooks', () => ({ useAuth: () => mocks.auth }))
vi.mock('@/app/hooks/useWorkspace', () => ({ useWorkspace: () => ({ selectedWorkspaceId: 'workspace' }) }))
vi.mock('@/infrastructure/api', async importOriginal => {
    const actual = await importOriginal<typeof import('@/infrastructure/api')>()
    return { ...actual, apiService: mocks }
})
import { ApiError } from '@/infrastructure/api'
import { useNovelAssistant } from './useNovelAssistant'

const index = wire.index as unknown as StoryStudioIndex
const original = wire.preview as unknown as NovelAssistantTurnPreview
const question = original.context.request.message
const conversation = (version = 0): AssistantConversation => ({ kind: 'novel', story_id: index.id, conversation_id: 7, title: 'The letter', conversation_version: version, active_request_id: null })
const detail = (version = 0) => ({ conversation: conversation(version), messages: [], target: index, target_cas: { revision: original.context.sourceVersion, content_hash: original.context.sourceVersion } })

function fixture(initialOpen=true) {
    let owned = true
    const preview = vi.fn<NovelAssistantSource['preview']>(async () => structuredClone(original))
    const getTurn = vi.fn<NovelAssistantSource['getTurn']>(async () => null)
    const turnState = vi.fn<NovelAssistantSource['turnState']>(async (id, requestId, signal) => {
        const result = await getTurn(id, requestId, signal)
        return result ? { status: 'completed', request_id: requestId, recovery_required: false, turn: result } : { status: 'running', request_id: requestId, execution_id: '00000000-0000-4000-8000-000000000001', recovery_required: true }
    })
    const stopTurn = vi.fn<NovelAssistantSource['stopTurn']>()
    const source: NovelAssistantSource = { key: 'author/workspace/book', storyId: index.id, isCurrent: () => owned,
        prepare: vi.fn(), preview, getTurn, turnState, stopTurn, generation: vi.fn(), stash: vi.fn(), sceneDocument: vi.fn(), acceptTogether: vi.fn(), recoverTogether: vi.fn(), undoTogether: vi.fn(), refinement: vi.fn(), refinementForGeneration:vi.fn(), refinementForVariant:vi.fn(), readRefinementSource:vi.fn(), reviewCandidate: vi.fn() }
    const workspace = { workspaceId: 'workspace', isCurrent: () => owned, detachedApi: () => null }
    const view = renderHook(({ open,readOnly }) => useNovelAssistant({ open, source, workspace, story: index, anchorSceneId: original.context.request.anchorSceneId,
        selection: null, readOnly, onAuthRequired: () => {} }), { initialProps: { open: initialOpen,readOnly:false } })
    const seed = () => act(() => {
        const { limits, message, sourceVersion, ...settings } = original.context.request
        void sourceVersion
        view.result.current.save({ title: 'The letter', message, settings: { ...settings, limits: Object.fromEntries(Object.entries(limits).map(([key, value]) => [key, String(value)])) as typeof view.result.current.draft.settings.limits } })
    })
    return { ...view, source,preview, getTurn, turnState, stopTurn, seed, retire: () => { owned = false } }
}
beforeEach(() => {
    vi.resetAllMocks(); localStorage.clear()
    mocks.withWorkspace.mockReturnValue(mocks)
    mocks.listAssistantConversations.mockResolvedValue({ conversations: [] })
    mocks.getAssistantConversation.mockResolvedValue(detail())
    mocks.createAssistantConversation.mockResolvedValue(detail())
    mocks.getAssistantTurn.mockResolvedValue(null)
    mocks.streamAssistantMessage.mockResolvedValue(undefined)
})

/** Opaque references stand in for the server's checked digest in this hook test. */
function authoredSource():NovelRefinementSource {
    const parent=structuredClone(refined.parent) as unknown as NovelRefinementContext,snapshot=authorVariantFixture().snapshot
    return {...parent,variant:{...snapshot,storyId:parent.parent.storyId,parent,
        operation:{...snapshot.operation,sceneId:parent.parent.sceneId,expectedRevision:parent.parent.baseRevision}}}
}

it('stages the exact authored source without replacing unsent text or executing, then dispatches only its full identity',async()=>{
    const f=fixture(false);f.seed();const value=authoredSource(),record=authorVariantFixture().record
    vi.mocked(f.source.refinementForVariant).mockResolvedValue({refinement:value,selection:null})
    await act(async()=>{expect(await f.result.current.refineVariant(record,new AbortController().signal)).toBe(true)})
    expect(f.result.current.draft).toMatchObject({message:question,refinement:value,settings:{task:'suggest',scope:'scene',selection:null}})
    expect(mocks.streamAssistantMessage).not.toHaveBeenCalled()
    f.rerender({open:true,readOnly:false})
    await waitFor(()=>expect(f.result.current.assistant.ready).toBe(true))
    act(()=>f.result.current.save({message:refined.preview.context.request.message}))
    f.preview.mockResolvedValue({...structuredClone(refined.preview) as unknown as NovelAssistantTurnPreview,refinement:value})
    await act(async()=>{await f.result.current.prepare()})
    expect(f.result.current.reviewCurrent).toBe(true)
    expect(f.result.current.reviewSent).toBe(false)
    await act(async()=>{await f.result.current.sendReviewed()})
    // Once sent, the prepared review is that turn's, so the drawer stops asking to prepare it again.
    expect(f.result.current.reviewSent).toBe(true)
    const reference=mocks.streamAssistantMessage.mock.calls[0][1].refinement
    expect(reference).toEqual({generationId:value.parent.id,parentHash:value.parentHash,
        variant:'variant'in value?{id:value.variant.id,variantHash:value.variant.variantHash}:undefined})
    const retained=listAssistantDrafts({userHash:mocks.auth.userHash,workspaceId:'workspace'})[0].write
    expect(retained.refinement).toEqual(value)
    expect(retained.pending?.body.refinement).toEqual(reference)
})

it('keeps an authored source in memory and blocks handoff or dispatch when it cannot be retained',async()=>{
    const f=fixture(false);f.seed();const value=authoredSource()
    vi.mocked(f.source.refinementForVariant).mockResolvedValue({refinement:value,selection:null})
    const storage=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('Quota')})
    try{
        await act(async()=>{expect(await f.result.current.refineVariant(authorVariantFixture().record,new AbortController().signal)).toBe(false)})
        expect(f.result.current.record.storageFailed).toBe(true)
        expect(f.result.current.draft.refinement).toEqual(value)
        expect(f.result.current.draft.message).toBe(question)
        await act(async()=>{await f.result.current.prepare()})
        expect(mocks.createAssistantConversation).not.toHaveBeenCalled()
        expect(mocks.streamAssistantMessage).not.toHaveBeenCalled()
        act(()=>expect(f.result.current.preserve()).toBe(false))
    }finally{storage.mockRestore()}
    act(()=>expect(f.result.current.preserve()).toBe(true))
    expect(listAssistantDrafts({userHash:mocks.auth.userHash,workspaceId:'workspace'})[0].write.refinement).toEqual(value)
})

it('retains an uncertain exact request but sends nothing when its dispatch checkpoint fails',async()=>{
    const f=fixture();f.seed();await waitFor(()=>expect(f.result.current.assistant.ready).toBe(true))
    await act(async()=>{await f.result.current.prepare()})
    const storage=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('Quota')})
    try{
        await act(async()=>{await f.result.current.sendReviewed()})
        expect(f.result.current.record.storageFailed).toBe(true)
        expect(f.result.current.draft.pending?.body.message).toBe(question)
        act(()=>f.result.current.save({message:'Later typing remains separate.'}))
        await act(async()=>{await f.result.current.resume()})
        expect(mocks.streamAssistantMessage).not.toHaveBeenCalled()
        expect(f.result.current.draft.pending?.body.message).toBe(question)
        expect(f.result.current.draft.message).toBe('Later typing remains separate.')
    }finally{storage.mockRestore()}
})

it('opens a history refinement from a closed assistant without replacing its unsent instruction or public profile choice',async()=>{
    const f=fixture(false);f.seed()
    const profile={mode:'profile' as const,profile_id:'fictional-profile'}
    act(()=>f.result.current.save({selection:profile}))
    vi.mocked(f.source.refinementForGeneration).mockResolvedValue({refinement:structuredClone(refined.parent) as unknown as NovelRefinementContext,selection:null})
    const {novelAssistantReviewFixture}=await import('@/test/fixtures/novelAssistantReview')
    const generation=novelAssistantReviewFixture().detail.generation,signal=new AbortController().signal
    await act(async()=>{expect(await f.result.current.refineGeneration(generation,signal)).toBe(true)})
    expect(f.source.refinementForGeneration).toHaveBeenCalledWith(generation,expect.any(AbortSignal),null)
    expect(f.result.current.draft).toMatchObject({message:question,selection:profile,refinement:refined.parent,
        settings:{task:'suggest',anchorSceneId:generation.sceneId,scope:'scene'}})
    expect(f.result.current.reviewCurrent).toBe(false)
    expect(mocks.createAssistantConversation).not.toHaveBeenCalled()
    expect(mocks.streamAssistantMessage).not.toHaveBeenCalled()
})

it.each(['abort','input','owner','readOnly'] as const)('keeps history handoff from changing the draft after %s changes',async change=>{
    const f=fixture(false);f.seed()
    let finish!:(value:Awaited<ReturnType<NovelAssistantSource['refinementForGeneration']>>)=>void
    vi.mocked(f.source.refinementForGeneration).mockImplementation(()=>new Promise(resolve=>{finish=resolve}))
    const {novelAssistantReviewFixture}=await import('@/test/fixtures/novelAssistantReview')
    const abort=new AbortController();let pending!:Promise<boolean>
    act(()=>{pending=f.result.current.refineGeneration(novelAssistantReviewFixture().detail.generation,abort.signal)})
    if(change==='abort')abort.abort()
    if(change==='input')act(()=>f.result.current.save({message:'My later instruction.'}))
    if(change==='owner')f.retire()
    if(change==='readOnly')f.rerender({open:false,readOnly:true})
    await act(async()=>{finish({refinement:structuredClone(refined.parent) as unknown as NovelRefinementContext,selection:null});expect(await pending).toBe(false)})
    expect(f.result.current.draft.message).toBe(change==='input'?'My later instruction.':question)
    expect(f.result.current.draft.refinement).toBeUndefined()
    expect(mocks.streamAssistantMessage).not.toHaveBeenCalled()
})

it('fences history refinement when the conversation acquires an active request during its parent read',async()=>{
    const f=fixture();f.seed()
    await waitFor(()=>expect(f.result.current.assistant.ready).toBe(true))
    await act(async()=>{await f.result.current.prepare()})
    let finish!:(value:Awaited<ReturnType<NovelAssistantSource['refinementForGeneration']>>)=>void
    vi.mocked(f.source.refinementForGeneration).mockImplementation(()=>new Promise(resolve=>{finish=resolve}))
    const {novelAssistantReviewFixture}=await import('@/test/fixtures/novelAssistantReview')
    let pending!:Promise<boolean>
    act(()=>{pending=f.result.current.refineGeneration(novelAssistantReviewFixture().detail.generation,new AbortController().signal)})
    mocks.getAssistantConversation.mockResolvedValue({...detail(),conversation:{...conversation(),active_request_id:'other-tab-request'}})
    await act(async()=>{await f.result.current.assistant.reloadConversation({currentHead:true})})
    expect(f.result.current.assistant.activeConversation?.active_request_id).toBe('other-tab-request')
    await act(async()=>{finish({refinement:structuredClone(refined.parent) as unknown as NovelRefinementContext,selection:null});expect(await pending).toBe(false)})
    expect(f.result.current.draft.refinement).toBeUndefined();expect(f.result.current.draft.message).toBe(question)
    expect(mocks.streamAssistantMessage).not.toHaveBeenCalled()
})

it('retains the unsent instruction, reviews a protected parent and freezes only its reference in the request',async()=>{
    const f=fixture();f.seed()
    await waitFor(()=>expect(f.result.current.assistant.ready).toBe(true))
    vi.mocked(f.source.refinement).mockResolvedValue(structuredClone(refined.parent) as unknown as NovelRefinementContext)
    await act(async()=>{expect(await f.result.current.refine(wire.records.suggest as unknown as NovelAssistantRecord,new AbortController().signal)).toBe(true)})
    expect(f.result.current.draft.message).toBe(question)
    expect(f.result.current.draft.refinement).toEqual(refined.parent)
    expect(f.result.current.draft.settings).toMatchObject({task:'suggest',scope:'scene',anchorSceneId:refined.parent.parent.sceneId})
    expect(mocks.streamAssistantMessage).not.toHaveBeenCalled()
    act(()=>f.result.current.save({message:refined.preview.context.request.message}))
    f.preview.mockResolvedValue(structuredClone(refined.preview) as unknown as NovelAssistantTurnPreview)
    await act(async()=>{await f.result.current.prepare()})
    expect(f.preview.mock.calls[0][4]).toEqual(refined.parent)
    expect(f.result.current.reviewCurrent).toBe(true)
    await act(async()=>{await f.result.current.sendReviewed()})
    const body=mocks.streamAssistantMessage.mock.calls[0][1]
    expect(body.refinement).toEqual({generationId:refined.parent.parent.id,parentHash:refined.parent.parentHash})
    expect('output'in body.refinement).toBe(false)
    const retained=listAssistantDrafts({userHash:mocks.auth.userHash,workspaceId:'workspace'})[0].write
    expect(retained.refinement).toEqual(refined.parent)
    expect(retained.pending?.body.refinement).toEqual(body.refinement)
})

it('fences a closed refinement read and preserves the current draft',async()=>{
    const f=fixture();f.seed()
    await waitFor(()=>expect(f.result.current.assistant.ready).toBe(true))
    let finish!:(value:NovelRefinementContext)=>void
    vi.mocked(f.source.refinement).mockImplementation(()=>new Promise(resolve=>{finish=resolve}))
    const abort=new AbortController();let pending!:Promise<boolean>
    act(()=>{pending=f.result.current.refine(wire.records.suggest as unknown as NovelAssistantRecord,abort.signal)})
    await act(async()=>{abort.abort();finish(structuredClone(refined.parent) as unknown as NovelRefinementContext);expect(await pending).toBe(false)})
    expect(f.result.current.draft.refinement).toBeUndefined()
    expect(f.result.current.draft.message).toBe(question)
    expect(f.result.current.working).toBe(false)
    expect(mocks.streamAssistantMessage).not.toHaveBeenCalled()
})

it('preserves later input when a retained-parent read finishes after the draft changes',async()=>{
    const f=fixture();f.seed()
    await waitFor(()=>expect(f.result.current.assistant.ready).toBe(true))
    let finish!:(value:NovelRefinementContext)=>void
    vi.mocked(f.source.refinement).mockImplementation(()=>new Promise(resolve=>{finish=resolve}))
    let pending!:Promise<boolean>
    act(()=>{pending=f.result.current.refine(wire.records.suggest as unknown as NovelAssistantRecord,new AbortController().signal)})
    act(()=>f.result.current.save({message:'Later writing must survive.'}))
    await act(async()=>{finish(structuredClone(refined.parent) as unknown as NovelRefinementContext);expect(await pending).toBe(false)})
    expect(f.result.current.draft.message).toBe('Later writing must survive.')
    expect(f.result.current.draft.refinement).toBeUndefined()
    expect(f.result.current.working).toBe(false)
})

it('prepares one named conversation without sending, retains its create identity on failure, and invalidates changed choices', async () => {
    const f = fixture(); f.seed()
    await waitFor(() => expect(f.result.current.assistant.ready).toBe(true))
    mocks.createAssistantConversation.mockRejectedValueOnce(new ApiError(503, 'Controlled lost creation response'))
    await act(async () => { await f.result.current.prepare() })
    const creation = f.result.current.draft.creation!
    expect(creation.title).toBe('The letter')
    expect(listAssistantDrafts({ userHash: mocks.auth.userHash, workspaceId: 'workspace' })[0].write.creation).toEqual(creation)
    expect(f.preview).not.toHaveBeenCalled()
    await act(async () => { await f.result.current.prepare() })
    expect(mocks.createAssistantConversation).toHaveBeenCalledTimes(2)
    expect(mocks.createAssistantConversation.mock.calls.map(call => call[0])).toEqual([
        { kind: 'novel', story_id: index.id, title: 'The letter', creation_request_id: creation.requestId },
        { kind: 'novel', story_id: index.id, title: 'The letter', creation_request_id: creation.requestId },
    ])
    expect(f.result.current.reviewCurrent).toBe(true)
    expect(f.result.current.draft.message).toBe(question)
    expect(mocks.streamAssistantMessage).not.toHaveBeenCalled()
    act(() => f.result.current.save({ message: 'A changed question' }))
    expect(f.result.current.reviewCurrent).toBe(false)
    await act(async () => { await f.result.current.sendReviewed() })
    expect(mocks.streamAssistantMessage).not.toHaveBeenCalled()
})

it('freezes request/profile guards before dispatch and preserves a next question typed during the reply', async () => {
    const f = fixture(); f.seed()
    await waitFor(() => expect(f.result.current.assistant.ready).toBe(true))
    await act(async () => { await f.result.current.prepare() })
    let emit!: (event: AssistantStreamEvent<'novel'>) => void, finish!: () => void
    mocks.streamAssistantMessage.mockImplementation((_id, _body, callback) => { emit = callback; return new Promise<void>(resolve => { finish = resolve }) })
    let sending!: Promise<void>
    act(() => { sending = f.result.current.sendReviewed() })
    await waitFor(() => expect(mocks.streamAssistantMessage).toHaveBeenCalledOnce())
    const pending = f.result.current.draft.pending!
    expect(pending.body.expected_prompt_hash).toBe(original.promptHash)
    expect(mocks.streamAssistantMessage.mock.calls[0][3]).toMatchObject({ requestId: pending.requestId, llm: { selection: { mode: 'inherit' }, expected_revision_id: original.profile.revision_id } })
    expect(listAssistantDrafts({ userHash: mocks.auth.userHash, workspaceId: 'workspace' })[0].write.pending).toEqual(pending)
    act(() => f.result.current.save({ message: 'My next question must survive.' }))
    const user = { message_id: 10, conversation_id: 7, sequence_no: 1, role: 'user' as const, status: 'completed' as const, content: question, metadata: { request_id: pending.requestId } }
    const reply = { message_id: 11, conversation_id: 7, sequence_no: 2, role: 'assistant' as const, status: 'completed' as const, content: 'A saved answer.', metadata: { request_id: pending.requestId } }
    await act(async () => { emit({ type: 'final', ...assistantTurnFixture('novel', pending.requestId, { conversation: conversation(1), user_message: user, assistant_message: reply, messages: [user, reply] }) }); finish(); await sending })
    expect(f.result.current.draft.pending).toBeNull()
    expect(f.result.current.draft.message).toBe('My next question must survive.')
    expect(f.result.current.reviewCurrent).toBe(false)
    expect(f.result.current.assistant.pendingTarget).toBeNull()
})

it('recovers an uncertain request after remount and resumes its original identity without sending a newly typed question', async () => {
    const f = fixture(); f.seed()
    await waitFor(() => expect(f.result.current.assistant.ready).toBe(true))
    await act(async () => { await f.result.current.prepare() })
    mocks.streamAssistantMessage.mockRejectedValue(new ApiError(503, 'Controlled disconnect'))
    await act(async () => { await f.result.current.sendReviewed() })
    const pending = f.result.current.draft.pending!
    act(() => f.result.current.save({ message: 'Unsent after the disconnect' }))
    f.unmount()
    const records = listAssistantDrafts({ userHash: mocks.auth.userHash, workspaceId: 'workspace' })
    const resumed = fixture()
    await waitFor(() => expect(resumed.result.current.assistant.ready).toBe(true))
    await act(async () => { await resumed.result.current.recover(records[0]) })
    expect(resumed.result.current.draft.pending).toEqual(pending)
    expect(resumed.result.current.draft.message).toBe('Unsent after the disconnect')
    expect(listAssistantDrafts({ userHash: mocks.auth.userHash, workspaceId: 'workspace' })).toHaveLength(2)
    await act(async () => { await resumed.result.current.resume() })
    expect(mocks.streamAssistantMessage).toHaveBeenCalledTimes(2)
    expect(mocks.streamAssistantMessage.mock.calls[1][1]).toEqual(pending.body)
    expect(mocks.streamAssistantMessage.mock.calls[1][3]).toMatchObject({ requestId: pending.requestId, llm: pending.llm })
    expect(resumed.result.current.draft.message).toBe('Unsent after the disconnect')
    const stored: AssistantTurnResponse<'novel'> = assistantTurnFixture('novel', pending.requestId, { conversation: conversation(1) })
    resumed.getTurn.mockResolvedValue(stored)
    await act(async () => { await resumed.result.current.checkResult() })
    expect(resumed.result.current.draft.pending).toBeNull()
    expect(mocks.streamAssistantMessage).toHaveBeenCalledTimes(2)
    expect(resumed.result.current.draft.message).toBe('Unsent after the disconnect')
})

it('keeps a question in memory when storage is unavailable and ignores a late preview after ownership retires', async () => {
    const f = fixture()
    const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    f.seed()
    expect(f.result.current.record.storageFailed).toBe(true)
    expect(f.result.current.draft.message).toBe(question)
    blocked.mockRestore()
    await waitFor(() => expect(f.result.current.assistant.ready).toBe(true))
    let resolve!: (value: NovelAssistantTurnPreview) => void
    f.preview.mockImplementation(() => new Promise(done => { resolve = done }))
    let pending!: Promise<void>
    act(() => { pending = f.result.current.prepare() })
    await waitFor(() => expect(f.preview).toHaveBeenCalledOnce())
    f.retire()
    await act(async () => { resolve(structuredClone(original)); await pending })
    expect(f.result.current.review).toBeNull()
    expect(mocks.streamAssistantMessage).not.toHaveBeenCalled()
})

async function uncertainTurn() {
    const f=fixture();f.seed()
    await waitFor(()=>expect(f.result.current.assistant.ready).toBe(true))
    await act(async()=>{await f.result.current.prepare()})
    mocks.streamAssistantMessage.mockRejectedValue(new ApiError(503,'Controlled disconnect'))
    await act(async()=>{await f.result.current.sendReviewed()})
    expect(f.result.current.draft.pending).not.toBeNull()
    return f
}
function stoppedState(requestId:string,change:Partial<import('@/shared/types/novelAssistantControl.types').NovelAssistantControl>={}) {
    return {status:'cancelled' as const,request_id:requestId,execution_id:'00000000-0000-4000-8000-000000000001',recovery_required:false as const,
        control:{stop_requested:true,executor_stopped:true,settlement:'pending' as const,usage:null,usage_complete:false,...change}}
}

it('persists Stop before the control request and cannot resume it after a lost reply or remount',async()=>{
    const f=await uncertainTurn(),pending=structuredClone(f.result.current.draft.pending!)
    act(()=>f.result.current.save({message:'Keep my next question'}))
    f.stopTurn.mockImplementation(async(id,requestId)=>{
        expect([id,requestId]).toEqual([pending.conversationId,pending.requestId])
        expect(listAssistantDrafts({userHash:mocks.auth.userHash,workspaceId:'workspace'})[0].write.pending?.stopRequested).toBe(true)
        throw new Error('Lost control reply')
    })
    await act(async()=>{await f.result.current.stop()})
    expect(f.result.current.draft.pending).toMatchObject({...pending,stopRequested:true})
    expect(f.result.current.draft.message).toBe('Keep my next question')
    await act(async()=>{await f.result.current.resume()})
    expect(mocks.streamAssistantMessage).toHaveBeenCalledOnce()
    f.unmount()
    const originalDraft=listAssistantDrafts({userHash:mocks.auth.userHash,workspaceId:'workspace'})[0]
    const resumed=fixture()
    await waitFor(()=>expect(resumed.result.current.assistant.ready).toBe(true))
    await act(async()=>{await resumed.result.current.recover(originalDraft)})
    resumed.stopTurn.mockResolvedValue(stoppedState(pending.requestId,{settlement:'not_used',usage_complete:true}))
    await act(async()=>{await resumed.result.current.checkResult()})
    expect(resumed.stopTurn).toHaveBeenCalledWith(pending.conversationId,pending.requestId,expect.any(AbortSignal))
    expect(resumed.turnState).not.toHaveBeenCalled()
    expect(resumed.result.current.draft.pending).toBeNull()
    expect(resumed.result.current.draft.outcome?.result.status).toBe('cancelled')
    expect(resumed.result.current.draft.message).toBe('Keep my next question')
    // The settled copy proves the original Stop finished, so every older copy holding it is retired.
    const left=listAssistantDrafts({userHash:mocks.auth.userHash,workspaceId:'workspace'})
    expect(left).toHaveLength(1)
    expect(left[0].write.id).toBe(resumed.result.current.draft.id)
    expect(mocks.streamAssistantMessage).toHaveBeenCalledOnce()
})

it('resumes the newest unsent draft after a remount instead of starting another one',async()=>{
    const f=fixture();await waitFor(()=>expect(f.result.current.assistant.ready).toBe(true))
    act(()=>f.result.current.save({title:'Kept',message:'An unsent question'}))
    f.unmount()
    const again=fixture()
    await waitFor(()=>expect(again.result.current.draft.message).toBe('An unsent question'))
    const rows=listAssistantDrafts({userHash:mocks.auth.userHash,workspaceId:'workspace'})
    expect(rows).toHaveLength(1)
    expect(rows[0].write.id).toBe(again.result.current.draft.id)
    expect(again.result.current.notice).toBe('Your unsent draft from this device is open again.')
})

it('resumes over a draft that only holds primed source settings and retires that empty draft',async()=>{
    const f=fixture();await waitFor(()=>expect(f.result.current.assistant.ready).toBe(true))
    act(()=>f.result.current.save({title:'Kept',message:'An unsent question'}))
    f.unmount()
    const again=fixture(false)
    act(()=>again.result.current.save({settings:{...again.result.current.draft.settings,includeArchived:true}}))
    expect(again.result.current.record.storageKey).toBeTruthy()
    again.rerender({open:true,readOnly:false})
    await waitFor(()=>expect(again.result.current.draft.message).toBe('An unsent question'))
    const rows=listAssistantDrafts({userHash:mocks.auth.userHash,workspaceId:'workspace'})
    expect(rows.map(row=>row.write.id)).toEqual([again.result.current.draft.id])
})

it('checks and stops a conversation active request without the device draft that sent it',async()=>{
    const requestId='novel-turn-elsewhere',active={...conversation(1),active_request_id:requestId}
    mocks.listAssistantConversations.mockResolvedValue({conversations:[active]})
    mocks.getAssistantConversation.mockResolvedValue({...detail(1),conversation:active})
    const f=fixture();await waitFor(()=>expect(f.result.current.assistant.ready).toBe(true))
    await act(async()=>{await f.result.current.selectConversation(7)})
    expect(f.result.current.assistant.activeConversation?.active_request_id).toBe(requestId)
    await act(async()=>{await f.result.current.checkActive()})
    expect(f.turnState).toHaveBeenCalledWith(7,requestId,expect.any(AbortSignal))
    expect(f.result.current.notice).toMatch(/^No completed result is available yet/)
    expect(f.result.current.draft.outcome ?? null).toBeNull()
    f.stopTurn.mockResolvedValue(stoppedState(requestId,{settlement:'not_used',usage_complete:true}))
    mocks.getAssistantConversation.mockResolvedValue(detail(2))
    await act(async()=>{await f.result.current.stopActive()})
    expect(f.stopTurn).toHaveBeenCalledWith(7,requestId,expect.any(AbortSignal))
    expect(f.result.current.draft.outcome?.result).toMatchObject({status:'cancelled',request_id:requestId})
    await waitFor(()=>expect(f.result.current.assistant.activeConversation?.active_request_id).toBeNull())
    expect(mocks.streamAssistantMessage).not.toHaveBeenCalled()
})

it('keeps a stopped request until late usage is confirmed without submitting another turn',async()=>{
    const f=await uncertainTurn(),pending=f.result.current.draft.pending!
    f.stopTurn.mockResolvedValue(stoppedState(pending.requestId))
    await act(async()=>{await f.result.current.stop()})
    expect(f.result.current.draft.pending?.terminal?.control.settlement).toBe('pending')
    expect(f.result.current.draft.pending?.body).toEqual(pending.body)
    await act(async()=>{await f.result.current.resume()})
    expect(mocks.streamAssistantMessage).toHaveBeenCalledOnce()
    f.stopTurn.mockResolvedValue(stoppedState(pending.requestId,{settlement:'used',usage:{prompt_tokens:2,completion_tokens:1,total_tokens:3},usage_complete:true}))
    await act(async()=>{await f.result.current.checkResult()})
    expect(f.result.current.draft.pending).toBeNull()
    expect(f.result.current.draft.outcome?.result).toMatchObject({control:{settlement:'used',usage_complete:true}})
    expect(f.result.current.draft.message).toBe(question)
    expect(f.stopTurn).toHaveBeenCalledTimes(2)
    expect(mocks.streamAssistantMessage).toHaveBeenCalledOnce()
})

it('retains the message when completion wins before Stop and never applies its suggestion',async()=>{
    const f=await uncertainTurn(),pending=f.result.current.draft.pending!
    const turn=assistantTurnFixture('novel',pending.requestId,{conversation:conversation(1)})
    f.stopTurn.mockResolvedValue({status:'completed',request_id:pending.requestId,recovery_required:false,turn})
    await act(async()=>{await f.result.current.stop()})
    expect(f.result.current.draft.pending).toBeNull()
    expect(f.result.current.draft.outcome?.result).toEqual({status:'completed',request_id:pending.requestId,execution_id:turn.llm_execution.execution_id})
    expect(f.result.current.draft.message).toBe(question)
    expect(f.result.current.assistant.pendingTarget).toBeNull()
    expect(f.result.current.reviewCurrent).toBe(false)
})

it('keeps failed terminal work distinct from an author Stop and checks its usage without resuming',async()=>{
    const f=await uncertainTurn(),pending=f.result.current.draft.pending!
    const state={...stoppedState(pending.requestId,{stop_requested:false}),status:'failed' as const}
    f.turnState.mockResolvedValue(state)
    await act(async()=>{await f.result.current.checkResult()})
    expect(f.result.current.draft.pending?.terminal?.status).toBe('failed')
    expect(f.result.current.draft.pending?.stopRequested).toBeUndefined()
    await act(async()=>{await f.result.current.resume()})
    expect(mocks.streamAssistantMessage).toHaveBeenCalledOnce()
    f.stopTurn.mockResolvedValue({...state,control:{...state.control,settlement:'not_used',usage_complete:true}})
    await act(async()=>{await f.result.current.checkResult()})
    expect(f.stopTurn).toHaveBeenCalledOnce()
    expect(f.result.current.draft.pending).toBeNull()
    expect(f.result.current.draft.outcome?.result.status).toBe('failed')
})

it('retains a failed device save in memory and requires it to succeed before dispatching Stop',async()=>{
    const f=await uncertainTurn(),pending=f.result.current.draft.pending!
    const blocked=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('Full device storage')})
    try {
        await act(async()=>{await f.result.current.stop()})
        expect(f.stopTurn).not.toHaveBeenCalled()
        expect(f.result.current.draft.pending?.stopRequested).toBe(true)
        expect(f.result.current.record.storageFailed).toBe(true)
        expect(f.result.current.draft.message).toBe(question)
        await act(async()=>{await f.result.current.resume()})
        expect(mocks.streamAssistantMessage).toHaveBeenCalledOnce()
    } finally {blocked.mockRestore()}
    f.stopTurn.mockResolvedValue(stoppedState(pending.requestId,{settlement:'not_used',usage_complete:true}))
    await act(async()=>{await f.result.current.stop()})
    expect(f.stopTurn).toHaveBeenCalledOnce()
    expect(f.result.current.record.storageFailed).toBe(false)
    expect(f.result.current.draft.pending).toBeNull()
})

it('ignores late Stop replies after ownership retires',async()=>{
    const f=await uncertainTurn(),pending=f.result.current.draft.pending!
    let resolve!:(value:Awaited<ReturnType<NovelAssistantSource['stopTurn']>>)=>void
    f.stopTurn.mockImplementation(()=>new Promise(done=>{resolve=done}))
    let stopping!:Promise<void>
    act(()=>{stopping=f.result.current.stop()})
    await waitFor(()=>expect(f.stopTurn).toHaveBeenCalledOnce())
    f.retire()
    await act(async()=>{resolve(stoppedState(pending.requestId,{settlement:'not_used',usage_complete:true}));await stopping})
    expect(f.result.current.draft.pending?.stopRequested).toBe(true)
    expect(f.result.current.draft.outcome).toBeNull()
    expect(mocks.streamAssistantMessage).toHaveBeenCalledOnce()
})

it('aborts the live browser stream only after Stop intent is durable',async()=>{
    const f=fixture();f.seed()
    await waitFor(()=>expect(f.result.current.assistant.ready).toBe(true))
    await act(async()=>{await f.result.current.prepare()})
    let streamSignal!:AbortSignal
    mocks.streamAssistantMessage.mockImplementation((_id,_body,_callback,options)=>new Promise((_resolve,reject)=>{
        streamSignal=options.signal
        streamSignal.addEventListener('abort',()=>{
            expect(listAssistantDrafts({userHash:mocks.auth.userHash,workspaceId:'workspace'})[0].write.pending?.stopRequested).toBe(true)
            reject(new DOMException('Stopped','AbortError'))
        },{once:true})
    }))
    let sending!:Promise<void>
    act(()=>{sending=f.result.current.sendReviewed()})
    await waitFor(()=>expect(mocks.streamAssistantMessage).toHaveBeenCalledOnce())
    const pending=f.result.current.draft.pending!
    f.stopTurn.mockResolvedValue(stoppedState(pending.requestId,{settlement:'not_used',usage_complete:true}))
    await act(async()=>{await f.result.current.stop();await sending})
    expect(streamSignal.aborted).toBe(true)
    expect(f.stopTurn).toHaveBeenCalledOnce()
    expect(f.result.current.draft.message).toBe(question)
    expect(f.result.current.draft.pending).toBeNull()
})

it('keeps Stop available after the manuscript becomes read-only',async()=>{
    const f=await uncertainTurn(),pending=f.result.current.draft.pending!
    f.rerender({open:true,readOnly:true})
    f.stopTurn.mockResolvedValue(stoppedState(pending.requestId,{settlement:'not_used',usage_complete:true}))
    await act(async()=>{await f.result.current.stop()})
    expect(f.stopTurn).toHaveBeenCalledOnce()
    expect(f.result.current.draft.pending).toBeNull()
    expect(f.result.current.draft.message).toBe(question)
})

it('keeps the durable Stop after closing the drawer and ignores its late acknowledgement',async()=>{
    const f=await uncertainTurn(),pending=f.result.current.draft.pending!
    let resolve!:(value:Awaited<ReturnType<NovelAssistantSource['stopTurn']>>)=>void
    f.stopTurn.mockImplementation(()=>new Promise(done=>{resolve=done}))
    let stopping!:Promise<void>
    act(()=>{stopping=f.result.current.stop()})
    await waitFor(()=>expect(f.stopTurn).toHaveBeenCalledOnce())
    act(()=>f.result.current.close())
    f.rerender({open:false,readOnly:false})
    await act(async()=>{resolve(stoppedState(pending.requestId,{settlement:'not_used',usage_complete:true}));await stopping})
    expect(f.result.current.draft.pending?.stopRequested).toBe(true)
    expect(f.result.current.draft.outcome).toBeNull()
    expect(listAssistantDrafts({userHash:mocks.auth.userHash,workspaceId:'workspace'})[0].write.pending?.stopRequested).toBe(true)
    f.stopTurn.mockResolvedValue(stoppedState(pending.requestId,{settlement:'not_used',usage_complete:true}))
    f.rerender({open:true,readOnly:false})
    await waitFor(()=>expect(f.result.current.assistant.ready).toBe(true))
    await act(async()=>{await f.result.current.checkResult()})
    expect(f.result.current.draft.pending).toBeNull()
    expect(f.stopTurn).toHaveBeenLastCalledWith(pending.conversationId,pending.requestId,expect.any(AbortSignal))
})
