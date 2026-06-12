import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiService } from './index'

const fetchMock = vi.fn()

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
    return new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
    })
}

describe('API health check', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
        localStorage.setItem('magic_worlds:token', 'stored-token')
        vi.stubGlobal('fetch', fetchMock)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('requests /health without auth headers', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ status: 'ok' }))

        await expect(apiService.getHealth()).resolves.toEqual({ status: 'ok' })

        expect(fetchMock).toHaveBeenCalledTimes(1)
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
        const headers = init.headers as Record<string, string>
        expect(url).toMatch(/\/health$/)
        expect(init.method).toBe('GET')
        expect(headers.Accept).toBe('application/json')
        expect(headers.Authorization).toBeUndefined()
    })

    it('throws an ApiError for non-ok health responses', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ status: 'error' }, { status: 503 }))

        await expect(apiService.getHealth()).rejects.toMatchObject({
            status: 503,
            message: 'Health check failed (503)',
        })
    })
})
