import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiService } from './index'
import { authSession } from './authSession'
import type { TextGenerationEvent } from '@/shared'
import { storyStreamFetch } from '@/test-utils/storyStreamFetch'

const fetchMock = vi.fn()
const frame = (event: string, data: unknown) => new TextEncoder().encode(`event: ${event}\r\ndata: ${JSON.stringify(data)}\r\n\r\n`)
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
function stream() {
    let controller!: ReadableStreamDefaultController<Uint8Array>
    const cancel = vi.fn()
    const response = new Response(new ReadableStream<Uint8Array>({ start(c) { controller = c }, cancel }), { headers: { 'Content-Type': 'text/event-stream' } })
    return { response, cancel, send: (type: string, data: unknown) => controller.enqueue(frame(type, data)), end: () => controller.close() }
}

function storyResult(requestId: string, replayed = false) {
    return { generation: { id: 'execution-1', chapterId: 'chapter-1', sceneId:'scene-1', requestId, output: 'Saved text' },
        scene: { id: 'scene-1' }, stagedCardUpdates: [],
        llm_execution: { execution_id: 'execution-1', profile_id: 'profile-1', revision_id: 'revision-1',
            resolution_source: 'system_default', credential_mode: 'platform', replayed } }
}

const cardId = '11111111-1111-4111-8111-111111111111'
function cardResult(requestId = 'req-1', replayed = false) {
    return { id: cardId, name: 'Realm', description: 'A candlelit realm', request_id: requestId,
        llm_execution: { execution_id: cardId, profile_id: '22222222-2222-4222-8222-222222222222',
            revision_id: '33333333-3333-4333-8333-333333333333', resolution_source: 'system_default',
            credential_mode: 'platform', replayed } }
}

