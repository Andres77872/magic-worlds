/**
 * Hash helpers for deep-linking into a voice call's saved transcript on CallsPage
 * (`#/calls?call=<voice_session_id>`). Preserves any existing `workspace` query param.
 */

export function buildCallTranscriptHash(
    voiceSessionId: string,
    currentHash: string = typeof window === 'undefined' ? '' : window.location.hash,
): string {
    const withoutHash = currentHash.startsWith('#') ? currentHash.slice(1) : currentHash
    const queryIndex = withoutHash.indexOf('?')
    const existingParams = new URLSearchParams(queryIndex === -1 ? '' : withoutHash.slice(queryIndex + 1))
    const workspace = existingParams.get('workspace')
    const params = new URLSearchParams()
    if (workspace) params.set('workspace', workspace)
    params.set('call', voiceSessionId)
    return `#/calls?${params.toString()}`
}

export function clearCallTranscriptHash(
    currentHash: string = typeof window === 'undefined' ? '' : window.location.hash,
): string {
    const withoutHash = currentHash.startsWith('#') ? currentHash.slice(1) : currentHash
    const queryIndex = withoutHash.indexOf('?')
    const existingParams = new URLSearchParams(queryIndex === -1 ? '' : withoutHash.slice(queryIndex + 1))
    existingParams.delete('call')
    const query = existingParams.toString()
    return `#/calls${query ? `?${query}` : ''}`
}

export function readCallIdFromLocation(
    hash: string = typeof window === 'undefined' ? '' : window.location.hash,
): string | null {
    const withoutHash = hash.startsWith('#') ? hash.slice(1) : hash
    const [path, query = ''] = withoutHash.split('?')
    if (path !== '/calls') return null
    const id = new URLSearchParams(query).get('call')?.trim()
    return id || null
}
