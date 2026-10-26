import { API_BASE_URL } from './baseUrl'

const PROTECTED_MEDIA_PATH_PREFIXES = [
    '/images/assets/',
    '/theme-songs/assets/',
    '/tts/assets/',
    '/user/me/avatar/',
    // Voice audio (D10, D18): catalog samples and recipe-preview renders are
    // owned, `Cache-Control: private` media, fetched as authed blobs and never
    // hotlinked as a bare `<audio src>`.
    '/voices/catalog/',
    '/voice-presets/preview/',
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

export function avatarVariantUrl(
    variant: 'A' | 'B' | 'C' | 'D',
    size: 128 | 256 | 512 | 'full' = 512,
): string {
    return `/user/me/avatar/variant_${variant}/${size}.webp`
}

/**
 * Rewrite a `/user/me/avatar/variant_{X}/512.webp` URL to the smallest WebP tier
 * (`128.webp`, `256.webp`, or `512.webp`) that covers a 2x Retina display of `pixelSize`.
 */
export function resolveAvatarUrlForSize(
    url: string | null | undefined,
    pixelSize: number,
): string | null | undefined {
    if (!url || !url.includes('/user/me/avatar/variant_')) return url
    const tier = pixelSize <= 64 ? '128.webp' : pixelSize <= 128 ? '256.webp' : '512.webp'
    return url.replace(/\/(128|256|512|full)\.(webp|png)(\?.*)?$/, `/${tier}$3`)
}
