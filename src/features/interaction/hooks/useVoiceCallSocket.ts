import { useCallback, useEffect, useRef, useState } from 'react'
import { VoiceSocket, type VoiceSocketStatus } from '@/infrastructure/api'
import type { VoiceCallState, VoiceSocketClientFrame, VoiceSocketServerFrame } from '@/shared/types/voice.types'

type VoiceStartFrame = Extract<VoiceSocketClientFrame, { type: 'voice_start' }>
type VoiceVadFrame = Extract<VoiceSocketClientFrame, { type: 'voice_vad' }>
type VoiceSegmentMetaFrame = Extract<VoiceSocketClientFrame, { type: 'voice_segment_meta' }>
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
    voiceState: VoiceCallState
    ready: VoiceReadyFrame | null
    error: VoiceErrorFrame | null
    voiceSessionId: string | null
    start: (frame: VoiceStartFrame) => void
    sendVad: (frame: VoiceVadFrame) => boolean
    sendSegmentMeta: (frame: VoiceSegmentMetaFrame) => boolean
    bargeIn: (frame: VoiceBargeInFrame) => boolean
    end: (reason?: Extract<VoiceSocketClientFrame, { type: 'voice_end' }>['reason']) => boolean
    close: () => void
}

/**
 * React wrapper around the imperative VoiceSocket. Like useAdventureChatSocket,
 * callbacks are read through refs so render-time handler changes do not tear down
 * an active socket. The hook stores only protocol metadata and never stores raw
 * microphone Blob/bytes, so reconnect cannot replay captured audio.
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
    const [socketStatus, setSocketStatus] = useState<VoiceSocketStatus>('closed')
    const [voiceState, setVoiceState] = useState<VoiceCallState>('idle')
    const [ready, setReady] = useState<VoiceReadyFrame | null>(null)
    const [error, setError] = useState<VoiceErrorFrame | null>(null)
    const [voiceSessionId, setVoiceSessionId] = useState<string | null>(null)

    useEffect(() => {
        setReady(null)
        setError(null)
        setVoiceSessionId(null)
        setVoiceState('idle')
        if (sessionId === null || Number.isNaN(sessionId) || authKey === null) return

        const socket = new VoiceSocket(sessionId, {
            onStatusChange: (nextStatus) => {
                setSocketStatus(nextStatus)
                if (nextStatus === 'connecting') setVoiceState((current) => current === 'idle' ? 'connecting' : 'reconnecting')
            },
            onMessage: (message) => {
                const current = handlersRef.current
                switch (message.type) {
                    case 'voice_ready':
                        setReady(message)
                        setVoiceSessionId(message.voice_session_id)
                        setVoiceState('listening')
                        current.onReady?.(message)
                        break
                    case 'voice_state_snapshot':
                        setVoiceSessionId(message.voice_session_id)
                        setVoiceState(message.state)
                        current.onStateSnapshot?.(message)
                        break
                    case 'voice_status':
                        setVoiceState(message.state)
                        current.onStatus?.(message)
                        break
                    case 'voice_segment_ack':
                        if (message.status === 'received' || message.status === 'accepted') setVoiceState('transcribing')
                        current.onSegmentAck?.(message)
                        break
                    case 'transcript_final':
                        setVoiceState('assistant_thinking')
                        current.onTranscriptFinal?.(message)
                        break
                    case 'voice_turn_start':
                        setVoiceState('assistant_thinking')
                        current.onTurnStart?.(message)
                        break
                    case 'voice_assistant_delta':
                        current.onAssistantDelta?.(message)
                        break
                    case 'voice_audio_chunk':
                        setVoiceState('assistant_speaking')
                        current.onAudioChunk?.(message)
                        break
                    case 'voice_audio_final':
                        current.onAudioFinal?.(message)
                        break
                    case 'voice_turn_end':
                        setVoiceState(message.status === 'failed' ? 'error' : 'listening')
                        current.onTurnEnd?.(message)
                        break
                    case 'voice_cancelled':
                        setVoiceState('listening')
                        current.onCancelled?.(message)
                        break
                    case 'voice_error':
                        setError(message)
                        setVoiceState('error')
                        current.onError?.(message)
                        break
                    case 'voice_ended':
                        setVoiceState('ended')
                        current.onEnded?.(message)
                        break
                    case 'voice_pong':
                        break
                }
            },
        }, basePath)
        socketRef.current = socket

        return () => {
            socket.close()
            socketRef.current = null
            setSocketStatus('closed')
        }
    }, [sessionId, authKey, basePath])

    const start = useCallback((frame: VoiceStartFrame) => {
        setError(null)
        setVoiceState('connecting')
        socketRef.current?.connect(frame)
    }, [])

    const sendVad = useCallback((frame: VoiceVadFrame) => socketRef.current?.sendVad(frame) ?? false, [])
    const sendSegmentMeta = useCallback((frame: VoiceSegmentMetaFrame) => socketRef.current?.sendSegmentMeta(frame) ?? false, [])
    const bargeIn = useCallback((frame: VoiceBargeInFrame) => {
        setVoiceState('barge_in')
        return socketRef.current?.sendBargeIn(frame) ?? false
    }, [])
    const end = useCallback((reason: Extract<VoiceSocketClientFrame, { type: 'voice_end' }>['reason'] = 'user') => {
        setVoiceState('ending')
        return socketRef.current?.end(reason) ?? false
    }, [])
    const close = useCallback(() => {
        socketRef.current?.close()
        setVoiceState('ended')
    }, [])

    return { socketStatus, voiceState, ready, error, voiceSessionId, start, sendVad, sendSegmentMeta, bargeIn, end, close }
}
