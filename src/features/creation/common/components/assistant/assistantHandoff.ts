/**
 * Hand-off from the assistant page (`#/assistant`) to an editor. The page opens
 * the editor's own route with `assistant=<conversation id>`; the editor's
 * assistant panel opens on that conversation and drops the parameter.
 */
const PARAM = 'assistant'

export function withAssistantConversation(hash: string, conversationId: number): string {
    const [path, query = ''] = hash.split('?')
    const params = new URLSearchParams(query)
    params.set(PARAM, String(conversationId))
    return `${path}?${params.toString()}`
}

/** The conversation a hash hands off, and the same hash without it. */
export function takeAssistantConversation(hash: string): { conversationId: number; hash: string } | null {
    const [path, query = ''] = hash.split('?')
    const params = new URLSearchParams(query)
    const conversationId = Number(params.get(PARAM))
    if (!Number.isSafeInteger(conversationId) || conversationId < 1) return null
    params.delete(PARAM)
    const rest = params.toString()
    return { conversationId, hash: rest ? `${path}?${rest}` : path }
}
