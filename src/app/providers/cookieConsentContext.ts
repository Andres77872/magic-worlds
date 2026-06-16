import { createContext } from 'react'
import type { CookieCategory, CookieConsent } from './cookieConsent'

export interface CookieConsentContextValue {
    /** The stored decision, or null while the user has not chosen yet. */
    consent: CookieConsent | null
    /** True while no decision has been made — the banner should be shown. */
    isBannerVisible: boolean
    /** True while the granular preferences dialog is open. */
    isPreferencesOpen: boolean
    /** Accept every category (essential + optional). */
    acceptAll: () => void
    /** Keep only strictly-necessary storage; decline optional categories. */
    acceptEssential: () => void
    /** Persist a granular choice from the preferences dialog. */
    savePreferences: (categories: Record<CookieCategory, boolean>) => void
    openPreferences: () => void
    closePreferences: () => void
    /** Forget the stored decision so the banner is shown again. */
    reopen: () => void
    /** Whether a category may currently be used (future analytics gate). */
    hasConsent: (category: CookieCategory) => boolean
}

export const CookieConsentContext = createContext<CookieConsentContextValue | undefined>(undefined)
