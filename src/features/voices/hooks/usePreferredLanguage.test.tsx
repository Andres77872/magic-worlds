import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import { authSession } from '@/infrastructure/api/authSession'
import { baseLanguageCode } from '../languageCode'
import { clearPreferredLanguageCache, usePreferredLanguage } from './usePreferredLanguage'

const api: Record<string, unknown> = {}

vi.mock('@/infrastructure/api', () => ({
    apiService: new Proxy({}, { get: (_target, key: string) => api[key] }),
}))

describe('usePreferredLanguage (05 §7.3, §5.5)', () => {
    beforeEach(() => {
        clearPreferredLanguageCache()
        for (const key of Object.keys(api)) delete api[key]
    })

    it('reads user_preferences.preferred_language, once for every reader', async () => {
        const getUserPreferences = vi.fn().mockResolvedValue({ preferred_language: 'es', has_preference: true, narration_tier: 'standard' })
        api.getUserPreferences = getUserPreferences
        const first = renderHook(() => usePreferredLanguage())
        const second = renderHook(() => usePreferredLanguage())
        expect(first.result.current).toEqual({ language: null, pending: true })
        await waitFor(() => expect(first.result.current).toEqual({ language: 'es', pending: false }))
        await waitFor(() => expect(second.result.current.language).toBe('es'))
        expect(getUserPreferences).toHaveBeenCalledTimes(1)
    })

    it('has no language when the account never saved one, and asks again after a failure', async () => {
        api.getUserPreferences = vi.fn().mockResolvedValue({ preferred_language: 'en', has_preference: false, narration_tier: 'standard' })
        const unsaved = renderHook(() => usePreferredLanguage())
        await waitFor(() => expect(unsaved.result.current).toEqual({ language: null, pending: false }))

        clearPreferredLanguageCache()
        const failing = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue({ preferred_language: 'en', has_preference: true, narration_tier: 'standard' })
        api.getUserPreferences = failing
        const failed = renderHook(() => usePreferredLanguage())
        await waitFor(() => expect(failed.result.current).toEqual({ language: null, pending: false }))
        const retried = renderHook(() => usePreferredLanguage())
        await waitFor(() => expect(retried.result.current.language).toBe('en'))
        expect(failing).toHaveBeenCalledTimes(2)
    })

    it('reads again for another account and after a language change', async () => {
        const preference = (preferred_language: string) => ({ preferred_language, has_preference: true, narration_tier: 'standard' })
        const getUserPreferences = vi.fn()
            .mockResolvedValueOnce(preference('es'))
            .mockResolvedValueOnce(preference('en'))
            .mockResolvedValueOnce(preference('pt'))
        api.getUserPreferences = getUserPreferences
        const snapshot = authSession.getSnapshot()
        const account = vi.spyOn(authSession, 'getSnapshot').mockReturnValue({ ...snapshot, accountKey: 'user:a:1' })
        try {
            const first = renderHook(() => usePreferredLanguage())
            await waitFor(() => expect(first.result.current.language).toBe('es'))
            // Same account: the shared answer.
            const again = renderHook(() => usePreferredLanguage())
            await waitFor(() => expect(again.result.current.language).toBe('es'))
            expect(getUserPreferences).toHaveBeenCalledTimes(1)

            // Signed in as another account: never the previous account's language.
            account.mockReturnValue({ ...snapshot, accountKey: 'user:b:2' })
            const other = renderHook(() => usePreferredLanguage())
            await waitFor(() => expect(other.result.current.language).toBe('en'))

            // A language change is saved as preferred_language: the next reader asks again.
            act(() => {
                i18n.emit('languageChanged', i18n.language)
            })
            const changed = renderHook(() => usePreferredLanguage())
            await waitFor(() => expect(changed.result.current.language).toBe('pt'))
            expect(getUserPreferences).toHaveBeenCalledTimes(3)
        } finally {
            account.mockRestore()
        }
    })

    it('is settled at once without a preferences read, and idle while disabled', () => {
        expect(renderHook(() => usePreferredLanguage()).result.current).toEqual({ language: null, pending: false })
        api.getUserPreferences = vi.fn()
        expect(renderHook(() => usePreferredLanguage(false)).result.current).toEqual({ language: null, pending: false })
        expect(api.getUserPreferences).not.toHaveBeenCalled()
    })

    it('reduces language tags to their base code', () => {
        expect(baseLanguageCode('es-MX')).toBe('es')
        expect(baseLanguageCode(' EN_us ')).toBe('en')
        expect(baseLanguageCode('auto')).toBeNull()
        expect(baseLanguageCode(null)).toBeNull()
    })
})
