import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiService } from './index'

const fetchMock = vi.fn()

function jsonResponse(body: unknown) {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    })
}

describe('chat message API methods', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
        localStorage.setItem('magic_worlds:token', 'test-token')
        vi.stubGlobal('fetch', fetchMock)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('deletes and clears adventure messages through canonical endpoints', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse({ adventure_last_turn: '{"turns":[]}' }))
            .mockResolvedValueOnce(jsonResponse({ adventure_last_turn: '{"turns":[]}' }))

        await apiService.deleteAdventureSessionMessage(7, 100)
        await apiService.clearAdventureSessionMessages(7)

        let [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
        expect(url).toMatch(/\/adventure-sessions\/7\/messages\/100$/)
        expect(init.method).toBe('DELETE')
        expect(init.headers).toMatchObject({ Authorization: 'Bearer test-token' })

        ;[url, init] = fetchMock.mock.calls[1] as [string, RequestInit]
        expect(url).toMatch(/\/adventure-sessions\/7\/messages$/)
        expect(init.method).toBe('DELETE')
    })

    it('deletes and clears character chat messages through canonical endpoints', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse({ last_turn: '{"turns":[]}' }))
            .mockResolvedValueOnce(jsonResponse({ last_turn: '{"turns":[]}' }))

        await apiService.deleteCharacterChatMessage(9, 199)
        await apiService.clearCharacterChatMessages(9)

        let [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
        expect(url).toMatch(/\/character-chats\/9\/messages\/199$/)
        expect(init.method).toBe('DELETE')
        expect(init.headers).toMatchObject({ Authorization: 'Bearer test-token' })

        ;[url, init] = fetchMock.mock.calls[1] as [string, RequestInit]
        expect(url).toMatch(/\/character-chats\/9\/messages$/)
        expect(init.method).toBe('DELETE')
    })
})
