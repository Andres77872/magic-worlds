import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatSocket, configureChatSocketAuthRefresh } from './chatSocket'

const transport = vi.hoisted(() => ({ baseUrl: 'http://localhost:8010' }))
vi.mock('./baseUrl', () => ({ get API_BASE_URL() { return transport.baseUrl } }))

const WORKSPACE_ID = '0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b'

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

    emitMessage(message: unknown): void {
        this.onmessage?.({ data: JSON.stringify(message) } as MessageEvent)
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

describe('ChatSocket auth recovery', () => {
    beforeEach(() => {
        transport.baseUrl = 'http://localhost:8010'
        vi.stubEnv('DEV', true)
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
        vi.unstubAllEnvs()
        configureChatSocketAuthRefresh(null)
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it('sends the captured workspace as the workspace_id query and keeps the bearer subprotocol', () => {
        const socket = new ChatSocket(3, WORKSPACE_ID, { onMessage: vi.fn() })
        socket.connect()
        const url = new URL(MockWebSocket.instances[0].url)
        expect(url.pathname).toMatch(/\/adventure-sessions\/3\/ws$/)
        expect(url.searchParams.get('workspace_id')).toBe(WORKSPACE_ID)
        expect([...url.searchParams.keys()]).toEqual(['workspace_id'])
        expect(protocolsOf(MockWebSocket.instances[0])).toEqual(['mw.bearer.v1', 'old-token'])
        socket.close()
    })

    it('refuses to open without a workspace UUID', () => {
        expect(() => new ChatSocket(3, '', { onMessage: vi.fn() })).toThrow()
        expect(() => new ChatSocket(3, WORKSPACE_ID.toUpperCase(), { onMessage: vi.fn() })).toThrow()
    })

    it('Stop clears a queued chat before the socket opens', () => {
        const socket = new ChatSocket(3, WORKSPACE_ID, { onMessage: vi.fn() })
        socket.sendChat('Do not send', 'stopped-request')
        socket.cancel()
        MockWebSocket.instances[0].emitOpen()
        expect(MockWebSocket.instances[0].send).not.toHaveBeenCalled()
        socket.close()
    })

    it('Stop invalidates a pending token refresh continuation', async () => {
        const expired = jwtWithExp(Math.floor(Date.now() / 1000) - 60)
        localStorage.setItem('magic_worlds:token', expired)
        let resolve!: (token: string) => void
        configureChatSocketAuthRefresh(() => new Promise((done) => { resolve = done }))
        const socket = new ChatSocket(3, WORKSPACE_ID, { onMessage: vi.fn() })
        socket.sendChat('Do not send', 'stopped-request')
        socket.cancel()
        resolve('fresh-token')
        await flushPromises()
        expect(MockWebSocket.instances).toHaveLength(0)
        socket.close()
    })

    it('reports a dropped active stream once and never resends it on reconnect', async () => {
        vi.useFakeTimers()
        const interrupted = vi.fn()
        const socket = new ChatSocket(3, WORKSPACE_ID, { onMessage: vi.fn(), onStreamInterrupted: interrupted })
        socket.connect()
        MockWebSocket.instances[0].emitOpen()
        socket.sendChat('Only once', 'req-one')
        MockWebSocket.instances[0].emitClose(1006)
        expect(interrupted).toHaveBeenCalledOnce()
        await vi.advanceTimersByTimeAsync(2000)
        MockWebSocket.instances[1].emitOpen()
        expect(MockWebSocket.instances[1].send).not.toHaveBeenCalled()
        socket.close()
        vi.useRealTimers()
    })

    it('refreshes once on first 4401 and reconnects with the new token', async () => {
        const expired = vi.fn()
        const onMessage = vi.fn()
        window.addEventListener('auth:expired', expired)
        configureChatSocketAuthRefresh(vi.fn().mockImplementation(async () => {
            localStorage.setItem('magic_worlds:token', 'new-token')
            return 'new-token'
        }))

        const socket = new ChatSocket(3, WORKSPACE_ID, { onMessage })
        socket.connect()
        expect(protocolsOf(MockWebSocket.instances[0])).toEqual(['mw.bearer.v1', 'old-token'])

        MockWebSocket.instances[0].emitClose(4401)
        await flushPromises()

        expect(MockWebSocket.instances).toHaveLength(2)
        expect(protocolsOf(MockWebSocket.instances[1])).toEqual(['mw.bearer.v1', 'new-token'])
        expect(expired).not.toHaveBeenCalled()
        expect(onMessage).not.toHaveBeenCalledWith(expect.objectContaining({ category: 'auth' }))
    })

    it('recovers across independent expiry cycles after authenticated ready frames', async () => {
        let generation = 0
        const refresh = vi.fn().mockImplementation(async () => {
            generation += 1
            const token = `new-token-${generation}`
            localStorage.setItem('magic_worlds:token', token)
            return token
        })
        configureChatSocketAuthRefresh(refresh)

        const socket = new ChatSocket(3, WORKSPACE_ID, { onMessage: vi.fn() })
        socket.connect()
        MockWebSocket.instances[0].emitClose(4401)
        await flushPromises()
        MockWebSocket.instances[1].emitOpen()
        MockWebSocket.instances[1].emitMessage({ type: 'ready' })
        MockWebSocket.instances[1].emitClose(4401)
        await flushPromises()

        expect(refresh).toHaveBeenCalledTimes(2)
        expect(MockWebSocket.instances).toHaveLength(3)
        expect(protocolsOf(MockWebSocket.instances[2])).toEqual(['mw.bearer.v1', 'new-token-2'])
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

        const socket = new ChatSocket(3, WORKSPACE_ID, { onMessage })
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

        const socket = new ChatSocket(3, WORKSPACE_ID, { onMessage })
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

        const socket = new ChatSocket(3, WORKSPACE_ID, { onMessage })
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

        const socket = new ChatSocket(3, WORKSPACE_ID, { onMessage })
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

        const socket = new ChatSocket(3, WORKSPACE_ID, { onMessage: vi.fn() })
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

        const socket = new ChatSocket(7, WORKSPACE_ID, { onMessage: vi.fn() })
        socket.connect()
        MockWebSocket.instances[0].emitOpen()

        socket.sendChat('hello')
        await flushPromises()

        expect(refresh).toHaveBeenCalledTimes(1)
        expect(MockWebSocket.instances[0].send).not.toHaveBeenCalled()
        expect(MockWebSocket.instances).toHaveLength(2)
        expect(protocolsOf(MockWebSocket.instances[1])).toEqual(['mw.bearer.v1', freshToken])

        MockWebSocket.instances[1].emitOpen()

        expect(JSON.parse(String(MockWebSocket.instances[1].send.mock.calls[0][0]))).toEqual({
            type: 'chat',
            llm: { selection: { mode: 'inherit' } },
            content: 'hello',
            request_id: expect.any(String),
        })
    })

    it('sends immediately when the current JWT is not close to expiry', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-06-17T10:00:00Z'))
        const token = jwtWithExp(Math.floor((Date.now() + 5 * 60_000) / 1_000))
        const refresh = vi.fn()
        localStorage.setItem('magic_worlds:token', token)
        configureChatSocketAuthRefresh(refresh)

        const socket = new ChatSocket(7, WORKSPACE_ID, { onMessage: vi.fn() })
        socket.connect()
        MockWebSocket.instances[0].emitOpen()

        socket.sendChat('hello')

        expect(refresh).not.toHaveBeenCalled()
        expect(MockWebSocket.instances).toHaveLength(1)
        expect(JSON.parse(String(MockWebSocket.instances[0].send.mock.calls[0][0]))).toEqual({
            type: 'chat',
            llm: { selection: { mode: 'inherit' } },
            content: 'hello',
            request_id: expect.any(String),
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

        const socket = new ChatSocket(7, WORKSPACE_ID, { onMessage })
        socket.connect()
        MockWebSocket.instances[0].emitOpen()

        socket.sendChat('hello')
        await flushPromises()

        expect(refresh).toHaveBeenCalledTimes(1)
        expect(MockWebSocket.instances[0].send).not.toHaveBeenCalled()
        expect(MockWebSocket.instances).toHaveLength(1)
        expect(expired).toHaveBeenCalledTimes(1)
        expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ category: 'auth' }))
    })

    it('keeps text frames but drops narration frames with voices off and calls on', async () => {
        setTestFeatureFlags({ voices: false })
        setTestFeatureFlags({ calls: true })
        const socket = new ChatSocket(7, WORKSPACE_ID, { onMessage: vi.fn() }, 'character-chats')
        socket.connect()
        const ws = MockWebSocket.instances[0]
        ws.emitOpen()
        socket.sendTts(101, 'turn', 'tts-request')
        socket.sendChat('hello')
        await flushPromises()
        expect(ws.send.mock.calls.map(([value]) => JSON.parse(String(value)).type)).toEqual(['chat'])
        socket.close()
    })

    it('keeps character text chat on /ws with text-only control frame types', async () => {
        vi.useFakeTimers()
        const socket = new ChatSocket(7, WORKSPACE_ID, { onMessage: vi.fn() }, 'character-chats')
        socket.connect()

        expect(MockWebSocket.instances[0].url).toMatch(new RegExp(`/character-chats/7/ws\\?workspace_id=${WORKSPACE_ID}$`))
        expect(MockWebSocket.instances[0].url).not.toContain('/ws-voice')

        MockWebSocket.instances[0].emitOpen()
        socket.sendChat('hello')
        socket.sendTts(101, 'turn-1', 'tts-request-1')
        socket.cancel()
        await vi.advanceTimersByTimeAsync(25_000)

        const frames = MockWebSocket.instances[0].send.mock.calls.map(([payload]) => JSON.parse(String(payload)))
        expect(frames.map((frame) => frame.type)).toEqual(['chat', 'tts', 'cancel', 'ping'])
        expect(frames[0]).toEqual({
            type: 'chat',
            llm: { selection: { mode: 'inherit' } },
            content: 'hello',
            request_id: expect.any(String),
        })
        expect(JSON.stringify(frames)).not.toContain('raw_audio')
        expect(JSON.stringify(frames)).not.toContain('audio_b64')
        expect(JSON.stringify(frames)).not.toContain('data_b64')
    })

    it('treats a 4403 origin rejection as terminal instead of reconnecting', async () => {
        vi.useFakeTimers()
        const onMessage = vi.fn()
        const socket = new ChatSocket(3, WORKSPACE_ID, { onMessage })
        socket.connect()
        MockWebSocket.instances[0].emitOpen()
        MockWebSocket.instances[0].emitClose(4403)
        await vi.advanceTimersByTimeAsync(60_000)

        expect(MockWebSocket.instances).toHaveLength(1)
        expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({
            type: 'error',
            category: 'forbidden',
        }))
    })

    it('treats a 4404 (unknown session or workspace) as terminal instead of reconnecting', async () => {
        vi.useFakeTimers()
        const onMessage = vi.fn()
        const socket = new ChatSocket(3, WORKSPACE_ID, { onMessage })
        socket.connect()
        MockWebSocket.instances[0].emitClose(4404)
        await vi.advanceTimersByTimeAsync(60_000)

        expect(MockWebSocket.instances).toHaveLength(1)
        expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', category: 'not_found', code: 'CHAT_SESSION_NOT_FOUND' }))
    })

    it('refreshes permissions without refreshing authentication or reconnecting after a feature refusal', async () => {
        vi.useFakeTimers()
        const refresh = vi.fn()
        configureChatSocketAuthRefresh(refresh)
        const invalidated = vi.fn()
        window.addEventListener('feature-flags:invalidate', invalidated)
        const socket = new ChatSocket(3, WORKSPACE_ID, { onMessage: vi.fn() })
        try {
            socket.connect()
            MockWebSocket.instances[0].emitOpen()
            MockWebSocket.instances[0].emitClose(4453)
            await vi.advanceTimersByTimeAsync(60_000)
            expect(MockWebSocket.instances).toHaveLength(1)
            expect(refresh).not.toHaveBeenCalled()
            expect(invalidated).toHaveBeenCalledOnce()
        } finally {
            socket.close()
            window.removeEventListener('feature-flags:invalidate', invalidated)
        }
    })

    it('treats a 4422 (no workspace sent: stale client) as terminal and asks for a reload', async () => {
        vi.useFakeTimers()
        const onMessage = vi.fn()
        const required = vi.fn()
        window.addEventListener('workspace:required', required)
        const socket = new ChatSocket(3, WORKSPACE_ID, { onMessage })
        socket.connect()
        MockWebSocket.instances[0].emitClose(4422)
        await vi.advanceTimersByTimeAsync(60_000)
        window.removeEventListener('workspace:required', required)

        expect(MockWebSocket.instances).toHaveLength(1)
        expect(required).toHaveBeenCalledTimes(1)
        expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', code: 'WORKSPACE_REQUIRED' }))
    })

    it('tears down and reconnects a half-open socket that stops answering pings', async () => {
        vi.useFakeTimers()
        const socket = new ChatSocket(3, WORKSPACE_ID, { onMessage: vi.fn() })
        socket.connect()
        MockWebSocket.instances[0].emitOpen()

        // No inbound frame at all (not even a pong) across the liveness window.
        await vi.advanceTimersByTimeAsync(25_000)
        await vi.advanceTimersByTimeAsync(25_000)
        expect(MockWebSocket.instances).toHaveLength(1)
        await vi.advanceTimersByTimeAsync(25_000)
        expect(MockWebSocket.instances[0].close).toHaveBeenCalled()

        await vi.advanceTimersByTimeAsync(1_000)
        expect(MockWebSocket.instances).toHaveLength(2)
    })

    it('keeps a quiet socket alive while pong frames arrive', async () => {
        vi.useFakeTimers()
        const socket = new ChatSocket(3, WORKSPACE_ID, { onMessage: vi.fn() })
        socket.connect()
        MockWebSocket.instances[0].emitOpen()

        for (let i = 0; i < 4; i++) {
            await vi.advanceTimersByTimeAsync(25_000)
            MockWebSocket.instances[0].onmessage?.({ data: JSON.stringify({ type: 'pong' }) } as MessageEvent)
        }

        expect(MockWebSocket.instances).toHaveLength(1)
        expect(MockWebSocket.instances[0].close).not.toHaveBeenCalled()
    })

    it('serializes an optional request id', () => {
        const socket = new ChatSocket(7, WORKSPACE_ID, { onMessage: vi.fn() })
        socket.connect()
        MockWebSocket.instances[0].emitOpen()

        socket.sendChat('hello', 'request-7')

        expect(JSON.parse(String(MockWebSocket.instances[0].send.mock.calls[0][0]))).toEqual({
            type: 'chat',
            llm: { selection: { mode: 'inherit' } },
            content: 'hello',
            request_id: 'request-7',
        })
    })

    it.each(['http://localhost:8010', 'https://api.test.invalid'])('materializes a queued LLM key only when sending over %s and drops the copy afterward', baseUrl => {
        transport.baseUrl = baseUrl
        const onMessage = vi.fn()
        const socket = new ChatSocket(7, WORKSPACE_ID, { onMessage }, 'character-chats')
        const llm = { selection: { mode: 'profile' as const, profile_id: 'custom-profile' }, expected_revision_id: 'custom-revision',
            credentials: { api_key: 'FAKE_LLM_SOCKET_CANARY' } }
        const materialize = vi.fn(() => llm)
        socket.sendChat('hello', 'custom-request', undefined, materialize)
        expect(materialize).not.toHaveBeenCalled()
        MockWebSocket.instances[0].emitOpen()
        expect(materialize).toHaveBeenCalledOnce()
        expect(JSON.parse(String(MockWebSocket.instances[0].send.mock.calls[0][0])).llm.credentials.api_key).toBe('FAKE_LLM_SOCKET_CANARY')
        expect(llm).not.toHaveProperty('credentials')
        expect(onMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }))
        socket.close()
    })

    it('blocks a queued key when production transport is insecure and preserves the fixed reason', () => {
        vi.stubEnv('DEV', false)
        const onMessage = vi.fn()
        const socket = new ChatSocket(7, WORKSPACE_ID, { onMessage })
        const llm = { credentials: { api_key: 'FAKE_BLOCKED_SOCKET_CANARY' } }
        socket.sendChat('hello', 'blocked-request', undefined, () => llm)
        MockWebSocket.instances[0].emitOpen()
        expect(MockWebSocket.instances[0].send).not.toHaveBeenCalled()
        expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', category: 'request', code: 'LLM_CREDENTIAL_HTTPS_REQUIRED', request_id: 'blocked-request' }))
        expect(JSON.stringify(onMessage.mock.calls)).not.toContain('FAKE_BLOCKED_SOCKET_CANARY')
        expect(llm).not.toHaveProperty('credentials')
        socket.close()
    })

    it('reads the image choice when a queued frame leaves and never sends its key without HTTPS', () => {
        const socket = new ChatSocket(7, WORKSPACE_ID, { onMessage: vi.fn() })
        socket.connect()
        let reads = 0
        const image = { generate: true, image_profile_id: '11111111-1111-4111-8111-111111111111', credentials: { api_key: 'FAKE_IMAGE_KEY' } }
        socket.sendChat('hello', 'request-8', undefined, undefined, () => { reads += 1; return image })
        expect(reads).toBe(0)
        MockWebSocket.instances[0].emitOpen()
        // Whether the frame may carry `image` is named on the ready frame: it waits for it.
        expect(reads).toBe(0)
        expect(MockWebSocket.instances[0].send).not.toHaveBeenCalled()
        MockWebSocket.instances[0].emitMessage({ type: 'ready', capabilities: { chat_image_request: true, chat_images: true } })

        expect(reads).toBe(1)
        const sent = String(MockWebSocket.instances[0].send.mock.calls[0][0])
        expect(JSON.parse(sent)).toEqual({
            type: 'chat', content: 'hello', request_id: 'request-8', llm: { selection: { mode: 'inherit' } },
            image: { generate: true, image_profile_id: '11111111-1111-4111-8111-111111111111' },
        })
        expect(sent).not.toContain('FAKE_IMAGE_KEY')
        // The materialized key is dropped once the frame is out.
        expect(image).not.toHaveProperty('credentials')
    })

    it('reads the server capabilities before building the image field of a new chat\'s first frame', () => {
        let accepted = false
        const onMessage = vi.fn((message: { type: string; capabilities?: { chat_image_request: boolean } }) => {
            if (message.type === 'ready') accepted = message.capabilities?.chat_image_request === true
        })
        const socket = new ChatSocket(7, WORKSPACE_ID, { onMessage })
        socket.connect()
        socket.sendChat('hello', 'request-10', undefined, undefined, () => (accepted ? { generate: false } : undefined))
        MockWebSocket.instances[0].emitOpen()
        MockWebSocket.instances[0].emitMessage({ type: 'ready', capabilities: { chat_image_request: true, chat_images: true } })

        expect(JSON.parse(String(MockWebSocket.instances[0].send.mock.calls[0][0])).image).toEqual({ generate: false })
    })

    it('holds a frame sent between open and ready, and sends text-only frames at once', () => {
        const socket = new ChatSocket(7, WORKSPACE_ID, { onMessage: vi.fn() })
        socket.connect()
        const ws = MockWebSocket.instances[0]
        ws.emitOpen()

        socket.sendChat('plain', 'request-11')
        expect(ws.send).toHaveBeenCalledTimes(1)

        socket.sendChat('with image', 'request-12', undefined, undefined, () => ({ generate: true }))
        expect(ws.send).toHaveBeenCalledTimes(1)
        // An older server's ready frame names no capabilities; the frame still leaves.
        ws.emitMessage({ type: 'ready' })
        expect(ws.send).toHaveBeenCalledTimes(2)
        expect(MockWebSocket.instances).toHaveLength(1)

        socket.sendChat('after ready', 'request-13', undefined, undefined, () => ({ generate: true }))
        expect(ws.send).toHaveBeenCalledTimes(3)
    })

    it('sends no image field when the choice materializes to nothing', () => {
        const socket = new ChatSocket(7, WORKSPACE_ID, { onMessage: vi.fn() })
        socket.connect()
        MockWebSocket.instances[0].emitOpen()
        MockWebSocket.instances[0].emitMessage({ type: 'ready' })
        socket.sendChat('hello', 'request-9', undefined, undefined, () => undefined)
        expect(JSON.parse(String(MockWebSocket.instances[0].send.mock.calls[0][0]))).not.toHaveProperty('image')
    })

    it('preserves the stored user message id while a retry waits for connection', () => {
        const socket = new ChatSocket(7, WORKSPACE_ID, { onMessage: vi.fn() })
        socket.connect()
        socket.sendChat('hello', 'retry-7', 100)
        MockWebSocket.instances[0].emitOpen()

        expect(JSON.parse(String(MockWebSocket.instances[0].send.mock.calls[0][0]))).toEqual({
            type: 'chat', content: 'hello', request_id: 'retry-7', existing_user_message_id: 100, llm: { selection: { mode: 'inherit' } },
        })
    })
})
