/**
 * Email deep-link bootstrap.
 *
 * api.auth emails password-reset / email-activation links as PATH-based URLs:
 *   {base}/auth/password/reset?token=<lookup_id.secret>
 *   {base}/auth/email/verify?token=<lookup_id.secret>
 *
 * This SPA is hash-routed, so on first load we detect those two paths, lift the
 * single-use token OUT of the URL (never into localStorage), rewrite the address
 * bar to the internal hash route, and hand the token to the reset/verify page.
 * The token lives in a module variable plus sessionStorage (survives the
 * bootstrap→mount gap and a manual refresh, but never persists to disk).
 */

export type AuthDeepLinkKind = 'password-reset' | 'verify-email' | 'google-login'

interface AuthDeepLink {
    kind: AuthDeepLinkKind
    token: string
    error?: string
}

const PATH_TO_KIND: Record<string, AuthDeepLinkKind> = {
    '/auth/password/reset': 'password-reset',
    '/auth/email/verify': 'verify-email',
    // BFF-mediated Google return: {SPA}/auth/google/return?code=<delivery>|error=<reason>
    '/auth/google/return': 'google-login',
}

const KIND_TO_HASH: Record<AuthDeepLinkKind, string> = {
    'password-reset': '#/password-reset',
    'verify-email': '#/verify-email',
    'google-login': '#/google-callback',
}

const SESSION_KEY = 'mw:auth-deeplink'

let pending: AuthDeepLink | null = null

function normalizePath(pathname: string): string {
    return pathname.replace(/\/+$/, '') || '/'
}

/**
 * Run once at startup, BEFORE React mounts. If the current URL is a provider
 * email link, stash the token, rewrite the URL to the internal hash route, and
 * return the kind so the router lands on the right page. Returns null otherwise.
 */
export function consumeAuthDeepLink(): AuthDeepLinkKind | null {
    if (typeof window === 'undefined') return null
    const kind = PATH_TO_KIND[normalizePath(window.location.pathname)]
    if (!kind) return null

    // Password/email links carry ?token=; the Google return carries ?code= (and on
    // failure ?error=). Lift whichever is present — never into localStorage.
    const search = new URLSearchParams(window.location.search)
    const token = search.get('token') ?? search.get('code') ?? ''
    const error = search.get('error') ?? undefined
    pending = { kind, token, error }
    try {
        window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(pending))
    } catch {
        // sessionStorage unavailable (private mode / quota) — the module var still works.
    }

    const hash = KIND_TO_HASH[kind]
    try {
        // Path '/' + internal hash; drops the provider path and the ?token query.
        window.history.replaceState(null, '', `/${hash}`)
    } catch {
        window.location.hash = hash
    }
    return kind
}

/** Read (without clearing) the token captured for a given page kind. */
export function readAuthDeepLinkToken(kind: AuthDeepLinkKind): string | null {
    if (pending?.kind === kind) return pending.token || null
    if (typeof window === 'undefined') return null
    try {
        const raw = window.sessionStorage.getItem(SESSION_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw) as AuthDeepLink
        return parsed.kind === kind ? parsed.token || null : null
    } catch {
        return null
    }
}

/** Read (without clearing) the error captured for a given page kind (Google return). */
export function readAuthDeepLinkError(kind: AuthDeepLinkKind): string | null {
    if (pending?.kind === kind) return pending.error || null
    if (typeof window === 'undefined') return null
    try {
        const raw = window.sessionStorage.getItem(SESSION_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw) as AuthDeepLink
        return parsed.kind === kind ? parsed.error || null : null
    } catch {
        return null
    }
}

/** Clear the stashed token after a page has consumed it (the token is single-use). */
export function clearAuthDeepLink(): void {
    pending = null
    if (typeof window === 'undefined') return
    try {
        window.sessionStorage.removeItem(SESSION_KEY)
    } catch {
        // ignore
    }
}
