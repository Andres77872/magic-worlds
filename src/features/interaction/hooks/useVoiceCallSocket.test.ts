import { renderHook, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VoiceSocketClientFrame, VoiceSocketServerFrame } from '@/shared/types/voice.types'
import { useVoiceCallSocket } from './useVoiceCallSocket'

let socketHandlers: { onMessage: (message: VoiceSocketServerFrame) => void; onStatusChange?: (status: string) => void } | null = null
const socketInstances: Array<{
    sessionId: number
    basePath: string
    connect: ReturnType<typeof vi.fn>
    close: ReturnType<typeof vi.fn>
    sendVad: ReturnType<typeof vi.fn>
    sendSegmentMeta: ReturnType<typeof vi.fn>
    sendBargeIn: ReturnType<typeof vi.fn>
    end: ReturnType<typeof vi.fn>
}> = []

vi.mock('@/infrastructure/api', () => ({
    VoiceSocket: class {
        readonly sessionId: number
        readonly basePath: string
        connect = vi.fn()
        close = vi.fn()
        sendVad = vi.fn(() => true)
        sendSegmentMeta = vi.fn(() => true)
        sendBargeIn = vi.fn(() => true)
        end = vi.fn(() => true)

        constructor(_sessionId: number, handlers: { onMessage: (message: VoiceSocketServerFrame) => void; onStatusChange?: (status: string) => void }, _basePath: string) {
            this.sessionId = _sessionId
            this.basePath = _basePath
            socketHandlers = handlers
            socketInstances.push(this)
        }
    },
}))

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

describe('useVoiceCallSocket', () => {
    afterEach(() => {
        socketHandlers = null
        socketInstances.length = 0
        vi.clearAllMocks()
    })

    it('creates a VoiceSocket, starts it on demand, and closes on unmount', () => {
        const { result, unmount } = renderHook(() => useVoiceCallSocket(7, {}, 'token-1'))

        expect(socketInstances).toHaveLength(1)
        expect(socketInstances[0].sessionId).toBe(7)
        expect(socketInstances[0].basePath).toBe('character-chats')
        expect(socketInstances[0].connect).not.toHaveBeenCalled()

        act(() => result.current.start(startFrame()))
        expect(socketInstances[0].connect).toHaveBeenCalledWith(startFrame())
        expect(result.current.voiceState).toBe('connecting')

        unmount()
        expect(socketInstances[0].close).toHaveBeenCalledTimes(1)
    })

    it('uses refs so handler changes do not recreate the socket', () => {
        const firstReady = vi.fn()
        const secondReady = vi.fn()
        const { rerender } = renderHook(
            ({ onReady }) => useVoiceCallSocket(7, { onReady }, 'token-1'),
            { initialProps: { onReady: firstReady } },
        )

        rerender({ onReady: secondReady })
        socketHandlers?.onMessage({
            type: 'voice_ready',
            voice_session_id: 'voice-1',
            server_time_ms: 1,
            limits: { max_call_seconds: 600, idle_timeout_seconds: 30, remaining_daily_seconds: 120 },
            upload_url: '/character-chats/7/voice-segments',
        })

        expect(socketInstances).toHaveLength(1)
        expect(firstReady).not.toHaveBeenCalled()
        expect(secondReady).toHaveBeenCalledTimes(1)
    })

    it('updates deterministic state for ready/resume snapshot/status/error frames', () => {
        const onStateSnapshot = vi.fn()
        const onStatus = vi.fn()
        const onError = vi.fn()
        const { result } = renderHook(() => useVoiceCallSocket(7, { onStateSnapshot, onStatus, onError }, 'token-1'))

        act(() => socketHandlers?.onStatusChange?.('connecting'))
        expect(result.current.socketStatus).toBe('connecting')
        expect(result.current.voiceState).toBe('connecting')

        act(() => socketHandlers?.onMessage({
            type: 'voice_ready',
            voice_session_id: 'voice-1',
            server_time_ms: 1,
            limits: { max_call_seconds: 600, idle_timeout_seconds: 30, remaining_daily_seconds: 120 },
            upload_url: '/character-chats/7/voice-segments',
        }))
        expect(result.current.voiceSessionId).toBe('voice-1')
        expect(result.current.voiceState).toBe('listening')

        act(() => socketHandlers?.onMessage({
            type: 'voice_state_snapshot',
            voice_session_id: 'voice-1',
            state: 'listening',
            status: 'active',
            last_segment_seq: 2,
            last_audio_seq: 4,
            server_time_ms: 2,
        }))
        expect(result.current.voiceSessionId).toBe('voice-1')
        expect(result.current.voiceState).toBe('listening')
        expect(onStateSnapshot).toHaveBeenCalledWith(expect.objectContaining({ type: 'voice_state_snapshot', last_segment_seq: 2 }))

        act(() => socketHandlers?.onMessage({ type: 'voice_status', state: 'transcribing', message: 'Transcribing.' }))
        expect(result.current.voiceState).toBe('transcribing')
        expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({ state: 'transcribing' }))

        act(() => socketHandlers?.onMessage({ type: 'voice_error', category: 'quota_exceeded', message: 'Daily limit reached.', fatal: true }))
        expect(result.current.voiceState).toBe('error')
        expect(result.current.error).toMatchObject({ category: 'quota_exceeded' })
        expect(onError).toHaveBeenCalledTimes(1)
    })

    it('dispatches voice frames without storing or replaying raw audio', () => {
        const { result } = renderHook(() => useVoiceCallSocket(7, {}, 'token-1'))

        act(() => result.current.sendSegmentMeta({
            type: 'voice_segment_meta',
            voice_session_id: 'voice-1',
            seq: 1,
            started_at_ms: 0,
            duration_ms: 500,
            encoding: 'audio/wav;codec=pcm_s16le',
            sample_rate: 16000,
            channels: 1,
            byte_length: 44,
            audio_sha256: 'a'.repeat(64),
            vad: { speech_ms: 450, silence_ms: 50, rms: 0.1, peak: 0.2 },
        }))

        expect(socketInstances[0].sendSegmentMeta).toHaveBeenCalledTimes(1)
        expect(socketInstances[0].sendSegmentMeta.mock.calls[0][0]).not.toHaveProperty('audio')
    })

    it('recreates the socket when the auth key changes', () => {
        const { rerender, unmount } = renderHook(
            ({ authKey }) => useVoiceCallSocket(7, {}, authKey),
            { initialProps: { authKey: 'old-token' as string | null } },
        )

        rerender({ authKey: 'new-token' })

        expect(socketInstances).toHaveLength(2)
        expect(socketInstances[0].close).toHaveBeenCalledTimes(1)
        expect(socketInstances[1].sessionId).toBe(7)

        unmount()
        expect(socketInstances[1].close).toHaveBeenCalledTimes(1)
    })
})
