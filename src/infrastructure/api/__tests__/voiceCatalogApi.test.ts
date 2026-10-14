import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearVoiceCapabilitiesCache } from '@/shared/voice/voiceCapabilities'
import { apiService } from '../index'

const WS_A = '0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b'

const fetchMock = vi.fn()

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function headersAt(index: number): Record<string, string> {
    return (fetchMock.mock.calls[index][1] as RequestInit).headers as Record<string, string>
}

function urlAt(index: number): URL {
    return new URL(String(fetchMock.mock.calls[index][0]), 'http://localhost')
}

const CAPABILITIES = {
    surfaces: {
        narration: {
            standard: {
                controls: ['stability', 'similarity_boost', 'speed', 'emotion'],
                ranges: { stability: [0, 1], similarity_boost: [0, 1], speed: [0.7, 1.2] },
                defaults: { stability: 0.5, similarity_boost: 0.75, speed: 1 },
                supports_emotion: true, supports_speed: true, max_chars: 40000, max_turn_chars: 2500, healthy: false,
            },
        },
    },
}

describe('voice catalog and capabilities API (08 §5.1)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
        localStorage.setItem('magic_worlds:token', 'token-1')
        vi.stubGlobal('fetch', fetchMock)
        vi.stubEnv('VITE_FEATURE_VOICES_ENABLED', 'true')
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        clearVoiceCapabilitiesCache()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.unstubAllEnvs()
        vi.restoreAllMocks()
        clearVoiceCapabilitiesCache()
    })

    it('reads the account profile unscoped, even through a workspace client (09 §2.1)', async () => {
        fetchMock.mockImplementation(async () => jsonResponse({ user_hash: 'u1', membership: {} }))

        await apiService.withWorkspace(WS_A).getUserProfile()

        expect(urlAt(0).pathname).toMatch(/\/user\/me$/)
        expect(headersAt(0)).not.toHaveProperty('X-Workspace-Id')
    })

    it('maps GET /voices/capabilities to the view model, unscoped, and caches it', async () => {
        fetchMock.mockImplementation(async () => jsonResponse(CAPABILITIES))

        const capabilities = await apiService.withWorkspace(WS_A).getVoiceCapabilities()
        await apiService.getVoiceCapabilities()

        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(urlAt(0).pathname).toMatch(/\/voices\/capabilities$/)
        expect(headersAt(0)).not.toHaveProperty('X-Workspace-Id')
        expect(capabilities.surfaces[0].controls.map((control) => control.key)).toEqual(['stability', 'similarity_boost', 'speed'])
        expect(capabilities.surfaces[0].healthy).toBe(false)
        expect(capabilities.status.auto_narration_paused).toBe(false)

        await apiService.getVoiceCapabilities({ fresh: true })
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('rejects an unrecognised capabilities body and does not cache the failure', async () => {
        fetchMock.mockImplementationOnce(async () => jsonResponse({ ok: true }))
        await expect(apiService.getVoiceCapabilities()).rejects.toMatchObject({ status: 502 })

        fetchMock.mockImplementationOnce(async () => jsonResponse(CAPABILITIES))
        await expect(apiService.getVoiceCapabilities()).resolves.toMatchObject({ provider_route: 'elevenlabs', consent_version_required: 'voice-v2' })
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('lists a catalog page with filters and the cursor, unscoped', async () => {
        fetchMock.mockImplementation(async () => jsonResponse({
            items: [{ voice_key: 'vk_a', display_name: 'Ana', status: 'active' }, { display_name: 'broken' }],
            next_cursor: 'c2',
        }))

        const page = await apiService.withWorkspace(WS_A).listVoiceCatalog({ language: 'es', works_in_calls: true, limit: 20 }, 'c1')

        const url = urlAt(0)
        expect(url.pathname).toMatch(/\/voices\/catalog$/)
        expect(Object.fromEntries(url.searchParams)).toEqual({ language: 'es', works_in_calls: 'true', after: 'c1', limit: '20' })
        expect(headersAt(0)).not.toHaveProperty('X-Workspace-Id')
        expect(page.items.map((voice) => voice.voice_key)).toEqual(['vk_a'])
        expect(page.next_cursor).toBe('c2')
    })

    it('keeps the card workspace selector for recommended_for (08 §5.1)', async () => {
        fetchMock.mockImplementation(async () => jsonResponse({ items: [], next_cursor: null }))

        await apiService.withWorkspace(WS_A).listVoiceCatalog({ recommended_for: 'card-7' })

        expect(urlAt(0).searchParams.get('recommended_for')).toBe('card-7')
        expect(headersAt(0)['X-Workspace-Id']).toBe(WS_A)
    })

    it('looks up keys in batches of 100 and merges the items', async () => {
        fetchMock.mockImplementation(async (url: string) => {
            const keys = new URL(url, 'http://localhost').searchParams.get('keys')!.split(',')
            return jsonResponse({ items: keys.map((key) => ({ voice_key: key, display_name: key.toUpperCase(), status: 'removed' })) })
        })
        const keys = Array.from({ length: 150 }, (_, index) => `vk_${index}`)

        const items = await apiService.getVoiceCatalogByKeys([...keys, 'vk_1', ''])

        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(urlAt(0).searchParams.get('keys')!.split(',')).toHaveLength(100)
        expect(urlAt(1).searchParams.get('keys')!.split(',')).toHaveLength(50)
        expect(items).toHaveLength(150)
        expect(items[0].status).toBe('removed')
        await expect(apiService.getVoiceCatalogByKeys([])).resolves.toEqual([])
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('tolerates a server without the catalog route (404) as an error the caller handles', async () => {
        fetchMock.mockImplementation(async () => jsonResponse({ detail: 'Not Found' }, 404))
        await expect(apiService.listVoiceCatalog()).rejects.toMatchObject({ status: 404 })
    })

    it('no longer carries the dead waitForTts and getCharacterChatCalls methods', () => {
        expect('waitForTts' in apiService).toBe(false)
        expect('getCharacterChatCalls' in apiService).toBe(false)
    })
})
