import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VoiceSocket, configureVoiceSocketAuthRefresh } from './voiceSocket'
import type { VoiceSocketClientFrame } from '@/shared/types/voice.types'

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
        consent_version: 'voice-v1',
        audio: {
            preferred_encoding: 'audio/wav;codec=pcm_s16le',
            sample_rate: 16000,
            channels: 1,
            vad: { source: 'audio_worklet', aggressiveness: 'balanced' },
        },
        capabilities: { media_source_mp3: true, audio_worklet: true, media_recorder: true },
    }
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
        const socket = new VoiceSocket(7, { onMessage, onStatusChange })

        socket.connect(startFrame())
        expect(MockWebSocket.instances[0].url).toContain('/character-chats/7/ws-voice')
        expect(protocolsOf(MockWebSocket.instances[0])).toEqual(['mw.bearer.v1', 'old-token'])

        MockWebSocket.instances[0].emitOpen()

        expect(onStatusChange).toHaveBeenLastCalledWith('open')
        expect(MockWebSocket.instances[0].send).toHaveBeenCalledWith(JSON.stringify(startFrame()))
    })

    it('sends heartbeat voice_ping every 25 seconds after voice_ready', async () => {
        vi.useFakeTimers()
        const socket = new VoiceSocket(7, { onMessage: vi.fn() })
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

    it('refreshes once on 4401 and reconnects with voice_resume after a ready session', async () => {
        configureVoiceSocketAuthRefresh(vi.fn().mockImplementation(async () => {
            localStorage.setItem('magic_worlds:token', 'new-token')
            return 'new-token'
        }))
        const socket = new VoiceSocket(7, { onMessage: vi.fn() })
        socket.connect(startFrame())
        MockWebSocket.instances[0].emitOpen()
        MockWebSocket.instances[0].emitMessage({
            type: 'voice_ready',
            voice_session_id: 'voice-1',
            server_time_ms: 1,
            limits: { max_call_seconds: 600, idle_timeout_seconds: 30, remaining_daily_seconds: 60 },
            upload_url: '/character-chats/7/voice-segments',
        })
        socket.sendSegmentMeta({
            type: 'voice_segment_meta',
            voice_session_id: 'voice-1',
            seq: 3,
            started_at_ms: 10,
            duration_ms: 500,
            encoding: 'audio/wav;codec=pcm_s16le',
            sample_rate: 16000,
            channels: 1,
            byte_length: 44,
            audio_sha256: 'a'.repeat(64),
            vad: { speech_ms: 450, silence_ms: 50, rms: 0.1, peak: 0.2 },
        })

        MockWebSocket.instances[0].emitClose(4401)
        await flushPromises()
        MockWebSocket.instances[1].emitOpen()

        expect(protocolsOf(MockWebSocket.instances[1])).toEqual(['mw.bearer.v1', 'new-token'])
        expect(MockWebSocket.instances[1].send).toHaveBeenCalledWith(JSON.stringify({
            type: 'voice_resume',
            voice_session_id: 'voice-1',
            last_segment_seq: 3,
            last_audio_seq: 0,
        }))
    })

    it('accepts resume state snapshots without replaying raw audio', () => {
        const onMessage = vi.fn()
        const socket = new VoiceSocket(7, { onMessage })
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
        const socket = new VoiceSocket(7, { onMessage })
        socket.connect(startFrame())

        MockWebSocket.instances[0].emitClose(4403)
        await vi.advanceTimersByTimeAsync(30_000)

        expect(MockWebSocket.instances).toHaveLength(1)
        expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'voice_error', category: 'auth', fatal: true }))
    })

    it('reconnects transient closes with backoff', async () => {
        vi.useFakeTimers()
        const socket = new VoiceSocket(7, { onMessage: vi.fn() })
        socket.connect(startFrame())

        MockWebSocket.instances[0].emitClose(1006)
        await vi.advanceTimersByTimeAsync(999)
        expect(MockWebSocket.instances).toHaveLength(1)

        await vi.advanceTimersByTimeAsync(1)
        expect(MockWebSocket.instances).toHaveLength(2)
    })

    it('refuses raw-audio JSON control payloads', () => {
        const onMessage = vi.fn()
        const socket = new VoiceSocket(7, { onMessage })
        socket.connect(startFrame())
        MockWebSocket.instances[0].emitOpen()
        MockWebSocket.instances[0].send.mockClear()

        const sent = socket.sendFrame({ type: 'voice_segment_meta', data_b64: 'raw-audio' } as unknown as VoiceSocketClientFrame)

        expect(sent).toBe(false)
        expect(MockWebSocket.instances[0].send).not.toHaveBeenCalled()
        expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'voice_error', category: 'unsupported_media' }))
    })

    it('drops stale audio chunks after cancellation', () => {
        const onMessage = vi.fn()
        const socket = new VoiceSocket(7, { onMessage })
        socket.connect(startFrame())
        MockWebSocket.instances[0].emitOpen()

        MockWebSocket.instances[0].emitMessage({ type: 'voice_audio_chunk', voice_session_id: 'voice-1', turn_id: 'turn-1', seq: 1, content_type: 'audio/mpeg', sample_rate: 32000, channels: 1, data_b64: 'AA==', is_final: false })
        MockWebSocket.instances[0].emitMessage({ type: 'voice_cancelled', voice_session_id: 'voice-1', turn_id: 'turn-1', reason: 'barge_in' })
        MockWebSocket.instances[0].emitMessage({ type: 'voice_audio_chunk', voice_session_id: 'voice-1', turn_id: 'turn-1', seq: 2, content_type: 'audio/mpeg', sample_rate: 32000, channels: 1, data_b64: 'AQ==', is_final: false })

        expect(onMessage.mock.calls.filter(([frame]) => frame.type === 'voice_audio_chunk')).toHaveLength(1)
        expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'voice_cancelled' }))
    })

    it('does not log raw access tokens during auth recovery', async () => {
        configureVoiceSocketAuthRefresh(vi.fn().mockImplementation(async () => {
            localStorage.setItem('magic_worlds:token', 'new-token')
            return 'new-token'
        }))
        const socket = new VoiceSocket(7, { onMessage: vi.fn() })
        socket.connect(startFrame())

        MockWebSocket.instances[0].emitClose(4401)
        await flushPromises()

        expect(console.error).not.toHaveBeenCalledWith(expect.stringContaining('old-token'), expect.anything())
        expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining('old-token'), expect.anything())
        expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('old-token'), expect.anything())
    })
})
