import { API_BASE_URL } from './baseUrl'

const LOOPBACK_HTTP = /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i

/** This exception is for the browser-to-BFF hop, never a user provider URL. */
export function isLlmCredentialTransportAllowed(apiBaseUrl: string, pageUrl: string | undefined, development: boolean): boolean {
    try {
        if (/[\\\s]/.test(apiBaseUrl)) return false
        const api = new URL(apiBaseUrl)
        if (api.username || api.password || apiBaseUrl.includes('?') || apiBaseUrl.includes('#')) return false
        if (api.protocol === 'https:') return true
        return development && api.protocol === 'http:' && LOOPBACK_HTTP.test(apiBaseUrl)
            && pageUrl !== undefined && LOOPBACK_HTTP.test(pageUrl) && new URL(pageUrl).protocol === 'http:'
    } catch {
        return false
    }
}

export function assertLlmCredentialTransport(): void {
    if (!isLlmCredentialTransportAllowed(API_BASE_URL, typeof window === 'undefined' ? undefined : window.location.href, import.meta.env.DEV)) {
        throw Object.assign(new Error('LLM_CREDENTIAL_HTTPS_REQUIRED'), { code: 'LLM_CREDENTIAL_HTTPS_REQUIRED' })
    }
}
