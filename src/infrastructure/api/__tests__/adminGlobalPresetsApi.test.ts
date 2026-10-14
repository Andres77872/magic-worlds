import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdminGlobalPresetInput } from '@/shared'
import { apiService } from '../index'

/**
 * Root global presets (EP-5, `/admin/voice-presets/global`; R1-FE-06): exact URLs
 * and bodies, account level (never a workspace scope, even on a scoped client).
 */

const WS_A = '0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b'

const fetchMock = vi.fn()

function response(body: unknown, status = 200): Response {
    return status === 204
        ? new Response(null, { status })
        : new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const call = (index = 0) => fetchMock.mock.calls[index] as [string, RequestInit]
const pathOf = (index = 0) => new URL(call(index)[0], 'http://localhost').pathname
const headersOf = (index = 0) => call(index)[1].headers as Record<string, string>
const bodyOf = (index = 0) => {
    const body = call(index)[1].body
    return typeof body === 'string' ? JSON.parse(body) : body
}

const INPUT: AdminGlobalPresetInput = {
    name: 'Calm narrator',
    description: null,
    voice_key: 'vk_0123456789abcdef0123456789abcdef',
    settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed: 1 },
    emotion: null,
    language_code: 'en',
}

const ROW = {
    preset_id: 'gp-1',
    ...INPUT,
    voice_name: 'Ava',
    is_global: true,
    schema_version: 2,
    provider: 'elevenlabs',
    voice_public: true,
    seed_key: 'en:narrator',
}

describe('admin global presets API (EP-5)', () => {
    beforeEach(() => {
        vi.stubEnv('VITE_FEATURE_VOICES_ENABLED', 'true')
        localStorage.clear()
        localStorage.setItem('magic_worlds:token', 'root-token')
        fetchMock.mockReset()
        fetchMock.mockImplementation(async () => response(ROW))
        vi.stubGlobal('fetch', fetchMock)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.unstubAllEnvs()
        vi.restoreAllMocks()
        localStorage.clear()
    })

    it('lists the global presets', async () => {
        fetchMock.mockImplementationOnce(async () => response({ items: [ROW] }))
        expect(await apiService.listAdminGlobalPresets()).toEqual({ items: [ROW] })
        expect(pathOf()).toBe('/admin/voice-presets/global')
        expect(call()[1].method).toBe('GET')
        expect(headersOf().Authorization).toBe('Bearer root-token')
        expect(headersOf()).not.toHaveProperty('X-Workspace-Id')
    })

    it('creates a global preset with the exact body', async () => {
        expect(await apiService.createAdminGlobalPreset(INPUT)).toEqual(ROW)
        expect(pathOf()).toBe('/admin/voice-presets/global')
        expect(call()[1].method).toBe('POST')
        expect(bodyOf()).toEqual(INPUT)
    })

    it('updates with a partial body and an encoded id', async () => {
        await apiService.updateAdminGlobalPreset('gp/1', { name: 'Renamed', language_code: null })
        expect(call()[0]).toContain('/admin/voice-presets/global/gp%2F1')
        expect(call()[1].method).toBe('PUT')
        expect(bodyOf()).toEqual({ name: 'Renamed', language_code: null })
    })

    it('deletes by id (204)', async () => {
        fetchMock.mockImplementationOnce(async () => response(null, 204))
        await expect(apiService.deleteAdminGlobalPreset('gp-1')).resolves.toBeUndefined()
        expect(pathOf()).toBe('/admin/voice-presets/global/gp-1')
        expect(call()[1].method).toBe('DELETE')
    })

    it('never sends a workspace scope, even from a scoped client', async () => {
        const scoped = apiService.withWorkspace(WS_A)
        fetchMock.mockImplementationOnce(async () => response({ items: [] }))
        await scoped.listAdminGlobalPresets()
        await scoped.createAdminGlobalPreset(INPUT)
        await scoped.updateAdminGlobalPreset('gp-1', { name: 'x' })
        fetchMock.mockImplementationOnce(async () => response(null, 204))
        await scoped.deleteAdminGlobalPreset('gp-1')
        for (let index = 0; index < 4; index += 1) expect(headersOf(index)).not.toHaveProperty('X-Workspace-Id')
    })

    it.each([
        [422, { code: 'voice_not_eligible', path: 'voice' }],
        [409, { code: 'global_preset_seed_exists', preset_id: 'gp-0' }],
    ])('surfaces a %s refusal with its code', async (status, detail) => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        fetchMock.mockImplementationOnce(async () => response({ detail: { ...detail, message: 'refused' } }, status))
        await expect(apiService.createAdminGlobalPreset(INPUT)).rejects.toMatchObject({ status, code: detail.code })
    })
})
