import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiService } from './index'
import { authSession } from './authSession'
import type { TextGenerationEvent } from '@/shared'

const fetchMock = vi.fn()
const frame = (event: string, data: unknown) => new TextEncoder().encode(`event: ${event}\r\ndata: ${JSON.stringify(data)}\r\n\r\n`)
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
function stream() {
    let controller!: ReadableStreamDefaultController<Uint8Array>
    const cancel = vi.fn()
    const response = new Response(new ReadableStream<Uint8Array>({ start(c) { controller = c }, cancel }), { headers: { 'Content-Type': 'text/event-stream' } })
    return { response, cancel, send: (type: string, data: unknown) => controller.enqueue(frame(type, data)), end: () => controller.close() }
}

beforeEach(() => {
    vi.clearAllMocks()
    authSession.authenticate('stream-test-user', 'test-token')
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('VITE_FEATURE_NOVELS_ENABLED', 'true')
    vi.stubEnv('VITE_FEATURE_TEXT_STREAMING_ENABLED', 'true')
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
        wire.send('final', { request_id: 'req-1', card: { id: 'saved-1', name: 'Realm' } })
        expect(await pending).toMatchObject({ id: 'saved-1' })
        expect(fetchMock).toHaveBeenCalledOnce()
        expect(wire.cancel).toHaveBeenCalledOnce()
    })

    it('recovers a committed card by a read-only request after stream loss', async () => {
        const wire = stream()
        fetchMock.mockResolvedValueOnce(wire.response).mockResolvedValueOnce(json({ status: 'completed', request_id: 'req-1', card: { id: 'saved-1' } }))
        const pending = apiService.createWorldAI('A candlelit realm', { requestId: 'req-1', idempotencyKey: 'idem-1', onEvent: vi.fn() })
        wire.end()
        expect(await pending).toMatchObject({ id: 'saved-1' })
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
        const generation = { id: 'gen-1', requestId: 'req-1', output: 'Saved text' }
        fetchMock.mockResolvedValueOnce(wire.response).mockResolvedValueOnce(json({ chapters: [{ id: 'chapter-1', generationHistory: [generation] }] }))
        const pending = apiService.generateStory('story-1', { chapterId: 'chapter-1', command: 'continue' }, { requestId: 'req-1' })
        wire.end()
        expect(await pending).toMatchObject({ generation })
        expect(fetchMock.mock.calls.map((call) => call[1].method)).toEqual(['POST', 'GET'])
    })

    it('selects the synchronous fallback before starting a request', async () => {
        vi.stubEnv('VITE_FEATURE_TEXT_STREAMING_ENABLED', 'false')
        fetchMock.mockResolvedValueOnce(json({ generation: { id: 'gen-1' } }))
        await apiService.generateStory('story-1', { chapterId: 'chapter-1', command: 'continue' }, { onEvent: vi.fn() })
        expect(fetchMock).toHaveBeenCalledOnce()
        expect(fetchMock.mock.calls[0][0]).toMatch(/\/generate$/)
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
        await expect(apiService.generateStory('story-1', { chapterId: 'chapter-1', command: 'continue' }, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('aborts during auth refresh without sending a late generation retry', async () => {
        let resolveRefresh!: (response: Response) => void
        fetchMock.mockResolvedValueOnce(json({ detail: 'expired' }, 401))
            .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveRefresh = resolve }))
        const controller = new AbortController()
        const pending = apiService.generateStory('story-1', { chapterId: 'chapter-1', command: 'continue' }, { signal: controller.signal })
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
        expect(fetchMock.mock.calls[1][0]).toMatch(/\/auth\/refresh$/)
        controller.abort()
        await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
        resolveRefresh(json({ success: true, message: 'Refreshed', access_token: 'new-token' }))
        await vi.waitFor(() => expect(localStorage.getItem('magic_worlds:token')).toBe('new-token'))
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })
})
