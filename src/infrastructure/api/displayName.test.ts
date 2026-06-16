import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiService, ApiError } from './index'

const fetchMock = vi.fn()

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
    return new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        statusText: init.statusText,
        headers: { 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
    })
}

const profileBody = {
    user_hash: 'usr-1',
    username: 'lyra',
    display_name: 'The Loremaster',
    user_type: 'consumer',
    user_usage: 50,
    card_counts: { character: 0, world: 0, adventure_template: 0, item: 0 },
}

describe('apiService.updateDisplayName', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
        localStorage.setItem('magic_worlds:token', 'dn-token')
        vi.stubGlobal('fetch', fetchMock)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('PATCHes /user/me with the display name as JSON and returns the profile', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(profileBody))

        const response = await apiService.updateDisplayName('The Loremaster')

        expect(response.display_name).toBe('The Loremaster')
        expect(fetchMock).toHaveBeenCalledTimes(1)
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
        const headers = init.headers as Record<string, string>
        expect(String(url)).toContain('/user/me')
        expect(init.method).toBe('PATCH')
        expect(headers.Authorization).toBe('Bearer dn-token')
        expect(headers['Content-Type']).toBe('application/json')
        expect(init.body).toBe(JSON.stringify({ display_name: 'The Loremaster' }))
    })

    it('sends null to clear the display name', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ ...profileBody, display_name: null }))

        const response = await apiService.updateDisplayName(null)

        expect(response.display_name).toBeNull()
        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
        expect(init.body).toBe(JSON.stringify({ display_name: null }))
    })

    it('throws an ApiError on a failed request', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'too long' }, { status: 422 }))

        await expect(apiService.updateDisplayName('x'.repeat(300))).rejects.toBeInstanceOf(ApiError)
    })
})
