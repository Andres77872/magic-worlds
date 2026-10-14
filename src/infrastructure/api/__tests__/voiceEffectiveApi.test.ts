import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearVoiceCapabilitiesCache } from '@/shared/voice/voiceCapabilities'
import { LEGACY_V1_VOICE } from '@/test/fixtures/legacyMinimax'
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

function initAt(index: number): RequestInit {
    return fetchMock.mock.calls[index][1] as RequestInit
}

const EFFECTIVE = {
    voice_key: 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f',
    display_name: 'Eldrin',
    provider_route: 'elevenlabs',
    substitution_reason: null,
    flags: [],
    badges: [],
}

describe('effective voice and review flag API (R1-FE-03)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
        localStorage.setItem('magic_worlds:token', 'token-1')
        vi.stubGlobal('fetch', fetchMock)
        vi.stubEnv('VITE_FEATURE_VOICES_ENABLED', 'true')
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.unstubAllEnvs()
        vi.restoreAllMocks()
        localStorage.clear()
    })

    it('reads a document ref through its workspace client, with the selector', async () => {
        const body = { ref_type: 'card', ref_id: 'card-1', voices: [{ json_path: 'voice', effective_voice: EFFECTIVE }] }
        fetchMock.mockImplementation(async () => jsonResponse(body))

        await expect(apiService.withWorkspace(WS_A).getEffectiveVoice('card', 'card-1')).resolves.toEqual(body)

        const url = urlAt(0)
        expect(url.pathname).toMatch(/\/voices\/effective$/)
        expect(Object.fromEntries(url.searchParams)).toEqual({ ref_type: 'card', ref_id: 'card-1' })
        expect(initAt(0).method).toBe('GET')
        expect(headersAt(0)['X-Workspace-Id']).toBe(WS_A)
    })

    it('reads a preset ref at account level, even through a workspace client', async () => {
        fetchMock.mockImplementation(async () => jsonResponse({ ref_type: 'preset', ref_id: 'p1', voices: [] }))

        await apiService.withWorkspace(WS_A).getEffectiveVoice('preset', 'p1')

        expect(Object.fromEntries(urlAt(0).searchParams)).toEqual({ ref_type: 'preset', ref_id: 'p1' })
        expect(headersAt(0)).not.toHaveProperty('X-Workspace-Id')
    })

    it('lists review flags unscoped and maps a 404 (route not deployed) to no flags', async () => {
        const list = {
            items: [{ flag_id: 7, ref_type: 'preset', ref_id: 'p1', json_path: 'voice', flags: ['pitch_dropped'], created_at: null, organization: null }],
        }
        fetchMock.mockImplementationOnce(async () => jsonResponse(list))
        await expect(apiService.withWorkspace(WS_A).listVoiceReviewFlags()).resolves.toEqual(list)
        expect(urlAt(0).pathname).toMatch(/\/voices\/review-flags$/)
        expect(headersAt(0)).not.toHaveProperty('X-Workspace-Id')

        fetchMock.mockImplementationOnce(async () => jsonResponse({ detail: 'Not Found' }, 404))
        await expect(apiService.listVoiceReviewFlags()).resolves.toEqual({ items: [] })

        fetchMock.mockImplementationOnce(async () => jsonResponse({ detail: 'boom' }, 500))
        await expect(apiService.listVoiceReviewFlags()).rejects.toMatchObject({ status: 500 })
    })

    it('dismisses a flag with a POST (204) and treats a 404 as already dismissed', async () => {
        fetchMock.mockImplementationOnce(async () => new Response(null, { status: 204 }))
        await expect(apiService.dismissVoiceReviewFlag(7)).resolves.toBeUndefined()
        expect(urlAt(0).pathname).toMatch(/\/voices\/review-flags\/7\/dismiss$/)
        expect(initAt(0).method).toBe('POST')
        expect(headersAt(0)).not.toHaveProperty('X-Workspace-Id')

        fetchMock.mockImplementationOnce(async () => jsonResponse({ detail: 'Review flag not found' }, 404))
        await expect(apiService.dismissVoiceReviewFlag(8)).resolves.toBeUndefined()

        fetchMock.mockImplementationOnce(async () => jsonResponse({ detail: 'boom' }, 500))
        await expect(apiService.dismissVoiceReviewFlag(9)).rejects.toMatchObject({ status: 500 })
    })

    describe('write boundary (D35): the projections never reach a write body', () => {
        // A V1 voice with a padded id: re-sent byte-identical (D32), never normalised.
        const V1 = { ...LEGACY_V1_VOICE, voice_id: ` ${LEGACY_V1_VOICE.voice_id} `, pitch: 2 }
        const V2 = { schema_version: 2, provider: 'elevenlabs', voice_key: EFFECTIVE.voice_key, voice_name: 'Eldrin', settings: null, emotion: null, language_code: null }
        const card = () => ({
            name: 'Mira',
            voice: V1,
            effective_voice: EFFECTIVE,
            category: [{ id: 'stats', attributes: [{ effective_voice: EFFECTIVE, label: 'kept' }] }],
        })
        const template = () => ({
            name: 'Harbour',
            narrator_voice: V2,
            effective_narrator_voice: EFFECTIVE,
            characters: [{ name: 'Mira', voice: V1, effective_voice: EFFECTIVE }, { name: 'Tobias', voice: null }],
            persona: { name: 'Me', voice: V2, effective_voice: EFFECTIVE },
        })
        const preset = () => ({ name: 'P', description: null, voice_key: EFFECTIVE.voice_key, settings: null, emotion: null, effective_voice: EFFECTIVE })

        const writes: Array<[string, () => Promise<unknown>, () => unknown]> = []
        const register = (name: string, input: () => unknown, call: (body: never) => Promise<unknown>) => {
            const body = input()
            writes.push([name, () => call(body as never), () => body])
        }
        register('createCharacter', card, (body) => apiService.withWorkspace(WS_A).createCharacter(body))
        register('saveCardDraft', card, (body) => apiService.withWorkspace(WS_A).saveCardDraft('character', 'card-1', body))
        register('createAdventureTemplate', template, (body) => apiService.withWorkspace(WS_A).createAdventureTemplate(body))
        register('updateAdventureTemplate', template, (body) => apiService.withWorkspace(WS_A).updateAdventureTemplate('tpl-1', body))
        register('createVoicePreset', preset, (body) => apiService.createVoicePreset(body))
        register('updateVoicePreset', preset, (body) => apiService.updateVoicePreset('p1', body))
        register(
            'updateAdventureSnapshot',
            () => ({ template: template(), narrator_voice: V1, effective_narrator_voice: EFFECTIVE, narrate_thoughts: true }),
            (body) => apiService.withWorkspace(WS_A).updateAdventureSnapshot(5, body),
        )

        it.each(writes.map(([name, call, input]) => ({ name, call, input })))('$name strips them at any depth, keeps V1 bytes, mutates nothing', async ({ call, input }) => {
            fetchMock.mockImplementation(async () => jsonResponse({ ok: true }))
            const before = JSON.stringify(input())
            await call()
            const raw = String(initAt(0).body)
            expect(raw).not.toContain('effective_voice')
            expect(raw).not.toContain('effective_narrator_voice')
            if (before.includes('voice_id')) expect(raw).toContain('"voice_id":" English_radiant_girl "')
            // The caller's object is untouched (copy-on-write).
            expect(JSON.stringify(input())).toBe(before)
        })

        it('covers all seven write methods', () => {
            expect(writes.map(([name]) => name)).toHaveLength(7)
        })
    })

    it('refuses while voices are disabled', async () => {
        vi.stubEnv('VITE_FEATURE_VOICES_ENABLED', 'false')
        await expect(apiService.getEffectiveVoice('preset', 'p1')).rejects.toThrow('Voices are disabled.')
        await expect(apiService.listVoiceReviewFlags()).rejects.toThrow('Voices are disabled.')
        await expect(apiService.dismissVoiceReviewFlag(1)).rejects.toThrow('Voices are disabled.')
        expect(fetchMock).not.toHaveBeenCalled()
    })
})

