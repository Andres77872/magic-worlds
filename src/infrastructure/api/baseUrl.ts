/**
 * API base URL resolution.
 *
 * The BFF's refresh cookie (`mw_refresh_token`) is HttpOnly + SameSite=lax,
 * so the API must be SAME-SITE with the page or the browser silently refuses
 * to store/send the cookie and every token refresh fails with 401. A
 * hardcoded host (e.g. `http://192.168.1.13:8010`) is same-site only when the
 * page is opened via that exact host — opening the app at
 * `http://localhost:5173` would make the API cross-site and break refresh.
 *
 * To support both localhost and LAN-device access with one config,
 * `VITE_API_BASE_URL` may contain a literal `{hostname}` placeholder that is
 * replaced with the page's hostname at runtime:
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

export const API_BASE_URL = resolveApiBaseUrl(
    import.meta.env.VITE_API_BASE_URL,
    typeof window !== 'undefined' ? window.location?.hostname : undefined,
)
