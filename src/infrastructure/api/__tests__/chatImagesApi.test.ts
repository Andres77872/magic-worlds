import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiService, ChatImagesUnsupportedError } from '../index'

function jsonResponse(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText: status < 300 ? 'OK' : 'Error',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        clone() {
            return jsonResponse(body, status)
        },
        json: async () => body,
        text: async () => JSON.stringify(body),
    } as unknown as Response
}

const generation = { job_id: 'img-2', status: 'pending', assets: [], trigger: 'regenerate', credential_mode: 'platform' }

describe('chat message images API', () => {
    beforeEach(() => {
        localStorage.clear()
        localStorage.setItem('magic_worlds:token', 'token-1')
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
        localStorage.clear()
    })

    it('posts a regenerate and reads the 202 generation', async () => {
        const fetchMock = vi.fn(async () => jsonResponse({ generation }, 202))
        vi.stubGlobal('fetch', fetchMock)

        await expect(apiService.generateChatMessageImage('character-chats', 7, 101, { prompt: 'A lantern-lit bridge.' })).resolves.toMatchObject({ job_id: 'img-2' })

        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
        expect(url).toMatch(/\/character-chats\/7\/messages\/101\/images$/)
        expect(init.method).toBe('POST')
        expect(JSON.parse(String(init.body))).toEqual({ prompt: 'A lantern-lit bridge.' })
    })

    it('answers null when the job was slow to create', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ generation: null }, 202)))
        await expect(apiService.generateChatMessageImage('adventure-sessions', 7, 101)).resolves.toBeNull()
    })

    it('lists a message\'s images from `items`', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ assistant_message_id: 101, items: [generation, { job_id: '' }] })))
        await expect(apiService.listChatMessageImages('adventure-sessions', 7, 101)).resolves.toEqual([generation])
    })

    it('tells an older server from a missing message', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ detail: 'Not Found' }, 404)))
        await expect(apiService.listChatMessageImages('adventure-sessions', 7, 101)).rejects.toBeInstanceOf(ChatImagesUnsupportedError)

        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ detail: { category: 'not_found', detail: 'Message not found.', code: 'CHAT_MESSAGE_NOT_FOUND' } }, 404)))
        const error = await apiService.generateChatMessageImage('adventure-sessions', 7, 101).catch((caught: unknown) => caught)
        expect(error).not.toBeInstanceOf(ChatImagesUnsupportedError)
        expect(error).toMatchObject({ status: 404, code: 'CHAT_MESSAGE_NOT_FOUND' })
    })
})
