import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VOICE_PROTOCOL_VERSION, VoiceSocket, configureVoiceSocketAuthRefresh, readClientMetricsVersion } from './voiceSocket'
import type { VoiceSocketClientFrame, VoiceTurnClientMetricsFrame } from '@/shared/types/voice.types'

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

function protocolsOf(socket: MockWebSocket): string[] {
    return Array.isArray(socket.protocols) ? socket.protocols : [socket.protocols ?? '']
}

async function flushPromises(): Promise<void> {
    await Promise.resolve()
    await Promise.resolve()
}

function startFrame(): Extract<VoiceSocketClientFrame, { type: 'voice_start' }> {
    return {
        type: 'voice_start',
        client_call_id: 'call-1',
        audio: {
            preferred_encoding: 'audio/wav;codec=pcm_s16le',
            sample_rate: 16000,
            channels: 1,
            vad: { source: 'audio_worklet', aggressiveness: 'balanced' },
        },
        capabilities: { media_source_mp3: true, audio_worklet: true, media_recorder: false },
    }
}

const READY_FRAME = {
    type: 'voice_ready',
    voice_session_id: 'voice-1',
    server_time_ms: 1,
    limits: { max_call_seconds: 600, idle_timeout_seconds: 30, remaining_daily_seconds: 60 },
    upload_url: '/character-chats/7/voice-segments',
}

