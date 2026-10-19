/** Local form/wire validation only; server-side DNS enforcement happens at connection time. */
export function isCustomProviderBaseUrl(value: unknown): value is string {
    if (typeof value !== 'string' || !value || value.length > 2048 || value !== value.trim()
        || /[\x00-\x20\x7f\\]/.test(value) || /\{\{|\}\}|\[model\]/.test(value)) return false
    try {
        const url = new URL(value)
        const host = url.hostname.toLowerCase().replace(/\.$/, '')
        if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
            || url.port && url.port !== '443' || !host
            || host === 'localhost' || /\.(localhost|local|internal)$/.test(host)
            || /\/(chat\/completions|responses|completions|messages)\/?$/.test(url.pathname)
            || /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
            || /^\[(::1|::|f[cd]|fe80|ff)/.test(host)) return false
        return host.includes('.') || host.startsWith('[')
    } catch { return false }
}

export function isCustomProvider(value: unknown): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const data = value as Record<string, unknown>
    return Object.keys(data).length === 3 && data.protocol === 'openai'
        && isCustomProviderBaseUrl(data.base_url)
        && (data.endpoint === 'chat_completions' || data.endpoint === 'responses')
}
