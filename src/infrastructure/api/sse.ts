/** Incremental SSE framing. Network chunks have no relationship to lines or events. */
export class StreamContractError extends Error {
    readonly code: string
    constructor(message: string, code = 'stream_contract') { super(message); this.code = code }
}

export interface SseEvent { type: string; [key: string]: unknown }

export async function readEventStream<T extends { type: string }>(
    response: Response,
    onEvent: (event: T) => void,
    options: { signal?: AbortSignal; assertOwner?: () => void; idleMs?: number } = {},
): Promise<void> {
    if (response.headers.get('content-type')?.split(';')[0].trim() !== 'text/event-stream') {
        await response.body?.cancel()
        throw new StreamContractError('Expected an event stream.')
    }
    if (!response.body) throw new StreamContractError('The stream returned no response body.')
    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8', { fatal: true })
    let line = ''
    let skipLF = false
    let eventType = 'message'
    let data: string[] = []
    let terminal = false
    let readError: unknown
    const abort = () => { readError = options.signal?.reason ?? new DOMException('Aborted', 'AbortError'); void reader.cancel().catch(() => {}) }
    options.signal?.addEventListener('abort', abort, { once: true })
    const consumeLine = () => {
        if (!line) {
            if (data.length) {
                let value: unknown
                try { value = JSON.parse(data.join('\n')) } catch { throw new StreamContractError('The stream returned malformed event data.') }
                if (!value || typeof value !== 'object' || Array.isArray(value)) throw new StreamContractError('The stream returned an invalid event.')
                const event = { ...value, type: eventType } as T
                options.signal?.throwIfAborted()
                options.assertOwner?.()
                onEvent(event)
                terminal = eventType === 'final' || eventType === 'error'
                if (eventType === 'done' && !terminal) throw new StreamContractError('The stream ended before its result.', 'stream_incomplete')
            }
            data = []
            eventType = 'message'
        } else if (!line.startsWith(':')) {
            const colon = line.indexOf(':')
            const field = colon < 0 ? line : line.slice(0, colon)
            const raw = colon < 0 ? '' : line.slice(colon + 1)
            const value = raw.startsWith(' ') ? raw.slice(1) : raw
            if (field === 'event') eventType = value
            if (field === 'data') data.push(value)
        }
        line = ''
    }
    const consume = (text: string) => {
        for (const char of text) {
            if (skipLF) { skipLF = false; if (char === '\n') continue }
            if (char === '\r' || char === '\n') {
                consumeLine()
                skipLF = char === '\r'
                if (terminal) return
            } else line += char
        }
    }
    try {
        options.signal?.throwIfAborted()
        while (!terminal) {
            const timer = setTimeout(() => {
                readError = new StreamContractError('The connection stopped receiving data.', 'stream_idle_timeout')
                void reader.cancel().catch(() => {})
            }, options.idleMs ?? 45_000)
            let chunk: ReadableStreamReadResult<Uint8Array>
            try { chunk = await reader.read() } finally { clearTimeout(timer) }
            if (readError) throw readError
            options.assertOwner?.()
            if (chunk.done) {
                consume(decoder.decode())
                if (!terminal) throw new StreamContractError('The stream ended before its result.', 'stream_incomplete')
                break
            }
            consume(decoder.decode(chunk.value, { stream: true }))
        }
    } finally {
        options.signal?.removeEventListener('abort', abort)
        await reader.cancel().catch(() => {})
        reader.releaseLock()
    }
}
