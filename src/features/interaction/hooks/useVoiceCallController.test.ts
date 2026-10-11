import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VoicePlaybackBuffer, VoicePlaybackState } from '../audio/voicePlaybackBuffer'
import type { CapturedVoiceSegment } from '../audio/voiceVadWorklet'
import type { MicrophoneCaptureApi, UseMicrophoneCaptureOptions } from './useMicrophoneCapture'
import type { VoiceCallSocketApi, VoiceCallSocketHandlers } from './useVoiceCallSocket'
import { deriveVoiceCallState, useVoiceCallController } from './useVoiceCallController'

type PlaybackMock = Pick<VoicePlaybackBuffer, 'startTurn' | 'appendChunk' | 'finalize' | 'cancel' | 'dispose' | 'unlock' | 'resume' | 'addStateListener'>

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
    playback: null as PlaybackMock | null,
    playbackListener: null as ((state: VoicePlaybackState) => void) | null,
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

function readyFrame(limits: Record<string, number> = {}) {
    return {
        type: 'voice_ready' as const,
        voice_session_id: 'voice-1',
        server_time_ms: 1,
        limits: { max_call_seconds: 600, idle_timeout_seconds: 120, remaining_daily_seconds: 120, ...limits },
        upload_url: '/character-chats/7/voice-segments',
    }
}

function chunk(turnId = 'turn-1', seq = 1) {
    return { type: 'voice_audio_chunk' as const, voice_session_id: 'voice-1', turn_id: turnId, seq, content_type: 'audio/mpeg' as const, sample_rate: 32000 as const, channels: 1 as const, data_b64: 'AA==', is_final: false as const }
}

function turnStart(turnId = 'turn-1') {
    return { type: 'voice_turn_start' as const, voice_session_id: 'voice-1', turn_id: turnId, user_message_id: 10, assistant_message_id: 11 }
}

function emitPlayback(status: VoicePlaybackState['status'], turnId: string | null = 'turn-1') {
    act(() => mocks.playbackListener?.({ status, voiceSessionId: 'voice-1', turnId }))
}

function renderController(overrides: Partial<Parameters<typeof useVoiceCallController>[0]> = {}) {
    return renderHook(() => useVoiceCallController({
        sessionId: 7,
        authKey: 'token-1',
        consentGranted: true,
        enabled: true,
        clientCallId: 'call-1',
        playbackBuffer: mocks.playback as unknown as VoicePlaybackBuffer,
        ...overrides,
    }))
}

/** Start a call and receive voice_ready — the common "live call" precondition. */
async function renderLiveCall(overrides: Partial<Parameters<typeof useVoiceCallController>[0]> = {}) {
    const rendered = renderController(overrides)
    await act(async () => { await rendered.result.current.startCall() })
    act(() => mocks.socketHandlers?.onReady?.(readyFrame()))
    return rendered
}

describe('deriveVoiceCallState', () => {
    const base = { lifecycle: 'live', reconnecting: false, bargingIn: false, userSpeaking: false, playback: 'idle', turnPhase: 'none' } as const

    it('follows audible playback over server turn progress', () => {
        expect(deriveVoiceCallState({ ...base, playback: 'playing', turnPhase: 'none' })).toBe('assistant_speaking')
        expect(deriveVoiceCallState({ ...base, playback: 'buffering', turnPhase: 'streaming' })).toBe('assistant_thinking')
        expect(deriveVoiceCallState({ ...base, turnPhase: 'uploading' })).toBe('uploading_segment')
        expect(deriveVoiceCallState({ ...base, userSpeaking: true, turnPhase: 'thinking' })).toBe('user_speaking')
        expect(deriveVoiceCallState({ ...base, reconnecting: true, playback: 'playing' })).toBe('reconnecting')
        expect(deriveVoiceCallState({ ...base, lifecycle: 'ended', playback: 'playing' })).toBe('ended')
    })
})

