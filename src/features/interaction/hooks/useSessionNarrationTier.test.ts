import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import type { VoiceCapabilities } from '@/shared/types'
import type { SessionVoiceSettings } from '@/shared/types/sessionVoice.types'
import { toVoiceCapabilities } from '@/shared/voice/voiceCapabilities'
import { BFF_EL_PLUS_BODY, BFF_R0_BODY } from '@/shared/voice/voiceCapabilities.fixtures'
import { sessionVoiceErrorKey, useSessionNarrationTier } from './useSessionNarrationTier'

const caps = toVoiceCapabilities(BFF_EL_PLUS_BODY) as VoiceCapabilities
const settings: SessionVoiceSettings = {
    session_id: 12,
    tier_override: null,
    effective_tier: 'expressive',
    tier_fallback_reason: null,
    tiers_allowed: ['standard', 'expressive'],
    provider_route: 'elevenlabs',
    updated_at: null,
}

describe('sessionVoiceErrorKey', () => {
    it('maps the session tier and workspace refusals', () => {
        expect(sessionVoiceErrorKey(new ApiError(422, 'x', { code: 'voice_plan_locked' }))).toBe('voices.errors.planLocked')
        expect(sessionVoiceErrorKey(new ApiError(422, 'x', { code: 'voice_tier_unavailable' }))).toBe('voices.errors.tierUnavailable')
        expect(sessionVoiceErrorKey(new ApiError(409, 'x', { code: 'WORKSPACE_ARCHIVED' }))).toBe('workspaceContent.saveErrors.archived')
        expect(sessionVoiceErrorKey(new ApiError(500, 'x'))).toBe('voices.errors.budgetUnavailable')
        expect(sessionVoiceErrorKey(new Error('network'))).toBe('voices.errors.budgetUnavailable')
    })
})

describe('useSessionNarrationTier', () => {
    it('reads nothing without a persisted session id', async () => {
        const api = { getVoiceCapabilities: vi.fn(async () => caps), getSessionVoiceSettings: vi.fn(async () => settings) }
        const { result } = renderHook(() => useSessionNarrationTier(api, 'adventure-sessions', null))
        await act(async () => {})
        expect(api.getVoiceCapabilities).not.toHaveBeenCalled()
        expect(result.current.settings).toBeNull()
        expect(result.current.loading).toBe(false)
    })

    it('reads the settings of the session on the given route and saves through PUT', async () => {
        const api = {
            getVoiceCapabilities: vi.fn(async () => caps),
            getSessionVoiceSettings: vi.fn(async () => settings),
            setSessionNarrationTier: vi.fn(async () => ({ ...settings, tier_override: 'standard' as const, effective_tier: 'standard' as const })),
        }
        const { result } = renderHook(() => useSessionNarrationTier(api, 'adventure-sessions', 12))
        await waitFor(() => expect(result.current.settings).toEqual(settings))
        expect(api.getSessionVoiceSettings).toHaveBeenCalledWith('adventure-sessions', 12)
        await act(async () => {
            await result.current.setTier('standard')
        })
        expect(api.setSessionNarrationTier).toHaveBeenCalledWith('adventure-sessions', 12, 'standard')
        expect(result.current.settings?.effective_tier).toBe('standard')
        expect(result.current.error).toBeNull()
    })

    it('reads the settings for every caller, whatever the plan (I-68: no cohort)', async () => {
        const free = toVoiceCapabilities(BFF_R0_BODY) as VoiceCapabilities
        const api = { getVoiceCapabilities: vi.fn(async () => free), getSessionVoiceSettings: vi.fn(async () => settings) }
        const { result } = renderHook(() => useSessionNarrationTier(api, 'character-chats', 12))
        await waitFor(() => expect(result.current.settings).toEqual(settings))
        expect(api.getSessionVoiceSettings).toHaveBeenCalledWith('character-chats', 12)
    })

    it('fails closed on a failed capabilities or settings read', async () => {
        const noCaps = { getVoiceCapabilities: vi.fn(async () => { throw new Error('offline') }), getSessionVoiceSettings: vi.fn(async () => settings) }
        const first = renderHook(() => useSessionNarrationTier(noCaps, 'character-chats', 12))
        await waitFor(() => expect(first.result.current.loading).toBe(false))
        expect(first.result.current.settings).toBeNull()
        expect(noCaps.getSessionVoiceSettings).not.toHaveBeenCalled()

        const notFound = { getVoiceCapabilities: vi.fn(async () => caps), getSessionVoiceSettings: vi.fn(async () => { throw new ApiError(404, 'Not Found') }) }
        const second = renderHook(() => useSessionNarrationTier(notFound, 'adventure-sessions', 12))
        await waitFor(() => expect(second.result.current.loading).toBe(false))
        expect(second.result.current.settings).toBeNull()
    })
})
