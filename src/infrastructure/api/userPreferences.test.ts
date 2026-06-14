import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiService } from './index'

const fetchMock = vi.fn()

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
    return new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        statusText: init.statusText,
        headers: { 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
    })
}

describe('user preference API helpers', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
        localStorage.setItem('magic_worlds:token', 'pref-token')
        vi.stubGlobal('fetch', fetchMock)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('fetches the signed-in user language preference', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ preferred_language: 'es', has_preference: true }))

        const response = await apiService.getUserPreferences()

        expect(response).toEqual({ preferred_language: 'es', has_preference: true })
        expect(fetchMock).toHaveBeenCalledTimes(1)
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
        expect(String(url)).toContain('/user/preferences')
        expect(init.method).toBe('GET')
        expect((init.headers as Record<string, string>).Authorization).toBe('Bearer pref-token')
    })

    it('patches the signed-in user language preference as JSON', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ preferred_language: 'es', has_preference: true }))

        const response = await apiService.updateUserPreferences({ preferred_language: 'es' })

        expect(response).toEqual({ preferred_language: 'es', has_preference: true })
        expect(fetchMock).toHaveBeenCalledTimes(1)
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
        const headers = init.headers as Record<string, string>
        expect(String(url)).toContain('/user/preferences')
        expect(init.method).toBe('PATCH')
        expect(headers.Authorization).toBe('Bearer pref-token')
        expect(headers['Content-Type']).toBe('application/json')
        expect(init.body).toBe(JSON.stringify({ preferred_language: 'es' }))
    })
})
