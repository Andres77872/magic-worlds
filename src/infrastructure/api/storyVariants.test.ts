import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import wire from '@/test/fixtures/storyVariantsNative.json'
import type { StoryVariantCreate, StoryVariantDecision, StoryVariantSnapshot } from '@/shared'
import { apiService } from './index'
import { storyScene } from '@/test/fixtures/story'

const snapshot = wire.preview as StoryVariantSnapshot, storyId = snapshot.storyId
const write: StoryVariantCreate = { requestId: 'create-version-once', reviewedHash: snapshot.variantHash, intent: {
    id: snapshot.id, title: snapshot.title, parent: { generationId: snapshot.parent.parent.id, parentHash: snapshot.parent.parentHash }, operation: snapshot.operation } }
const fetchMock = vi.fn(), response = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } })
const workspaceId = '11111111-1111-4111-8111-111111111111'
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); setTestFeatureFlags({ novels: true });
    localStorage.setItem('magic_worlds:token', 'version-token'); vi.stubGlobal('fetch', fetchMock) })
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

it('uses the owned workspace for preview, creation, bounded history and a fresh full version read', async () => {
    const api = apiService.withWorkspace(workspaceId), controller = new AbortController()
    fetchMock.mockResolvedValueOnce(response(snapshot)).mockResolvedValueOnce(response(wire.creationReceipt))
        .mockResolvedValueOnce(response(wire.page)).mockResolvedValueOnce(response(wire.records[2]))
    expect(await api.previewStoryVariant(storyId, write.intent, { signal: controller.signal })).toEqual(snapshot)
    expect(await api.createStoryVariant(storyId, write)).toEqual(wire.creationReceipt)
    expect(await api.getStoryVariants(storyId)).toEqual(wire.page)
    expect(await api.getStoryVariant(storyId, snapshot.id)).toEqual(wire.records[2])
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(write.intent)
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(write)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/generation-variants/preview')
    expect(String(fetchMock.mock.calls[3][0])).toContain('/generation-variants/' + snapshot.id)
    for (const [, init] of fetchMock.mock.calls) expect(init.headers).toMatchObject({ 'X-Workspace-Id': workspaceId, Authorization: 'Bearer version-token' })
})
it('recovers the exact creation or decision receipt through GET without another write', async () => {
    const record = wire.records[1], decision: StoryVariantDecision = { requestId: 'stash-version-once',
        reference: { id: record.variant.id, variantHash: record.variant.variantHash }, expectedStatus: 'candidate', decision: 'stash' }
    fetchMock.mockResolvedValueOnce(response(null)).mockResolvedValueOnce(response(wire.creationReceipt))
        .mockResolvedValueOnce(response(record)).mockResolvedValueOnce(response(record))
    expect(await apiService.getStoryVariantResult(storyId, write)).toBeNull()
    expect(await apiService.getStoryVariantResult(storyId, write)).toEqual(wire.creationReceipt)
    expect(await apiService.decideStoryVariant(storyId, decision)).toEqual(record)
    expect(await apiService.getStoryVariantResult(storyId, decision)).toEqual(record)
    for (const index of [0, 1, 3]) {
        const [url, init] = fetchMock.mock.calls[index]
        expect(String(url)).toContain('/generation-variant-requests/')
        expect(init.method ?? 'GET').toBe('GET'); expect(init.body).toBeUndefined()
    }
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual(decision)
})
it('keeps mismatched acknowledgements uncertain and blocks malformed intents before transport', async () => {
    fetchMock.mockResolvedValueOnce(response({ ...snapshot, title: 'Not reviewed' })).mockResolvedValueOnce(response(wire.records[2]))
    await expect(apiService.previewStoryVariant(storyId, write.intent)).rejects.toMatchObject({ status: 502, code: 'story_variant_contract' })
    await expect(apiService.getStoryVariantResult(storyId, write)).rejects.toMatchObject({ status: 502, code: 'story_variant_contract' })
    await expect(apiService.getStoryVariants(storyId, { limit: 21 })).rejects.toMatchObject({ status: 422 })
    await expect(apiService.createStoryVariant(storyId, { ...write, requestId: snapshot.id })).rejects.toMatchObject({ status: 422 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
})
it('gates every authored-version route when novels are disabled', async () => {
    setTestFeatureFlags({ novels: false })
    const decision: StoryVariantDecision = { requestId: 'decision', reference: { id: snapshot.id, variantHash: snapshot.variantHash }, expectedStatus: 'candidate', decision: 'reject' }
    for (const call of [() => apiService.previewStoryVariant(storyId, write.intent), () => apiService.createStoryVariant(storyId, write),
        () => apiService.getStoryVariant(storyId, snapshot.id), () => apiService.getStoryVariants(storyId),
        () => apiService.decideStoryVariant(storyId, decision), () => apiService.getStoryVariantResult(storyId, write)])
        await expect(call()).rejects.toThrow('Novels are disabled')
    expect(fetchMock).not.toHaveBeenCalled()
})
it('sends the exact version reference and empty mapping through the existing atomic generation writer',async()=>{
    const version={id:snapshot.id,variantHash:snapshot.variantHash}
    const commit={requestId:'apply-reviewed-version',sceneId:snapshot.operation.sceneId,expectedRevision:2,document:snapshot.operation.document,anchorEdits:[],variant:version}
    const saved=storyScene({id:commit.sceneId,storyId,document:commit.document,revision:3})
    fetchMock.mockResolvedValue(response(saved))
    expect(await apiService.acceptStoryGeneration(storyId,snapshot.parent.parent.id,commit)).toEqual(saved)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(commit)
    for(const variant of [undefined,null,{...version,variantHash:'broken'},{...version,apply:true},{...version,id:snapshot.parent.parent.id}])
        await expect(apiService.acceptStoryGeneration(storyId,snapshot.parent.parent.id,{...commit,variant} as never)).rejects.toMatchObject({status:422})
    expect(fetchMock).toHaveBeenCalledOnce()
})