describe('VoiceSocket', () => {
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
        configureVoiceSocketAuthRefresh(null)
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
        vi.useRealTimers()
    })

    it('opens the sibling ws-voice endpoint with the bearer subprotocol and sends voice_start', () => {
        const onMessage = vi.fn()
        const onStatusChange = vi.fn()
        const socket = new VoiceSocket(7, WORKSPACE_ID, { onMessage, onStatusChange })

        socket.connect(startFrame())
        expect(MockWebSocket.instances[0].url).toContain('/character-chats/7/ws-voice')
        expect(new URL(MockWebSocket.instances[0].url).searchParams.get('workspace_id')).toBe(WORKSPACE_ID)
        expect(protocolsOf(MockWebSocket.instances[0])).toEqual(['mw.bearer.v1', 'old-token'])

        MockWebSocket.instances[0].emitOpen()

        expect(onStatusChange).toHaveBeenLastCalledWith('open')
        expect(MockWebSocket.instances[0].send).toHaveBeenCalledWith(JSON.stringify(startFrame()))
    })

    it('sends heartbeat voice_ping every 25 seconds after voice_ready', async () => {
        vi.useFakeTimers()
        const socket = new VoiceSocket(7, WORKSPACE_ID, { onMessage: vi.fn() })
        socket.connect(startFrame())
        MockWebSocket.instances[0].emitOpen()
        MockWebSocket.instances[0].emitMessage({
            type: 'voice_ready',
            voice_session_id: 'voice-1',
            server_time_ms: 1,
            limits: { max_call_seconds: 600, idle_timeout_seconds: 30, remaining_daily_seconds: 60 },
            upload_url: '/character-chats/7/voice-segments',
        })

        MockWebSocket.instances[0].send.mockClear()
        await vi.advanceTimersByTimeAsync(25_000)

        expect(MockWebSocket.instances[0].send).toHaveBeenCalledWith(JSON.stringify({ type: 'voice_ping', voice_session_id: 'voice-1' }))
    })

    it('resumes an established call after two missed heartbeat windows', async () => {
        vi.useFakeTimers()
        const onMessage = vi.fn()
        const onStatusChange = vi.fn()
        const socket = new VoiceSocket(7, WORKSPACE_ID, { onMessage, onStatusChange })
        socket.connect(startFrame())
        MockWebSocket.instances[0].emitOpen()
        MockWebSocket.instances[0].emitMessage(READY_FRAME)
        socket.noteSegmentSeq(4)

        await vi.advanceTimersByTimeAsync(50_000)
        expect(MockWebSocket.instances[0].close).toHaveBeenCalledTimes(1)
        expect(onStatusChange).toHaveBeenLastCalledWith('connecting')

        await vi.advanceTimersByTimeAsync(500)
        expect(MockWebSocket.instances).toHaveLength(2)
        MockWebSocket.instances[1].emitOpen()
        expect(MockWebSocket.instances[1].send).toHaveBeenCalledWith(JSON.stringify({ type: 'voice_resume', voice_session_id: 'voice-1', last_segment_seq: 4 }))
        expect(onMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'voice_error' }))
    })

    it('resets the liveness deadline on every valid inbound frame', async () => {
        vi.useFakeTimers()
        const socket = new VoiceSocket(7, WORKSPACE_ID, { onMessage: vi.fn() })
        socket.connect(startFrame())
        MockWebSocket.instances[0].emitOpen()
        MockWebSocket.instances[0].emitMessage({
            type: 'voice_ready',
            voice_session_id: 'voice-1',
            server_time_ms: 1,
            limits: { max_call_seconds: 600, idle_timeout_seconds: 30, remaining_daily_seconds: 60 },
            upload_url: '/character-chats/7/voice-segments',
        })

        await vi.advanceTimersByTimeAsync(49_000)
        MockWebSocket.instances[0].emitMessage({
            type: 'voice_pong',
            voice_session_id: 'voice-1',
            server_time_ms: 49_000,
        })
        await vi.advanceTimersByTimeAsync(49_000)
        expect(MockWebSocket.instances[0].close).not.toHaveBeenCalled()

        await vi.advanceTimersByTimeAsync(2_000)
        expect(MockWebSocket.instances[0].close).toHaveBeenCalledTimes(1)
    })

    it('fails visibly on 4401 after ready instead of resuming an ended backend session', async () => {
        const refresh = vi.fn().mockImplementation(async () => {
            localStorage.setItem('magic_worlds:token', 'new-token')
            return 'new-token'
        })
        configureVoiceSocketAuthRefresh(refresh)
        const onMessage = vi.fn()
        const socket = new VoiceSocket(7, WORKSPACE_ID, { onMessage })
        socket.connect(startFrame())
        MockWebSocket.instances[0].emitOpen()
        MockWebSocket.instances[0].emitMessage({
            type: 'voice_ready',
            voice_session_id: 'voice-1',
            server_time_ms: 1,
            limits: { max_call_seconds: 600, idle_timeout_seconds: 30, remaining_daily_seconds: 60 },
            upload_url: '/character-chats/7/voice-segments',
        })
        MockWebSocket.instances[0].emitClose(4401)
        await flushPromises()

        expect(refresh).not.toHaveBeenCalled()
        expect(MockWebSocket.instances).toHaveLength(1)
        expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({
            type: 'voice_error',
            category: 'auth',
            fatal: true,
        }))
    })

    it('accepts resume state snapshots without replaying raw audio', () => {
        const onMessage = vi.fn()
        const socket = new VoiceSocket(7, WORKSPACE_ID, { onMessage })
        socket.connect(startFrame())
        MockWebSocket.instances[0].emitOpen()

        MockWebSocket.instances[0].emitMessage({
            type: 'voice_state_snapshot',
            voice_session_id: 'voice-1',
            state: 'listening',
            status: 'active',
            last_segment_seq: 2,
            last_audio_seq: 4,
            server_time_ms: 1,
        })

        expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'voice_state_snapshot', voice_session_id: 'voice-1' }))
        expect(MockWebSocket.instances[0].send.mock.calls.map(([payload]) => String(payload))).not.toEqual(
            expect.arrayContaining([expect.stringContaining('raw_audio')]),
        )
    })

    it('does not reconnect after terminal origin rejection', async () => {
        vi.useFakeTimers()
        const onMessage = vi.fn()
        const socket = new VoiceSocket(7, WORKSPACE_ID, { onMessage })
        socket.connect(startFrame())

        MockWebSocket.instances[0].emitClose(4403)
        await vi.advanceTimersByTimeAsync(30_000)

        expect(MockWebSocket.instances).toHaveLength(1)
        expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'voice_error', category: 'auth', fatal: true }))
    })

    it('ends the call once on a 4404 close (chat not in this workspace), even mid-call', async () => {
        vi.useFakeTimers()
        const onMessage = vi.fn()
        const required = vi.fn()
        window.addEventListener('workspace:required', required)
        const socket = new VoiceSocket(7, WORKSPACE_ID, { onMessage })
        socket.connect(startFrame())
        MockWebSocket.instances[0].emitOpen()
        MockWebSocket.instances[0].emitMessage(READY_FRAME)

        MockWebSocket.instances[0].emitClose(4404)
        await vi.advanceTimersByTimeAsync(30_000)
        window.removeEventListener('workspace:required', required)

        expect(MockWebSocket.instances).toHaveLength(1)
        expect(socket.isResuming).toBe(false)
        expect(required).not.toHaveBeenCalled()
        expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'voice_error', category: 'not_found', code: 'CHAT_SESSION_NOT_FOUND', fatal: true }))
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('CLOSE_CHAT_SESSION_NOT_FOUND_4404'), expect.anything())
    })

    it('treats a 4422 close as a stale build: no reconnect, workspace:required fired', async () => {
        vi.useFakeTimers()
        const onMessage = vi.fn()
        const required = vi.fn()
        window.addEventListener('workspace:required', required)
        const socket = new VoiceSocket(7, WORKSPACE_ID, { onMessage })
        socket.connect(startFrame())

        MockWebSocket.instances[0].emitClose(4422)
        await vi.advanceTimersByTimeAsync(30_000)
        window.removeEventListener('workspace:required', required)

        expect(MockWebSocket.instances).toHaveLength(1)
        expect(required).toHaveBeenCalledOnce()
        expect(onMessage).toHaveBeenCalledTimes(1)
        expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'voice_error', code: 'WORKSPACE_REQUIRED', fatal: true }))
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('CLOSE_WORKSPACE_REQUIRED_4422'), expect.anything())
    })

    it('reconnects transient closes with backoff', async () => {
        vi.useFakeTimers()
        const socket = new VoiceSocket(7, WORKSPACE_ID, { onMessage: vi.fn() })
        socket.connect(startFrame())

        MockWebSocket.instances[0].emitClose(1006)
        await vi.advanceTimersByTimeAsync(999)
        expect(MockWebSocket.instances).toHaveLength(1)

        await vi.advanceTimersByTimeAsync(1)
        expect(MockWebSocket.instances).toHaveLength(2)
    })

    it('resumes the call with voice_resume after a transient close', async () => {
        vi.useFakeTimers()
        const onMessage = vi.fn()
        const socket = new VoiceSocket(7, WORKSPACE_ID, { onMessage })
        socket.connect(startFrame())
        MockWebSocket.instances[0].emitOpen()
        MockWebSocket.instances[0].emitMessage(READY_FRAME)
        socket.noteSegmentSeq(2)

        MockWebSocket.instances[0].emitClose(1006)
        expect(socket.isResuming).toBe(true)
        await vi.advanceTimersByTimeAsync(500)
        expect(MockWebSocket.instances).toHaveLength(2)
        MockWebSocket.instances[1].emitOpen()
        expect(MockWebSocket.instances[1].send).toHaveBeenCalledWith(JSON.stringify({ type: 'voice_resume', voice_session_id: 'voice-1', last_segment_seq: 2 }))

        MockWebSocket.instances[1].emitMessage({
            type: 'voice_state_snapshot',
            voice_session_id: 'voice-1',
            state: 'listening',
            status: 'active',
            last_segment_seq: 2,
            last_audio_seq: 0,
            server_time_ms: 2,
        })
        expect(socket.isResuming).toBe(false)
        expect(onMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'voice_error' }))
    })

    it('gives up once the resume window passes', async () => {
        vi.useFakeTimers()
        const onMessage = vi.fn()
        const socket = new VoiceSocket(7, WORKSPACE_ID, { onMessage })
        socket.connect(startFrame())
        MockWebSocket.instances[0].emitOpen()
        MockWebSocket.instances[0].emitMessage(READY_FRAME)

        MockWebSocket.instances[0].emitClose(1006)
        // Every resume attempt fails at the network level.
        for (let elapsed = 0; elapsed < 20_000; elapsed += 250) {
            await vi.advanceTimersByTimeAsync(250)
            const latest = MockWebSocket.instances[MockWebSocket.instances.length - 1]
            if (latest.readyState === MockWebSocket.CONNECTING) latest.emitClose(1006)
        }

        expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({
            type: 'voice_error',
            category: 'internal',
            code: 'VOICE_CONNECTION_LOST',
            fatal: true,
        }))
        const attempts = MockWebSocket.instances.length
        await vi.advanceTimersByTimeAsync(30_000)
        expect(MockWebSocket.instances).toHaveLength(attempts)
    })

    it('refreshes the token once when the handshake fails before any frame', async () => {
        const refresh = vi.fn().mockImplementation(async () => {
            localStorage.setItem('magic_worlds:token', 'new-token')
            return 'new-token'
        })
        configureVoiceSocketAuthRefresh(refresh)
        const socket = new VoiceSocket(7, WORKSPACE_ID, { onMessage: vi.fn() })
        socket.connect(startFrame())

        MockWebSocket.instances[0].emitClose(1006)
        await flushPromises()

        expect(refresh).toHaveBeenCalledTimes(1)
        expect(MockWebSocket.instances).toHaveLength(2)
        expect(protocolsOf(MockWebSocket.instances[1])).toEqual(['mw.bearer.v1', 'new-token'])
        MockWebSocket.instances[1].emitOpen()
        expect(MockWebSocket.instances[1].send).toHaveBeenCalledWith(JSON.stringify(startFrame()))
    })

    it('lets the 4401 close recover a rejected token instead of surfacing the typed auth frame', async () => {
        const refresh = vi.fn().mockImplementation(async () => {
            localStorage.setItem('magic_worlds:token', 'new-token')
            return 'new-token'
        })
        configureVoiceSocketAuthRefresh(refresh)
        const onMessage = vi.fn()
        const socket = new VoiceSocket(7, WORKSPACE_ID, { onMessage })
        socket.connect(startFrame())

        // Server contract C3: accept, typed voice_error, then close 4401.
        MockWebSocket.instances[0].emitOpen()
        MockWebSocket.instances[0].emitMessage({ type: 'voice_error', category: 'auth', code: 'auth_required', message: 'Authentication required.', fatal: true })
        MockWebSocket.instances[0].emitClose(4401)
        await flushPromises()

        expect(onMessage).not.toHaveBeenCalled()
        expect(refresh).toHaveBeenCalledTimes(1)
        MockWebSocket.instances[1].emitOpen()
        expect(MockWebSocket.instances[1].send).toHaveBeenCalledWith(JSON.stringify(startFrame()))
    })

    it('refreshes and resumes when the token expired during a network drop', async () => {
        vi.useFakeTimers()
        configureVoiceSocketAuthRefresh(vi.fn().mockImplementation(async () => {
            localStorage.setItem('magic_worlds:token', 'new-token')
            return 'new-token'
        }))
        const onMessage = vi.fn()
        const socket = new VoiceSocket(7, WORKSPACE_ID, { onMessage })
        socket.connect(startFrame())
        MockWebSocket.instances[0].emitOpen()
        MockWebSocket.instances[0].emitMessage(READY_FRAME)
        onMessage.mockClear()

        MockWebSocket.instances[0].emitClose(1006)
        await vi.advanceTimersByTimeAsync(500)
        MockWebSocket.instances[1].emitOpen()
        MockWebSocket.instances[1].emitMessage({ type: 'voice_error', category: 'auth', code: 'auth_required', message: 'Authentication required.', fatal: true })
        MockWebSocket.instances[1].emitClose(4401)
        await vi.advanceTimersByTimeAsync(0)

        expect(MockWebSocket.instances).toHaveLength(3)
        MockWebSocket.instances[2].emitOpen()
        expect(MockWebSocket.instances[2].send).toHaveBeenCalledWith(JSON.stringify({ type: 'voice_resume', voice_session_id: 'voice-1', last_segment_seq: 0 }))
        expect(onMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'voice_error' }))
    })

    it('still reports a rejected origin as a terminal auth error', () => {
        const onMessage = vi.fn()
        const socket = new VoiceSocket(7, WORKSPACE_ID, { onMessage })
        socket.connect(startFrame())
        MockWebSocket.instances[0].emitOpen()
        MockWebSocket.instances[0].emitMessage({ type: 'voice_error', category: 'auth', code: 'origin_forbidden', message: 'Origin not allowed.', fatal: true })

        expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'voice_error', code: 'origin_forbidden', fatal: true }))
    })

    it('starts a fresh call with voice_start after a previous call ended', () => {
        const socket = new VoiceSocket(7, WORKSPACE_ID, { onMessage: vi.fn() })
        socket.connect(startFrame())
        MockWebSocket.instances[0].emitOpen()
        MockWebSocket.instances[0].emitMessage(READY_FRAME)
        socket.close()

        socket.connect({ ...startFrame(), client_call_id: 'call-2' })
        MockWebSocket.instances[1].emitOpen()
        expect(MockWebSocket.instances[1].send).toHaveBeenCalledWith(JSON.stringify({ ...startFrame(), client_call_id: 'call-2' }))
    })

    it('refuses raw-audio JSON control payloads', () => {
        const onMessage = vi.fn()
        const socket = new VoiceSocket(7, WORKSPACE_ID, { onMessage })
        socket.connect(startFrame())
        MockWebSocket.instances[0].emitOpen()
        MockWebSocket.instances[0].send.mockClear()

        const sent = socket.sendFrame({ type: 'voice_segment_meta', data_b64: 'raw-audio' } as unknown as VoiceSocketClientFrame)

        expect(sent).toBe(false)
        expect(MockWebSocket.instances[0].send).not.toHaveBeenCalled()
        expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'voice_error', category: 'unsupported_media' }))
    })

    it.each(['xi_api_key', 'xi-api-key', 'XI-API-KEY', 'single_use_token'])('refuses a provider credential key (%s), even nested', (key) => {
        const onMessage = vi.fn()
        const socket = new VoiceSocket(7, WORKSPACE_ID, { onMessage })
        socket.connect(startFrame())
        MockWebSocket.instances[0].emitOpen()
        MockWebSocket.instances[0].send.mockClear()

        const frame = { ...startFrame(), capabilities: { media_source_mp3: true, [key]: 'secret' } }
        const sent = socket.sendFrame(frame as unknown as VoiceSocketClientFrame)

        expect(sent).toBe(false)
        expect(MockWebSocket.instances[0].send).not.toHaveBeenCalled()
        expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'voice_error', category: 'unsupported_media' }))
    })

    it('drops assistant text from canceled turns and other voice sessions', () => {
        const onMessage = vi.fn()
        const socket = new VoiceSocket(7, WORKSPACE_ID, { onMessage })
        socket.connect(startFrame())
        MockWebSocket.instances[0].emitOpen()
        MockWebSocket.instances[0].emitMessage({ type: 'voice_state_snapshot', voice_session_id: 'voice-1' })
        MockWebSocket.instances[0].emitMessage({ type: 'voice_cancelled', voice_session_id: 'voice-1', turn_id: 'turn-1', reason: 'barge_in' })
        onMessage.mockClear()
        MockWebSocket.instances[0].emitMessage({ type: 'voice_assistant_delta', voice_session_id: 'voice-1', turn_id: 'turn-1', delta: 'late' })
        MockWebSocket.instances[0].emitMessage({ type: 'voice_assistant_delta', voice_session_id: 'older-session', turn_id: 'turn-2', delta: 'wrong session' })
        expect(onMessage).not.toHaveBeenCalled()
        MockWebSocket.instances[0].emitMessage({ type: 'voice_assistant_delta', voice_session_id: 'voice-1', turn_id: 'turn-2', delta: 'current' })
        expect(onMessage).toHaveBeenCalledOnce()
        socket.close()
    })

    it('drops stale audio chunks after cancellation', () => {
        const onMessage = vi.fn()
        const socket = new VoiceSocket(7, WORKSPACE_ID, { onMessage })
        socket.connect(startFrame())
        MockWebSocket.instances[0].emitOpen()

        MockWebSocket.instances[0].emitMessage({ type: 'voice_audio_chunk', voice_session_id: 'voice-1', turn_id: 'turn-1', seq: 1, content_type: 'audio/mpeg', sample_rate: 44100, channels: 1, data_b64: 'AA==', is_final: false })
        MockWebSocket.instances[0].emitMessage({ type: 'voice_cancelled', voice_session_id: 'voice-1', turn_id: 'turn-1', reason: 'barge_in' })
        MockWebSocket.instances[0].emitMessage({ type: 'voice_audio_chunk', voice_session_id: 'voice-1', turn_id: 'turn-1', seq: 2, content_type: 'audio/mpeg', sample_rate: 44100, channels: 1, data_b64: 'AQ==', is_final: false })

        expect(onMessage.mock.calls.filter(([frame]) => frame.type === 'voice_audio_chunk')).toHaveLength(1)
        expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'voice_cancelled' }))
    })

    it('does not log raw access tokens during auth recovery', async () => {
        configureVoiceSocketAuthRefresh(vi.fn().mockImplementation(async () => {
            localStorage.setItem('magic_worlds:token', 'new-token')
            return 'new-token'
        }))
        const socket = new VoiceSocket(7, WORKSPACE_ID, { onMessage: vi.fn() })
        socket.connect(startFrame())

        MockWebSocket.instances[0].emitClose(4401)
        await flushPromises()

        expect(console.error).not.toHaveBeenCalledWith(expect.stringContaining('old-token'), expect.anything())
        expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining('old-token'), expect.anything())
        expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('old-token'), expect.anything())
    })
})

