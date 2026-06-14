import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VoicePlaybackBuffer } from '../audio/voicePlaybackBuffer'
import type { CapturedVoiceSegment } from '../audio/voiceVadWorklet'
import type { MicrophoneCaptureApi, UseMicrophoneCaptureOptions } from './useMicrophoneCapture'
import type { VoiceCallSocketApi, VoiceCallSocketHandlers } from './useVoiceCallSocket'
import { useVoiceCallController } from './useVoiceCallController'

const mocks = vi.hoisted(() => ({
    apiService: {
        saveVoiceConsent: vi.fn(),
        uploadVoiceSegment: vi.fn(),
        endVoiceCall: vi.fn(),
    },
    socketHandlers: null as VoiceCallSocketHandlers | null,
    microphoneOptions: null as UseMicrophoneCaptureOptions | null,
    socketApi: null as VoiceCallSocketApi | null,
    microphoneApi: null as MicrophoneCaptureApi | null,
    playback: null as Pick<VoicePlaybackBuffer, 'startTurn' | 'appendChunk' | 'finalize' | 'cancel' | 'dispose'> | null,
}))

vi.mock('@/infrastructure/api', () => ({
    apiService: mocks.apiService,
}))

vi.mock('./useVoiceCallSocket', () => ({
    useVoiceCallSocket: vi.fn((_sessionId: number | null, handlers: VoiceCallSocketHandlers) => {
        mocks.socketHandlers = handlers
        return mocks.socketApi
    }),
}))

vi.mock('./useMicrophoneCapture', () => ({
    useMicrophoneCapture: vi.fn((options: UseMicrophoneCaptureOptions) => {
        mocks.microphoneOptions = options
        return mocks.microphoneApi
    }),
}))

function createSegment(seq = 1): CapturedVoiceSegment {
    return {
        seq,
        started_at_ms: 10,
        duration_ms: 500,
        encoding: 'audio/wav;codec=pcm_s16le',
        sample_rate: 16000,
        channels: 1,
        byte_length: 48,
        audio_sha256: `${seq}`.repeat(64).slice(0, 64),
        vad: { speech_ms: 450, silence_ms: 50, rms: 0.12, peak: 0.4, source: 'audio_worklet', aggressiveness: 'balanced' },
        audio: new Blob([new Uint8Array([82, 73, 70, 70])], { type: 'audio/wav;codec=pcm_s16le' }),
    }
}

function readyFrame() {
    return {
        type: 'voice_ready' as const,
        voice_session_id: 'voice-1',
        server_time_ms: 1,
        limits: { max_call_seconds: 600, idle_timeout_seconds: 30, remaining_daily_seconds: 120 },
        upload_url: '/character-chats/7/voice-segments',
    }
}

function renderController(overrides: Partial<Parameters<typeof useVoiceCallController>[0]> = {}) {
    return renderHook(() => useVoiceCallController({
        sessionId: 7,
        authKey: 'token-1',
        consentGranted: true,
        enabled: true,
        clientCallId: 'call-1',
        playbackBuffer: mocks.playback as VoicePlaybackBuffer,
        ...overrides,
    }))
}

