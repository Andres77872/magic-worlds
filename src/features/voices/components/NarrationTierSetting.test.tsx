import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import { ApiError, apiService } from '@/infrastructure/api'
import type { UserPreferences, VoiceCapabilities } from '@/shared/types'
import { toVoiceCapabilities } from '@/shared/voice/voiceCapabilities'
import { BFF_EL_FREE_BODY, BFF_EL_PLUS_BODY } from '@/shared/voice/voiceCapabilities.fixtures'
import { NarrationTierSetting } from './NarrationTierSetting'

const caps = (body: unknown) => toVoiceCapabilities(body) as VoiceCapabilities
const prefs = (overrides: Partial<UserPreferences> = {}): UserPreferences => ({ preferred_language: 'es', has_preference: true, narration_tier: 'standard', ...overrides })

const getVoiceCapabilities = vi.spyOn(apiService, 'getVoiceCapabilities')
const getUserPreferences = vi.spyOn(apiService, 'getUserPreferences')
const updateUserPreferences = vi.spyOn(apiService, 'updateUserPreferences')

beforeEach(async () => {
    await i18n.changeLanguage('en')
    getVoiceCapabilities.mockReset()
    getUserPreferences.mockReset().mockResolvedValue(prefs())
    updateUserPreferences.mockReset().mockResolvedValue(prefs({ narration_tier: 'expressive' }))
})

afterEach(() => {
    vi.clearAllMocks()
})

const expressiveSwitch = () => screen.getByRole('switch', { name: 'Expressive' })

describe('NarrationTierSetting', () => {
    it('renders nothing when the capabilities read fails (fail closed)', async () => {
        getVoiceCapabilities.mockRejectedValue(new ApiError(404, 'Not Found'))
        const { container } = render(<NarrationTierSetting />)
        await waitFor(() => expect(getVoiceCapabilities).toHaveBeenCalled())
        await act(async () => {})
        expect(container).toBeEmptyDOMElement()
    })

    it('is locked with the plan hint when expressive is not allowed', async () => {
        getVoiceCapabilities.mockResolvedValue(caps(BFF_EL_FREE_BODY))
        render(<NarrationTierSetting />)
        expect(await screen.findByRole('switch', { name: 'Expressive' })).toBeDisabled()
        expect(screen.getByText('Available on Plus and Pro.')).toBeInTheDocument()
        expect(expressiveSwitch()).toHaveAttribute('aria-checked', 'false')
    })

    it('saves the tier with the stored language (R-31), then reads capabilities fresh', async () => {
        getVoiceCapabilities.mockResolvedValueOnce(caps({ ...BFF_EL_PLUS_BODY, narration_tier: 'standard' }))
        getVoiceCapabilities.mockResolvedValueOnce(caps(BFF_EL_PLUS_BODY))
        render(<NarrationTierSetting />)
        const toggle = await screen.findByRole('switch', { name: 'Expressive' })
        expect(toggle).toHaveAttribute('aria-checked', 'false')
        fireEvent.click(toggle)
        // Optimistic.
        expect(expressiveSwitch()).toHaveAttribute('aria-checked', 'true')
        await waitFor(() => expect(updateUserPreferences).toHaveBeenCalledWith({ narration_tier: 'expressive', preferred_language: 'es' }))
        await waitFor(() => expect(getVoiceCapabilities).toHaveBeenLastCalledWith({ fresh: true }))
        await waitFor(() => expect(expressiveSwitch()).not.toBeDisabled())
        expect(expressiveSwitch()).toHaveAttribute('aria-checked', 'true')
    })

    it('sends the interface language when the account never saved one', async () => {
        getVoiceCapabilities.mockResolvedValue(caps({ ...BFF_EL_PLUS_BODY, narration_tier: 'standard' }))
        getUserPreferences.mockResolvedValue(prefs({ has_preference: false, preferred_language: 'es' }))
        render(<NarrationTierSetting />)
        fireEvent.click(await screen.findByRole('switch', { name: 'Expressive' }))
        await waitFor(() => expect(updateUserPreferences).toHaveBeenCalledWith({ narration_tier: 'expressive', preferred_language: 'en' }))
    })

    it('rolls back and shows the voice code copy on a 422', async () => {
        getVoiceCapabilities.mockResolvedValue(caps({ ...BFF_EL_PLUS_BODY, narration_tier: 'standard' }))
        updateUserPreferences.mockRejectedValue(new ApiError(422, 'locked', { code: 'voice_tier_unavailable' }))
        render(<NarrationTierSetting />)
        fireEvent.click(await screen.findByRole('switch', { name: 'Expressive' }))
        expect(await screen.findByRole('alert')).toHaveTextContent(String(i18n.t('voices.errors.tierUnavailable')))
        expect(expressiveSwitch()).toHaveAttribute('aria-checked', 'false')
    })

    it('turns expressive off again', async () => {
        getVoiceCapabilities.mockResolvedValueOnce(caps(BFF_EL_PLUS_BODY))
        getVoiceCapabilities.mockResolvedValueOnce(caps({ ...BFF_EL_PLUS_BODY, narration_tier: 'standard' }))
        render(<NarrationTierSetting />)
        const toggle = await screen.findByRole('switch', { name: 'Expressive' })
        expect(toggle).toHaveAttribute('aria-checked', 'true')
        fireEvent.click(toggle)
        await waitFor(() => expect(updateUserPreferences).toHaveBeenCalledWith({ narration_tier: 'standard', preferred_language: 'es' }))
        await waitFor(() => expect(expressiveSwitch()).toHaveAttribute('aria-checked', 'false'))
    })
})