beforeEach(() => {
    vi.clearAllMocks()
    authSession.authenticate('stream-test-user', 'test-token')
    vi.stubGlobal('fetch', storyStreamFetch(fetchMock))
    setTestFeatureFlags({ novels: true })

})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('saved generation streaming', () => {
    it.each(['character', 'world', 'item', 'adventure'] as const)('%s exposes field previews before the saved final and sends only one POST', async (kind) => {
        const wire = stream()
        fetchMock.mockResolvedValueOnce(wire.response)
        const events: TextGenerationEvent[] = []
        const options = { requestId: 'req-1', idempotencyKey: 'idem-1', onEvent: (event: TextGenerationEvent) => events.push(event) }
        const methods = { character: apiService.createCharacterAI.bind(apiService), world: apiService.createWorldAI.bind(apiService), item: apiService.createItemAI.bind(apiService), adventure: apiService.createAdventureTemplateAI.bind(apiService) }
        const pending = methods[kind]('Create a candlelit realm', options)
        let finished = false
        void pending.then(() => { finished = true })
        wire.send('preview', { request_id: 'req-1', path: ['description'], text: 'A candlelit' })
        await vi.waitFor(() => expect(events).toHaveLength(1))
        expect(finished).toBe(false)
        expect(fetchMock.mock.calls[0][0]).toMatch(/\/ai\/stream$/)
        wire.send('final', { request_id: 'req-1', card: cardResult() })
        expect(await pending).toMatchObject({ id: cardId })
        expect(fetchMock).toHaveBeenCalledOnce()
        expect(wire.cancel).toHaveBeenCalledOnce()
    })

    it('recovers a committed card by a read-only request after stream loss', async () => {
        const wire = stream()
        fetchMock.mockResolvedValueOnce(wire.response).mockResolvedValueOnce(json({ status: 'completed', request_id: 'req-1', card: cardResult('req-1', true) }))
        const pending = apiService.createWorldAI('A candlelit realm', { requestId: 'req-1', idempotencyKey: 'idem-1', onEvent: vi.fn() })
        wire.end()
        expect(await pending).toMatchObject({ id: cardId })
        expect(fetchMock.mock.calls.map((call) => call[1].method)).toEqual(['POST', 'GET'])
        expect(fetchMock.mock.calls[1][0]).toMatch(/\/ai\/result$/)
    })

    it('does not recover an older card with a mismatched request ID', async () => {
        const wire = stream()
        fetchMock.mockResolvedValueOnce(wire.response).mockResolvedValueOnce(json({ status: 'completed', request_id: 'old', card: { id: 'old-card' } }))
        const pending = apiService.createWorldAI('A candlelit realm', { requestId: 'req-1', onEvent: vi.fn() })
        wire.end()
        await expect(pending).rejects.toMatchObject({ code: 'stream_incomplete' })
    })

    it('recovers exactly the saved Story Studio candidate without another generation', async () => {
        const wire = stream()
        const saved = storyResult('req-1', true)
        fetchMock.mockResolvedValueOnce(wire.response).mockResolvedValueOnce(json(saved))
        const pending = apiService.generateStory('story-1', { sceneId: 'scene-1', baseRevision:1, command: 'continue' }, { requestId: 'req-1' })
        wire.end()
        expect(await pending).toEqual(saved)
        expect(fetchMock.mock.calls.map((call) => call[1].method)).toEqual(['POST', 'GET'])
        expect(fetchMock.mock.calls[1][0]).toMatch(/\/generation-requests\/req-1$/)
        expect(fetchMock.mock.calls[1][1].body).toBeUndefined()
    })

    it('uses the stable stream endpoint without a frontend transport flag', async () => {

        fetchMock.mockResolvedValueOnce(json(storyResult('req-1')))
        await apiService.generateStory('story-1', { sceneId: 'scene-1', baseRevision:1, command: 'continue' }, { requestId: 'req-1', onEvent: vi.fn() })
        expect(fetchMock).toHaveBeenCalledOnce()
        expect(fetchMock.mock.calls[0][0]).toMatch(/\/generate\/stream$/)
    })

    it('omits transient credentials from context previews', async () => {
        fetchMock.mockResolvedValueOnce(json({ cards: [], chapters: [], loreEntries: [], totalEstimatedTokens: 0 }))
        await apiService.previewStoryContext('story-1', { sceneId: 'scene-1', baseRevision:1, command: 'continue',
            llm: { expected_revision_id: 'revision-1', credentials: { api_key: 'FAKE_TRANSIENT_KEY' } } })
        expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ sceneId: 'scene-1', baseRevision:1, command: 'continue' }))
    })

    it.each(['missing_plan', 'different_request', 'different_execution', 'different_chapter', 'private_field'])('rejects %s in novel execution results', async (invalid) => {

        const result: Record<string, unknown> = storyResult('req-1')
        if (invalid === 'missing_plan') delete result.llm_execution
        else if (invalid === 'different_request') result.generation = { ...storyResult('req-1').generation, requestId: 'another' }
        else if (invalid === 'different_execution') result.llm_execution = { ...storyResult('req-1').llm_execution, execution_id: 'another' }
        else if (invalid === 'different_chapter') result.scene = { id: 'another' }
        else result.llm_execution = { ...storyResult('req-1').llm_execution, api_key: 'FAKE_TRANSIENT_KEY' }
        fetchMock.mockResolvedValueOnce(json(result))
        await expect(apiService.generateStory('story-1', { sceneId: 'scene-1', baseRevision:1, command: 'continue' }, { requestId: 'req-1' }))
            .rejects.toMatchObject({ code: 'story_execution_contract' })
        expect(fetchMock).toHaveBeenCalledOnce()
    })

    it('stops a pending stream on an account change and never recovers it under another account', async () => {
        const wire = stream()
        fetchMock.mockResolvedValueOnce(wire.response)
        const onEvent = vi.fn()
        const pending = apiService.createWorldAI('A candlelit realm', { requestId: 'req-1', onEvent })
        wire.send('progress', { request_id: 'req-1', stage: 'generating' })
        await vi.waitFor(() => expect(onEvent).toHaveBeenCalled())
        authSession.authenticate('different-user', 'other-token')
        await expect(pending).rejects.toMatchObject({ code: 'auth_epoch_changed' })
        expect(fetchMock).toHaveBeenCalledOnce()
    })

    it('does not send a generation when already aborted', async () => {
        const controller = new AbortController()
        controller.abort()
        await expect(apiService.generateStory('story-1', { sceneId: 'scene-1', baseRevision:1, command: 'continue' }, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('aborts during auth refresh without sending a late generation retry', async () => {
        let resolveRefresh!: (response: Response) => void
        fetchMock.mockResolvedValueOnce(json({ detail: 'expired' }, 401))
            .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveRefresh = resolve }))
        const controller = new AbortController()
        const pending = apiService.generateStory('story-1', { sceneId: 'scene-1', baseRevision:1, command: 'continue' }, { signal: controller.signal })
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
        expect(fetchMock.mock.calls[1][0]).toMatch(/\/auth\/refresh$/)
        controller.abort()
        await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
        resolveRefresh(json({ success: true, message: 'Refreshed', access_token: 'new-token' }))
        await vi.waitFor(() => expect(localStorage.getItem('magic_worlds:token')).toBe('new-token'))
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })
})