describe('peekVoiceCapabilities (warm-cache first frame)', () => {
    const BODY = {
        provider_route: 'elevenlabs',
        surfaces: {
            narration: {
                standard: {
                    controls: ['stability', 'similarity_boost', 'speed'],
                    ranges: { stability: [0, 1], similarity_boost: [0, 1], speed: [0.7, 1.2] },
                    defaults: { stability: 0.5, similarity_boost: 0.75, speed: 1 },
                    supports_emotion: false, supports_speed: true, max_chars: 40000, max_turn_chars: 2500, healthy: true,
                },
            },
        },
    }

    beforeEach(() => {
        vi.clearAllMocks()
        clearVoiceCapabilitiesCache()
        localStorage.clear()
        localStorage.setItem('magic_worlds:token', 'token-peek')
        vi.stubGlobal('fetch', fetchMock)
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
        clearVoiceCapabilitiesCache()
        localStorage.clear()
    })

    it('answers the settled read synchronously, per account, within the cache lifetime, and never requests', async () => {
        localStorage.setItem('magic_worlds:token', 'token-cold')
        expect(apiService.peekVoiceCapabilities()).toBeNull()
        localStorage.setItem('magic_worlds:token', 'token-peek')
        fetchMock.mockImplementation(async () => jsonResponse(BODY))
        const read = await apiService.getVoiceCapabilities()
        expect(apiService.peekVoiceCapabilities()).toBe(read)
        expect(apiService.withWorkspace(WS_A).peekVoiceCapabilities()).toBe(read)
        expect(read.provider_route).toBe('elevenlabs')
        expect(fetchMock).toHaveBeenCalledTimes(1)

        localStorage.setItem('magic_worlds:token', 'token-other')
        expect(apiService.peekVoiceCapabilities()).toBeNull()
        localStorage.setItem('magic_worlds:token', 'token-peek')

        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(Date.now() + 61_000)
        expect(apiService.peekVoiceCapabilities()).toBeNull()
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('forgets the snapshot when the latest read fails', async () => {
        fetchMock.mockImplementationOnce(async () => jsonResponse(BODY))
        await apiService.getVoiceCapabilities({ fresh: true })
        expect(apiService.peekVoiceCapabilities()).not.toBeNull()
        fetchMock.mockImplementationOnce(async () => jsonResponse({ ok: true }))
        await expect(apiService.getVoiceCapabilities({ fresh: true })).rejects.toMatchObject({ status: 502 })
        expect(apiService.peekVoiceCapabilities()).toBeNull()
    })
})
