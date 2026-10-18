/** A test server that delivers saved story candidates over the stable SSE transport. */
export function storyStreamFetch(fetchResponse: typeof fetch): typeof fetch {
    return async (input, init) => {
        const response = await fetchResponse(input, init)
        if (!String(input).endsWith('/generate/stream') || !response.ok
            || !response.headers.get('Content-Type')?.includes('application/json')) return response
        const candidate: unknown = await response.json()
        return new Response(`event: final\ndata: ${JSON.stringify(candidate)}\n\n`, {
            headers: { 'Content-Type': 'text/event-stream' },
        })
    }
}
