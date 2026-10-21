import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Character, CharacterChatSession } from '@/shared'
import type { CapturedVoiceSegment } from '../audio/voiceVadWorklet'
import type { VoicePlaybackState } from '../audio/voicePlaybackBuffer'
import type { MicrophoneCaptureApi, UseMicrophoneCaptureOptions } from '../hooks/useMicrophoneCapture'
import type { VoiceCallSocketApi, VoiceCallSocketHandlers } from '../hooks/useVoiceCallSocket'
import { CallScreen } from '../../call'
import { ChatroomPage } from '../../characterChat/components/ChatroomPage'

const integration = vi.hoisted(() => ({
    apiService: {
        saveVoiceConsent: vi.fn(),
        uploadVoiceSegment: vi.fn(),
        endVoiceCall: vi.fn(),
        getVoiceCallTranscript: vi.fn().mockResolvedValue({ segments: [] }),
        getImageJob: vi.fn(),
        getTtsJob: vi.fn(),
        fetchProtectedMediaBlob: vi.fn(),
        // The call's scoped client shares these methods.
        withWorkspace: vi.fn(),
    },
    socketHandlers: null as VoiceCallSocketHandlers | null,
    microphoneOptions: null as UseMicrophoneCaptureOptions | null,
    socketApi: null as VoiceCallSocketApi | null,
    microphoneApi: null as MicrophoneCaptureApi | null,
    playback: null as {
        startTurn: ReturnType<typeof vi.fn>
        appendChunk: ReturnType<typeof vi.fn>
        finalize: ReturnType<typeof vi.fn>
        cancel: ReturnType<typeof vi.fn>
        dispose: ReturnType<typeof vi.fn>
        unlock: ReturnType<typeof vi.fn>
        resume: ReturnType<typeof vi.fn>
        addStateListener: ReturnType<typeof vi.fn>
        setAudioFormat: ReturnType<typeof vi.fn>
        playedMs: ReturnType<typeof vi.fn>
    } | null,
    playbackListener: null as ((state: VoicePlaybackState) => void) | null,
    setPage: vi.fn(),
    openLoginModal: vi.fn(),
    resumeCharacterChat: vi.fn(),
    deleteCharacterChat: vi.fn(),
    loadData: vi.fn().mockResolvedValue(undefined),
    isAuthenticated: true,
    characterChats: [] as CharacterChatSession[],
}))

function appHooksMock() {
    return {
        useAuth: () => ({
            isAuthenticated: integration.isAuthenticated,
            openLoginModal: integration.openLoginModal,
            token: 'frontend-token-sentinel-do-not-leak',
        }),
        useNavigation: () => ({ setPage: integration.setPage }),
        useData: () => ({
            characterChats: integration.characterChats,
            resumeCharacterChat: integration.resumeCharacterChat,
            deleteCharacterChat: integration.deleteCharacterChat,
            loadData: integration.loadData,
        }),
    }
}

vi.mock('@/app/hooks', () => appHooksMock())
vi.mock('../../../app/hooks', () => appHooksMock())

vi.mock('@/app/hooks/useWorkspace', () => ({
    useWorkspace: () => ({
        status: 'ready',
        selectedWorkspaceId: '0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b',
        workspaceEpoch: 1,
        workspaces: [],
        api: integration.apiService,
        capture: () => ({ accountKey: 'test', authEpoch: 1, userHash: 'u', workspaceId: '0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b', workspaceEpoch: 1 }),
        isCurrent: () => true,
    }),
}))

vi.mock('@/infrastructure/api', () => ({
    apiService: integration.apiService,
    isProtectedMediaUrl: () => false,
    resolveMediaUrl: (value?: string | null) => value ?? undefined,
}))

vi.mock('../hooks/useVoiceCallSocket', () => ({
    useVoiceCallSocket: vi.fn((_sessionId: number | null, handlers: VoiceCallSocketHandlers) => {
        integration.socketHandlers = handlers
        return integration.socketApi
    }),
}))

vi.mock('../hooks/useMicrophoneCapture', () => ({
    useMicrophoneCapture: vi.fn((options: UseMicrophoneCaptureOptions) => {
        integration.microphoneOptions = options
        return integration.microphoneApi
    }),
}))

vi.mock('../audio/voicePlaybackBuffer', () => ({
    VoicePlaybackBuffer: vi.fn(function VoicePlaybackBuffer() {
        return integration.playback
    }),
}))

const CHARACTERS: Character[] = [
    { id: 'c1', name: 'Lyra', race: 'Half-elf', stats: {}, role: 'character' },
] as Character[]

