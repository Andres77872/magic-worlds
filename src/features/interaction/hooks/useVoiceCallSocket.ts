import { useCallback, useEffect, useRef, useState } from 'react'
import { VoiceSocket, type VoiceSocketStatus } from '@/infrastructure/api'
import type { VoiceSocketClientFrame, VoiceSocketServerFrame } from '@/shared/types/voice.types'

type VoiceStartFrame = Extract<VoiceSocketClientFrame, { type: 'voice_start' }>
type VoiceBargeInFrame = Extract<VoiceSocketClientFrame, { type: 'voice_barge_in' }>
type VoiceReadyFrame = Extract<VoiceSocketServerFrame, { type: 'voice_ready' }>
type VoiceStateSnapshotFrame = Extract<VoiceSocketServerFrame, { type: 'voice_state_snapshot' }>
type VoiceStatusFrame = Extract<VoiceSocketServerFrame, { type: 'voice_status' }>
type VoiceSegmentAckFrame = Extract<VoiceSocketServerFrame, { type: 'voice_segment_ack' }>
type TranscriptFinalFrame = Extract<VoiceSocketServerFrame, { type: 'transcript_final' }>
type VoiceTurnStartFrame = Extract<VoiceSocketServerFrame, { type: 'voice_turn_start' }>
type VoiceAssistantDeltaFrame = Extract<VoiceSocketServerFrame, { type: 'voice_assistant_delta' }>
type VoiceAudioChunkFrame = Extract<VoiceSocketServerFrame, { type: 'voice_audio_chunk' }>
type VoiceAudioFinalFrame = Extract<VoiceSocketServerFrame, { type: 'voice_audio_final' }>
type VoiceTurnEndFrame = Extract<VoiceSocketServerFrame, { type: 'voice_turn_end' }>
type VoiceCancelledFrame = Extract<VoiceSocketServerFrame, { type: 'voice_cancelled' }>
type VoiceErrorFrame = Extract<VoiceSocketServerFrame, { type: 'voice_error' }>
type VoiceEndedFrame = Extract<VoiceSocketServerFrame, { type: 'voice_ended' }>

export interface VoiceCallSocketHandlers {
    /** Transport status; `connecting` after ready means the call is being resumed. */
    onSocketStatus?: (status: VoiceSocketStatus) => void
    onReady?: (frame: VoiceReadyFrame) => void
    onStateSnapshot?: (frame: VoiceStateSnapshotFrame) => void
    onStatus?: (frame: VoiceStatusFrame) => void
    onSegmentAck?: (frame: VoiceSegmentAckFrame) => void
    onTranscriptFinal?: (frame: TranscriptFinalFrame) => void
    onTurnStart?: (frame: VoiceTurnStartFrame) => void
    onAssistantDelta?: (frame: VoiceAssistantDeltaFrame) => void
    onAudioChunk?: (frame: VoiceAudioChunkFrame) => void
    onAudioFinal?: (frame: VoiceAudioFinalFrame) => void
    onTurnEnd?: (frame: VoiceTurnEndFrame) => void
    onCancelled?: (frame: VoiceCancelledFrame) => void
    onError?: (frame: VoiceErrorFrame) => void
    onEnded?: (frame: VoiceEndedFrame) => void
}

export interface VoiceCallSocketApi {
    socketStatus: VoiceSocketStatus
    start: (frame: VoiceStartFrame) => void
    bargeIn: (frame: VoiceBargeInFrame) => boolean
    /** Record the highest uploaded segment seq (sent in `voice_resume`). */
    noteSegmentSeq: (seq: number) => void
    end: () => boolean
    close: () => void
}

/**
 * React wrapper around the imperative VoiceSocket. Like useAdventureChatSocket,
 * callbacks are read through refs so render-time handler changes do not tear down
 * an active socket. The call state machine lives in useVoiceCallController; this
 * hook only routes typed frames and reports the transport status. It never
 * stores raw microphone Blob/bytes, so a reconnect cannot replay captured audio.
 */
export function useVoiceCallSocket(
    sessionId: number | null,
    handlers: VoiceCallSocketHandlers = {},
    authKey?: string | null,
    basePath: string = 'character-chats',
): VoiceCallSocketApi {
    const handlersRef = useRef(handlers)
    useEffect(() => {
        handlersRef.current = handlers
    })

    const socketRef = useRef<VoiceSocket | null>(null)
    const pendingStartRef = useRef<VoiceStartFrame | null>(null)
    const [socketStatus, setSocketStatus] = useState<VoiceSocketStatus>('closed')

    // Only auth *availability* gates the socket. The token value itself must not
    // be an effect dependency: VoiceSocket reads the stored token fresh on every
    // connect and the server authenticates only the handshake, so recreating the
    // socket on each `auth:refreshed` would close a live call.
    const authDisabled = authKey === null

    useEffect(() => {
        if (sessionId === null || Number.isNaN(sessionId) || authDisabled) return

        const socket = new VoiceSocket(sessionId, {
            onStatusChange: (nextStatus) => {
                setSocketStatus(nextStatus)
                handlersRef.current.onSocketStatus?.(nextStatus)
            },
            onMessage: (message) => {
                const current = handlersRef.current
                switch (message.type) {
                    case 'voice_ready':
                        current.onReady?.(message)
                        break
                    case 'voice_state_snapshot':
                        current.onStateSnapshot?.(message)
                        break
                    case 'voice_status':
                        current.onStatus?.(message)
                        break
                    case 'voice_segment_ack':
                        current.onSegmentAck?.(message)
                        break
                    case 'transcript_final':
                        current.onTranscriptFinal?.(message)
                        break
                    case 'voice_turn_start':
                        current.onTurnStart?.(message)
                        break
                    case 'voice_assistant_delta':
                        current.onAssistantDelta?.(message)
                        break
                    case 'voice_audio_chunk':
                        current.onAudioChunk?.(message)
                        break
                    case 'voice_audio_final':
                        current.onAudioFinal?.(message)
                        break
                    case 'voice_turn_end':
                        current.onTurnEnd?.(message)
                        break
                    case 'voice_cancelled':
                        current.onCancelled?.(message)
                        break
                    case 'voice_error':
                        current.onError?.(message)
                        break
                    case 'voice_ended':
                        current.onEnded?.(message)
                        break
                    case 'voice_pong':
                        break
                }
            },
        }, basePath)
        socketRef.current = socket
        if (pendingStartRef.current) {
            const frame = pendingStartRef.current
            pendingStartRef.current = null
            socket.connect(frame)
        }

        return () => {
            socket.close()
            socketRef.current = null
            setSocketStatus('closed')
        }
    }, [sessionId, authDisabled, basePath])

    const start = useCallback((frame: VoiceStartFrame) => {
        if (socketRef.current) socketRef.current.connect(frame)
        else pendingStartRef.current = frame
    }, [])

    const bargeIn = useCallback((frame: VoiceBargeInFrame) => socketRef.current?.sendBargeIn(frame) ?? false, [])
    const noteSegmentSeq = useCallback((seq: number) => socketRef.current?.noteSegmentSeq(seq), [])
    const end = useCallback(() => {
        pendingStartRef.current = null
        return socketRef.current?.end() ?? false
    }, [])
    const close = useCallback(() => {
        pendingStartRef.current = null
        socketRef.current?.close()
    }, [])

    return { socketStatus, start, bargeIn, noteSegmentSeq, end, close }
}
