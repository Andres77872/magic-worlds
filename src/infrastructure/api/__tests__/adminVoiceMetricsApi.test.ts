import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiService } from '../index'

function jsonResponse(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? 'OK' : 'Error',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        clone() {
            return jsonResponse(body, status)
        },
        json: async () => body,
        text: async () => JSON.stringify(body),
    } as unknown as Response
}

type FetchCall = [string, RequestInit]

describe('root voice metrics API (R0-OPS-07)', () => {
    let fetchMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
        vi.stubEnv('VITE_FEATURE_VOICES_ENABLED', 'true')
        localStorage.clear()
        localStorage.setItem('magic_worlds:token', 'root-token')
        fetchMock = vi.fn(async () => jsonResponse({ surface: 'narration' }))
        vi.stubGlobal('fetch', fetchMock)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.unstubAllEnvs()
        vi.restoreAllMocks()
        localStorage.clear()
    })

    const lastCall = () => fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as FetchCall
    const path = (call: FetchCall) => {
        const url = new URL(call[0], 'http://localhost')
        return url.pathname + url.search
    }

    it.each([
        ['narration', { hours: 24 }, '/admin/voices/metrics/narration?hours=24'],
        ['calls', { hours: 1 }, '/admin/voices/metrics/calls?hours=1'],
        ['provider', {}, '/admin/voices/metrics/provider'],
        ['moderation', { hours: 720 }, '/admin/voices/metrics/moderation?hours=720'],
        // Spend takes days only; an hours value is never sent to it.
        ['spend', { days: 30, hours: 6 }, '/admin/voices/metrics/spend?days=30'],
    ] as const)('GETs %s with its window and the bearer token, with no workspace header', async (area, query, expected) => {
        await apiService.getAdminVoiceMetrics(area, query)
        const call = lastCall()
        expect(path(call)).toBe(expected)
        expect(call[1].method).toBe('GET')
        const headers = call[1].headers as Record<string, string>
        expect(headers.Authorization).toBe('Bearer root-token')
        expect(Object.keys(headers).map((name) => name.toLowerCase())).not.toContain('x-workspace-id')
    })

    it('surfaces the 503 "metrics unavailable" answer as an ApiError', async () => {
        fetchMock.mockResolvedValue(jsonResponse({ detail: 'Voice metrics are unavailable.' }, 503))
        await expect(apiService.getAdminVoiceMetrics('calls')).rejects.toBeInstanceOf(ApiError)
        await expect(apiService.getAdminVoiceMetrics('calls')).rejects.toMatchObject({ status: 503 })
    })

    it('sends confirm_removal with explicit Job B keys', async () => {
        fetchMock.mockResolvedValue(jsonResponse({ job: 'B', run_id: 'r', status: 'completed', detail: 'removed=1' }))
        await apiService.syncAdminCatalog({ job: 'B', voice_keys: ['vk_1'], confirm_removal: true })
        const call = lastCall()
        expect(path(call)).toBe('/admin/voices/sync')
        expect(JSON.parse(String(call[1].body))).toEqual({ job: 'B', voice_keys: ['vk_1'], confirm_removal: true })
    })

    it('refuses metrics calls while voices are disabled', async () => {
        vi.stubEnv('VITE_FEATURE_VOICES_ENABLED', 'false')
        await expect(apiService.getAdminVoiceMetrics('narration')).rejects.toThrow('Voices are disabled.')
        expect(fetchMock).not.toHaveBeenCalled()
    })
})