describe('useVoiceCallController', () => {
    beforeEach(() => {
        vi.useRealTimers()
        vi.clearAllMocks()
        mocks.socketHandlers = null
        mocks.microphoneOptions = null
        mocks.playbackListener = null
        mocks.apiService.saveVoiceConsent.mockResolvedValue({
            status: 'accepted',
            consent_version: 'voice-v1',
            limits: { max_call_seconds: 600, idle_timeout_seconds: 120, remaining_daily_seconds: 120, max_segment_duration_ms: 30_000 },
        })
        mocks.apiService.uploadVoiceSegment.mockResolvedValue({ voice_session_id: 'voice-1', segment_id: 'segment-1', seq: 1, status: 'accepted' })
        mocks.apiService.endVoiceCall.mockResolvedValue({ status: 'ended', voice_session_id: 'voice-1', reason: 'user' })
        mocks.socketApi = {
            socketStatus: 'closed',
            start: vi.fn(),
            bargeIn: vi.fn(() => true),
            noteSegmentSeq: vi.fn(),
            end: vi.fn(() => true),
            close: vi.fn(),
        }
        mocks.microphoneApi = {
            status: 'idle',
            error: null,
            errorCode: null,
            source: null,
            isMuted: false,
            nextSeq: 1,
            echoCancellation: true,
            rawFallbackActive: false,
            start: vi.fn(async () => true),
            stop: vi.fn(),
            mute: vi.fn(),
            unmute: vi.fn(),
            configure: vi.fn(),
        }
        mocks.playback = {
            startTurn: vi.fn(),
            appendChunk: vi.fn(() => true),
            finalize: vi.fn(),
            cancel: vi.fn(),
            dispose: vi.fn(),
            unlock: vi.fn(),
            resume: vi.fn(async () => true),
            addStateListener: vi.fn((listener: (state: VoicePlaybackState) => void) => {
                mocks.playbackListener = listener
                return () => { mocks.playbackListener = null }
            }),
        }
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('leaves a new call as a local draft until consent and microphone access succeed', async () => {
        const ensureSession = vi.fn(async () => 19)
        const { result } = renderController({ sessionId: null, ensureSession })
        expect(ensureSession).not.toHaveBeenCalled()
        await act(async () => { await expect(result.current.startCall()).resolves.toBe(true) })
        expect(ensureSession).toHaveBeenCalledTimes(1)
        expect(vi.mocked(mocks.microphoneApi!.start).mock.invocationCallOrder[0]).toBeLessThan(ensureSession.mock.invocationCallOrder[0])
        expect(mocks.apiService.saveVoiceConsent).toHaveBeenCalledWith(19)
        expect(mocks.socketApi!.start).toHaveBeenCalledTimes(1)
        expect(mocks.microphoneApi!.stop).not.toHaveBeenCalled()
        expect(mocks.socketApi!.close).not.toHaveBeenCalled()
    })

    it('does not create a draft chat when microphone permission is denied', async () => {
        const ensureSession = vi.fn(async () => 19)
        vi.mocked(mocks.microphoneApi!.start).mockResolvedValue(false)
        mocks.microphoneApi!.status = 'permission_denied'
        const { result } = renderController({ sessionId: null, ensureSession })
        await act(async () => { await expect(result.current.startCall()).resolves.toBe(false) })
        expect(ensureSession).not.toHaveBeenCalled()
        expect(mocks.apiService.saveVoiceConsent).not.toHaveBeenCalled()
        expect(result.current.error).toMatchObject({ category: 'permission_denied', fatal: true })
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

    it('unlocks playback synchronously inside the start click', () => {
        const { result } = renderController()
        let pending: Promise<boolean> | undefined
        act(() => { pending = result.current.startCall() })
        // Before the first await resolves: still inside the user gesture.
        expect(mocks.playback!.unlock).toHaveBeenCalledTimes(1)
        return act(async () => { await pending })
    })

    it('starts after explicit consent, then ends with full local teardown and a keepalive end request', async () => {
        const { result } = renderController()

        await act(async () => {
            await expect(result.current.startCall()).resolves.toBe(true)
        })

        expect(mocks.apiService.saveVoiceConsent).toHaveBeenCalledWith(7)
        expect(vi.mocked(mocks.microphoneApi!.start).mock.invocationCallOrder[0]).toBeLessThan(
            mocks.apiService.saveVoiceConsent.mock.invocationCallOrder[0],
        )
        expect(mocks.socketApi!.start).toHaveBeenCalledWith(expect.objectContaining({
            type: 'voice_start',
            client_call_id: 'call-1',
        }))
        expect(result.current.state).toBe('connecting')

        act(() => mocks.socketHandlers?.onReady?.(readyFrame()))
        expect(result.current.state).toBe('listening')
        expect(result.current.voiceSessionId).toBe('voice-1')

        await act(async () => {
            await result.current.endCall()
        })

        expect(mocks.socketApi!.end).toHaveBeenCalledWith()
        expect(mocks.microphoneApi!.stop).toHaveBeenCalled()
        expect(mocks.playback!.cancel).toHaveBeenCalled()
        expect(mocks.socketApi!.close).toHaveBeenCalled()
        expect(mocks.apiService.endVoiceCall).toHaveBeenCalledWith(7, { voiceSessionId: 'voice-1', reason: 'user' }, { keepalive: true })
        expect(result.current.state).toBe('ended')
        expect(result.current.endReason).toBe('user')
    })

    it('caps VAD segments below the server limit (default until the server advertises one)', async () => {
        renderController()
        expect(mocks.microphoneOptions?.vad?.maxSegmentMs).toBe(7_500)

        await renderLiveCall()
        // Consent limits advertise 30 s → cut at 29.5 s.
        expect(mocks.microphoneApi!.configure).toHaveBeenCalledWith({ maxSegmentMs: 29_500 })

        act(() => mocks.socketHandlers?.onReady?.(readyFrame({ max_segment_duration_ms: 8_000 })))
        expect(mocks.microphoneApi!.configure).toHaveBeenLastCalledWith({ maxSegmentMs: 7_500 })
    })

    it('queues VAD-cut segments until voice_ready, then uploads them over REST in seq order', async () => {
        const { result } = renderController()
        await act(async () => { await result.current.startCall() })

        act(() => {
            mocks.microphoneOptions?.onSegment?.(createSegment(2))
            mocks.microphoneOptions?.onSegment?.(createSegment(1))
        })
        expect(result.current.uploadQueueDepth).toBe(2)
        expect(mocks.apiService.uploadVoiceSegment).not.toHaveBeenCalled()

        act(() => mocks.socketHandlers?.onReady?.(readyFrame()))

        await waitFor(() => expect(mocks.apiService.uploadVoiceSegment).toHaveBeenCalledTimes(2))
        expect(mocks.apiService.uploadVoiceSegment.mock.calls.map(([, body]) => body.seq)).toEqual([1, 2])
        expect(mocks.apiService.uploadVoiceSegment).toHaveBeenCalledWith(7, expect.objectContaining({
            voice_session_id: 'voice-1',
            client_call_id: 'call-1',
            seq: 1,
        }), expect.objectContaining({ signal: expect.any(AbortSignal) }))
        expect(mocks.socketApi!.noteSegmentSeq).toHaveBeenCalledWith(2)
    })

    it('derives speaking from playback, not from server frames (FE-05)', async () => {
        let resolveUpload: (value: unknown) => void = () => undefined
        mocks.apiService.uploadVoiceSegment.mockImplementation(() => new Promise((resolve) => { resolveUpload = resolve }))
        const { result } = await renderLiveCall()

        act(() => mocks.microphoneOptions?.onSegment?.(createSegment(1)))
        expect(result.current.state).toBe('uploading_segment')
        act(() => mocks.socketHandlers?.onSegmentAck?.({ type: 'voice_segment_ack', voice_session_id: 'voice-1', seq: 1, status: 'accepted' }))
        expect(result.current.state).toBe('transcribing')

        act(() => mocks.socketHandlers?.onTranscriptFinal?.({ type: 'transcript_final', voice_session_id: 'voice-1', seq: 1, turn_id: 'turn-1', text: 'Hello there.' }))
        expect(result.current.transcript).toBe('Hello there.')
        expect(result.current.state).toBe('assistant_thinking')

        act(() => mocks.socketHandlers?.onTurnStart?.(turnStart()))
        act(() => mocks.socketHandlers?.onAudioChunk?.(chunk()))
        expect(mocks.playback!.appendChunk).toHaveBeenCalled()
        expect(result.current.state).toBe('assistant_thinking')

        emitPlayback('playing')
        expect(result.current.state).toBe('assistant_speaking')

        act(() => mocks.socketHandlers?.onAudioFinal?.({ type: 'voice_audio_final', voice_session_id: 'voice-1', turn_id: 'turn-1', last_seq: 1 }))
        act(() => mocks.socketHandlers?.onTurnEnd?.({ type: 'voice_turn_end', voice_session_id: 'voice-1', turn_id: 'turn-1', status: 'completed', partial: false, duration_ms: 1200 }))
        // The HTTP response lands after the turn: it must not regress the state.
        await act(async () => { resolveUpload({ voice_session_id: 'voice-1', segment_id: 's1', seq: 1, status: 'accepted' }) })
        expect(result.current.state).toBe('assistant_speaking')

        emitPlayback('idle', null)
        expect(result.current.state).toBe('listening')
    })

    it('ignores stale chunks of an interrupted turn instead of resurrecting speaking (FE-06)', async () => {
        vi.useFakeTimers()
        const { result } = await renderLiveCall()
        act(() => mocks.socketHandlers?.onTurnStart?.(turnStart()))
        act(() => mocks.socketHandlers?.onAudioChunk?.(chunk('turn-1', 1)))
        emitPlayback('playing')

        act(() => { expect(result.current.bargeIn()).toBe(true) })
        expect(mocks.playback!.cancel).toHaveBeenCalledWith({ voice_session_id: 'voice-1', turn_id: 'turn-1' })
        expect(mocks.socketApi!.bargeIn).toHaveBeenCalledTimes(1)
        emitPlayback('idle', null)

        vi.mocked(mocks.playback!.appendChunk).mockReturnValue(false)
        act(() => mocks.socketHandlers?.onAudioChunk?.(chunk('turn-1', 2)))
        act(() => mocks.socketHandlers?.onCancelled?.({ type: 'voice_cancelled', voice_session_id: 'voice-1', turn_id: 'turn-1', reason: 'barge_in' }))
        expect(result.current.state).toBe('listening')

        // A later utterance does not send a second barge-in for the dead turn.
        await act(async () => { vi.advanceTimersByTime(5_000) })
        act(() => mocks.microphoneOptions?.onVadState?.('speech_start'))
        expect(mocks.socketApi!.bargeIn).toHaveBeenCalledTimes(1)
        expect(result.current.state).toBe('user_speaking')
    })

    it('auto-interrupts audible playback after the echo-cancellation warm-up', async () => {
        vi.useFakeTimers()
        await renderLiveCall()
        act(() => mocks.socketHandlers?.onTurnStart?.(turnStart()))
        act(() => mocks.socketHandlers?.onAudioChunk?.(chunk()))
        emitPlayback('playing')
        // Raised interruption threshold while the character is audible.
        expect(mocks.microphoneApi!.configure).toHaveBeenLastCalledWith({ minSpeechMs: 500 })

        act(() => mocks.microphoneOptions?.onVadState?.('speech_start'))
        expect(mocks.socketApi!.bargeIn).not.toHaveBeenCalled()
        act(() => mocks.microphoneOptions?.onVadState?.('speech_end'))

        await act(async () => { vi.advanceTimersByTime(3_000) })
        act(() => mocks.microphoneOptions?.onVadState?.('speech_start'))
        expect(mocks.socketApi!.bargeIn).toHaveBeenCalledWith({ type: 'voice_barge_in', reason: 'barge_in' })

        emitPlayback('idle', null)
        expect(mocks.microphoneApi!.configure).toHaveBeenLastCalledWith({ minSpeechMs: 250 })
    })

    it('does not interrupt a reply that is only buffering, but treats a mid-reply stall as speaking', async () => {
        vi.useFakeTimers()
        const { result } = await renderLiveCall()
        act(() => mocks.socketHandlers?.onTurnStart?.(turnStart()))
        act(() => mocks.socketHandlers?.onAudioChunk?.(chunk()))
        emitPlayback('buffering')
        await act(async () => { vi.advanceTimersByTime(5_000) })
        act(() => mocks.microphoneOptions?.onVadState?.('speech_start'))
        expect(mocks.socketApi!.bargeIn).not.toHaveBeenCalled()
        act(() => mocks.microphoneOptions?.onVadState?.('speech_end'))

        emitPlayback('playing')
        await act(async () => { vi.advanceTimersByTime(3_000) })
        emitPlayback('buffering')
        expect(result.current.state).toBe('assistant_speaking')
        act(() => mocks.microphoneOptions?.onVadState?.('speech_start'))
        expect(mocks.socketApi!.bargeIn).toHaveBeenCalledTimes(1)
    })

    it('interrupts when the reply becomes audible while the user is still talking', async () => {
        vi.useFakeTimers()
        await renderLiveCall()
        act(() => mocks.socketHandlers?.onTurnStart?.(turnStart()))
        act(() => mocks.socketHandlers?.onAudioChunk?.(chunk()))
        emitPlayback('playing')
        emitPlayback('idle', null)
        await act(async () => { vi.advanceTimersByTime(3_000) })

        act(() => mocks.microphoneOptions?.onVadState?.('speech_start'))
        expect(mocks.socketApi!.bargeIn).not.toHaveBeenCalled()
        act(() => mocks.socketHandlers?.onTurnStart?.(turnStart('turn-2')))
        act(() => mocks.socketHandlers?.onAudioChunk?.(chunk('turn-2')))
        emitPlayback('playing', 'turn-2')
        expect(mocks.socketApi!.bargeIn).toHaveBeenCalledTimes(1)
    })

    it('never auto-interrupts without echo cancellation, but keeps the manual button', async () => {
        vi.useFakeTimers()
        mocks.microphoneApi!.echoCancellation = false
        const { result } = await renderLiveCall()
        expect(result.current.echoCancellationOff).toBe(true)
        act(() => mocks.socketHandlers?.onTurnStart?.(turnStart()))
        act(() => mocks.socketHandlers?.onAudioChunk?.(chunk()))
        emitPlayback('playing')
        await act(async () => { vi.advanceTimersByTime(5_000) })

        act(() => mocks.microphoneOptions?.onVadState?.('speech_start'))
        expect(mocks.socketApi!.bargeIn).not.toHaveBeenCalled()
        act(() => { result.current.bargeIn() })
        expect(mocks.socketApi!.bargeIn).toHaveBeenCalledTimes(1)
    })

    it('keeps the call live on non-fatal errors and clears the notice by itself (FE-08)', async () => {
        vi.useFakeTimers()
        const { result } = await renderLiveCall()

        act(() => mocks.socketHandlers?.onError?.({ type: 'voice_error', category: 'llm_timeout', message: 'Voice profile execution failed.', fatal: false }))
        expect(result.current.error).toMatchObject({ category: 'llm_timeout', fatal: false })
        expect(result.current.state).toBe('listening')
        expect(mocks.microphoneApi!.stop).not.toHaveBeenCalled()

        await act(async () => { vi.advanceTimersByTime(8_000) })
        expect(result.current.error).toBeNull()
    })

    it('keeps the specific server reason when a failed turn also ends and fails its upload', async () => {
        mocks.apiService.uploadVoiceSegment.mockRejectedValueOnce(Object.assign(new Error('Bad gateway'), { status: 502 }))
        const { result } = await renderLiveCall()

        act(() => mocks.microphoneOptions?.onSegment?.(createSegment(1)))
        act(() => mocks.socketHandlers?.onTranscriptFinal?.({ type: 'transcript_final', voice_session_id: 'voice-1', seq: 1, turn_id: 'turn-1', text: 'Hello.' }))
        act(() => mocks.socketHandlers?.onError?.({ type: 'voice_error', category: 'tts_timeout', message: 'Voice synthesis timed out.', fatal: false }))
        act(() => mocks.socketHandlers?.onTurnEnd?.({ type: 'voice_turn_end', voice_session_id: 'voice-1', turn_id: 'turn-1', status: 'failed', partial: true, duration_ms: 900 }))
        await waitFor(() => expect(mocks.apiService.uploadVoiceSegment).toHaveBeenCalledTimes(1))
        await act(async () => { await Promise.resolve() })

        expect(result.current.error).toMatchObject({ category: 'tts_timeout', fatal: false })
        expect(result.current.state).toBe('listening')
    })

    it('stays silent for no-speech rejections and labels other rejections by code', async () => {
        const { result } = await renderLiveCall()

        act(() => mocks.microphoneOptions?.onSegment?.(createSegment(1)))
        act(() => mocks.socketHandlers?.onSegmentAck?.({ type: 'voice_segment_ack', voice_session_id: 'voice-1', seq: 1, status: 'rejected', reason: 'no_speech' }))
        expect(result.current.error).toBeNull()

        mocks.apiService.uploadVoiceSegment.mockResolvedValueOnce({ voice_session_id: 'voice-1', segment_id: 's2', seq: 2, status: 'rejected', reason: 'unsupported_media' })
        act(() => mocks.microphoneOptions?.onSegment?.(createSegment(2)))
        await waitFor(() => expect(result.current.error).toMatchObject({ code: 'VOICE_SEGMENT_UNSUPPORTED_MEDIA', fatal: false }))
        await waitFor(() => expect(result.current.state).toBe('listening'))
    })

    it('treats a superseded upload as part of the next turn, not an error', async () => {
        mocks.apiService.uploadVoiceSegment.mockResolvedValueOnce({ voice_session_id: 'voice-1', segment_id: 's1', seq: 1, status: 'cancelled', reason: 'superseded' })
        const { result } = await renderLiveCall()

        act(() => mocks.microphoneOptions?.onSegment?.(createSegment(1)))
        await waitFor(() => expect(mocks.apiService.uploadVoiceSegment).toHaveBeenCalledTimes(1))
        expect(result.current.error).toBeNull()
    })

    it('reports why the server ended the call (FE-09)', async () => {
        const { result } = await renderLiveCall()

        act(() => mocks.socketHandlers?.onEnded?.({ type: 'voice_ended', voice_session_id: 'voice-1', reason: 'idle_timeout' }))

        expect(result.current.state).toBe('ended')
        expect(result.current.endReason).toBe('idle_timeout')
        expect(mocks.microphoneApi!.stop).toHaveBeenCalled()
        expect(mocks.socketApi!.close).toHaveBeenCalled()
    })

    it('shows reconnecting while the socket resumes and drops a half-played turn afterwards', async () => {
        const { result } = await renderLiveCall()
        act(() => mocks.socketHandlers?.onTurnStart?.(turnStart()))
        act(() => mocks.socketHandlers?.onAudioChunk?.(chunk()))

        act(() => mocks.socketHandlers?.onSocketStatus?.('connecting'))
        expect(result.current.state).toBe('reconnecting')

        act(() => mocks.socketHandlers?.onStateSnapshot?.({ type: 'voice_state_snapshot', voice_session_id: 'voice-1', state: 'listening', status: 'active', last_segment_seq: 1, last_audio_seq: 0, server_time_ms: 5 }))
        expect(mocks.playback!.cancel).toHaveBeenCalledWith({ voice_session_id: 'voice-1', turn_id: 'turn-1' })
        expect(result.current.state).toBe('listening')
    })

    it('counts down the remaining call time from the server limit', async () => {
        vi.useFakeTimers()
        const { result } = renderController()
        await act(async () => { await result.current.startCall() })
        act(() => mocks.socketHandlers?.onReady?.(readyFrame({ max_call_seconds: 90 })))
        expect(result.current.remainingSeconds).toBe(90)
        await act(async () => { vi.advanceTimersByTime(31_000) })
        expect(result.current.remainingSeconds).toBe(59)
    })

    it('throttles mic level updates instead of re-rendering on every worklet frame (FE-13)', async () => {
        vi.useFakeTimers()
        const { result } = await renderLiveCall()
        await act(async () => { vi.advanceTimersByTime(200) })

        act(() => {
            mocks.microphoneOptions?.onLevel?.(0.5)
            mocks.microphoneOptions?.onLevel?.(0.6)
            mocks.microphoneOptions?.onLevel?.(0.7)
        })
        expect(result.current.inputLevel).toBe(0.5)

        await act(async () => { vi.advanceTimersByTime(100) })
        act(() => mocks.microphoneOptions?.onLevel?.(0.7))
        expect(result.current.inputLevel).toBe(0.7)
        // Silence is always published so the meter never sticks.
        act(() => mocks.microphoneOptions?.onLevel?.(0))
        expect(result.current.inputLevel).toBe(0)
    })

    it('surfaces fatal errors and tears down terminal calls', async () => {
        const { result } = await renderLiveCall()

        act(() => mocks.socketHandlers?.onError?.({ type: 'voice_error', category: 'quota_exceeded', message: 'Daily limit reached.', fatal: true }))

        expect(result.current.error).toMatchObject({ category: 'quota_exceeded', fatal: true })
        expect(result.current.state).toBe('error')
        expect(mocks.microphoneApi!.stop).toHaveBeenCalled()
        expect(mocks.socketApi!.close).toHaveBeenCalled()
    })

    it('ends the call with a keepalive request when the page is torn down', async () => {
        await renderLiveCall()

        act(() => { window.dispatchEvent(Object.assign(new Event('pagehide'), { persisted: false })) })

        expect(mocks.socketApi!.end).toHaveBeenCalled()
        expect(mocks.apiService.endVoiceCall).toHaveBeenCalledWith(7, { voiceSessionId: 'voice-1', reason: 'user' }, { keepalive: true })
    })

    it('tears down on auth expiry and route-leave unmount', async () => {
        const { result, unmount } = await renderLiveCall()

        act(() => window.dispatchEvent(new CustomEvent('auth:expired')))
        expect(result.current.error).toMatchObject({ category: 'auth' })
        expect(mocks.microphoneApi!.stop).toHaveBeenCalled()
        expect(mocks.socketApi!.close).toHaveBeenCalled()

        unmount()
        await waitFor(() => expect(mocks.apiService.endVoiceCall).toHaveBeenCalledWith(7, { voiceSessionId: 'voice-1', reason: 'user' }, { keepalive: true }))
        expect(mocks.playback!.dispose).toHaveBeenCalled()
    })
})
