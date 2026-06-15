/**
 * API base URL resolution.
 *
 * The SPA talks to the magic-worlds-api BFF (never api.auth directly). The BFF's
 * refresh cookie (`mw_refresh_token`) is HttpOnly + Secure + SameSite=None, so it
 * works cross-site — e.g. an SPA on https://magic-worlds.novus.chat calling a BFF
 * on https://api-magic-worlds.arz.ai. Every credentialed auth call sets
 * `credentials: 'include'` (see ApiService); the browser only attaches the cookie
 * when it does.
 *
 * Two hard requirements for refresh to work in production:
 *  1. HTTPS. SameSite=None cookies require Secure, and an HTTPS page cannot call an
 *     HTTP API (mixed content blocks every request). Set VITE_API_BASE_URL to the
 *     BFF's absolute HTTPS URL. {@link warnIfApiBaseUrlBlocksAuth} flags violations.
 *  2. The SPA origin must be allow-listed in the BFF (CORS_ORIGINS +
 *     PROVIDER_INIT_RETURN_ORIGINS) and api.auth (GOOGLE_OAUTH_RETURN_ORIGINS).
 *
 * Caveat: a cross-site cookie is a third-party cookie, which Safari (ITP) and
 * Firefox (Total Cookie Protection) block outright — there, refresh fails until the
 * SPA and BFF share a registrable domain (then SameSite=Lax would suffice).
 *
 * For local/LAN dev the SPA and BFF are same-site on different ports, so a literal
 * `{hostname}` placeholder in VITE_API_BASE_URL is substituted with the page's
 * hostname at runtime so one value works everywhere:
 *
 *   VITE_API_BASE_URL=http://{hostname}:8010
 *
 * Page at http://localhost:5173      → API http://localhost:8010
 * Page at http://192.168.1.13:5173   → API http://192.168.1.13:8010
 */
export function resolveApiBaseUrl(configured: string | undefined, pageHostname: string | undefined): string {
    const base = (configured ?? '').trim().replace(/\/+$/, '')
    // Backend default port is 8000 (APP_PORT).
    if (!base) return 'http://localhost:8000'
    return base.replace(/\{hostname\}/g, pageHostname || 'localhost')
}

/**
 * Browser-only diagnostic. A misconfigured base URL makes the browser silently
 * block EVERY auth call (refresh included) before it hits the network, so it looks
 * like "refresh is broken" with no response to inspect. Surface it loudly instead.
 * Never throws and never rewrites the URL — config stays the single source of truth.
 */
export function warnIfApiBaseUrlBlocksAuth(baseUrl: string): void {
    if (typeof window === 'undefined' || !window.location) return
    let api: URL
    try {
        api = new URL(baseUrl)
    } catch {
        console.error(`[auth] VITE_API_BASE_URL is not a valid absolute URL: "${baseUrl}". Every auth call will fail.`)
        return
    }
    if (window.location.protocol === 'https:' && api.protocol === 'http:') {
        console.error(
            `[auth] Mixed content: the page is HTTPS but VITE_API_BASE_URL is HTTP ("${baseUrl}"). ` +
            'The browser blocks every request to it, so login and token refresh fail silently. ' +
            'Set VITE_API_BASE_URL to the BFF\'s HTTPS URL (e.g. https://api-magic-worlds.arz.ai).',
        )
    }
}

export const API_BASE_URL = resolveApiBaseUrl(
    import.meta.env.VITE_API_BASE_URL,
    typeof window !== 'undefined' ? window.location?.hostname : undefined,
)

warnIfApiBaseUrlBlocksAuth(API_BASE_URL)
