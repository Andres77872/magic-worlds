import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdventureChatSocket, configureChatSocketAuthRefresh } from './chatSocket'
import type { ChatMessage } from '@/shared/types/auth.types'

type Protocols = string | string[] | undefined

class MockWebSocket {
    static readonly CONNECTING = 0
    static readonly OPEN = 1
    static readonly CLOSING = 2
    static readonly CLOSED = 3
    static instances: MockWebSocket[] = []

    readonly url: string
    readonly protocols: Protocols
    readyState = MockWebSocket.CONNECTING
    onopen: ((event: Event) => void) | null = null
    onmessage: ((event: MessageEvent) => void) | null = null
    onclose: ((event: CloseEvent) => void) | null = null
    onerror: ((event: Event) => void) | null = null
    send = vi.fn()
    close = vi.fn((code?: number) => {
        this.readyState = MockWebSocket.CLOSED
        return code
    })

    constructor(url: string, protocols?: Protocols) {
        this.url = url
        this.protocols = protocols
        MockWebSocket.instances.push(this)
    }

    emitOpen(): void {
        this.readyState = MockWebSocket.OPEN
        this.onopen?.(new Event('open'))
    }

    emitClose(code: number): void {
        this.readyState = MockWebSocket.CLOSED
        this.onclose?.({ code } as CloseEvent)
    }
}

async function flushPromises(): Promise<void> {
    await Promise.resolve()
    await Promise.resolve()
}

function protocolsOf(socket: MockWebSocket): string[] {
    return Array.isArray(socket.protocols) ? socket.protocols : [socket.protocols ?? '']
}

function jwtWithExp(exp: number): string {
    const encode = (payload: unknown) =>
        btoa(JSON.stringify(payload))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/g, '')
    return `${encode({ alg: 'none' })}.${encode({ exp })}.signature`
}

