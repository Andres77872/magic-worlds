/**
 * Stores the user's cookie/storage consent choice and drives the consent
 * banner. See `cookieConsent.ts` for the storage details: the app uses only
 * first-party storage + one strictly-necessary auth cookie, so declining the
 * optional category never disables a current feature — it just records the
 * choice and future-proofs an analytics category that is empty today.
 */
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
    clearConsent,
    hasConsent as hasConsentPure,
    makeConsent,
    readConsent,
    writeConsent,
    type CookieCategory,
    type CookieConsent,
    type CookieDecision,
} from './cookieConsent'
import { CookieConsentContext, type CookieConsentContextValue } from './cookieConsentContext'

export function CookieConsentProvider({ children }: { children: ReactNode }) {
    const [consent, setConsent] = useState<CookieConsent | null>(() => readConsent())
    const [isPreferencesOpen, setIsPreferencesOpen] = useState(false)

    const persist = useCallback((decision: CookieDecision, categories: Record<CookieCategory, boolean>) => {
        const next = makeConsent(decision, categories)
        writeConsent(next)
        setConsent(next)
        setIsPreferencesOpen(false)
    }, [])

    const acceptAll = useCallback(() => {
        persist('all', { essential: true, analytics: true })
    }, [persist])

    const acceptEssential = useCallback(() => {
        persist('essential', { essential: true, analytics: false })
    }, [persist])

    const savePreferences = useCallback(
        (categories: Record<CookieCategory, boolean>) => {
            const analytics = categories.analytics === true
            persist(analytics ? 'all' : 'essential', { essential: true, analytics })
        },
        [persist],
    )

    const openPreferences = useCallback(() => setIsPreferencesOpen(true), [])
    const closePreferences = useCallback(() => setIsPreferencesOpen(false), [])

    const reopen = useCallback(() => {
        clearConsent()
        setConsent(null)
        setIsPreferencesOpen(false)
    }, [])

    const value = useMemo<CookieConsentContextValue>(
        () => ({
            consent,
            isBannerVisible: consent === null,
            isPreferencesOpen,
            acceptAll,
            acceptEssential,
            savePreferences,
            openPreferences,
            closePreferences,
            reopen,
            hasConsent: (category: CookieCategory) => hasConsentPure(consent, category),
        }),
        [consent, isPreferencesOpen, acceptAll, acceptEssential, savePreferences, openPreferences, closePreferences, reopen],
    )

    return <CookieConsentContext.Provider value={value}>{children}</CookieConsentContext.Provider>
}