describe('useVoiceCallController', () => {
    beforeEach(() => {
        vi.useRealTimers()
        vi.clearAllMocks()
        mocks.socketHandlers = null
        mocks.microphoneOptions = null
        mocks.apiService.saveVoiceConsent.mockResolvedValue({
            status: 'accepted',
            consent_version: 'voice-v1',
            limits: { max_call_seconds: 600, idle_timeout_seconds: 30, remaining_daily_seconds: 120 },
        })
        mocks.apiService.uploadVoiceSegment.mockResolvedValue({ voice_session_id: 'voice-1', segment_id: 'segment-1', seq: 1, status: 'accepted' })
        mocks.apiService.endVoiceCall.mockResolvedValue({ status: 'ended', voice_session_id: 'voice-1', reason: 'user' })
        mocks.socketApi = {
            socketStatus: 'closed',
            voiceState: 'idle',
            ready: null,
            error: null,
            voiceSessionId: null,
            start: vi.fn(),
            sendVad: vi.fn(() => true),
            sendSegmentMeta: vi.fn(() => true),
            bargeIn: vi.fn(() => true),
            end: vi.fn(() => true),
            close: vi.fn(),
        }
        mocks.microphoneApi = {
            status: 'idle',
            error: null,
            source: null,
            isMuted: false,
            nextSeq: 1,
            start: vi.fn(async () => true),
            stop: vi.fn(),
            mute: vi.fn(),
            unmute: vi.fn(),
        }
        mocks.playback = {
            startTurn: vi.fn(),
            appendChunk: vi.fn(() => true),
            finalize: vi.fn(),
            cancel: vi.fn(),
            dispose: vi.fn(),
        }
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('starts after explicit consent, then ends with full local teardown', async () => {
        const { result } = renderController()

        await act(async () => {
            await expect(result.current.startCall()).resolves.toBe(true)
        })

        expect(mocks.apiService.saveVoiceConsent).toHaveBeenCalledWith(7)
        expect(mocks.microphoneApi!.start).toHaveBeenCalledTimes(1)
        expect(vi.mocked(mocks.microphoneApi!.start).mock.invocationCallOrder[0]).toBeLessThan(
            mocks.apiService.saveVoiceConsent.mock.invocationCallOrder[0],
        )
        expect(mocks.socketApi!.start).toHaveBeenCalledWith(expect.objectContaining({
            type: 'voice_start',
            client_call_id: 'call-1',
            consent_version: 'voice-v1',
        }))
        expect(vi.mocked(mocks.socketApi!.start).mock.calls[0][0]).not.toHaveProperty('audio_blob')
        expect(result.current.state).toBe('connecting')

        act(() => mocks.socketHandlers?.onReady?.(readyFrame()))
        expect(result.current.state).toBe('listening')
        expect(result.current.voiceSessionId).toBe('voice-1')

        await act(async () => {
            await result.current.endCall('user')
        })

        expect(mocks.socketApi!.end).toHaveBeenCalledWith('user')
        expect(mocks.microphoneApi!.stop).toHaveBeenCalled()
        expect(mocks.playback!.cancel).toHaveBeenCalled()
        expect(mocks.socketApi!.close).toHaveBeenCalled()
        expect(mocks.apiService.endVoiceCall).toHaveBeenCalledWith(7, { voiceSessionId: 'voice-1', reason: 'user' })
        expect(result.current.state).toBe('ended')
    })

    it('stops at consent_required without saving consent or opening capture', async () => {
        const { result } = renderController({ consentGranted: false })

        await act(async () => {
            await expect(result.current.startCall()).resolves.toBe(false)
        })

        expect(result.current.state).toBe('consent_required')
        expect(mocks.apiService.saveVoiceConsent).not.toHaveBeenCalled()
        expect(mocks.microphoneApi!.start).not.toHaveBeenCalled()
        expect(mocks.socketApi!.start).not.toHaveBeenCalled()
    })

    it('queues VAD-cut segments until voice_ready, then sends metadata and uploads bytes over REST', async () => {
        const { result } = renderController()
        const segment = createSegment(1)

        act(() => mocks.microphoneOptions?.onSegment?.(segment))
        expect(result.current.uploadQueueDepth).toBe(1)
        expect(mocks.apiService.uploadVoiceSegment).not.toHaveBeenCalled()

        act(() => mocks.socketHandlers?.onReady?.(readyFrame()))

        await waitFor(() => expect(mocks.apiService.uploadVoiceSegment).toHaveBeenCalledTimes(1))
        expect(mocks.socketApi!.sendSegmentMeta).toHaveBeenCalledWith(expect.objectContaining({
            type: 'voice_segment_meta',
            voice_session_id: 'voice-1',
            seq: 1,
        }))
        expect(vi.mocked(mocks.socketApi!.sendSegmentMeta).mock.calls[0][0]).not.toHaveProperty('audio')
        expect(mocks.apiService.uploadVoiceSegment).toHaveBeenCalledWith(7, expect.objectContaining({
            voice_session_id: 'voice-1',
            client_call_id: 'call-1',
            seq: 1,
            audio: segment.audio,
        }), expect.objectContaining({ signal: expect.any(AbortSignal) }))

        act(() => mocks.socketHandlers?.onSegmentAck?.({ type: 'voice_segment_ack', voice_session_id: 'voice-1', seq: 1, status: 'accepted' }))
        expect(result.current.state).toBe('transcribing')
    })

    it('transitions through transcript, assistant audio, finalization, and playback', () => {
        const { result } = renderController()
        act(() => mocks.socketHandlers?.onReady?.(readyFrame()))

        act(() => mocks.socketHandlers?.onTranscriptFinal?.({ type: 'transcript_final', voice_session_id: 'voice-1', seq: 1, turn_id: 'turn-1', text: 'Hello there.' }))
        expect(result.current.transcript).toBe('Hello there.')
        expect(result.current.state).toBe('assistant_thinking')

        act(() => mocks.socketHandlers?.onTurnStart?.({ type: 'voice_turn_start', voice_session_id: 'voice-1', turn_id: 'turn-1', user_message_id: 10, assistant_message_id: 11 }))
        expect(mocks.playback!.startTurn).toHaveBeenCalledWith('voice-1', 'turn-1')
        expect(result.current.activeTurnId).toBe('turn-1')

        act(() => mocks.socketHandlers?.onAudioChunk?.({ type: 'voice_audio_chunk', voice_session_id: 'voice-1', turn_id: 'turn-1', seq: 2, content_type: 'audio/mpeg', sample_rate: 32000, channels: 1, data_b64: 'AA==', is_final: false }))
        expect(mocks.playback!.appendChunk).toHaveBeenCalled()
        expect(result.current.state).toBe('assistant_speaking')

        act(() => mocks.socketHandlers?.onAudioFinal?.({ type: 'voice_audio_final', voice_session_id: 'voice-1', turn_id: 'turn-1', last_seq: 2 }))
        expect(mocks.playback!.finalize).toHaveBeenCalled()

        act(() => mocks.socketHandlers?.onTurnEnd?.({ type: 'voice_turn_end', voice_session_id: 'voice-1', turn_id: 'turn-1', status: 'completed', partial: false, duration_ms: 1200 }))
        expect(result.current.state).toBe('listening')
        expect(result.current.activeTurnId).toBeNull()
    })

    it('handles explicit and VAD-triggered barge-in without replaying audio', () => {
        const { result } = renderController()
        act(() => mocks.socketHandlers?.onReady?.(readyFrame()))
        act(() => mocks.socketHandlers?.onTurnStart?.({ type: 'voice_turn_start', voice_session_id: 'voice-1', turn_id: 'turn-1', user_message_id: 10, assistant_message_id: 11 }))
        act(() => mocks.socketHandlers?.onAudioChunk?.({ type: 'voice_audio_chunk', voice_session_id: 'voice-1', turn_id: 'turn-1', seq: 3, content_type: 'audio/mpeg', sample_rate: 32000, channels: 1, data_b64: 'AA==', is_final: false }))

        act(() => {
            expect(result.current.bargeIn('button')).toBe(true)
        })
        expect(mocks.playback!.cancel).toHaveBeenCalledWith({ voice_session_id: 'voice-1', turn_id: 'turn-1' })
        expect(mocks.socketApi!.bargeIn).toHaveBeenCalledWith(expect.objectContaining({
            type: 'voice_barge_in',
            voice_session_id: 'voice-1',
            turn_id: 'turn-1',
            last_heard_audio_seq: 3,
            reason: 'button',
        }))

        vi.mocked(mocks.socketApi!.bargeIn).mockClear()
        act(() => mocks.socketHandlers?.onAudioChunk?.({ type: 'voice_audio_chunk', voice_session_id: 'voice-1', turn_id: 'turn-2', seq: 4, content_type: 'audio/mpeg', sample_rate: 32000, channels: 1, data_b64: 'AQ==', is_final: false }))
        act(() => mocks.microphoneOptions?.onVadState?.('speech_start', { at_ms: 500, rms: 0.2 }))
        expect(mocks.socketApi!.bargeIn).toHaveBeenCalledWith(expect.objectContaining({ reason: 'user_speech' }))
    })

    it('surfaces quota/provider errors and tears down terminal calls', () => {
        const { result } = renderController()
        act(() => mocks.socketHandlers?.onReady?.(readyFrame()))

        act(() => mocks.socketHandlers?.onError?.({ type: 'voice_error', category: 'quota_exceeded', message: 'Daily limit reached.', fatal: true }))

        expect(result.current.error).toMatchObject({ category: 'quota_exceeded' })
        expect(result.current.state).toBe('error')
        expect(mocks.microphoneApi!.stop).toHaveBeenCalled()
        expect(mocks.socketApi!.close).toHaveBeenCalled()
    })

    it('tears down on auth expiry and route-leave unmount', async () => {
        const { result, unmount } = renderController()
        act(() => mocks.socketHandlers?.onReady?.(readyFrame()))

        act(() => window.dispatchEvent(new CustomEvent('auth:expired')))
        expect(result.current.error).toMatchObject({ category: 'auth' })
        expect(mocks.microphoneApi!.stop).toHaveBeenCalled()
        expect(mocks.socketApi!.close).toHaveBeenCalled()

        unmount()
        await waitFor(() => expect(mocks.apiService.endVoiceCall).toHaveBeenCalledWith(7, { voiceSessionId: 'voice-1', reason: 'navigation' }))
        expect(mocks.playback!.dispose).toHaveBeenCalled()
    })
})
