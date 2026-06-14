import { API_BASE_URL } from './baseUrl'

const PROTECTED_MEDIA_PATH_PREFIXES = [
    '/images/assets/',
    '/theme-songs/assets/',
    '/generated-images/',
    '/generated-audio/',
    '/tts/assets/',
]

/**
 * Owner-agnostic media served for public/shared cards. These render as a plain
 * `<img src>` (no Bearer token), so they must NEVER be treated as protected —
 * even if a protected prefix above would otherwise match. This is what lets a
 * public/community card (and the logged-out shared-link page) load its image.
 */
const PUBLIC_MEDIA_PATH_PREFIXES = ['/images/public/', '/theme-songs/public/']

export function isPublicMediaUrl(url?: string | null): boolean {
    if (!url || /^(data:|blob:)/i.test(url)) return false
    try {
        const parsed = new URL(url, API_BASE_URL)
        return PUBLIC_MEDIA_PATH_PREFIXES.some((prefix) => parsed.pathname.startsWith(prefix))
    } catch {
        return false
    }
}

export function getProtectedMediaPath(url?: string | null): string | undefined {
    if (!url || /^(data:|blob:)/i.test(url)) return undefined
    try {
        const parsed = new URL(url, API_BASE_URL)
        if (PUBLIC_MEDIA_PATH_PREFIXES.some((prefix) => parsed.pathname.startsWith(prefix))) return undefined
        if (!PROTECTED_MEDIA_PATH_PREFIXES.some((prefix) => parsed.pathname.startsWith(prefix))) return undefined
        return `${parsed.pathname}${parsed.search}`
    } catch {
        return undefined
    }
}

/**
 * Resolve a media asset URL for use in media fetches. The backend returns owned
 * generated assets as root-relative protected routes; prefix those with the API
 * base. Absolute/data/blob URLs pass through unchanged.
 */
export function resolveMediaUrl(url?: string | null): string | undefined {
    if (!url) return undefined
    const protectedPath = getProtectedMediaPath(url)
    if (protectedPath) return `${API_BASE_URL}${protectedPath}`
    if (/^(https?:|data:|blob:)/i.test(url)) return url
    return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`
}

export function isProtectedMediaUrl(url?: string | null): boolean {
    return Boolean(getProtectedMediaPath(url))
}
