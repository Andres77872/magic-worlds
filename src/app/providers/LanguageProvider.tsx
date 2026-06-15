import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { apiService } from '@/infrastructure'
import {
    DEFAULT_LANGUAGE,
    getLanguageOption,
    i18n,
    isSupportedLanguage,
    normalizeLanguage,
    readStoredLanguage,
    resolveCurrentLanguage,
    syncDocumentLanguage,
    writeStoredLanguage,
    type SupportedLanguage,
} from '@/app/i18n'
import { useAuth } from '@/app/hooks/useAuth'
import { LanguageContext } from './languageContext'

interface LanguageProviderProps {
    children: ReactNode
}

export function LanguageProvider({ children }: LanguageProviderProps) {
    const { isAuthenticated, token, user } = useAuth()
    const [language, setLanguageState] = useState<SupportedLanguage>(() => resolveCurrentLanguage(i18n.language))
    const [isSyncing, setIsSyncing] = useState(false)
    const [syncError, setSyncError] = useState<string | null>(null)
    const lastSyncedUserRef = useRef<string | null>(null)

    const applyLanguage = useCallback(async (next: SupportedLanguage) => {
        writeStoredLanguage(next)
        syncDocumentLanguage(next)
        setLanguageState(next)
        if (normalizeLanguage(i18n.language) !== next) {
            await i18n.changeLanguage(next)
        }
    }, [])

    const setLanguage = useCallback(
        async (next: SupportedLanguage) => {
            if (!isSupportedLanguage(next)) return
            setSyncError(null)
            await applyLanguage(next)

            if (!isAuthenticated || !token) return

            setIsSyncing(true)
            try {
                await apiService.updateUserPreferences({ preferred_language: next })
            } catch (error) {
                console.warn('[LanguageProvider] Could not save language preference:', error)
                setSyncError('language.saveError')
            } finally {
                setIsSyncing(false)
            }
        },
        [applyLanguage, isAuthenticated, token],
    )

    // Mirror i18next's active language into local state. Driven by the
    // 'languageChanged' event (not the local `language` dep) so it stays correct
    // when a lazily-loaded locale chunk resolves *after* changeLanguage was
    // called — reading i18n.language synchronously would still see the old value
    // mid-load and wrongly revert the selection.
    useEffect(() => {
        const sync = () => {
            const normalized = normalizeLanguage(i18n.language) ?? DEFAULT_LANGUAGE
            setLanguageState(normalized)
            syncDocumentLanguage(normalized)
        }
        sync()
        i18n.on('languageChanged', sync)
        return () => {
            i18n.off('languageChanged', sync)
        }
    }, [])

    useEffect(() => {
        if (!isAuthenticated || !token || !user?.user_hash) {
            lastSyncedUserRef.current = null
            setSyncError(null)
            return
        }

        const userKey = `${user.user_hash}:${token}`
        if (lastSyncedUserRef.current === userKey) return

        let cancelled = false
        setIsSyncing(true)
        setSyncError(null)

        async function syncAccountLanguage() {
            try {
                const preferences = await apiService.getUserPreferences()
                if (cancelled) return

                const remoteLanguage = normalizeLanguage(preferences.preferred_language)
                if (preferences.has_preference && remoteLanguage) {
                    await applyLanguage(remoteLanguage)
                    if (!cancelled) lastSyncedUserRef.current = userKey
                    return
                }

                const localLanguage = readStoredLanguage() ?? normalizeLanguage(i18n.language) ?? DEFAULT_LANGUAGE
                await apiService.updateUserPreferences({ preferred_language: localLanguage })
                if (!cancelled) lastSyncedUserRef.current = userKey
            } catch (error) {
                if (cancelled) return
                console.warn('[LanguageProvider] Could not sync language preference:', error)
                setSyncError('language.syncError')
            } finally {
                if (!cancelled) setIsSyncing(false)
            }
        }

        void syncAccountLanguage()

        return () => {
            cancelled = true
        }
    }, [applyLanguage, isAuthenticated, token, user?.user_hash])

    const value = useMemo(() => {
        const option = getLanguageOption(language)
        return {
            language,
            option,
            intlLocale: option.intlLocale,
            isSyncing,
            syncError,
            setLanguage,
        }
    }, [isSyncing, language, setLanguage, syncError])

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    )
}
