/**
 * Cookie-consent storage helpers (pure, no React).
 *
 * Magic Worlds uses only FIRST-PARTY storage plus one strictly-necessary,
 * HttpOnly auth cookie (`mw_refresh_token`). There are no third-party,
 * advertising, or cross-site tracking cookies and no analytics scripts are
 * loaded. This module persists the user's banner choice so the consent banner
 * is shown only until a decision is made.
 *
 * The `analytics` category controls NOTHING today (the app ships no analytics).
 * It exists so the banner records a real choice and is future-proofed: any
 * analytics/marketing code added later MUST be gated behind
 * `hasConsent(consent, 'analytics')` before it loads.
 */

export type CookieCategory = 'essential' | 'analytics'

export type CookieDecision = 'all' | 'essential'

export interface CookieConsent {
    version: number
    decision: CookieDecision
    categories: Record<CookieCategory, boolean>
    /** ISO timestamp of when the choice was made. */
    decidedAt: string
}

export const COOKIE_CONSENT_KEY = 'magic_worlds:cookie-consent:v1'
export const COOKIE_CONSENT_VERSION = 1

/** Build a consent record. Essential is always forced on — it cannot be declined. */
export function makeConsent(decision: CookieDecision, categories: Record<CookieCategory, boolean>): CookieConsent {
    return {
        version: COOKIE_CONSENT_VERSION,
        decision,
        categories: { ...categories, essential: true },
        decidedAt: new Date().toISOString(),
    }
}

export function readConsent(): CookieConsent | null {
    if (typeof localStorage === 'undefined') return null
    try {
        const raw = localStorage.getItem(COOKIE_CONSENT_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw) as Partial<CookieConsent> | null
        // Ignore records from a previous schema so a future bump re-asks cleanly.
        if (!parsed || parsed.version !== COOKIE_CONSENT_VERSION) return null
        if (parsed.decision !== 'all' && parsed.decision !== 'essential') return null
        return {
            version: COOKIE_CONSENT_VERSION,
            decision: parsed.decision,
            categories: {
                essential: true,
                analytics: parsed.categories?.analytics === true,
            },
            decidedAt: typeof parsed.decidedAt === 'string' ? parsed.decidedAt : '',
        }
    } catch {
        return null
    }
}

export function writeConsent(consent: CookieConsent): void {
    if (typeof localStorage === 'undefined') return
    try {
        localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent))
    } catch {
        // localStorage can be unavailable in private browsing or locked-down embeds.
    }
}

export function clearConsent(): void {
    if (typeof localStorage === 'undefined') return
    try {
        localStorage.removeItem(COOKIE_CONSENT_KEY)
    } catch {
        // ignore
    }
}

/**
 * Whether a category may be used. `essential` is always allowed (strictly
 * necessary); optional categories require a stored opt-in. Future analytics
 * code must call this before loading any tracker.
 */
export function hasConsent(consent: CookieConsent | null, category: CookieCategory): boolean {
    if (category === 'essential') return true
    return consent?.categories?.[category] === true
}