describe('AdventureChatSocket auth recovery', () => {
    beforeEach(() => {
        vi.useRealTimers()
        vi.clearAllMocks()
        localStorage.clear()
        localStorage.setItem('magic_worlds:token', 'old-token')
        localStorage.setItem('magic_worlds:user', JSON.stringify({ username: 'nyra' }))
        MockWebSocket.instances = []
        vi.stubGlobal('WebSocket', MockWebSocket)
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        vi.spyOn(console, 'log').mockImplementation(() => undefined)
    })

    afterEach(() => {
        configureChatSocketAuthRefresh(null)
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it('refreshes once on first 4401 and reconnects with the new token', async () => {
        const expired = vi.fn()
        const onMessage = vi.fn()
        window.addEventListener('auth:expired', expired)
        configureChatSocketAuthRefresh(vi.fn().mockImplementation(async () => {
            localStorage.setItem('magic_worlds:token', 'new-token')
            return 'new-token'
        }))

        const socket = new AdventureChatSocket(3, { onMessage })
        socket.connect()
        expect(protocolsOf(MockWebSocket.instances[0])).toEqual(['mw.bearer.v1', 'old-token'])

        MockWebSocket.instances[0].emitClose(4401)
        await flushPromises()

        expect(MockWebSocket.instances).toHaveLength(2)
        expect(protocolsOf(MockWebSocket.instances[1])).toEqual(['mw.bearer.v1', 'new-token'])
        expect(expired).not.toHaveBeenCalled()
        expect(onMessage).not.toHaveBeenCalledWith(expect.objectContaining({ category: 'auth' }))
    })

    it('keeps auth state when the refresh-driven reconnect is rejected with another 4401', async () => {
        const expired = vi.fn()
        const onMessage = vi.fn()
        const refresh = vi.fn().mockImplementation(async () => {
            localStorage.setItem('magic_worlds:token', 'new-token')
            return 'new-token'
        })
        window.addEventListener('auth:expired', expired)
        configureChatSocketAuthRefresh(refresh)

        const socket = new AdventureChatSocket(3, { onMessage })
        socket.connect()
        MockWebSocket.instances[0].emitClose(4401)
        await flushPromises()
        MockWebSocket.instances[1].emitOpen()
        MockWebSocket.instances[1].emitClose(4401)
        await flushPromises()

        expect(refresh).toHaveBeenCalledTimes(1)
        expect(MockWebSocket.instances).toHaveLength(2)
        expect(expired).not.toHaveBeenCalled()
        expect(localStorage.getItem('magic_worlds:token')).toBe('new-token')
        expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({
            type: 'error',
            category: 'auth',
        }))
    })

    it('dispatches terminal auth error without normal reconnect backoff when refresh fails', async () => {
        vi.useFakeTimers()
        const expired = vi.fn()
        const onMessage = vi.fn()
        const refresh = vi.fn().mockRejectedValue(Object.assign(new Error('Authentication required.'), { status: 401 }))
        window.addEventListener('auth:expired', expired)
        configureChatSocketAuthRefresh(refresh)

        const socket = new AdventureChatSocket(3, { onMessage })
        socket.connect()
        MockWebSocket.instances[0].emitClose(4401)
        await flushPromises()
        await vi.advanceTimersByTimeAsync(30_000)

        expect(refresh).toHaveBeenCalledTimes(1)
        expect(MockWebSocket.instances).toHaveLength(1)
        expect(expired).toHaveBeenCalledTimes(1)
        expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ category: 'auth' }))
    })

    it('keeps auth state on transient refresh outage and retries after backoff', async () => {
        vi.useFakeTimers()
        const expired = vi.fn()
        const onMessage = vi.fn()
        const refresh = vi.fn().mockRejectedValue(Object.assign(new Error('Authentication service unavailable'), {
            status: 503,
            retryable: true,
        }))
        window.addEventListener('auth:expired', expired)
        configureChatSocketAuthRefresh(refresh)

        const socket = new AdventureChatSocket(3, { onMessage })
        socket.connect()
        MockWebSocket.instances[0].emitClose(4401)
        await flushPromises()

        expect(refresh).toHaveBeenCalledTimes(1)
        expect(expired).not.toHaveBeenCalled()
        expect(localStorage.getItem('magic_worlds:token')).toBe('old-token')
        expect(localStorage.getItem('magic_worlds:user')).toBe(JSON.stringify({ username: 'nyra' }))
        expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({
            type: 'error',
            category: 'auth_service_unavailable',
        }))

        await vi.advanceTimersByTimeAsync(1_000)
        expect(MockWebSocket.instances).toHaveLength(2)
        MockWebSocket.instances[1].emitClose(4401)
        await flushPromises()

        expect(refresh).toHaveBeenCalledTimes(2)
        expect(expired).not.toHaveBeenCalled()
        expect(localStorage.getItem('magic_worlds:token')).toBe('old-token')
    })

    it('does not duplicate auth expiry when shared refresh already expired auth', async () => {
        const expired = vi.fn()
        const onMessage = vi.fn()
        const refresh = vi.fn().mockImplementation(async () => {
            localStorage.removeItem('magic_worlds:token')
            localStorage.removeItem('magic_worlds:user')
            window.dispatchEvent(new CustomEvent('auth:expired'))
            throw Object.assign(new Error('Authentication required.'), { status: 401 })
        })
        window.addEventListener('auth:expired', expired)
        configureChatSocketAuthRefresh(refresh)

        const socket = new AdventureChatSocket(3, { onMessage })
        socket.connect()
        MockWebSocket.instances[0].emitClose(4401)
        await flushPromises()

        expect(refresh).toHaveBeenCalledTimes(1)
        expect(expired).toHaveBeenCalledTimes(1)
        expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ category: 'auth' }))
    })

    it('does not log raw access tokens during auth recovery', async () => {
        configureChatSocketAuthRefresh(vi.fn().mockImplementation(async () => {
            localStorage.setItem('magic_worlds:token', 'new-token')
            return 'new-token'
        }))

        const socket = new AdventureChatSocket(3, { onMessage: vi.fn() })
        socket.connect()
        MockWebSocket.instances[0].emitClose(4401)
        await flushPromises()

        expect(console.error).not.toHaveBeenCalledWith(expect.stringContaining('old-token'), expect.anything())
        expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining('old-token'), expect.anything())
        expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('old-token'), expect.anything())
    })

    it('refreshes an expiring JWT before sending a chat frame on an open socket', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-06-17T10:00:00Z'))
        const expiringToken = jwtWithExp(Math.floor((Date.now() + 30_000) / 1_000))
        const freshToken = jwtWithExp(Math.floor((Date.now() + 15 * 60_000) / 1_000))
        localStorage.setItem('magic_worlds:token', expiringToken)
        const refresh = vi.fn().mockImplementation(async () => {
            localStorage.setItem('magic_worlds:token', freshToken)
            return freshToken
        })
        configureChatSocketAuthRefresh(refresh)

        const socket = new AdventureChatSocket(7, { onMessage: vi.fn() })
        socket.connect()
        MockWebSocket.instances[0].emitOpen()

        socket.sendChat([{ role: 'user', content: 'hello' } satisfies ChatMessage])
        await flushPromises()

        expect(refresh).toHaveBeenCalledTimes(1)
        expect(MockWebSocket.instances[0].send).not.toHaveBeenCalled()
        expect(MockWebSocket.instances).toHaveLength(2)
        expect(protocolsOf(MockWebSocket.instances[1])).toEqual(['mw.bearer.v1', freshToken])

        MockWebSocket.instances[1].emitOpen()

        expect(JSON.parse(String(MockWebSocket.instances[1].send.mock.calls[0][0]))).toEqual({
            type: 'chat',
            messages: [{ role: 'user', content: 'hello' }],
            options: { generateImage: true, suggestActions: true },
        })
    })

    it('sends immediately when the current JWT is not close to expiry', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-06-17T10:00:00Z'))
        const token = jwtWithExp(Math.floor((Date.now() + 5 * 60_000) / 1_000))
        const refresh = vi.fn()
        localStorage.setItem('magic_worlds:token', token)
        configureChatSocketAuthRefresh(refresh)

        const socket = new AdventureChatSocket(7, { onMessage: vi.fn() })
        socket.connect()
        MockWebSocket.instances[0].emitOpen()

        socket.sendChat([{ role: 'user', content: 'hello' } satisfies ChatMessage])

        expect(refresh).not.toHaveBeenCalled()
        expect(MockWebSocket.instances).toHaveLength(1)
        expect(JSON.parse(String(MockWebSocket.instances[0].send.mock.calls[0][0]))).toEqual({
            type: 'chat',
            messages: [{ role: 'user', content: 'hello' }],
            options: { generateImage: true, suggestActions: true },
        })
    })

    it('does not send a queued chat frame when proactive refresh is terminally rejected', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-06-17T10:00:00Z'))
        const expiredToken = jwtWithExp(Math.floor((Date.now() - 1_000) / 1_000))
        localStorage.setItem('magic_worlds:token', expiredToken)
        const expired = vi.fn()
        const onMessage = vi.fn()
        const refresh = vi.fn().mockRejectedValue(Object.assign(new Error('Authentication required.'), { status: 401 }))
        window.addEventListener('auth:expired', expired)
        configureChatSocketAuthRefresh(refresh)

        const socket = new AdventureChatSocket(7, { onMessage })
        socket.connect()
        MockWebSocket.instances[0].emitOpen()

        socket.sendChat([{ role: 'user', content: 'hello' } satisfies ChatMessage])
        await flushPromises()

        expect(refresh).toHaveBeenCalledTimes(1)
        expect(MockWebSocket.instances[0].send).not.toHaveBeenCalled()
        expect(MockWebSocket.instances).toHaveLength(1)
        expect(expired).toHaveBeenCalledTimes(1)
        expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ category: 'auth' }))
    })

    it('keeps character text chat on /ws with text-only control frame types', async () => {
        vi.useFakeTimers()
        const socket = new AdventureChatSocket(7, { onMessage: vi.fn() }, 'character-chats')
        socket.connect()

        expect(MockWebSocket.instances[0].url).toContain('/character-chats/7/ws')
        expect(MockWebSocket.instances[0].url).not.toContain('/ws-voice')

        MockWebSocket.instances[0].emitOpen()
        socket.sendChat([{ role: 'user', content: 'hello' } satisfies ChatMessage])
        socket.sendTts(101, 'turn-1', 'tts-request-1')
        socket.cancel()
        await vi.advanceTimersByTimeAsync(25_000)

        const frames = MockWebSocket.instances[0].send.mock.calls.map(([payload]) => JSON.parse(String(payload)))
        expect(frames.map((frame) => frame.type)).toEqual(['chat', 'tts', 'cancel', 'ping'])
        expect(frames[0]).toEqual({
            type: 'chat',
            messages: [{ role: 'user', content: 'hello' }],
            options: { generateImage: true, suggestActions: true },
        })
        expect(JSON.stringify(frames)).not.toContain('raw_audio')
        expect(JSON.stringify(frames)).not.toContain('audio_b64')
        expect(JSON.stringify(frames)).not.toContain('data_b64')
    })

    it('serializes explicit chat generation options', () => {
        const socket = new AdventureChatSocket(7, { onMessage: vi.fn() })
        socket.connect()
        MockWebSocket.instances[0].emitOpen()

        socket.sendChat(
            [{ role: 'user', content: 'hello' } satisfies ChatMessage],
            { generateImage: false, suggestActions: false },
        )

        expect(JSON.parse(String(MockWebSocket.instances[0].send.mock.calls[0][0]))).toEqual({
            type: 'chat',
            messages: [{ role: 'user', content: 'hello' }],
            options: { generateImage: false, suggestActions: false },
        })
    })
})
