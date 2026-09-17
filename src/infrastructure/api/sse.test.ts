import { describe, expect, it, vi } from 'vitest'
import { readEventStream, type SseEvent } from './sse'

const encoder = new TextEncoder()
function response(chunks: Uint8Array[], cancel = vi.fn()) {
    return new Response(new ReadableStream({
        start(controller) { for (const chunk of chunks) controller.enqueue(chunk); controller.close() },
        cancel,
    }), { headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } })
}

describe('readEventStream', () => {
    it.each(['\n', '\r\n', '\r'])('handles every byte boundary with %j lines, comments and multiline JSON', async (nl) => {
        const wire = [': heartbeat', '', 'event: assistant_delta', 'data: {', 'data: "delta": "á 😀 \\n \\"quoted\\""}', '', 'event: final', 'data: {"saved":true}', '', ''].join(nl)
        const bytes = encoder.encode(wire)
        for (let split = 0; split <= bytes.length; split++) {
            const events: SseEvent[] = []
            await readEventStream(response([bytes.slice(0, split), bytes.slice(split)]), (event: SseEvent) => events.push(event))
            expect(events).toEqual([{ type: 'assistant_delta', delta: 'á 😀 \n "quoted"' }, { type: 'final', saved: true }])
        }
        const events: SseEvent[] = []
        await readEventStream(response(Array.from(bytes, (byte) => new Uint8Array([byte]))), (event: SseEvent) => events.push(event))
        expect(events).toHaveLength(2)
    })

    it.each([
        ['event: final\ndata: broken\n\n', 'malformed'],
        ['event: final\ndata: []\n\n', 'invalid'],
        ['event: assistant_delta\ndata: {"delta":"partial"}\n\n', 'before its result'],
        ['event: done\ndata: {}\n\n', 'before its result'],
        ['event: final\ndata: {}\n', 'before its result'],
    ])('rejects invalid or incomplete streams', async (wire, message) => {
        await expect(readEventStream(response([encoder.encode(wire)]), vi.fn())).rejects.toThrow(message)
    })

    it('rejects an unexpected response type and releases the body', async () => {
        const cancel = vi.fn()
        const body = new ReadableStream({ cancel })
        await expect(readEventStream(new Response(body, { headers: { 'Content-Type': 'application/json' } }), vi.fn())).rejects.toThrow('Expected an event stream')
        expect(cancel).toHaveBeenCalledOnce()
        expect(body.locked).toBe(false)
    })

    it('cancels an idle read promptly and releases its reader', async () => {
        const controller = new AbortController()
        const cancel = vi.fn()
        const body = new ReadableStream({ cancel })
        const pending = readEventStream(new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }), vi.fn(), { signal: controller.signal })
        controller.abort()
        await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
        expect(cancel).toHaveBeenCalledOnce()
        expect(body.locked).toBe(false)
    })

    it('returns on a persisted final without waiting for socket EOF', async () => {
        const cancel = vi.fn()
        const body = new ReadableStream({ start(c) { c.enqueue(encoder.encode('event: final\ndata: {}\n\n')) }, cancel })
        await readEventStream(new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }), vi.fn())
        expect(cancel).toHaveBeenCalledOnce()
        expect(body.locked).toBe(false)
    })

    it('rejects output when account ownership changes', async () => {
        const onEvent = vi.fn()
        await expect(readEventStream(response([encoder.encode('event: final\ndata: {}\n\n')]), onEvent, {
            assertOwner() { throw new DOMException('Changed owner', 'AbortError') },
        })).rejects.toMatchObject({ name: 'AbortError' })
        expect(onEvent).not.toHaveBeenCalled()
    })

    it('distinguishes a silent connection from an incomplete generation', async () => {
        const body = new ReadableStream()
        await expect(readEventStream(new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }), vi.fn(), { idleMs: 1 }))
            .rejects.toMatchObject({ code: 'stream_idle_timeout' })
        expect(body.locked).toBe(false)
    })
})
