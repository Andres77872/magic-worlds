/**
 * AdventureChatSocket — per-session WebSocket transport for adventure chat.
 *
 * Replaces the old SSE `POST /chat` reader. One socket per adventure carries the
 * full typed envelope (see `ChatSocketServerMessage`): narrative `delta` frames,
 * a `metadata` frame (forwardOptions + imagePrompt), `done`/`error`, plus
 * reserved `image`/`action` frames for the future. The client sends `chat`,
 * `cancel`, and `ping` frames. Auth rides the handshake via the
 * `Sec-WebSocket-Protocol` subprotocol since browsers can't set headers on a WS.
 */

import type { ChatMessage } from '../../shared/types/auth.types'
import type { ChatSocketServerMessage } from '../../shared/types/interaction.types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const WS_BEARER_SUBPROTOCOL = 'mw.bearer.v1'
const HEARTBEAT_MS = 25_000
const MAX_RECONNECT_MS = 30_000

/** Derive the ws(s):// origin from the http(s):// API base URL. */
function toWsUrl(base: string): string {
    if (base.startsWith('https://')) return `wss://${base.slice('https://'.length)}`
    if (base.startsWith('http://')) return `ws://${base.slice('http://'.length)}`
    return base
}

/** Read the stored Bearer token (same key + quote-stripping as the REST client). */
function getStoredToken(): string {
    const token = localStorage.getItem('magic_worlds:token')
    return token ? token.replace(/"/g, '') : ''
}

export type ChatSocketStatus = 'connecting' | 'open' | 'closed'

export interface ChatSocketHandlers {
    onMessage: (message: ChatSocketServerMessage) => void
    onStatusChange?: (status: ChatSocketStatus) => void
}

export class AdventureChatSocket {
    private ws: WebSocket | null = null
    private readonly sessionId: number
    private readonly handlers: ChatSocketHandlers
    private heartbeat: ReturnType<typeof setInterval> | null = null
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null
    private reconnectAttempts = 0
    private closedByUser = false
    // A chat frame requested before the socket is OPEN; flushed on connect.
    private pendingChat: string | null = null

    constructor(sessionId: number, handlers: ChatSocketHandlers) {
        this.sessionId = sessionId
        this.handlers = handlers
    }

    connect(): void {
        this.closedByUser = false
        const token = getStoredToken()
        if (!token) {
            // No token yet — stay closed; the UI gates sending behind login.
            this.setStatus('closed')
            return
        }

        this.setStatus('connecting')
        const url = `${toWsUrl(API_BASE_URL)}/adventure-sessions/${this.sessionId}/ws`
        let ws: WebSocket
        try {
            ws = new WebSocket(url, [WS_BEARER_SUBPROTOCOL, token])
        } catch {
            this.scheduleReconnect()
            return
        }
        // Make any prior socket inert before adopting the new one, so a stale
        // (e.g. StrictMode-discarded) socket can't race shared state below.
        this.detach(this.ws)
        this.ws = ws

        ws.onopen = () => {
            if (this.ws !== ws) return
            this.reconnectAttempts = 0
            this.setStatus('open')
            this.startHeartbeat()
            if (this.pendingChat) {
                ws.send(this.pendingChat)
                this.pendingChat = null
            }
        }

        ws.onmessage = (event) => {
            if (this.ws !== ws) return
            let message: ChatSocketServerMessage
            try {
                message = JSON.parse(event.data)
            } catch {
                return
            }
            if (message && typeof (message as { type?: unknown }).type === 'string') {
                this.handlers.onMessage(message)
            }
        }

        ws.onclose = (event) => {
            if (this.ws !== ws) return
            this.stopHeartbeat()
            this.ws = null
            this.setStatus('closed')

            if (event.code === 4401) {
                // Token rejected — mirror the REST client's 401 expiry handling.
                localStorage.removeItem('magic_worlds:token')
                localStorage.removeItem('magic_worlds:user')
                window.dispatchEvent(new CustomEvent('auth:expired'))
                this.handlers.onMessage({
                    type: 'error',
                    message: 'Your session has expired. Please log in again.',
                    category: 'auth',
                })
                return
            }

            if (!this.closedByUser) {
                this.scheduleReconnect()
            }
        }

        // Connection failures surface through onclose, which handles reconnect.
        ws.onerror = () => {}
    }

    /** Request a generation. Queues until the socket is OPEN, (re)connecting if needed. */
    sendChat(messages: ChatMessage[]): void {
        const frame = JSON.stringify({ type: 'chat', messages })
        if (this.isOpen) {
            this.ws!.send(frame)
            return
        }
        this.pendingChat = frame
        // CONNECTING: the in-flight onopen will flush pendingChat.
        if (this.ws?.readyState === WebSocket.CONNECTING) return
        // null / CLOSING / CLOSED: drop the dead socket and (re)connect so the
        // queued frame is flushed once a fresh socket opens.
        if (this.ws) {
            this.detach(this.ws)
            try {
                this.ws.close()
            } catch {
                // ignore
            }
            this.ws = null
        }
        this.closedByUser = false
        if (!this.reconnectTimer) this.connect()
    }

    /** Cancel the in-flight generation (no-op if the socket isn't open). */
    cancel(): void {
        if (this.isOpen) this.ws!.send(JSON.stringify({ type: 'cancel' }))
    }

    close(): void {
        this.closedByUser = true
        this.pendingChat = null
        this.stopHeartbeat()
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer)
            this.reconnectTimer = null
        }
        if (this.ws) {
            this.detach(this.ws)
            try {
                this.ws.close(1000)
            } catch {
                // ignore
            }
            this.ws = null
        }
        this.setStatus('closed')
    }

    /** Detach a socket's handlers so its async callbacks become inert. */
    private detach(ws: WebSocket | null): void {
        if (!ws) return
        ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null
    }

    get isOpen(): boolean {
        return this.ws?.readyState === WebSocket.OPEN
    }

    private setStatus(status: ChatSocketStatus): void {
        this.handlers.onStatusChange?.(status)
    }

    private startHeartbeat(): void {
        this.stopHeartbeat()
        this.heartbeat = setInterval(() => {
            if (this.isOpen) this.ws!.send(JSON.stringify({ type: 'ping' }))
        }, HEARTBEAT_MS)
    }

    private stopHeartbeat(): void {
        if (this.heartbeat) {
            clearInterval(this.heartbeat)
            this.heartbeat = null
        }
    }

    private scheduleReconnect(): void {
        if (this.closedByUser || this.reconnectTimer) return
        const delay = Math.min(MAX_RECONNECT_MS, 1_000 * 2 ** this.reconnectAttempts)
        this.reconnectAttempts += 1
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null
            this.connect()
        }, delay)
    }
}