describe('VoiceSocket R1 client frames (WS-C1, WS-C2)', () => {
    beforeEach(() => {
        localStorage.clear()
        localStorage.setItem('magic_worlds:token', 'old-token')
        MockWebSocket.instances = []
        vi.stubGlobal('WebSocket', MockWebSocket)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    function openSocket() {
        const socket = new VoiceSocket(7, WORKSPACE_ID, { onMessage: vi.fn() })
        socket.connect(startFrame())
        MockWebSocket.instances[0].emitOpen()
        MockWebSocket.instances[0].send.mockClear()
        return { socket, sent: () => MockWebSocket.instances[0].send.mock.calls.map(([raw]) => JSON.parse(raw as string)) }
    }

    it('sends playback progress with whole milliseconds', () => {
        const { socket, sent } = openSocket()
        expect(socket.sendPlayback('turn-1', 1499.6)).toBe(true)
        expect(sent()).toEqual([{ type: 'voice_playback', turn_id: 'turn-1', played_ms: 1500 }])
    })

    it.each([['', 10], ['turn-1', -1], ['turn-1', Number.NaN], ['turn-1', Number.POSITIVE_INFINITY]])('refuses playback progress %j / %j', (turnId, played) => {
        const { socket, sent } = openSocket()
        expect(socket.sendPlayback(turnId as string, played as number)).toBe(false)
        expect(sent()).toEqual([])
    })

    it('sends the R0 barge-in unchanged, and the turn fields only when given', () => {
        const { socket, sent } = openSocket()
        socket.sendBargeIn()
        socket.sendBargeIn({ type: 'voice_barge_in', reason: 'barge_in' })
        socket.sendBargeIn('turn-2', 640.2)
        socket.sendBargeIn('turn-3')
        expect(sent()).toEqual([
            { type: 'voice_barge_in', reason: 'barge_in' },
            { type: 'voice_barge_in', reason: 'barge_in' },
            { type: 'voice_barge_in', reason: 'barge_in', turn_id: 'turn-2', played_ms: 640 },
            { type: 'voice_barge_in', reason: 'barge_in', turn_id: 'turn-3' },
        ])
    })

    it('sends nothing while closed', () => {
        const socket = new VoiceSocket(7, WORKSPACE_ID, { onMessage: vi.fn() })
        expect(socket.sendPlayback('turn-1', 10)).toBe(false)
    })
})

describe('VoiceSocket protocol v2', () => {
    const PROTOCOL_V2 = { version: 2, client_metrics: 1 }
    const METRICS: VoiceTurnClientMetricsFrame = {
        type: 'voice_turn_client_metrics', v: 1, turn_id: 'turn-1', segment_seq: 4, outcome: 'played',
        speech_end_to_playing_ms: 3_042, v2v_ms: 3_063, output_latency_ms: 21, played_ms: 4_180,
        chunks: 19, stalls: 0, stall_ms: 0, playback_path: 'media_source', aec: 'on', autoplay_blocked: false,
    }

    beforeEach(() => {
        vi.useRealTimers()
        localStorage.clear()
        localStorage.setItem('magic_worlds:token', 'old-token')
        MockWebSocket.instances = []
        vi.stubGlobal('WebSocket', MockWebSocket)
        vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
        vi.useRealTimers()
    })

    function sentTypes(socket: MockWebSocket): string[] {
        return socket.send.mock.calls.map(([raw]) => (JSON.parse(raw as string) as { type: string }).type)
    }

    it('reads voice_ready.protocol defensively: anything malformed is a v1 server', () => {
        expect(readClientMetricsVersion({ protocol: PROTOCOL_V2 })).toBe(1)
        expect(readClientMetricsVersion({ protocol: { version: 3, client_metrics: 1, extra: 'ignored' } })).toBe(1)
        const malformed: unknown[] = [
            undefined, null, 2, 'v2', true, [], [2, 1],
            { version: 2 }, { client_metrics: 1 }, { version: '2', client_metrics: 1 }, { version: 2, client_metrics: '1' },
            { version: 2.5, client_metrics: 1 }, { version: 2, client_metrics: 1.5 }, { version: 1, client_metrics: 1 },
            { version: 2, client_metrics: 0 }, { version: Number.NaN, client_metrics: 1 }, { version: 2, client_metrics: null },
        ]
        for (const protocol of malformed) expect(readClientMetricsVersion({ protocol })).toBeNull()
        expect(readClientMetricsVersion(null)).toBeNull()
        expect(readClientMetricsVersion(undefined)).toBeNull()
    })

    it('sends the voice_start it is given, protocol_version included', () => {
        const socket = new VoiceSocket(7, WORKSPACE_ID, { onMessage: vi.fn() })
        socket.connect({ ...startFrame(), protocol_version: VOICE_PROTOCOL_VERSION })
        MockWebSocket.instances[0].emitOpen()
        const [raw] = MockWebSocket.instances[0].send.mock.calls[0]
        expect(JSON.parse(raw as string)).toEqual({ ...startFrame(), protocol_version: 2 })
    })

    it('sends turn metrics only on a call whose voice_ready advertised them, reset per call', () => {
        const onMessage = vi.fn()
        const socket = new VoiceSocket(7, WORKSPACE_ID, { onMessage })
        socket.connect(startFrame())
        MockWebSocket.instances[0].emitOpen()
        expect(socket.sendTurnMetrics(METRICS)).toBe(false) // before voice_ready
        MockWebSocket.instances[0].emitMessage(READY_FRAME) // a v1 server
        expect(socket.sendTurnMetrics(METRICS)).toBe(false)
        expect(sentTypes(MockWebSocket.instances[0])).toEqual(['voice_start'])

        socket.connect(startFrame())
        MockWebSocket.instances[1].emitOpen()
        MockWebSocket.instances[1].emitMessage({ ...READY_FRAME, protocol: PROTOCOL_V2 })
        // The client tolerates the new field: the ready frame reaches the call unchanged.
        expect(onMessage).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'voice_ready', protocol: PROTOCOL_V2 }))
        expect(socket.sendTurnMetrics(METRICS)).toBe(true)
        expect(MockWebSocket.instances[1].send).toHaveBeenLastCalledWith(JSON.stringify(METRICS))
        // Only the v1 frame this client knows how to build.
        expect(socket.sendTurnMetrics({ ...METRICS, v: 2 } as unknown as VoiceTurnClientMetricsFrame)).toBe(false)
        expect(socket.sendTurnMetrics({ ...METRICS, turn_id: '' })).toBe(false)

        // The next call starts as v1 until its own voice_ready says otherwise.
        socket.connect(startFrame())
        MockWebSocket.instances[2].emitOpen()
        expect(socket.sendTurnMetrics(METRICS)).toBe(false)
        MockWebSocket.instances[2].emitMessage({ ...READY_FRAME, protocol: { version: 2, client_metrics: 'one' } })
        expect(socket.sendTurnMetrics(METRICS)).toBe(false)
        expect(sentTypes(MockWebSocket.instances[2])).toEqual(['voice_start'])
        socket.close()
    })

    it('drops metrics while the call is resumed and never replays them', async () => {
        vi.useFakeTimers()
        const socket = new VoiceSocket(7, WORKSPACE_ID, { onMessage: vi.fn() })
        socket.connect(startFrame())
        MockWebSocket.instances[0].emitOpen()
        MockWebSocket.instances[0].emitMessage({ ...READY_FRAME, protocol: PROTOCOL_V2 })

        MockWebSocket.instances[0].emitClose(1006)
        expect(socket.sendTurnMetrics(METRICS)).toBe(false)
        await vi.advanceTimersByTimeAsync(500)
        MockWebSocket.instances[1].emitOpen()
        // Open again, but the call is not back until the snapshot.
        expect(socket.sendTurnMetrics(METRICS)).toBe(false)
        MockWebSocket.instances[1].emitMessage({
            type: 'voice_state_snapshot', voice_session_id: 'voice-1', state: 'listening', status: 'active',
            last_segment_seq: 0, last_audio_seq: 0, server_time_ms: 2,
        })
        expect(sentTypes(MockWebSocket.instances[1])).toEqual(['voice_resume'])
        // The resumed call keeps its advertised protocol.
        expect(socket.sendTurnMetrics(METRICS)).toBe(true)
        socket.close()
        expect(socket.sendTurnMetrics(METRICS)).toBe(false)
    })
})
