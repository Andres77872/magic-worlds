import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import { ApiError, type ApiService } from '@/infrastructure/api'
import type { VoiceCapabilities } from '@/shared/types'
import type { SessionVoiceSettings } from '@/shared/types/sessionVoice.types'
import { toVoiceCapabilities } from '@/shared/voice/voiceCapabilities'
import { BFF_EL_FREE_BODY, BFF_EL_PLUS_BODY, BFF_R0_BODY } from '@/shared/voice/voiceCapabilities.fixtures'
import { installVoiceNarrationCopy } from '@/test-utils/voiceNarrationCopy'
import { SessionNarrationTierToggle } from './SessionNarrationTierToggle'

const caps = (body: unknown) => toVoiceCapabilities(body) as VoiceCapabilities

const settings = (overrides: Partial<SessionVoiceSettings> = {}): SessionVoiceSettings => ({
    session_id: 7,
    tier_override: null,
    effective_tier: 'standard',
    tier_fallback_reason: null,
    tiers_allowed: ['standard', 'expressive'],
    provider_route: 'elevenlabs',
    updated_at: null,
    ...overrides,
})

function fakeApi(capabilities: VoiceCapabilities, current = settings()) {
    return {
        getVoiceCapabilities: vi.fn(async () => capabilities),
        getSessionVoiceSettings: vi.fn(async () => current),
        setSessionNarrationTier: vi.fn(async (_basePath: string, _id: number, tier: 'standard' | 'expressive' | null) => ({ ...current, tier_override: tier })),
    }
}

const asApi = (api: ReturnType<typeof fakeApi>) => api as unknown as ApiService

beforeAll(() => {
    installVoiceNarrationCopy()
})

beforeEach(async () => {
    await i18n.changeLanguage('en')
})

describe('SessionNarrationTierToggle', () => {
    it('renders for every signed-in caller, a Free plan included (I-68: no cohort)', async () => {
        const api = fakeApi(caps(BFF_R0_BODY), settings({ tiers_allowed: ['standard'] }))
        render(<SessionNarrationTierToggle api={asApi(api)} basePath="adventure-sessions" sessionId={7} />)
        expect(await screen.findByRole('radiogroup', { name: 'Narration for this session' })).toBeInTheDocument()
        expect(api.getSessionVoiceSettings).toHaveBeenCalledWith('adventure-sessions', 7)
    })

    it('renders nothing when the capabilities read fails', async () => {
        const api = fakeApi(caps(BFF_EL_PLUS_BODY))
        api.getVoiceCapabilities.mockRejectedValue(new ApiError(404, 'Not Found'))
        const { container } = render(<SessionNarrationTierToggle api={asApi(api)} basePath="adventure-sessions" sessionId={7} />)
        await waitFor(() => expect(api.getVoiceCapabilities).toHaveBeenCalled())
        await act(async () => {})
        expect(container).toBeEmptyDOMElement()
        expect(api.getSessionVoiceSettings).not.toHaveBeenCalled()
    })

    it('renders nothing when the settings read fails (a 404 reads as unavailable)', async () => {
        const api = fakeApi(caps(BFF_EL_PLUS_BODY))
        api.getSessionVoiceSettings.mockRejectedValue(new ApiError(404, 'Not Found'))
        const { container } = render(<SessionNarrationTierToggle api={asApi(api)} basePath="character-chats" sessionId={7} />)
        await waitFor(() => expect(api.getSessionVoiceSettings).toHaveBeenCalledWith('character-chats', 7))
        await act(async () => {})
        expect(container).toBeEmptyDOMElement()
    })

    it('shows Default (account tier) / Standard / Expressive and saves a choice (chat route)', async () => {
        const api = fakeApi(caps(BFF_EL_PLUS_BODY))
        render(<SessionNarrationTierToggle api={asApi(api)} basePath="character-chats" sessionId={7} />)
        const group = await screen.findByRole('radiogroup', { name: 'Narration for this session' })
        expect(group).toBeInTheDocument()
        expect(screen.getByRole('radio', { name: 'Default (Expressive)' })).toHaveAttribute('aria-checked', 'true')
        fireEvent.click(screen.getByRole('radio', { name: 'Standard' }))
        expect(screen.getByRole('radio', { name: 'Standard' })).toHaveAttribute('aria-checked', 'true')
        await waitFor(() => expect(api.setSessionNarrationTier).toHaveBeenCalledWith('character-chats', 7, 'standard'))
        await waitFor(() => expect(screen.getByRole('radio', { name: 'Standard' })).not.toBeDisabled())
        fireEvent.click(screen.getByRole('radio', { name: 'Default (Expressive)' }))
        await waitFor(() => expect(api.setSessionNarrationTier).toHaveBeenLastCalledWith('character-chats', 7, null))
    })

    it('disables Expressive when the plan does not allow it', async () => {
        const api = fakeApi(caps(BFF_EL_FREE_BODY), settings({ tiers_allowed: ['standard'] }))
        render(<SessionNarrationTierToggle api={asApi(api)} basePath="adventure-sessions" sessionId={7} />)
        expect(await screen.findByRole('radio', { name: 'Expressive' })).toBeDisabled()
        expect(screen.getByRole('radio', { name: 'Default (Standard)' })).not.toBeDisabled()
        expect(screen.getByText(/Available on Plus and Pro\./)).toBeInTheDocument()
    })

    it('is disabled when read-only', async () => {
        const api = fakeApi(caps(BFF_EL_PLUS_BODY))
        render(<SessionNarrationTierToggle api={asApi(api)} basePath="adventure-sessions" sessionId={7} readOnly />)
        expect(await screen.findByRole('radio', { name: 'Standard' })).toBeDisabled()
        fireEvent.click(screen.getByRole('radio', { name: 'Default (Expressive)' }))
        expect(api.setSessionNarrationTier).not.toHaveBeenCalled()
    })

    it.each([
        [new ApiError(422, 'plan', { code: 'voice_plan_locked' }), 'voices.errors.planLocked'],
        [new ApiError(422, 'tier', { code: 'voice_tier_unavailable' }), 'voices.errors.tierUnavailable'],
        [new ApiError(409, 'archived', { code: 'WORKSPACE_ARCHIVED' }), 'workspaceContent.saveErrors.archived'],
    ])('rolls back on %s', async (failure, key) => {
        const api = fakeApi(caps(BFF_EL_PLUS_BODY))
        api.setSessionNarrationTier.mockRejectedValue(failure)
        render(<SessionNarrationTierToggle api={asApi(api)} basePath="adventure-sessions" sessionId={7} />)
        fireEvent.click(await screen.findByRole('radio', { name: 'Expressive' }))
        expect(await screen.findByRole('alert')).toHaveTextContent(String(i18n.t(key)))
        expect(screen.getByRole('radio', { name: 'Default (Expressive)' })).toHaveAttribute('aria-checked', 'true')
    })

    it('arrow keys move between the enabled options', async () => {
        const api = fakeApi(caps(BFF_EL_FREE_BODY), settings({ tiers_allowed: ['standard'], tier_override: 'standard' }))
        render(<SessionNarrationTierToggle api={asApi(api)} basePath="adventure-sessions" sessionId={7} />)
        fireEvent.keyDown(await screen.findByRole('radio', { name: 'Standard' }), { key: 'ArrowRight' })
        await waitFor(() => expect(api.setSessionNarrationTier).toHaveBeenCalledWith('adventure-sessions', 7, null))
    })
})
