import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VoicePlaybackBuffer, VoicePlaybackState } from '../audio/voicePlaybackBuffer'
import type { CapturedVoiceSegment } from '../audio/voiceVadWorklet'
import type { MicrophoneCaptureApi, UseMicrophoneCaptureOptions } from './useMicrophoneCapture'
import type { VoiceCallSocketApi, VoiceCallSocketHandlers } from './useVoiceCallSocket'
import { deriveVoiceCallState, useVoiceCallController } from './useVoiceCallController'
import { activeVoiceCallWorkspaceId, endActiveVoiceCall, hasActiveVoiceCall } from '@/features/call/activeVoiceCall'
import { createElement, type ReactNode } from 'react'
import { AttestationContext, type AttestationContextValue } from '@/features/legal/attestation/attestationContext'

const MAIN_WORKSPACE = '0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b'
const OTHER_WORKSPACE = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'

type PlaybackMock = Pick<VoicePlaybackBuffer, 'startTurn' | 'appendChunk' | 'finalize' | 'cancel' | 'dispose' | 'unlock' | 'resume' | 'addStateListener'>

const mocks = vi.hoisted(() => ({
    apiService: {
        saveVoiceConsent: vi.fn(),
        uploadVoiceSegment: vi.fn(),
        endVoiceCall: vi.fn(),
        getVoiceCapabilities: vi.fn(),
        // The call's scoped client shares these methods; the scope is asserted on this spy.
        withWorkspace: vi.fn(),
    },
    workspace: { selectedWorkspaceId: '0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b' as string | null },
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

vi.mock('@/app/hooks/useWorkspace', () => ({
    useWorkspace: () => mocks.workspace,
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

/** The announced call audio (WS-S1): every call sends it. */
const CALL_AUDIO = { content_type: 'audio/mpeg', codec: 'mp3', sample_rate: 44100 as const, channels: 1 as const }

function readyFrame(limits: Record<string, number> = {}) {
    return {
        type: 'voice_ready' as const,
        voice_session_id: 'voice-1',
        server_time_ms: 1,
        limits: { max_call_seconds: 600, idle_timeout_seconds: 120, remaining_daily_seconds: 120, ...limits },
        upload_url: '/character-chats/7/voice-segments',
        audio: { ...CALL_AUDIO },
    }
}

function chunk(turnId = 'turn-1', seq = 1) {
    return { type: 'voice_audio_chunk' as const, voice_session_id: 'voice-1', turn_id: turnId, seq, content_type: 'audio/mpeg' as const, codec: 'mp3' as const, sample_rate: 44100 as const, channels: 1 as const, data_b64: 'AA==', is_final: false as const }
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
        mocks.workspace.selectedWorkspaceId = MAIN_WORKSPACE
        mocks.apiService.withWorkspace.mockImplementation(() => mocks.apiService)
        mocks.apiService.saveVoiceConsent.mockResolvedValue({
            status: 'accepted',
            consent_version: 'voice-v2',
            limits: { max_call_seconds: 600, idle_timeout_seconds: 120, remaining_daily_seconds: 120, max_segment_duration_ms: 30_000 },
        })
        mocks.apiService.uploadVoiceSegment.mockResolvedValue({ voice_session_id: 'voice-1', segment_id: 'segment-1', seq: 1, status: 'accepted' })
        mocks.apiService.endVoiceCall.mockResolvedValue({ status: 'ended', voice_session_id: 'voice-1', reason: 'user' })
        // The controller never reads capabilities (I-68): a read would show up on this spy.
        mocks.apiService.getVoiceCapabilities.mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }))
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
        // WS-C1: the interrupted turn is named (the mock player reports no played time).
        expect(mocks.socketApi!.bargeIn).toHaveBeenCalledWith({ type: 'voice_barge_in', reason: 'barge_in', turn_id: 'turn-1' })

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

    it('resends an upload once when the network dropped it, with the same idempotent body', async () => {
        mocks.apiService.uploadVoiceSegment
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockResolvedValueOnce({ voice_session_id: 'voice-1', segment_id: 's1', seq: 1, status: 'duplicate' })
        const { result } = await renderLiveCall()

        act(() => mocks.microphoneOptions?.onSegment?.(createSegment(1)))
        await waitFor(() => expect(mocks.apiService.uploadVoiceSegment).toHaveBeenCalledTimes(2))
        const [first, second] = mocks.apiService.uploadVoiceSegment.mock.calls
        expect(second[1]).toBe(first[1])
        await act(async () => { await Promise.resolve() })
        expect(result.current.error).toBeNull()
    })

    it('reports an upload that fails twice at the network level, or once with an HTTP error', async () => {
        mocks.apiService.uploadVoiceSegment
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        const { result } = await renderLiveCall()

        act(() => mocks.microphoneOptions?.onSegment?.(createSegment(1)))
        await waitFor(() => expect(result.current.error).toMatchObject({ code: 'VOICE_UPLOAD_FAILED', fatal: false }))
        expect(mocks.apiService.uploadVoiceSegment).toHaveBeenCalledTimes(2)

        mocks.apiService.uploadVoiceSegment.mockRejectedValueOnce(Object.assign(new Error('Bad gateway'), { status: 502 }))
        act(() => mocks.microphoneOptions?.onSegment?.(createSegment(2)))
        await waitFor(() => expect(mocks.apiService.uploadVoiceSegment).toHaveBeenCalledTimes(3))
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)) })
        expect(mocks.apiService.uploadVoiceSegment).toHaveBeenCalledTimes(3)
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

    it('ends the call on attestation_required by code and opens the attestation prompt (D26)', async () => {
        const attestation: AttestationContextValue = {
            gate: 'unavailable',
            requestAttestation: vi.fn(async () => true),
            withAttestation: vi.fn(async (operation) => operation()),
            expectSignupAttestation: vi.fn(),
            cancelSignupAttestation: vi.fn(),
        }
        const wrapper = ({ children }: { children: ReactNode }) => createElement(AttestationContext.Provider, { value: attestation }, children)
        const { result } = renderHook(() => useVoiceCallController({
            sessionId: 7,
            authKey: 'token-1',
            consentGranted: true,
            enabled: true,
            clientCallId: 'call-1',
            playbackBuffer: mocks.playback as unknown as VoicePlaybackBuffer,
        }), { wrapper })
        await act(async () => { await result.current.startCall() })
        expect(attestation.withAttestation).toHaveBeenCalledTimes(1)
        act(() => mocks.socketHandlers?.onReady?.(readyFrame()))

        act(() => mocks.socketHandlers?.onError?.({ type: 'voice_error', category: 'tts_unavailable', code: 'attestation_required', message: 'Attestation required.', fatal: false }))

        expect(result.current.error).toMatchObject({ code: 'attestation_required', fatal: true })
        expect(result.current.state).toBe('error')
        expect(mocks.socketApi!.close).toHaveBeenCalled()
        expect(attestation.requestAttestation).toHaveBeenCalledTimes(1)
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

    describe('speech_end_lag_ms (R0-BE-37; always sent, I-68)', () => {
        /** Emit a captured segment whose closing speech_end arrived at `speechEndAt`, with the clock at `now`. */
        function emitStampedSegment(seq: number, speechEndAt: number, now: number) {
            const clock = vi.spyOn(performance, 'now').mockReturnValue(now)
            try {
                act(() => mocks.microphoneOptions?.onSegment?.({ ...createSegment(seq), speech_end_perf_ms: speechEndAt }))
            } finally {
                clock.mockRestore()
            }
        }

        function uploadedVad(call = 0): Record<string, unknown> {
            return mocks.apiService.uploadVoiceSegment.mock.calls[call][1].vad
        }

        it('sends the ms from speech_end to the upload, with no capabilities read', async () => {
            await renderLiveCall()

            emitStampedSegment(1, 10_000, 10_437.6)

            await waitFor(() => expect(mocks.apiService.uploadVoiceSegment).toHaveBeenCalledTimes(1))
            expect(uploadedVad()).toEqual({ ...createSegment(1).vad, speech_end_lag_ms: 438 })
            expect(mocks.apiService.getVoiceCapabilities).not.toHaveBeenCalled()
        })

        it('measures a segment queued before voice_ready up to the moment it is sent', async () => {
            const { result } = renderController()
            await act(async () => { await result.current.startCall() })

            emitStampedSegment(1, 1_000, 1_100)
            expect(mocks.apiService.uploadVoiceSegment).not.toHaveBeenCalled()

            const clock = vi.spyOn(performance, 'now').mockReturnValue(3_250)
            try {
                act(() => mocks.socketHandlers?.onReady?.(readyFrame()))
            } finally {
                clock.mockRestore()
            }
            await waitFor(() => expect(mocks.apiService.uploadVoiceSegment).toHaveBeenCalledTimes(1))
            expect(uploadedVad().speech_end_lag_ms).toBe(2_250)
        })

        it('clamps a lag over two minutes to 120000', async () => {
            await renderLiveCall()

            emitStampedSegment(1, 0, 600_000)

            await waitFor(() => expect(mocks.apiService.uploadVoiceSegment).toHaveBeenCalledTimes(1))
            expect(uploadedVad().speech_end_lag_ms).toBe(120_000)
        })

        it('keeps the measured body for the one network resend', async () => {
            mocks.apiService.uploadVoiceSegment
                .mockRejectedValueOnce(new TypeError('Failed to fetch'))
                .mockResolvedValueOnce({ voice_session_id: 'voice-1', segment_id: 's1', seq: 1, status: 'duplicate' })
            await renderLiveCall()

            emitStampedSegment(1, 500, 800)

            await waitFor(() => expect(mocks.apiService.uploadVoiceSegment).toHaveBeenCalledTimes(2))
            expect(uploadedVad(1)).toBe(uploadedVad(0))
            expect(uploadedVad(0).speech_end_lag_ms).toBe(300)
        })

        it('omits it for a segment whose speech_end was not seen', async () => {
            await renderLiveCall()

            act(() => mocks.microphoneOptions?.onSegment?.(createSegment(1)))

            await waitFor(() => expect(mocks.apiService.uploadVoiceSegment).toHaveBeenCalledTimes(1))
            expect(uploadedVad()).toEqual(createSegment(1).vad)
        })

        it('treats a 409 as the real answer: no resend, and the next segment still carries the lag', async () => {
            const { result } = await renderLiveCall()
            mocks.apiService.uploadVoiceSegment.mockRejectedValueOnce(Object.assign(new Error('Voice segment vad_json is invalid.'), { status: 409, category: 'conflict' }))

            emitStampedSegment(1, 10_000, 10_400)

            await waitFor(() => expect(result.current.error).toMatchObject({ fatal: false }))
            expect(mocks.apiService.uploadVoiceSegment).toHaveBeenCalledTimes(1)

            emitStampedSegment(2, 20_000, 20_250)
            await waitFor(() => expect(mocks.apiService.uploadVoiceSegment).toHaveBeenCalledTimes(2))
            expect(uploadedVad(1).speech_end_lag_ms).toBe(250)
        })
    })

    describe('Workspace R1', () => {
        it('sends consent, segments and the end request in the call workspace', async () => {
            const { result } = await renderLiveCall({ workspaceId: OTHER_WORKSPACE })
            mocks.workspace.selectedWorkspaceId = OTHER_WORKSPACE

            await act(async () => { await result.current.endCall() })

            expect(mocks.apiService.withWorkspace).toHaveBeenCalledWith(OTHER_WORKSPACE)
            expect(mocks.apiService.withWorkspace).not.toHaveBeenCalledWith(MAIN_WORKSPACE)
            expect(mocks.apiService.endVoiceCall).toHaveBeenCalledWith(7, { voiceSessionId: 'voice-1', reason: 'user' }, { keepalive: true })
        })

        it('registers a live call for the switch coordinator and ends it with a confirmed quota release', async () => {
            const { result, unmount } = await renderLiveCall()
            expect(hasActiveVoiceCall()).toBe(true)
            expect(activeVoiceCallWorkspaceId()).toBe(MAIN_WORKSPACE)

            await act(async () => { await endActiveVoiceCall() })

            expect(mocks.apiService.endVoiceCall).toHaveBeenCalledWith(7, { voiceSessionId: 'voice-1', reason: 'user' }, { keepalive: true })
            expect(mocks.microphoneApi!.stop).toHaveBeenCalled()
            expect(result.current.state).toBe('ended')
            expect(hasActiveVoiceCall()).toBe(false)
            unmount()
        })

        it('keeps the call registered when the end is not confirmed, so the coordinator can retry', async () => {
            const { unmount } = await renderLiveCall()
            mocks.apiService.endVoiceCall.mockRejectedValueOnce(new Error('network'))

            let failure: unknown = null
            await act(async () => { await endActiveVoiceCall().catch((error: unknown) => { failure = error }) })
            expect(failure).toBeInstanceOf(Error)
            expect(hasActiveVoiceCall()).toBe(true)

            await act(async () => { await endActiveVoiceCall() })
            expect(mocks.apiService.endVoiceCall).toHaveBeenCalledTimes(2)
            expect(hasActiveVoiceCall()).toBe(false)
            unmount()
        })

        it('resolves immediately when no call is active', async () => {
            await expect(endActiveVoiceCall()).resolves.toBeUndefined()
            expect(hasActiveVoiceCall()).toBe(false)
        })

        it('ends the call when its workspace stops being the selected one', async () => {
            const { result, rerender, unmount } = await renderLiveCall()
            mocks.workspace.selectedWorkspaceId = OTHER_WORKSPACE
            rerender()

            await waitFor(() => expect(result.current.state).toBe('ended'))
            await waitFor(() => expect(mocks.apiService.endVoiceCall).toHaveBeenCalledWith(7, { voiceSessionId: 'voice-1', reason: 'user' }, { keepalive: true }))
            expect(mocks.apiService.withWorkspace).not.toHaveBeenCalledWith(OTHER_WORKSPACE)
            expect(hasActiveVoiceCall()).toBe(false)
            unmount()
        })
    })

    describe('R1 call audio and voice (R1-FE-05; the only lane, I-68)', () => {
        const elReady = () => ({
            ...readyFrame(),
            audio: { content_type: 'audio/mpeg', codec: 'mp3', sample_rate: 44100 as const, channels: 1 as const },
            effective_voice: { voice_key: 'el:ava', display_name: 'Ava', provider_route: 'elevenlabs', substitution_reason: 'voice_removed', badges: ['replaced'] },
            original_voice_name: 'Mia',
            ai_voice: true,
        })
        const elChunk = (turnId = 'turn-1', seq = 1) => ({ ...chunk(turnId, seq), sample_rate: 44100 as const, codec: 'mp3' as const, gain_db: -3, substitution_reason: 'voice_removed' as const })

        function withPlayedMs(value: number) {
            const playedMs = vi.fn(() => value)
            const setAudioFormat = vi.fn()
            Object.assign(mocks.playback!, { playedMs, setAudioFormat })
            return { playedMs, setAudioFormat }
        }

        async function renderElCall() {
            const rendered = renderController()
            await act(async () => { await rendered.result.current.startCall() })
            act(() => mocks.socketHandlers?.onReady?.(elReady() as never))
            return rendered
        }

        it('forwards the announced audio, the effective voice and the original name', async () => {
            const { setAudioFormat } = withPlayedMs(0)
            const { result } = await renderElCall()
            expect(setAudioFormat).toHaveBeenCalledWith({ content_type: 'audio/mpeg', codec: 'mp3', sample_rate: 44100, channels: 1 })
            expect(result.current.audioFormat?.sample_rate).toBe(44100)
            expect(result.current.effectiveVoice?.display_name).toBe('Ava')
            expect(result.current.originalVoiceName).toBe('Mia')
            act(() => mocks.socketHandlers?.onTurnStart?.(turnStart()))
            act(() => mocks.socketHandlers?.onAudioChunk?.(elChunk()))
            expect(result.current.substitutionReason).toBe('voice_removed')
        })

        it('plays the default mp3 44.1 kHz format when voice_ready carries no audio (older BFF build)', async () => {
            const { setAudioFormat } = withPlayedMs(0)
            const bare = { ...readyFrame(), audio: undefined }
            const { result } = renderController()
            await act(async () => { await result.current.startCall() })
            act(() => mocks.socketHandlers?.onReady?.(bare))
            expect(setAudioFormat).toHaveBeenCalledWith(CALL_AUDIO)
            expect(result.current.audioFormat).toEqual(CALL_AUDIO)
            expect(result.current.effectiveVoice).toBeNull()
            expect(result.current.originalVoiceName).toBeNull()
            act(() => mocks.socketHandlers?.onTurnStart?.(turnStart()))
            act(() => mocks.socketHandlers?.onAudioChunk?.(chunk()))
            expect(mocks.playback!.appendChunk).toHaveBeenCalled()
            expect(result.current.substitutionReason).toBeNull()
        })

        it('reports playback progress every 500 ms while a reply plays', async () => {
            vi.useFakeTimers()
            const playback = vi.fn(() => true)
            mocks.socketApi!.playback = playback
            withPlayedMs(750)
            await renderElCall()
            act(() => mocks.socketHandlers?.onTurnStart?.(turnStart()))
            act(() => mocks.socketHandlers?.onAudioChunk?.(elChunk()))
            emitPlayback('playing')
            await act(async () => { vi.advanceTimersByTime(499) })
            expect(playback).not.toHaveBeenCalled()
            await act(async () => { vi.advanceTimersByTime(1) })
            expect(playback).toHaveBeenCalledWith('turn-1', 750)
            await act(async () => { vi.advanceTimersByTime(1_000) })
            expect(playback).toHaveBeenCalledTimes(3)
            emitPlayback('idle', null)
            await act(async () => { vi.advanceTimersByTime(2_000) })
            expect(playback).toHaveBeenCalledTimes(3)
        })

        it('reports playback progress for a call whose voice_ready carried no audio too', async () => {
            vi.useFakeTimers()
            const playback = vi.fn(() => true)
            mocks.socketApi!.playback = playback
            withPlayedMs(750)
            const bare = { ...readyFrame(), audio: undefined }
            const { result } = renderController()
            await act(async () => { await result.current.startCall() })
            act(() => mocks.socketHandlers?.onReady?.(bare))
            act(() => mocks.socketHandlers?.onTurnStart?.(turnStart()))
            act(() => mocks.socketHandlers?.onAudioChunk?.(chunk()))
            emitPlayback('playing')
            await act(async () => { vi.advanceTimersByTime(500) })
            expect(playback).toHaveBeenCalledWith('turn-1', 750)
        })

        it('names the interrupted turn and its played time in the barge-in, read before the cancel', async () => {
            const { playedMs } = withPlayedMs(1234.4)
            const { result } = await renderElCall()
            act(() => mocks.socketHandlers?.onTurnStart?.(turnStart()))
            act(() => mocks.socketHandlers?.onAudioChunk?.(elChunk()))
            emitPlayback('playing')
            act(() => { result.current.bargeIn() })
            expect(mocks.socketApi!.bargeIn).toHaveBeenCalledWith({ type: 'voice_barge_in', reason: 'barge_in', turn_id: 'turn-1', played_ms: 1234 })
            const cancels = vi.mocked(mocks.playback!.cancel).mock.invocationCallOrder
            expect(playedMs.mock.invocationCallOrder[0]).toBeLessThan(cancels[cancels.length - 1])
        })

        it('cuts the captions to kept_chars (code points) on a truncated turn end or cancel', async () => {
            withPlayedMs(0)
            const { result } = await renderElCall()
            act(() => mocks.socketHandlers?.onTurnStart?.(turnStart()))
            act(() => mocks.socketHandlers?.onAssistantDelta?.({ type: 'voice_assistant_delta', voice_session_id: 'voice-1', turn_id: 'turn-1', content: 'Héllo 👋 there, traveller.' }))
            // WS-S3: only a completed turn is truncated.
            act(() => mocks.socketHandlers?.onTurnEnd?.({ type: 'voice_turn_end', voice_session_id: 'voice-1', turn_id: 'turn-1', status: 'completed', partial: false, duration_ms: 900, truncated: true, played_ms: 900, kept_chars: 7 }))
            expect(result.current.assistantText).toBe('Héllo 👋')
            // A post-end cancel truncation cuts again; another turn's frame does not.
            act(() => mocks.socketHandlers?.onCancelled?.({ type: 'voice_cancelled', voice_session_id: 'voice-1', turn_id: 'turn-0', reason: 'barge_in', truncated: true, kept_chars: 1 }))
            expect(result.current.assistantText).toBe('Héllo 👋')
            act(() => mocks.socketHandlers?.onCancelled?.({ type: 'voice_cancelled', voice_session_id: 'voice-1', turn_id: 'turn-1', reason: 'barge_in', truncated: true, kept_chars: 5 }))
            expect(result.current.assistantText).toBe('Héllo')
        })

        it('keeps the captions when the turn end is not truncated', async () => {
            withPlayedMs(0)
            const { result } = await renderElCall()
            act(() => mocks.socketHandlers?.onTurnStart?.(turnStart()))
            act(() => mocks.socketHandlers?.onAssistantDelta?.({ type: 'voice_assistant_delta', voice_session_id: 'voice-1', turn_id: 'turn-1', content: 'All of it.' }))
            act(() => mocks.socketHandlers?.onTurnEnd?.({ type: 'voice_turn_end', voice_session_id: 'voice-1', turn_id: 'turn-1', status: 'completed', partial: false, duration_ms: 900, kept_chars: 2 }))
            expect(result.current.assistantText).toBe('All of it.')
        })

        it('keeps the captions on an interrupted, non-truncated turn end', async () => {
            withPlayedMs(0)
            const { result } = await renderElCall()
            act(() => mocks.socketHandlers?.onTurnStart?.(turnStart()))
            act(() => mocks.socketHandlers?.onAssistantDelta?.({ type: 'voice_assistant_delta', voice_session_id: 'voice-1', turn_id: 'turn-1', content: 'Cut short.' }))
            act(() => mocks.socketHandlers?.onTurnEnd?.({ type: 'voice_turn_end', voice_session_id: 'voice-1', turn_id: 'turn-1', status: 'interrupted', partial: true, duration_ms: 400, truncated: false, played_ms: 400 }))
            expect(result.current.assistantText).toBe('Cut short.')
        })

        it('clears the chunk reason when the chunks say null', async () => {
            withPlayedMs(0)
            const { result } = await renderElCall()
            act(() => mocks.socketHandlers?.onTurnStart?.(turnStart()))
            act(() => mocks.socketHandlers?.onAudioChunk?.(elChunk()))
            expect(result.current.substitutionReason).toBe('voice_removed')
            act(() => mocks.socketHandlers?.onAudioChunk?.({ ...elChunk('turn-1', 2), substitution_reason: null }))
            expect(result.current.substitutionReason).toBeNull()
        })

        it('reads the substitute the chunks name after a mid-call swap (R1-BE-04)', async () => {
            withPlayedMs(0)
            const { result } = await renderElCall()
            act(() => mocks.socketHandlers?.onTurnStart?.(turnStart()))
            act(() => mocks.socketHandlers?.onAudioChunk?.(elChunk()))
            expect(result.current.replacedVoiceName).toBeNull()
            act(() => mocks.socketHandlers?.onAudioChunk?.({ ...elChunk('turn-1', 2), substitution_reason: 'voice_unavailable', voice_name: ' Other ' } as never))
            expect(result.current.substitutionReason).toBe('voice_unavailable')
            expect(result.current.replacedVoiceName).toBe('Other')
            // A chunk without the name clears it, as the reason does.
            act(() => mocks.socketHandlers?.onAudioChunk?.({ ...elChunk('turn-1', 3), voice_name: '  ' } as never))
            expect(result.current.replacedVoiceName).toBeNull()
            act(() => mocks.socketHandlers?.onAudioChunk?.({ ...elChunk('turn-1', 4), substitution_reason: 'voice_unavailable', voice_name: 'Other' } as never))
            expect(result.current.replacedVoiceName).toBe('Other')

            // A new call on the same screen starts without the name.
            act(() => mocks.socketHandlers?.onEnded?.({ type: 'voice_ended', voice_session_id: 'voice-1', reason: 'user' }))
            await act(async () => { await result.current.startCall() })
            act(() => mocks.socketHandlers?.onReady?.(elReady() as never))
            expect(result.current.replacedVoiceName).toBeNull()
        })

        it('sends a bare barge-in when no turn is playing', async () => {
            withPlayedMs(0)
            const { result } = await renderElCall()
            act(() => { result.current.bargeIn() })
            expect(mocks.socketApi!.bargeIn).toHaveBeenCalledWith({ type: 'voice_barge_in', reason: 'barge_in' })
        })

        it('starts a second call on the same screen with no stale reason or notice', async () => {
            withPlayedMs(0)
            const { result } = await renderElCall()
            act(() => mocks.socketHandlers?.onTurnStart?.(turnStart()))
            act(() => mocks.socketHandlers?.onAudioChunk?.(elChunk()))
            act(() => mocks.socketHandlers?.onAudioChunk?.({ ...elChunk('turn-1', 2), content_type: 'audio/pcm' } as never))
            expect(result.current.substitutionReason).toBe('voice_removed')
            expect(result.current.audioUnsupported).toBe(true)
            act(() => mocks.socketHandlers?.onEnded?.({ type: 'voice_ended', voice_session_id: 'voice-1', reason: 'user' }))
            expect(result.current.state).toBe('ended')

            // "Call again": the card's voice was refreshed, so the new call is not substituted.
            await act(async () => { await result.current.startCall() })
            act(() => mocks.socketHandlers?.onReady?.({ ...elReady(), effective_voice: { ...elReady().effective_voice, substitution_reason: null, badges: [] }, original_voice_name: null } as never))
            expect(result.current.substitutionReason).toBeNull()
            expect(result.current.audioUnsupported).toBe(false)
            act(() => mocks.socketHandlers?.onTurnStart?.(turnStart('turn-2')))
            act(() => mocks.socketHandlers?.onAudioChunk?.({ ...elChunk('turn-2'), substitution_reason: null }))
            expect(result.current.substitutionReason).toBeNull()
            expect(result.current.effectiveVoice?.substitution_reason).toBeNull()
        })

        it('drops an unplayable chunk, shows the reply as text, and clears the notice on the next turn', async () => {
            withPlayedMs(0)
            const { result } = await renderElCall()
            act(() => mocks.socketHandlers?.onTurnStart?.(turnStart()))
            act(() => mocks.socketHandlers?.onAudioChunk?.({ ...elChunk(), content_type: 'audio/pcm' } as never))
            expect(mocks.playback!.appendChunk).not.toHaveBeenCalled()
            expect(result.current.audioUnsupported).toBe(true)
            act(() => mocks.socketHandlers?.onTurnStart?.(turnStart('turn-2')))
            expect(result.current.audioUnsupported).toBe(false)
        })
    })
})
