/**
 * The account's `user_preferences.preferred_language` for the R1 voice UI:
 * the catalog picker's default language filter (05 §7.3) and the language a
 * Studio preset is checked against for `not_tested_language` (05 §5.5, D34).
 * It is read from the existing preferences source (`GET /user/preferences`),
 * never from the interface locale.
 *
 * - `pending` until the read settles; `language` is null when the account has
 *   not saved one (`has_preference: false`), when the read fails, or when the
 *   api has no preferences read (test doubles).
 * - Concurrent readers share one request, and a settled answer is reused for
 *   `PREFERRED_LANGUAGE_TTL_MS` (the Studio, its editor and the picker open
 *   together). A failure is not kept, so the next mount asks again.
 * - The shared answer belongs to one signed-in account (`authSession`'s
 *   `accountKey`): a sign-out or a sign-in as another account reads again.
 *   A language change (`LanguageProvider` saves it as `preferred_language`)
 *   drops it too, so the next reader sees the new value.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiService } from '@/infrastructure/api'
import { authSession } from '@/infrastructure/api/authSession'
import { baseLanguageCode } from '../languageCode'

export const PREFERRED_LANGUAGE_TTL_MS = 30_000

interface CacheEntry {
    at: number
    /** The account the answer belongs to. */
    account: string
    promise: Promise<string | null>
}

let cache: CacheEntry | null = null

/** Forget the shared answer (tests, a language change). */
export function clearPreferredLanguageCache(): void {
    cache = null
}

function currentAccount(): string {
    try {
        return authSession.getSnapshot().accountKey
    } catch {
        return ''
    }
}

function readPreferredLanguage(): Promise<string | null> {
    const now = Date.now()
    const account = currentAccount()
    if (cache && cache.account === account && now - cache.at < PREFERRED_LANGUAGE_TTL_MS) return cache.promise
    const entry: CacheEntry = {
        at: now,
        account,
        promise: Promise.resolve()
            .then(() => apiService.getUserPreferences())
            .then((preferences) => (preferences?.has_preference ? baseLanguageCode(preferences.preferred_language) : null))
            .catch(() => {
                if (cache === entry) cache = null
                return null
            }),
    }
    cache = entry
    return entry.promise
}

export interface PreferredLanguageState {
    language: string | null
    pending: boolean
}

export function usePreferredLanguage(enabled = true): PreferredLanguageState {
    const { i18n } = useTranslation()
    const available = typeof apiService.getUserPreferences === 'function'
    const [state, setState] = useState<{ settled: boolean; language: string | null }>({ settled: false, language: null })

    useEffect(() => {
        if (!enabled || !available) return
        let cancelled = false
        void readPreferredLanguage().then((language) => {
            if (!cancelled) setState({ settled: true, language })
        })
        return () => {
            cancelled = true
        }
    }, [enabled, available])

    // A language change is saved as the account's preferred_language: drop the shared answer.
    useEffect(() => {
        if (!enabled || typeof i18n?.on !== 'function') return
        // One listener per reader: i18next's `off` drops every registration of a listener.
        const drop = () => clearPreferredLanguageCache()
        i18n.on('languageChanged', drop)
        return () => {
            i18n.off?.('languageChanged', drop)
        }
    }, [enabled, i18n])

    if (!available) return { language: null, pending: false }
    return { language: state.language, pending: enabled && !state.settled }
}
