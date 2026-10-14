/**
 * The account narration tier (R1-FE-04, D05): Standard or Expressive, stored in
 * `user_preferences.narration_tier` and read back clamped through
 * `GET /voices/capabilities` (I-32).
 *
 * - `visible` once the capabilities are read, for every signed-in account. A
 *   failed read (404 included) and an api without the read keep it hidden
 *   (fail closed).
 * - `locked` when `tiers_allowed` lacks expressive (Free, or no healthy
 *   Expressive model): the control is shown disabled with the plan hint.
 * - A save always sends `preferred_language` with `narration_tier` (R-31: a
 *   tier-only body is refused for an account that never saved a language),
 *   then reads the capabilities again with `fresh` so every surface sees the
 *   clamped tier. Optimistic, rolled back on a refusal; a 422 voice code maps
 *   through `voiceWriteErrorKey`.
 */
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { resolveCurrentLanguage } from '@/app/i18n'
import { ApiError, apiService, type ApiService } from '@/infrastructure/api'
import type { NarrationTier, PreferredLanguage, VoiceCapabilities } from '@/shared/types'
import { voiceWriteErrorKey } from '@/shared/voice/voiceWriteErrors'
import { useVoiceCapabilities } from './hooks/useVoiceCapabilities'

export type NarrationTierApi = Pick<ApiService, 'getVoiceCapabilities' | 'getUserPreferences' | 'updateUserPreferences'>

export interface NarrationTierState {
    /** The control is offered (the capabilities were read). */
    visible: boolean
    loading: boolean
    /** The tier shown: the pending choice while a save is in flight, else the clamped stored tier. */
    tier: NarrationTier
    /** Expressive is not in `tiers_allowed`. */
    locked: boolean
    saving: boolean
    /** Localised refusal copy of the last failed save. */
    error: string | null
    setTier: (tier: NarrationTier) => Promise<void>
}

/** The clamped stored tier of a capabilities reading. */
export function storedTier(capabilities: VoiceCapabilities | null | undefined): NarrationTier {
    const tier = capabilities?.narration_tier ?? 'standard'
    return tier === 'expressive' && !capabilities?.tiers_allowed.includes('expressive') ? 'standard' : tier
}

export function useNarrationTier(options: { api?: NarrationTierApi | null } = {}): NarrationTierState {
    const { t, i18n } = useTranslation()
    const api = options.api === undefined ? apiService : options.api
    const read = useVoiceCapabilities({ api })
    const [fresh, setFresh] = useState<VoiceCapabilities | null>(null)
    const [pending, setPending] = useState<NarrationTier | null>(null)
    const [error, setError] = useState<string | null>(null)
    const savingRef = useRef(false)

    const capabilities = fresh ?? read.capabilities
    const visible = capabilities !== null
    const locked = !capabilities?.tiers_allowed.includes('expressive')

    const setTier = useCallback(async (tier: NarrationTier) => {
        if (!api || savingRef.current) return
        savingRef.current = true
        setPending(tier)
        setError(null)
        try {
            let language: PreferredLanguage = resolveCurrentLanguage(i18n.language)
            try {
                const preferences = await api.getUserPreferences()
                if (preferences.has_preference) language = preferences.preferred_language
            } catch {
                // Keep the interface language: the write still carries one (R-31).
            }
            await api.updateUserPreferences({ narration_tier: tier, preferred_language: language })
            try {
                setFresh(await api.getVoiceCapabilities({ fresh: true }))
            } catch {
                // The write landed; the next shared read shows the clamped tier.
                setFresh((current) => {
                    const base = current ?? read.capabilities
                    return base ? { ...base, narration_tier: tier } : base
                })
            }
        } catch (cause) {
            const key = cause instanceof ApiError && cause.code ? voiceWriteErrorKey(cause.code) : null
            setError(key ? t(key) : t('voices.errors.budgetUnavailable'))
        } finally {
            savingRef.current = false
            setPending(null)
        }
    }, [api, i18n.language, read.capabilities, t])

    return {
        visible,
        loading: read.loading,
        tier: pending ?? storedTier(capabilities),
        locked,
        saving: pending !== null,
        error,
        setTier,
    }
}