const CHATS: CharacterChatSession[] = [
    {
        id: 'chat-1',
        character_id: 'c1',
        character: CHARACTERS[0],
        persona: { id: 'p1', name: 'Aria', stats: {}, role: 'persona' } as Character,
        turns: [{ id: 't1', type: 'ai', content: 'The fire knows your name.', timestamp: '' }],
        updatedAt: '2026-06-12 09:00:00',
    },
]

function renderVoicePanel() {
    return render(
        <CallScreen
            character={CHARACTERS[0]}
            sessionId={7}
            onSwitchToText={vi.fn()}
        />,
    )
}

function capturedSegment(seq = 1): CapturedVoiceSegment {
    return {
        seq,
        started_at_ms: 100,
        duration_ms: 500,
        encoding: 'audio/wav;codec=pcm_s16le',
        sample_rate: 16000,
        channels: 1,
        byte_length: 48,
        audio_sha256: `${seq}`.repeat(64).slice(0, 64),
        vad: { speech_ms: 450, silence_ms: 50, rms: 0.2, peak: 0.5, source: 'audio_worklet', aggressiveness: 'balanced' },
        audio: new Blob([new Uint8Array([82, 73, 70, 70])], { type: 'audio/wav;codec=pcm_s16le' }),
    }
}

/** `voice_ready` as every call sends it (WS-S1): the announced audio and the voice the call speaks with. */
function readyFrame() {
    return {
        type: 'voice_ready' as const,
        voice_session_id: 'voice-session-1',
        server_time_ms: 1,
        limits: { max_call_seconds: 600, idle_timeout_seconds: 30, remaining_daily_seconds: 300 },
        upload_url: '/character-chats/7/voice-segments',
        audio: { content_type: 'audio/mpeg', codec: 'mp3', sample_rate: 44100 as const, channels: 1 as const },
        effective_voice: { voice_key: `vk_${'b'.repeat(32)}`, display_name: 'Lyra', provider_route: 'elevenlabs' as const, substitution_reason: null, badges: [] },
        original_voice_name: null,
        ai_voice: true,
    }
}

/** A reply chunk as every call sends it (WS-S2): codec, gain and substitution keys included. */
function audioChunk(seq: number, data_b64: string) {
    return {
        type: 'voice_audio_chunk' as const,
        voice_session_id: 'voice-session-1',
        turn_id: 'turn-1',
        seq,
        content_type: 'audio/mpeg' as const,
        codec: 'mp3' as const,
        sample_rate: 44100 as const,
        channels: 1 as const,
        data_b64,
        is_final: false as const,
        gain_db: null,
        substitution_reason: null,
    }
}

/** Drive the (mocked) playback buffer's audible state, as the real audio element would. */
function emitPlayback(status: VoicePlaybackState['status'], turnId: string | null = 'turn-1') {
    act(() => integration.playbackListener?.({ status, voiceSessionId: 'voice-session-1', turnId }))
}

async function startVoiceCallThroughConsent() {
    // CallScreen opens the consent modal automatically — no separate "Start" button.
    fireEvent.click(screen.getByRole('button', { name: 'I consent and start call' }))
    await waitFor(() => expect(integration.microphoneApi!.start).toHaveBeenCalled())
}

