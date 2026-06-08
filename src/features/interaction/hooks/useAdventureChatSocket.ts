import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../../../shared/types/auth.types'
import type { ChatSocketServerMessage, ForwardOption } from '../../../shared'
import { AdventureChatSocket, type ChatSocketStatus } from '../../../infrastructure/api'

export interface AdventureChatHandlers {
    /** A narrative text chunk arrived. */
    onDelta?: (content: string) => void
    /** Validated turn metadata (suggested actions + image prompt) arrived. */
    onMetadata?: (meta: { forwardOptions: ForwardOption[]; imagePrompt: string }) => void
    /** The turn finished streaming (`interrupted` when stopped early). */
    onDone?: (done: { interrupted: boolean; assistantMessageId?: number; turnId?: string }) => void
    onImageJob?: (frame: Extract<ChatSocketServerMessage, { type: 'image_job' }>) => void
    onImageComplete?: (frame: Extract<ChatSocketServerMessage, { type: 'image_complete' }>) => void
    onImageFailed?: (frame: Extract<ChatSocketServerMessage, { type: 'image_failed' }>) => void
    /** The backend reported an error for this turn. */
    onError?: (message: string) => void
}

export interface AdventureChatSocketApi {
    status: ChatSocketStatus
    sendChat: (messages: ChatMessage[]) => void
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
): AdventureChatSocketApi {
    const handlersRef = useRef(handlers)
    useEffect(() => {
        handlersRef.current = handlers
    })

    const socketRef = useRef<AdventureChatSocket | null>(null)
    const [status, setStatus] = useState<ChatSocketStatus>('closed')

    useEffect(() => {
        // Disabled (no session / unauthenticated): stay disconnected. The prior
        // effect's cleanup already emitted 'closed' via the socket's onStatusChange.
        if (sessionId === null || Number.isNaN(sessionId)) {
            return
        }

        const socket = new AdventureChatSocket(sessionId, {
            onStatusChange: setStatus,
            onMessage: (message: ChatSocketServerMessage) => {
                const current = handlersRef.current
                switch (message.type) {
                    case 'delta':
                        current.onDelta?.(message.content)
                        break
                    case 'metadata':
                        current.onMetadata?.({
                            forwardOptions: message.forwardOptions,
                            imagePrompt: message.imagePrompt,
                        })
                        break
                    case 'done':
                        current.onDone?.({
                            interrupted: Boolean(message.interrupted),
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
                    case 'error':
                        current.onError?.(message.message)
                        break
                    // 'ready' | 'pong' | 'image' | 'action': ignored (forward-compatible).
                }
            },
        })
        socketRef.current = socket
        socket.connect()

        return () => {
            socket.close()
            socketRef.current = null
        }
    }, [sessionId])

    const sendChat = (messages: ChatMessage[]) => socketRef.current?.sendChat(messages)
    const cancel = () => socketRef.current?.cancel()

    return { status, sendChat, cancel }
}
