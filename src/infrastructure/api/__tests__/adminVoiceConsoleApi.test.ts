import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiService } from '../index'

const apiSource = Object.values(
    import.meta.glob<string>('/src/infrastructure/api/index.ts', { query: '?raw', import: 'default', eager: true }),
)[0]

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

function audioResponse(bytes: number[], headers: Record<string, string>): Response {
    const make = (): Response =>
        ({
            ok: true,
            status: 200,
            statusText: 'OK',
            headers: new Headers({ 'Content-Type': 'audio/mpeg', ...headers }),
            clone: make,
            blob: async () => new Blob([new Uint8Array(bytes)], { type: 'audio/mpeg' }),
            text: async () => '',
            json: async () => ({}),
        }) as unknown as Response
    return make()
}

type FetchCall = [string, RequestInit]

describe('root voice console API (08 §5.3)', () => {
    let fetchMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
        setTestFeatureFlags({ voices: true })
        localStorage.clear()
        localStorage.setItem('magic_worlds:token', 'root-token')
        fetchMock = vi.fn(async () => jsonResponse({ items: [] }))
        vi.stubGlobal('fetch', fetchMock)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.unstubAllEnvs()
        vi.restoreAllMocks()
        localStorage.clear()
    })

    const lastCall = () => fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as FetchCall
    const path = (call: FetchCall) => new URL(call[0], 'http://localhost').pathname + new URL(call[0], 'http://localhost').search

    it('lists the catalog with server filters and the bearer token', async () => {
        await apiService.listAdminCatalog({ status: 'active', call_eligible: true, q: 'mar', limit: 50 })
        const [url, init] = lastCall()
        expect(path([url, init])).toBe('/admin/voices/catalog?status=active&call_eligible=true&q=mar&limit=50')
        expect(init.method).toBe('GET')
        expect((init.headers as Record<string, string>).Authorization).toBe('Bearer root-token')
    })

    it('browses licensed Fish voices with encoded language, name and pagination filters', async () => {
        await apiService.getFishReferences('es', '  Voz & calma  ', 2)
        const [url, init] = lastCall()
        const params = new URL(url, 'http://localhost').searchParams
        expect(new URL(url, 'http://localhost').pathname).toBe('/admin/voices/fish/references')
        expect(Object.fromEntries(params)).toEqual({ language: 'es', page: '2', q: 'Voz & calma' })
        expect(init.method).toBe('GET')
        expect((init.headers as Record<string, string>).Authorization).toBe('Bearer root-token')
        expect((init.headers as Record<string, string>)['X-Workspace-Id']).toBeUndefined()
    })

    it.each([
        ['updateAdminCatalogVoice', () => apiService.updateAdminCatalogVoice('vk_1', { status: 'hidden' }), 'PATCH', '/admin/voices/catalog/vk_1', { status: 'hidden' }],
        ['getAdminCatalogImpact', () => apiService.getAdminCatalogImpact('vk_1'), 'GET', '/admin/voices/catalog/vk_1/impact', undefined],
        ['syncAdminCatalog', () => apiService.syncAdminCatalog({ job: 'B', voice_keys: ['vk_1'] }), 'POST', '/admin/voices/sync', { job: 'B', voice_keys: ['vk_1'] }],
        [
            'renderAcceptance',
            () => apiService.renderAcceptance({ voice_key: 'vk_1', model_ids: ['eleven_flash_v2_5'], languages: ['en'], script_version: 'acc-v1' }),
            'POST',
            '/admin/voices/acceptance/renders',
            { voice_key: 'vk_1', model_ids: ['eleven_flash_v2_5'], languages: ['en'], script_version: 'acc-v1' },
        ],
        [
            'putAcceptanceVerdict',
            () => apiService.putAcceptanceVerdict('vk_1', 'eleven_v4', 'es', { verdict: 'fail', scores: { timbre: 1, naturalness: 1, emotion_tags: 1, accent: 1, artefacts: 1, consistency_vs_v4: 1 } }),
            'PUT',
            '/admin/voices/acceptance/vk_1/eleven_v4/es',
            { verdict: 'fail', scores: { timbre: 1, naturalness: 1, emotion_tags: 1, accent: 1, artefacts: 1, consistency_vs_v4: 1 } },
        ],
        ['renderCatalogSamples', () => apiService.renderCatalogSamples('vk_1', { languages: ['en'] }), 'POST', '/admin/voices/catalog/vk_1/samples', { languages: ['en'] }],
        ['getVoiceDefaults', () => apiService.getVoiceDefaults(), 'GET', '/admin/voices/defaults', undefined],
        ['putVoiceDefaults', () => apiService.putVoiceDefaults('character_fallback', 'es', ['vk_1', 'vk_2']), 'PUT', '/admin/voices/defaults/character_fallback/es', { voice_keys: ['vk_1', 'vk_2'] }],
        [
            'addAdminLibraryVoice',
            () => apiService.addAdminLibraryVoice({ public_owner_id: 'o', library_voice_id: 'l', new_name: 'N', attest_not_child_like: true, attest_no_public_figure: true }),
            'POST',
            '/admin/voices/library/add',
            { public_owner_id: 'o', library_voice_id: 'l', new_name: 'N', attest_not_child_like: true, attest_no_public_figure: true },
        ],
        [
            'designAdminVoice',
            () => apiService.designAdminVoice({ voice_description: 'A warm narrator voice for testing', text: null, auto_generate_text: true }),
            'POST',
            '/admin/voices/design',
            { voice_description: 'A warm narrator voice for testing', text: null, auto_generate_text: true },
        ],
        [
            'saveAdminDesign',
            () =>
                apiService.saveAdminDesign({
                    generated_voice_id: 'g1',
                    voice_name: 'N',
                    voice_description: 'D',
                    labels: { language: 'en', accent: null, gender: null, age: null },
                    played_not_selected_voice_ids: ['g2', 'g3'],
                    parent_voice_key: 'vk_1',
                }),
            'POST',
            '/admin/voices/design/save',
            {
                generated_voice_id: 'g1',
                voice_name: 'N',
                voice_description: 'D',
                labels: { language: 'en', accent: null, gender: null, age: null },
                played_not_selected_voice_ids: ['g2', 'g3'],
                parent_voice_key: 'vk_1',
            },
        ],
        ['remixAdminVoice', () => apiService.remixAdminVoice('vk_1', { voice_description: 'older', text: null, auto_generate_text: true, guidance_scale: 2 }), 'POST', '/admin/voices/catalog/vk_1/remix', { voice_description: 'older', text: null, auto_generate_text: true, guidance_scale: 2 }],
        ['getVoiceLimits', () => apiService.getVoiceLimits(), 'GET', '/admin/voices/limits', undefined],
        ['getRuntimeSettings', () => apiService.getRuntimeSettings(), 'GET', '/admin/voices/runtime-settings', undefined],
        ['putRuntimeSetting', () => apiService.putRuntimeSetting('daily_budget_chars', 120000), 'PUT', '/admin/voices/runtime-settings/daily_budget_chars', { value_json: 120000 }],
    ] as const)('%s calls the documented route', async (_name, call, method, expectedPath, body) => {
        await call()
        const [url, init] = lastCall()
        expect(path([url, init])).toBe(expectedPath)
        expect(init.method).toBe(method)
        if (body === undefined) expect(init.body).toBeUndefined()
        else expect(JSON.parse(init.body as string)).toEqual(body)
        expect((init.headers as Record<string, string>)['X-Workspace-Id']).toBeUndefined()
    })

    it('always sends the enforced Library filters (AC-R6)', async () => {
        await apiService.listAdminLibrary({ search: 'harbour', sort: 'trending', page: 1 })
        const url = new URL(lastCall()[0], 'http://localhost')
        expect(url.pathname).toBe('/admin/voices/library')
        expect(Object.fromEntries(url.searchParams)).toEqual({
            search: 'harbour',
            sort: 'trending',
            page: '1',
            min_notice_period_days: '365',
            include_custom_rates: 'false',
            include_live_moderated: 'false',
        })
    })

    it('never lets a caller loosen the enforced Library filters (AC-R6, R1-FE-06 audit)', async () => {
        const loosened = { search: 'x', min_notice_period_days: 0, include_custom_rates: true, include_live_moderated: true } as Parameters<typeof apiService.listAdminLibrary>[0]
        await apiService.listAdminLibrary(loosened)
        const params = Object.fromEntries(new URL(lastCall()[0], 'http://localhost').searchParams)
        expect(params).toMatchObject({ min_notice_period_days: '365', include_custom_rates: 'false', include_live_moderated: 'false' })
    })

    it('runs the two-step provider delete with the confirm token', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ status: 'confirmation_required', confirm_token: 'tok 1', expires_at: null }))
        const first = await apiService.deleteAdminCatalogVoice('vk_1')
        expect(first).toEqual({ status: 'confirmation_required', confirm_token: 'tok 1', expires_at: null })
        expect(path(lastCall())).toBe('/admin/voices/catalog/vk_1')
        await apiService.deleteAdminCatalogVoice('vk_1', 'tok 1')
        expect(path(lastCall())).toBe('/admin/voices/catalog/vk_1?confirm_token=tok+1')
        expect(lastCall()[1].method).toBe('DELETE')
    })

    it('returns lab audio as a Blob with the neutral request id and character cost headers (I-14), never hex', async () => {
        fetchMock.mockResolvedValueOnce(audioResponse([1, 2, 3], { 'X-Voice-Request-Id': 'req-9', 'X-Voice-Character-Cost': '54' }))
        const result = await apiService.testAdminVoice({
            voice_key: 'vk_1',
            model_alias: 'el_v4',
            text: 'Hello',
            markup_mode: 'native',
            output_format: 'mp3_44100_128',
            language_code: null,
            seed: null,
            apply_text_normalization: 'auto',
            voice_settings: { stability: 0.5 },
        })
        const [url, init] = lastCall()
        expect(path([url, init])).toBe('/admin/voices/test')
        // §2.9 (R1-FE-06): the lab accepts any audio container (mp3, wav, pcm).
        expect((init.headers as Record<string, string>).Accept).toBe('audio/*')
        expect(result.blob.size).toBe(3)
        expect(result).toMatchObject({ content_type: 'audio/mpeg', request_id: 'req-9', character_cost: 54 })
    })

    it('ignores provider header names: only X-Voice-* is read (I-14)', async () => {
        const lab = () =>
            apiService.testAdminVoice({
                voice_key: 'vk_1',
                model_alias: 'el_flash_v2_5',
                text: 'Hello',
                markup_mode: 'app',
                output_format: 'mp3_44100_128',
                language_code: 'en',
                seed: null,
                apply_text_normalization: 'auto',
                voice_settings: {},
            })
        fetchMock.mockResolvedValueOnce(audioResponse([1], { 'request-id': 'req-raw', 'character-cost': '54', 'x-request-id': 'bff-1' }))
        expect(await lab()).toMatchObject({ request_id: null, character_cost: null })
        fetchMock.mockResolvedValueOnce(audioResponse([1], { 'x-voice-request-id': ' req-2 ', 'x-voice-character-cost': '12.5' }))
        expect(await lab()).toMatchObject({ request_id: 'req-2', character_cost: null })
        fetchMock.mockResolvedValueOnce(audioResponse([1], { 'X-Voice-Character-Cost': '-3' }))
        expect(await lab()).toMatchObject({ request_id: null, character_cost: null })
        fetchMock.mockResolvedValueOnce(audioResponse([1], { 'X-Voice-Character-Cost': '0' }))
        expect(await lab()).toMatchObject({ character_cost: 0 })
    })

    it('refuses a 2xx answer that is not audio, so no unplayable clip reaches a player', async () => {
        const lab = () =>
            apiService.testAdminVoice({
                voice_key: 'vk_1',
                model_alias: 'el_flash_v2_5',
                text: 'Hello',
                markup_mode: 'app',
                output_format: 'mp3_44100_128',
                language_code: 'en',
                seed: null,
                apply_text_normalization: 'auto',
                voice_settings: {},
            })
        // The lab never decodes a JSON body, even one that carries encoded audio.
        fetchMock.mockResolvedValueOnce(jsonResponse({ audio: '49443304', content_type: 'audio/mpeg' }))
        await expect(lab()).rejects.toMatchObject({ status: 502, code: 'unexpected_audio_response' })
        fetchMock.mockResolvedValueOnce(audioResponse([1], { 'Content-Type': 'text/html' }))
        await expect(lab()).rejects.toMatchObject({ status: 502, code: 'unexpected_audio_response' })
    })

    it('returns a PCM or WAV lab answer as audio with its own content type (R1-FE-06)', async () => {
        const lab = (output_format: string) =>
            apiService.testAdminVoice({
                voice_key: 'vk_1',
                model_alias: 'el_v4',
                text: 'Hello',
                markup_mode: 'app',
                output_format,
                language_code: null,
                seed: null,
                apply_text_normalization: 'on',
                voice_settings: {},
            })
        fetchMock.mockResolvedValueOnce(audioResponse([0, 0, 1, 0], { 'Content-Type': 'audio/pcm;rate=24000' }))
        expect(await lab('pcm_24000')).toMatchObject({ content_type: 'audio/pcm;rate=24000' })
        expect(JSON.parse(lastCall()[1].body as string)).toMatchObject({ output_format: 'pcm_24000', apply_text_normalization: 'on' })
        fetchMock.mockResolvedValueOnce(audioResponse([0x52, 0x49, 0x46, 0x46], { 'Content-Type': 'audio/wav' }))
        expect(await lab('wav_44100')).toMatchObject({ content_type: 'audio/wav' })
    })

    it('reads the lab model list (A4) and lets a missing route fail through to the caller', async () => {
        const model = { model_alias: 'el_v4', label: 'v4', tier: 'expressive', available: true, unavailable_reason: null, max_chars: 3000, output_formats: ['mp3_44100_128'], text_normalization: ['auto'], supports_language_code: true, supports_seed: true, audio_tags: true, breaks: false, inline_ipa: false, settings: ['stability'] }
        fetchMock.mockResolvedValueOnce(jsonResponse({ models: [model] }))
        expect(await apiService.listAdminLabModels()).toEqual({ models: [model] })
        const [url, init] = lastCall()
        expect(path([url, init])).toBe('/admin/voices/test/models')
        expect(init.method).toBe('GET')
        expect((init.headers as Record<string, string>)['X-Workspace-Id']).toBeUndefined()

        vi.spyOn(console, 'error').mockImplementation(() => {})
        fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'Not Found' }, 404))
        await expect(apiService.listAdminLabModels()).rejects.toMatchObject({ status: 404 })
    })

    it('keeps no legacy admin route (I-13, I-68, native cutover)', () => {
        const paths = [...apiSource.matchAll(/[`'"](\/admin\/voices[^`'"]*)[`'"]/g)].map((match) => match[1])
        expect(paths.length).toBeGreaterThan(15)
        // The removed provider console routes: GET /admin/voices, clone, and DELETE /{voice_type}/{voice_id}.
        expect(paths).not.toContain('/admin/voices')
        expect(paths.filter((value) => /^\/admin\/voices\/(clone|clone-file)\b/.test(value))).toEqual([])
        expect(paths.filter((value) => /^\/admin\/voices\/\$\{[^}]*\}\/\$\{/.test(value))).toEqual([])
        // No legacy audition, inventory, fallback, mapping or coverage route.
        expect(paths.filter((value) => value.startsWith('/admin/voices/legacy'))).toEqual([])
    })

    it('surfaces API errors with their code', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ detail: { code: 'invalid_api_key', message: 'Key rejected' } }, 403))
        vi.spyOn(console, 'error').mockImplementation(() => {})
        await expect(apiService.getVoiceLimits()).rejects.toMatchObject({ status: 403, code: 'invalid_api_key' })
    })

    it('refuses every console call while voices are disabled', async () => {
        setTestFeatureFlags({ voices: false })
        await expect(apiService.listAdminCatalog()).rejects.toThrow('Voices are disabled.')
        expect(fetchMock).not.toHaveBeenCalled()
    })
})