describe('Voice call integration proof', () => {
    beforeEach(() => {
        setTestFeatureFlags({ calls: true })
        localStorage.clear()
        integration.isAuthenticated = true
        integration.characterChats = CHATS
        integration.socketHandlers = null
        integration.microphoneOptions = null
        integration.apiService.saveVoiceConsent.mockResolvedValue({
            status: 'accepted',
            consent_version: 'voice-v2',
            limits: { max_call_seconds: 600, idle_timeout_seconds: 30, remaining_daily_seconds: 300 },
        })
        integration.apiService.uploadVoiceSegment.mockResolvedValue({
            voice_session_id: 'voice-session-1',
            segment_id: 'segment-1',
            seq: 1,
            status: 'accepted',
        })
        integration.apiService.endVoiceCall.mockResolvedValue({ status: 'ended', voice_session_id: 'voice-session-1', reason: 'user' })
        integration.apiService.getImageJob.mockResolvedValue(null)
        integration.apiService.getTtsJob.mockResolvedValue(null)
        integration.apiService.fetchProtectedMediaBlob.mockResolvedValue(new Blob())
        integration.apiService.withWorkspace.mockImplementation(() => integration.apiService)
        integration.socketApi = {
            socketStatus: 'closed',
            start: vi.fn(),
            bargeIn: vi.fn(() => true),
            noteSegmentSeq: vi.fn(),
            end: vi.fn(() => true),
            close: vi.fn(),
        }
        integration.microphoneApi = {
            status: 'idle',
            error: null,
            source: null,
            isMuted: false,
            nextSeq: 1,
            start: vi.fn(async () => true),
            stop: vi.fn(),
            mute: vi.fn(),
            unmute: vi.fn(),
            configure: vi.fn(),
            echoCancellation: true,
            rawFallbackActive: false,
            errorCode: null,
        }
        integration.playbackListener = null
        integration.playback = {
            startTurn: vi.fn(),
            appendChunk: vi.fn(() => true),
            finalize: vi.fn(),
            cancel: vi.fn(),
            dispose: vi.fn(),
            unlock: vi.fn(),
            resume: vi.fn(async () => true),
            addStateListener: vi.fn((listener: (state: VoicePlaybackState) => void) => {
                integration.playbackListener = listener
                return () => { integration.playbackListener = null }
            }),
            setAudioFormat: vi.fn(),
            playedMs: vi.fn(() => 1200),
        }
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
            configurable: true,
            value: vi.fn(),
        })
    })

    afterEach(() => {
        vi.clearAllMocks()
        vi.unstubAllEnvs()
    })

    it('runs the fake-provider frontend loop from consent to segment upload, audio playback, and teardown', async () => {
        renderVoicePanel()

        await startVoiceCallThroughConsent()
        expect(integration.apiService.saveVoiceConsent).toHaveBeenCalledWith(7)
        expect(integration.socketApi!.start).toHaveBeenCalledWith(expect.objectContaining({ type: 'voice_start' }))
        expect(vi.mocked(integration.socketApi!.start).mock.calls[0][0]).not.toHaveProperty('consent_version')

        act(() => integration.socketHandlers?.onReady?.(readyFrame()))
        act(() => integration.microphoneOptions?.onSegment?.(capturedSegment(1)))

        await waitFor(() => expect(integration.apiService.uploadVoiceSegment).toHaveBeenCalledWith(7, expect.objectContaining({
            voice_session_id: 'voice-session-1',
            seq: 1,
            audio: expect.any(Blob),
        }), expect.objectContaining({ signal: expect.any(AbortSignal) })))
        expect(integration.socketApi!.noteSegmentSeq).toHaveBeenCalledWith(1)
        // The click itself unlocked playback (iOS autoplay) before any await.
        expect(integration.playback!.unlock).toHaveBeenCalled()

        act(() => integration.socketHandlers?.onTranscriptFinal?.({ type: 'transcript_final', voice_session_id: 'voice-session-1', seq: 1, turn_id: 'turn-1', text: 'Hello there.' }))
        act(() => integration.socketHandlers?.onTurnStart?.({ type: 'voice_turn_start', voice_session_id: 'voice-session-1', turn_id: 'turn-1', user_message_id: 10, assistant_message_id: 11 }))
        act(() => integration.socketHandlers?.onAssistantDelta?.({ type: 'voice_assistant_delta', voice_session_id: 'voice-session-1', turn_id: 'turn-1', content: 'Welcome back.' }))
        act(() => integration.socketHandlers?.onAudioChunk?.(audioChunk(1, 'SUQzBA==')))
        // Buffered but not yet audible still reads as thinking.
        expect(screen.getByText('Thinking')).toBeInTheDocument()
        emitPlayback('playing')

        expect(screen.getByText('Speaking')).toBeInTheDocument()
        expect(screen.getByText(/Hello there\./)).toBeInTheDocument()
        expect(screen.getByText(/Welcome back\./)).toBeInTheDocument()
        expect(integration.playback!.startTurn).toHaveBeenCalledWith('voice-session-1', 'turn-1')
        expect(integration.playback!.appendChunk).toHaveBeenCalled()

        act(() => integration.socketHandlers?.onAudioFinal?.({ type: 'voice_audio_final', voice_session_id: 'voice-session-1', turn_id: 'turn-1', last_seq: 1 }))
        act(() => integration.socketHandlers?.onTurnEnd?.({ type: 'voice_turn_end', voice_session_id: 'voice-session-1', turn_id: 'turn-1', status: 'completed', partial: false, duration_ms: 1200 }))
        // The server finished sending, but the character is still audible.
        expect(screen.getByText('Speaking')).toBeInTheDocument()
        emitPlayback('idle', null)
        expect(screen.getByText('Listening')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'End call' }))

        await waitFor(() => expect(integration.apiService.endVoiceCall).toHaveBeenCalledWith(7, { voiceSessionId: 'voice-session-1', reason: 'user' }, { keepalive: true }))
        expect(integration.microphoneApi!.stop).toHaveBeenCalled()
        expect(integration.socketApi!.close).toHaveBeenCalled()
        expect(integration.playback!.cancel).toHaveBeenCalled()
    })

    it('keeps chatroom voice-call affordances hidden while the frontend flag is off', async () => {
        setTestFeatureFlags({ calls: false })

        render(<ChatroomPage />)
        fireEvent.click(screen.getByRole('button', { name: 'Actions for Lyra' }))

        expect(await screen.findByRole('menuitem', { name: 'Resume chat' })).toBeInTheDocument()
        expect(screen.queryByRole('menuitem', { name: 'Start voice call' })).not.toBeInTheDocument()
        expect(integration.resumeCharacterChat).not.toHaveBeenCalledWith(CHATS[0], { mode: 'voice' })
    })

    it('stops local capture when the backend kill switch rejects consent', async () => {
        const sentinel = 'Bearer frontend-secret data:audio/wav;base64,UFJJVkFURV9SQVdfTUlDX0FVRElP https://api.groq.com/openai/v1/audio/transcriptions'
        integration.apiService.saveVoiceConsent.mockRejectedValue({ category: 'disabled', message: sentinel, fatal: true })
        renderVoicePanel()

        await startVoiceCallThroughConsent()

        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/disabled by the backend/i))
        expect(integration.microphoneApi!.start).toHaveBeenCalled()
        expect(integration.microphoneApi!.stop).toHaveBeenCalled()
        expect(integration.socketApi!.start).not.toHaveBeenCalled()
        expect(document.body).not.toHaveTextContent('frontend-secret')
        expect(document.body).not.toHaveTextContent('data:audio')
        expect(document.body).not.toHaveTextContent('api.groq.com')
    })

    it('handles permission denial without saving consent or opening the socket', async () => {
        integration.microphoneApi = {
            ...integration.microphoneApi!,
            status: 'permission_denied',
            start: vi.fn(async () => false),
        }
        renderVoicePanel()

        await startVoiceCallThroughConsent()

        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Microphone permission was denied/i))
        expect(integration.apiService.saveVoiceConsent).not.toHaveBeenCalled()
        expect(integration.socketApi!.start).not.toHaveBeenCalled()
    })

    it('tears down on auth expiry and route leave using the HTTP end-call escape hatch', async () => {
        const { unmount } = renderVoicePanel()
        await startVoiceCallThroughConsent()
        act(() => integration.socketHandlers?.onReady?.(readyFrame()))

        act(() => window.dispatchEvent(new CustomEvent('auth:expired')))
        expect(integration.microphoneApi!.stop).toHaveBeenCalled()
        expect(integration.socketApi!.close).toHaveBeenCalled()
        expect(screen.getByRole('status')).toHaveTextContent(/session expired/i)

        unmount()
        await waitFor(() => expect(integration.apiService.endVoiceCall).toHaveBeenCalledWith(7, { voiceSessionId: 'voice-session-1', reason: 'user' }, { keepalive: true }))
        expect(integration.playback!.dispose).toHaveBeenCalled()
    })

    it('sends barge-in, drops local playback, and keeps provider/audio sentinels out of visible errors', async () => {
        integration.apiService.uploadVoiceSegment.mockRejectedValue({
            category: 'provider_submission',
            message: 'TTS_PROVIDER_API_KEY=provider-secret-sentinel https://tts.provider.invalid/v1/stream-input data:audio/wav;base64,UFJJVkFURV9SQVdfTUlDX0FVRElP',
            fatal: false,
        })
        renderVoicePanel()
        await startVoiceCallThroughConsent()
        act(() => integration.socketHandlers?.onReady?.(readyFrame()))
        act(() => integration.socketHandlers?.onTurnStart?.({ type: 'voice_turn_start', voice_session_id: 'voice-session-1', turn_id: 'turn-1', user_message_id: 10, assistant_message_id: 11 }))
        act(() => integration.socketHandlers?.onAudioChunk?.(audioChunk(4, 'UFJJVkFURQ==')))
        emitPlayback('playing')

        fireEvent.click(screen.getByRole('button', { name: 'Interrupt' }))

        expect(integration.playback!.cancel).toHaveBeenCalledWith({ voice_session_id: 'voice-session-1', turn_id: 'turn-1' })
        // WS-C1: the interrupted turn and how much of it played, read before the cancel.
        expect(integration.socketApi!.bargeIn).toHaveBeenCalledWith({
            type: 'voice_barge_in',
            reason: 'barge_in',
            turn_id: 'turn-1',
            played_ms: 1200,
        })

        act(() => integration.microphoneOptions?.onSegment?.(capturedSegment(2)))
        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/voice provider could not complete/i))
        expect(document.body).not.toHaveTextContent('TTS_PROVIDER_API_KEY')
        expect(document.body).not.toHaveTextContent('provider-secret-sentinel')
        expect(document.body).not.toHaveTextContent('tts.provider.invalid')
        expect(document.body).not.toHaveTextContent('data:audio')
    })
})
