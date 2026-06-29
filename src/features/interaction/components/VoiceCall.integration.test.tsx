import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Character, CharacterChatSession } from '@/shared'
import type { CapturedVoiceSegment } from '../audio/voiceVadWorklet'
import type { MicrophoneCaptureApi, UseMicrophoneCaptureOptions } from '../hooks/useMicrophoneCapture'
import type { VoiceCallSocketApi, VoiceCallSocketHandlers } from '../hooks/useVoiceCallSocket'
import { CallScreen } from '../../call'
import { ChatroomPage } from '../../characterChat/components/ChatroomPage'

const integration = vi.hoisted(() => ({
    apiService: {
        saveVoiceConsent: vi.fn(),
        uploadVoiceSegment: vi.fn(),
        endVoiceCall: vi.fn(),
        getImageJob: vi.fn(),
        getTtsJob: vi.fn(),
        fetchProtectedMediaBlob: vi.fn(),
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
    } | null,
    setPage: vi.fn(),
    openLoginModal: vi.fn(),
    resumeCharacterChat: vi.fn(),
    deleteCharacterChat: vi.fn(),
    loadData: vi.fn(),
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
            persona={CHATS[0].persona}
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

function readyFrame() {
    return {
        type: 'voice_ready' as const,
        voice_session_id: 'voice-session-1',
        server_time_ms: 1,
        limits: { max_call_seconds: 600, idle_timeout_seconds: 30, remaining_daily_seconds: 300 },
        upload_url: '/character-chats/7/voice-segments',
    }
}

async function startVoiceCallThroughConsent() {
    // CallScreen opens the consent modal automatically — no separate "Start" button.
    fireEvent.click(screen.getByRole('button', { name: 'I consent and start call' }))
    await waitFor(() => expect(integration.microphoneApi!.start).toHaveBeenCalled())
}

describe('Voice call integration proof', () => {
    beforeEach(() => {
        vi.stubEnv('VITE_FEATURE_CALLS_ENABLED', 'true')
        localStorage.clear()
        integration.isAuthenticated = true
        integration.characterChats = CHATS
        integration.socketHandlers = null
        integration.microphoneOptions = null
        integration.apiService.saveVoiceConsent.mockResolvedValue({
            status: 'accepted',
            consent_version: 'voice-v1',
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
        integration.socketApi = {
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
        }
        integration.playback = {
            startTurn: vi.fn(),
            appendChunk: vi.fn(() => true),
            finalize: vi.fn(),
            cancel: vi.fn(),
            dispose: vi.fn(),
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
        expect(integration.socketApi!.start).toHaveBeenCalledWith(expect.objectContaining({ type: 'voice_start', consent_version: 'voice-v1' }))

        act(() => integration.socketHandlers?.onReady?.(readyFrame()))
        act(() => integration.microphoneOptions?.onSegment?.(capturedSegment(1)))

        await waitFor(() => expect(integration.apiService.uploadVoiceSegment).toHaveBeenCalledWith(7, expect.objectContaining({
            voice_session_id: 'voice-session-1',
            seq: 1,
            audio: expect.any(Blob),
        }), expect.objectContaining({ signal: expect.any(AbortSignal) })))
        expect(integration.socketApi!.sendSegmentMeta).toHaveBeenCalledWith(expect.objectContaining({ type: 'voice_segment_meta', seq: 1 }))

        act(() => integration.socketHandlers?.onTranscriptFinal?.({ type: 'transcript_final', voice_session_id: 'voice-session-1', seq: 1, turn_id: 'turn-1', text: 'Hello there.' }))
        act(() => integration.socketHandlers?.onTurnStart?.({ type: 'voice_turn_start', voice_session_id: 'voice-session-1', turn_id: 'turn-1', user_message_id: 10, assistant_message_id: 11 }))
        act(() => integration.socketHandlers?.onAssistantDelta?.({ type: 'voice_assistant_delta', voice_session_id: 'voice-session-1', turn_id: 'turn-1', content: 'Welcome back.' }))
        act(() => integration.socketHandlers?.onAudioChunk?.({ type: 'voice_audio_chunk', voice_session_id: 'voice-session-1', turn_id: 'turn-1', seq: 1, content_type: 'audio/mpeg', sample_rate: 32000, channels: 1, data_b64: 'SUQzBA==', is_final: false }))

        expect(screen.getByText('Speaking')).toBeInTheDocument()
        expect(screen.getByText(/Hello there\./)).toBeInTheDocument()
        expect(screen.getByText(/Welcome back\./)).toBeInTheDocument()
        expect(integration.playback!.startTurn).toHaveBeenCalledWith('voice-session-1', 'turn-1')
        expect(integration.playback!.appendChunk).toHaveBeenCalled()

        act(() => integration.socketHandlers?.onAudioFinal?.({ type: 'voice_audio_final', voice_session_id: 'voice-session-1', turn_id: 'turn-1', last_seq: 1 }))
        act(() => integration.socketHandlers?.onTurnEnd?.({ type: 'voice_turn_end', voice_session_id: 'voice-session-1', turn_id: 'turn-1', status: 'completed', partial: false, duration_ms: 1200 }))
        expect(screen.getByText('Listening')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'End call' }))

        await waitFor(() => expect(integration.apiService.endVoiceCall).toHaveBeenCalledWith(7, { voiceSessionId: 'voice-session-1', reason: 'user' }))
        expect(integration.microphoneApi!.stop).toHaveBeenCalled()
        expect(integration.socketApi!.close).toHaveBeenCalled()
        expect(integration.playback!.cancel).toHaveBeenCalled()
    })

    it('keeps chatroom voice-call affordances hidden while the frontend flag is off', async () => {
        vi.stubEnv('VITE_FEATURE_CALLS_ENABLED', 'false')

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
        expect(screen.getByRole('alert')).toHaveTextContent(/session has expired/i)

        unmount()
        await waitFor(() => expect(integration.apiService.endVoiceCall).toHaveBeenCalledWith(7, { voiceSessionId: 'voice-session-1', reason: 'navigation' }))
        expect(integration.playback!.dispose).toHaveBeenCalled()
    })

    it('sends barge-in, drops local playback, and keeps provider/audio sentinels out of visible errors', async () => {
        integration.apiService.uploadVoiceSegment.mockRejectedValue({
            category: 'provider_submission',
            message: 'MINIMAX_API_KEY=minimax-secret https://api.minimax.io/ws/v1/t2a_v2 data:audio/wav;base64,UFJJVkFURV9SQVdfTUlDX0FVRElP',
            fatal: false,
        })
        renderVoicePanel()
        await startVoiceCallThroughConsent()
        act(() => integration.socketHandlers?.onReady?.(readyFrame()))
        act(() => integration.socketHandlers?.onTurnStart?.({ type: 'voice_turn_start', voice_session_id: 'voice-session-1', turn_id: 'turn-1', user_message_id: 10, assistant_message_id: 11 }))
        act(() => integration.socketHandlers?.onAudioChunk?.({ type: 'voice_audio_chunk', voice_session_id: 'voice-session-1', turn_id: 'turn-1', seq: 4, content_type: 'audio/mpeg', sample_rate: 32000, channels: 1, data_b64: 'UFJJVkFURQ==', is_final: false }))

        fireEvent.click(screen.getByRole('button', { name: 'Interrupt' }))

        expect(integration.playback!.cancel).toHaveBeenCalledWith({ voice_session_id: 'voice-session-1', turn_id: 'turn-1' })
        expect(integration.socketApi!.bargeIn).toHaveBeenCalledWith(expect.objectContaining({
            type: 'voice_barge_in',
            last_heard_audio_seq: 4,
            reason: 'button',
        }))

        act(() => integration.microphoneOptions?.onSegment?.(capturedSegment(2)))
        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/voice provider could not complete/i))
        expect(document.body).not.toHaveTextContent('MINIMAX_API_KEY')
        expect(document.body).not.toHaveTextContent('api.minimax.io')
        expect(document.body).not.toHaveTextContent('data:audio')
    })
})
