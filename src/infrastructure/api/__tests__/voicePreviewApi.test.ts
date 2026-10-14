import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiService, isProtectedMediaUrl } from '../index'

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

function requestOf(fetchMock: ReturnType<typeof vi.fn>, index = 0): { url: string; init: RequestInit } {
    const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit]
    return { url, init }
}

const WORKSPACE = '0b6f4c8e-2f1a-4d3b-9c7e-5a1d2e3f4a5b'

describe('recipe preview API (D18)', () => {
    beforeEach(() => {
        vi.stubEnv('VITE_FEATURE_VOICES_ENABLED', 'true')
        localStorage.clear()
        localStorage.setItem('magic_worlds:token', 'token-1')
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.unstubAllEnvs()
        vi.restoreAllMocks()
        localStorage.clear()
    })

    it('posts a fixed text id, account scoped, with the abort signal', async () => {
        const response = { cache_key: 'abc', url: '/voice-presets/preview/abc.mp3', cached: true, previews_left: 2 }
        const fetchMock = vi.fn(async () => jsonResponse(response))
        vi.stubGlobal('fetch', fetchMock)
        const controller = new AbortController()
        const body = {
            voice_key: 'vk_0a1b2c3d4e5f60718293a4b5c6d7e8f9',
            settings: { stability: 0.5, speed: 1 },
            emotion: null,
            text_id: 'dialogue' as const,
            language: 'es',
            tier: 'standard' as const,
        }

        // Even through a workspace client, previews never carry the selector.
        await expect(apiService.withWorkspace(WORKSPACE).previewVoice(body, { signal: controller.signal })).resolves.toEqual(response)

        const { url, init } = requestOf(fetchMock)
        expect(url).toMatch(/\/voice-presets\/preview$/)
        expect(init.method).toBe('POST')
        expect(JSON.parse(String(init.body))).toEqual(body)
        expect(init.signal).toBe(controller.signal)
        const headers = init.headers as Record<string, string>
        expect(headers.Authorization).toBe('Bearer token-1')
        expect(headers['X-Workspace-Id']).toBeUndefined()
    })

    it('surfaces a 422 (a refused body) with its status', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ detail: [{ loc: ['body', 'settings', 'style'], msg: 'Extra inputs are not permitted', type: 'extra_forbidden' }] }, 422)))
        const body = { voice_key: 'vk_1', settings: {}, emotion: null, text_id: 'narration' as const, language: 'en', tier: 'standard' as const }
        await expect(apiService.previewVoice(body)).rejects.toMatchObject({ status: 422 })
    })

    it('reads the preview texts for a language without a workspace selector', async () => {
        const texts = { items: [{ text_id: 'narration', kind: 'narration', text: 'A line.' }] }
        const fetchMock = vi.fn(async () => jsonResponse(texts))
        vi.stubGlobal('fetch', fetchMock)

        await expect(apiService.withWorkspace(WORKSPACE).getPreviewTexts('es')).resolves.toEqual(texts)

        const { url, init } = requestOf(fetchMock)
        expect(url).toMatch(/\/voices\/preview-texts\?language=es$/)
        expect(init.method).toBe('GET')
        expect((init.headers as Record<string, string>)['X-Workspace-Id']).toBeUndefined()
    })

    it('surfaces a 404 from an older server with its status', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ detail: 'Not Found' }, 404)))
        await expect(apiService.getPreviewTexts('en')).rejects.toMatchObject({ status: 404 })
    })

    it('surfaces 429 and 503 moderation_unavailable with status and code', async () => {
        vi.stubGlobal('fetch', vi.fn()
            .mockResolvedValueOnce(jsonResponse({ detail: 'Daily preview limit reached.' }, 429))
            .mockResolvedValueOnce(jsonResponse({ detail: { code: 'moderation_unavailable', message: 'Unavailable' } }, 503)))
        const body = { voice_key: 'vk_1', settings: {}, emotion: null, text_id: 'narration' as const, language: 'en', tier: 'standard' as const }

        await expect(apiService.previewVoice(body)).rejects.toMatchObject({ status: 429 })
        await expect(apiService.previewVoice(body)).rejects.toMatchObject({ status: 503, code: 'moderation_unavailable' })
    })

    it('posts the V2 body (EP-6) verbatim, account scoped, and returns tier_used', async () => {
        const response = { cache_key: 'v2', previews_left: 4, tier_used: 'standard', source: 'render' }
        const fetchMock = vi.fn(async () => jsonResponse(response))
        vi.stubGlobal('fetch', fetchMock)
        const body = {
            voice_key: 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f',
            settings: { stability: 0.5, similarity_boost: 0.75, speed: 1 },
            emotion: null,
            text_id: 'thought' as const,
            language: 'en',
            tier: 'expressive' as const,
        }

        await expect(apiService.withWorkspace(WORKSPACE).previewVoice(body)).resolves.toEqual(response)

        const { url, init } = requestOf(fetchMock)
        expect(url).toMatch(/\/voice-presets\/preview$/)
        expect(init.method).toBe('POST')
        expect(JSON.parse(String(init.body))).toEqual(body)
        expect((init.headers as Record<string, string>)['X-Workspace-Id']).toBeUndefined()
    })

    it('treats preview renders and catalog samples as protected media (authed blobs, D10)', () => {
        expect(isProtectedMediaUrl('/voice-presets/preview/abc.mp3')).toBe(true)
        expect(isProtectedMediaUrl('/voices/catalog/vk_0123/preview.mp3?lang=en&tier=standard&h=1')).toBe(true)
        // The render route itself (POST) is not media; only the renders under it are.
        expect(isProtectedMediaUrl('/voice-presets/preview')).toBe(false)
        expect(isProtectedMediaUrl('/voices/capabilities')).toBe(false)
    })
})
