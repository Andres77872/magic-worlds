import { useEffect, useRef, useState } from 'react'
import type { ChatSocketServerMessage, ForwardOption } from '../../../shared'
import { ChatSocket, type ChatSocketStatus } from '../../../infrastructure/api'

export interface AdventureChatHandlers {
    onTurnStarted?: (frame: Extract<ChatSocketServerMessage, { type: 'turn_started' }>) => void
    onConnectionLost?: () => void
    /** Transient speaker roster + narrator identity, sent once before the first delta. */
    onSpeakers?: (frame: Extract<ChatSocketServerMessage, { type: 'speakers' }>) => void
    /** A narrative text chunk arrived. */
    onDelta?: (content: string) => void
    /** Validated turn metadata (suggested actions + image prompt) arrived. */
    onMetadata?: (meta: { forwardOptions?: ForwardOption[]; imagePrompt?: string }) => void
    /** Parsed XML response segments arrived after the narrative stream completed. */
    onSegments?: (frame: Extract<ChatSocketServerMessage, { type: 'segments' }>) => void
    /** The turn finished streaming (`interrupted` when stopped early). */
    onDone?: (done: { interrupted: boolean; userMessageId?: number; assistantMessageId?: number; turnId?: string }) => void
    onImageJob?: (frame: Extract<ChatSocketServerMessage, { type: 'image_job' }>) => void
    onImageComplete?: (frame: Extract<ChatSocketServerMessage, { type: 'image_complete' }>) => void
    onImageFailed?: (frame: Extract<ChatSocketServerMessage, { type: 'image_failed' }>) => void
    onTtsJob?: (frame: Extract<ChatSocketServerMessage, { type: 'tts_job' }>) => void
    onTtsComplete?: (frame: Extract<ChatSocketServerMessage, { type: 'tts_complete' }>) => void
    onTtsFailed?: (frame: Extract<ChatSocketServerMessage, { type: 'tts_failed' }>) => void
    /** The backend reported an error for this turn. `detail` carries the
     *  server's fixed error category and the ids needed to find the matching
     *  backend log line. */
    onError?: (message: string, detail: AdventureChatSocketErrorDetail) => void
}

export interface AdventureChatSocketErrorDetail {
    category?: string
    requestId?: string
    turnId?: string
}

export interface AdventureChatSocketApi {
    status: ChatSocketStatus
    sendChat: (content: string, requestId?: string, existingUserMessageId?: number) => void
    sendTts: (assistantMessageId: number, turnId: string, requestId?: string) => void
    cancel: () => void
}

/**
 * Owns one per-session adventure chat WebSocket for the lifetime of the
 * interaction screen. Pass `null` to keep it disconnected (e.g. while
 * unauthenticated or before a session id is known). Handlers are read through a
 * ref so the socket isn't torn down when callbacks change between renders.
 */
export function useAdventureChatSocket(
    sessionId: number | null,
    handlers: AdventureChatHandlers,
    authKey?: string | null,
    basePath: string = 'adventure-sessions',
): AdventureChatSocketApi {
    const handlersRef = useRef(handlers)
    useEffect(() => {
        handlersRef.current = handlers
    })

    const socketRef = useRef<ChatSocket | null>(null)
    const requestRef = useRef<string | undefined>(undefined)
    const [status, setStatus] = useState<ChatSocketStatus>('closed')

    // Only auth *availability* gates the socket. The token value itself must not
    // be an effect dependency: the socket reads the stored token fresh on every
    // (re)connect and owns its own refresh recovery, so recreating it on each
    // `auth:refreshed` would drop a chat frame queued behind that very refresh.
    const authDisabled = authKey === null

    useEffect(() => {
        // Disabled (no session / unauthenticated): stay disconnected. The prior
        // effect's cleanup already emitted 'closed' via the socket's onStatusChange.
        if (sessionId === null || Number.isNaN(sessionId) || authDisabled) {
            return
        }

        const socket = new ChatSocket(sessionId, {
            onStatusChange: setStatus,
            onStreamInterrupted: () => handlersRef.current.onConnectionLost?.(),
            onMessage: (message: ChatSocketServerMessage) => {
                if (message.request_id && message.request_id !== requestRef.current && !message.type.startsWith('tts_') && !message.type.startsWith('image_')) return
                const current = handlersRef.current
                switch (message.type) {
                    case 'turn_started':
                        current.onTurnStarted?.(message)
                        break
                    case 'speakers':
                        current.onSpeakers?.(message)
                        break
                    case 'delta':
                        current.onDelta?.(message.content)
                        break
                    case 'metadata':
                        current.onMetadata?.({
                            forwardOptions: message.forwardOptions,
                            imagePrompt: message.imagePrompt,
                        })
                        break
                    case 'segments':
                        current.onSegments?.(message)
                        break
                    case 'done':
                        current.onDone?.({
                            interrupted: Boolean(message.interrupted),
                            userMessageId: message.user_message_id,
                            assistantMessageId: message.assistant_message_id,
                            turnId: message.turn_id,
                        })
                        break
                    case 'image_job':
                        current.onImageJob?.(message)
                        break
                    case 'image_complete':
                        current.onImageComplete?.(message)
                        break
                    case 'image_failed':
                        current.onImageFailed?.(message)
                        break
                    case 'tts_job':
                        current.onTtsJob?.(message)
                        break
                    case 'tts_complete':
                        current.onTtsComplete?.(message)
                        break
                    case 'tts_failed':
                        current.onTtsFailed?.(message)
                        break
                    case 'error':
                        current.onError?.(message.message, {
                            category: message.category,
                            requestId: message.request_id,
                            turnId: message.turn_id,
                        })
                        break
                    // 'ready' | 'pong' | 'image' | 'action': ignored (forward-compatible).
                }
            },
        }, basePath)
        socketRef.current = socket
        socket.connect()

        return () => {
            socket.close()
            socketRef.current = null
        }
        // basePath in deps so switching session kinds tears down + reconnects cleanly.
    }, [sessionId, authDisabled, basePath])

    const sendChat = (content: string, requestId?: string, existingUserMessageId?: number) => {
        requestRef.current = requestId
        socketRef.current?.sendChat(content, requestId, existingUserMessageId)
    }
    const sendTts = (assistantMessageId: number, turnId: string, requestId?: string) =>
        socketRef.current?.sendTts(assistantMessageId, turnId, requestId)
    const cancel = () => socketRef.current?.cancel()

    return { status, sendChat, sendTts, cancel }
}
