import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionVoiceSettings } from '@/shared/types/sessionVoice.types'
import { apiService } from '../index'

/**
 * Session voice settings and the D36 refresh (EP-1, EP-2; R1-FE-04): exact URLs,
 * bodies and the session workspace scope (`withWorkspace`, ER-G1).
 */

const WS_A = '0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b'

const fetchMock = vi.fn()

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const call = (index = 0) => fetchMock.mock.calls[index] as [string, RequestInit]
const pathOf = (index = 0) => {
    const url = new URL(call(index)[0], 'http://localhost')
    return url.pathname + url.search
}
const headersOf = (index = 0) => call(index)[1].headers as Record<string, string>
const bodyOf = (index = 0) => {
    const body = call(index)[1].body
    return typeof body === 'string' ? JSON.parse(body) : body
}

/** The exact EP-1 response DTO. */
const SETTINGS: SessionVoiceSettings = {
    session_id: 12,
    tier_override: 'standard',
    effective_tier: 'standard',
    tier_fallback_reason: null,
    tiers_allowed: ['standard', 'expressive'],
    provider_route: 'elevenlabs',
    updated_at: '2026-10-01T12:00:00Z',
}

describe('session voice API (EP-1, EP-2)', () => {
    beforeEach(() => {
        vi.stubEnv('VITE_FEATURE_VOICES_ENABLED', 'true')
        localStorage.clear()
        localStorage.setItem('magic_worlds:token', 'user-token')
        fetchMock.mockReset()
        fetchMock.mockImplementation(async () => jsonResponse(SETTINGS))
        vi.stubGlobal('fetch', fetchMock)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.unstubAllEnvs()
        vi.restoreAllMocks()
        localStorage.clear()
    })

    it.each(['adventure-sessions', 'character-chats'] as const)('reads %s voice settings on the session workspace', async (basePath) => {
        expect(await apiService.withWorkspace(WS_A).getSessionVoiceSettings(basePath, 12)).toEqual(SETTINGS)
        expect(pathOf()).toBe(`/${basePath}/12/voice-settings`)
        expect(call()[1].method).toBe('GET')
        expect(headersOf()['X-Workspace-Id']).toBe(WS_A)
        expect(headersOf().Authorization).toBe('Bearer user-token')
    })

    it('writes the session tier override, and null clears it', async () => {
        const scoped = apiService.withWorkspace(WS_A)
        await scoped.setSessionNarrationTier('character-chats', 4, 'expressive')
        expect(pathOf(0)).toBe('/character-chats/4/voice-settings')
        expect(call(0)[1].method).toBe('PUT')
        expect(bodyOf(0)).toEqual({ tier_override: 'expressive' })
        expect(headersOf(0)['X-Workspace-Id']).toBe(WS_A)

        await scoped.setSessionNarrationTier('adventure-sessions', 9, null)
        expect(pathOf(1)).toBe('/adventure-sessions/9/voice-settings')
        expect(bodyOf(1)).toEqual({ tier_override: null })
    })

    it('refreshes a 1:1 chat voice with an empty body', async () => {
        fetchMock.mockImplementationOnce(async () => jsonResponse({ id: 4, kind: 'character' }))
        expect(await apiService.withWorkspace(WS_A).refreshChatVoice(4)).toEqual({ id: 4, kind: 'character' })
        expect(pathOf()).toBe('/character-chats/4/voice/refresh')
        expect(call()[1].method).toBe('POST')
        expect(bodyOf()).toEqual({})
        expect(headersOf()['X-Workspace-Id']).toBe(WS_A)
    })

    it('refreshes adventure voices for the named cards, or every card with null (R-30)', async () => {
        const scoped = apiService.withWorkspace(WS_A)
        fetchMock.mockImplementation(async () => jsonResponse({ id: 9 }))
        await scoped.refreshAdventureVoices(9, ['card-1'])
        expect(pathOf(0)).toBe('/adventure-sessions/9/voices/refresh')
        expect(call(0)[1].method).toBe('POST')
        expect(bodyOf(0)).toEqual({ card_ids: ['card-1'] })
        expect(headersOf(0)['X-Workspace-Id']).toBe(WS_A)

        await scoped.refreshAdventureVoices(9, null)
        expect(bodyOf(1)).toEqual({ card_ids: null })
    })

    it('surfaces refusals with their code', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        fetchMock.mockImplementationOnce(async () => jsonResponse({ detail: { code: 'voice_refresh_busy', message: 'busy' } }, 409))
        await expect(apiService.withWorkspace(WS_A).refreshChatVoice(4)).rejects.toMatchObject({ status: 409, code: 'voice_refresh_busy' })
    })

    it('sends nothing while voices are disabled', async () => {
        vi.stubEnv('VITE_FEATURE_VOICES_ENABLED', 'false')
        await expect(apiService.withWorkspace(WS_A).getSessionVoiceSettings('character-chats', 4)).rejects.toThrow()
        expect(fetchMock).not.toHaveBeenCalled()
    })
})
