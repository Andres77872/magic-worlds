import { renderHook, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VoiceSocketClientFrame, VoiceSocketServerFrame } from '@/shared/types/voice.types'
import { useVoiceCallSocket } from './useVoiceCallSocket'

let socketHandlers: { onMessage: (message: VoiceSocketServerFrame) => void; onStatusChange?: (status: string) => void } | null = null
const socketInstances: Array<{
    sessionId: number
    workspaceId: string
    basePath: string
    connect: ReturnType<typeof vi.fn>
    close: ReturnType<typeof vi.fn>
    sendBargeIn: ReturnType<typeof vi.fn>
    sendTurnMetrics: ReturnType<typeof vi.fn>
    noteSegmentSeq: ReturnType<typeof vi.fn>
    end: ReturnType<typeof vi.fn>
}> = []

const WORKSPACE_ID = '0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b'
const workspaceState = vi.hoisted(() => ({ selectedWorkspaceId: '0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b' as string | null }))
vi.mock('@/app/hooks/useWorkspace', () => ({ useWorkspace: () => workspaceState }))

vi.mock('@/infrastructure/api', () => ({
    VoiceSocket: class {
        readonly sessionId: number
        readonly basePath: string
        connect = vi.fn()
        close = vi.fn()
        sendBargeIn = vi.fn(() => true)
        sendTurnMetrics = vi.fn(() => true)
        noteSegmentSeq = vi.fn()
        end = vi.fn(() => true)

        readonly workspaceId: string

        constructor(_sessionId: number, workspaceId: string, handlers: { onMessage: (message: VoiceSocketServerFrame) => void; onStatusChange?: (status: string) => void }, _basePath: string) {
            this.sessionId = _sessionId
            this.workspaceId = workspaceId
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
        audio: {
            preferred_encoding: 'audio/wav;codec=pcm_s16le',
            sample_rate: 16000,
            channels: 1,
            vad: { source: 'audio_worklet', aggressiveness: 'balanced' },
        },
        capabilities: { media_source_mp3: true, audio_worklet: true, media_recorder: false },
    }
}

describe('useVoiceCallSocket', () => {
    afterEach(() => {
        socketHandlers = null
        socketInstances.length = 0
        vi.clearAllMocks()
    })

    it('waits for a committed workspace before creating the call socket', () => {
        workspaceState.selectedWorkspaceId = null
        const { rerender, unmount } = renderHook(() => useVoiceCallSocket(7))
        expect(socketInstances).toHaveLength(0)
        workspaceState.selectedWorkspaceId = WORKSPACE_ID
        rerender()
        expect(socketInstances).toHaveLength(1)
        expect(socketInstances[0].workspaceId).toBe(WORKSPACE_ID)
        unmount()
    })

    it('keeps the call socket in the chat workspace and closes it when that workspace is switched away', () => {
        const OTHER = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'
        workspaceState.selectedWorkspaceId = WORKSPACE_ID
        const { rerender, unmount } = renderHook(() => useVoiceCallSocket(7, {}, 'token-1', 'character-chats', WORKSPACE_ID))
        expect(socketInstances).toHaveLength(1)
        expect(socketInstances[0].workspaceId).toBe(WORKSPACE_ID)

        workspaceState.selectedWorkspaceId = OTHER
        rerender()
        expect(socketInstances[0].close).toHaveBeenCalled()
        // Never reopened in the newly selected workspace.
        expect(socketInstances).toHaveLength(1)
        workspaceState.selectedWorkspaceId = WORKSPACE_ID
        unmount()
    })

    it('queues the accepted call until the draft receives its session id', () => {
        const { result, rerender } = renderHook(
            ({ id }: { id: number | null }) => useVoiceCallSocket(id, {}, 'token-1'),
            { initialProps: { id: null as number | null } },
        )
        expect(socketInstances).toHaveLength(0)
        act(() => result.current.start(startFrame()))
        rerender({ id: 19 })
        expect(socketInstances).toHaveLength(1)
        expect(socketInstances[0].connect).toHaveBeenCalledExactlyOnceWith(startFrame())
    })

    it('drops a queued call when the user leaves before session creation finishes', () => {
        const { result, rerender } = renderHook(
            ({ id }: { id: number | null }) => useVoiceCallSocket(id, {}, 'token-1'),
            { initialProps: { id: null as number | null } },
        )
        act(() => { result.current.start(startFrame()); result.current.close() })
        rerender({ id: 19 })
        expect(socketInstances[0].connect).not.toHaveBeenCalled()
    })

    it('creates a VoiceSocket, starts it on demand, and closes on unmount', () => {
        const { result, unmount } = renderHook(() => useVoiceCallSocket(7, {}, 'token-1'))

        expect(socketInstances).toHaveLength(1)
        expect(socketInstances[0].sessionId).toBe(7)
        expect(socketInstances[0].basePath).toBe('character-chats')
        expect(socketInstances[0].workspaceId).toBe(WORKSPACE_ID)
        expect(socketInstances[0].connect).not.toHaveBeenCalled()

        act(() => result.current.start(startFrame()))
        expect(socketInstances[0].connect).toHaveBeenCalledWith(startFrame())

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

    it('routes typed frames and transport status to the handlers', () => {
        const onSocketStatus = vi.fn()
        const onReady = vi.fn()
        const onStateSnapshot = vi.fn()
        const onError = vi.fn()
        const onEnded = vi.fn()
        const { result } = renderHook(() => useVoiceCallSocket(7, { onSocketStatus, onReady, onStateSnapshot, onError, onEnded }, 'token-1'))

        act(() => socketHandlers?.onStatusChange?.('connecting'))
        expect(result.current.socketStatus).toBe('connecting')
        expect(onSocketStatus).toHaveBeenCalledWith('connecting')

        act(() => socketHandlers?.onMessage({
            type: 'voice_ready',
            voice_session_id: 'voice-1',
            server_time_ms: 1,
            limits: { max_call_seconds: 600, idle_timeout_seconds: 120, remaining_daily_seconds: 120, max_segment_duration_ms: 30_000 },
            upload_url: '/character-chats/7/voice-segments',
        }))
        expect(onReady).toHaveBeenCalledWith(expect.objectContaining({ voice_session_id: 'voice-1' }))

        act(() => socketHandlers?.onMessage({
            type: 'voice_state_snapshot',
            voice_session_id: 'voice-1',
            state: 'listening',
            status: 'active',
            last_segment_seq: 2,
            last_audio_seq: 0,
            server_time_ms: 2,
        }))
        expect(onStateSnapshot).toHaveBeenCalledWith(expect.objectContaining({ type: 'voice_state_snapshot', last_segment_seq: 2 }))

        act(() => socketHandlers?.onMessage({ type: 'voice_error', category: 'quota_exceeded', message: 'Daily limit reached.', fatal: true }))
        expect(onError).toHaveBeenCalledTimes(1)

        act(() => socketHandlers?.onMessage({ type: 'voice_ended', voice_session_id: 'voice-1', reason: 'idle_timeout' }))
        expect(onEnded).toHaveBeenCalledWith(expect.objectContaining({ reason: 'idle_timeout' }))
    })

    it('forwards barge-in and the uploaded segment seq without carrying raw audio', () => {
        const { result } = renderHook(() => useVoiceCallSocket(7, {}, 'token-1'))

        act(() => {
            result.current.noteSegmentSeq(3)
            result.current.bargeIn({ type: 'voice_barge_in', reason: 'barge_in' })
        })

        expect(socketInstances[0].noteSegmentSeq).toHaveBeenCalledWith(3)
        expect(socketInstances[0].sendBargeIn).toHaveBeenCalledWith({ type: 'voice_barge_in', reason: 'barge_in' })
        expect(socketInstances[0].sendBargeIn.mock.calls[0][0]).not.toHaveProperty('audio')
    })

    it('forwards a turn metrics frame and reports nothing sent without a socket', () => {
        const frame = { type: 'voice_turn_client_metrics' as const, v: 1 as const, turn_id: 'turn-1', outcome: 'played' as const, chunks: 3, stalls: 0, stall_ms: 0 }
        const { result } = renderHook(() => useVoiceCallSocket(7, {}, 'token-1'))
        expect(result.current.turnMetrics?.(frame)).toBe(true)
        expect(socketInstances[0].sendTurnMetrics).toHaveBeenCalledWith(frame)

        const closed = renderHook(() => useVoiceCallSocket(null, {}, 'token-1'))
        expect(closed.result.current.turnMetrics?.(frame)).toBe(false)
    })

    it('forwards the voice_end reason', () => {
        const { result } = renderHook(() => useVoiceCallSocket(7, {}, 'token-1'))
        expect(result.current.end('navigation')).toBe(true)
        expect(result.current.end()).toBe(true)
        expect(socketInstances[0].end.mock.calls).toEqual([['navigation'], [undefined]])
    })

    it('keeps the live call socket when the access token rotates', () => {
        const { result, rerender, unmount } = renderHook(
            ({ authKey }) => useVoiceCallSocket(7, {}, authKey),
            { initialProps: { authKey: 'old-token' as string | null } },
        )
        act(() => result.current.start(startFrame()))
        act(() => socketHandlers?.onMessage({
            type: 'voice_ready',
            voice_session_id: 'voice-1',
            server_time_ms: 1,
            limits: { max_call_seconds: 600, idle_timeout_seconds: 30, remaining_daily_seconds: 120 },
            upload_url: '/character-chats/7/voice-segments',
        }))

        rerender({ authKey: 'new-token' })

        expect(socketInstances).toHaveLength(1)
        expect(socketInstances[0].close).not.toHaveBeenCalled()
        expect(socketInstances[0].connect).toHaveBeenCalledExactlyOnceWith(startFrame())

        unmount()
        expect(socketInstances[0].close).toHaveBeenCalledTimes(1)
    })

    it('closes the socket when auth becomes unavailable', () => {
        const { rerender } = renderHook(
            ({ authKey }) => useVoiceCallSocket(7, {}, authKey),
            { initialProps: { authKey: 'token-1' as string | null } },
        )

        rerender({ authKey: null })

        expect(socketInstances).toHaveLength(1)
        expect(socketInstances[0].close).toHaveBeenCalledTimes(1)
    })
})
