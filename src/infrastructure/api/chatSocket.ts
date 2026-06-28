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
import type { ChatGenerationOptions, ChatSocketServerMessage } from '../../shared/types/interaction.types'
import { API_BASE_URL } from './baseUrl'

const WS_BEARER_SUBPROTOCOL = 'mw.bearer.v1'
const HEARTBEAT_MS = 25_000
const MAX_RECONNECT_MS = 30_000
const CHAT_AUTH_REFRESH_SKEW_MS = 60_000

let refreshAccessTokenForSocket: (() => Promise<string>) | null = null

type RefreshFailureShape = {
    status?: unknown
    message?: unknown
    retryable?: unknown
}

export function configureChatSocketAuthRefresh(handler: (() => Promise<string>) | null): void {
    refreshAccessTokenForSocket = handler
}

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

function decodeBase64UrlJson(value: string): unknown {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    return JSON.parse(atob(padded))
}

function accessTokenExpiresAtMs(token: string): number | null {
    const payload = token.split('.')[1]
    if (!payload) return null
    try {
        const decoded = decodeBase64UrlJson(payload)
        if (typeof decoded !== 'object' || decoded === null) return null
        const exp = (decoded as { exp?: unknown }).exp
        const seconds = typeof exp === 'number' ? exp : Number(exp)
        return Number.isFinite(seconds) ? seconds * 1_000 : null
    } catch {
        return null
    }
}

function shouldRefreshBeforeChat(token: string, nowMs: number = Date.now()): boolean {
    const expiresAt = accessTokenExpiresAtMs(token)
    return expiresAt !== null && expiresAt - nowMs <= CHAT_AUTH_REFRESH_SKEW_MS
}

export type ChatSocketStatus = 'connecting' | 'open' | 'closed'

export interface ChatSocketHandlers {
    onMessage: (message: ChatSocketServerMessage) => void
    onStatusChange?: (status: ChatSocketStatus) => void
}

export class ChatSocket {
    private ws: WebSocket | null = null
    private readonly sessionId: number
    private readonly handlers: ChatSocketHandlers
    // API path segment for the session kind: 'adventure-sessions' or 'character-chats'.
    // Both serve the identical frame protocol, so only the URL differs.
    private readonly basePath: string
    private heartbeat: ReturnType<typeof setInterval> | null = null
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null
    private reconnectAttempts = 0
    private closedByUser = false
    private authRecoveryAttempted = false
    private terminalAuthReported = false
    // A chat frame requested before the socket is OPEN; flushed on connect.
    private pendingChat: string | null = null

    constructor(sessionId: number, handlers: ChatSocketHandlers, basePath: string = 'adventure-sessions') {
        this.sessionId = sessionId
        this.handlers = handlers
        this.basePath = basePath
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
        const url = `${toWsUrl(API_BASE_URL)}/${this.basePath}/${this.sessionId}/ws`
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
                const pendingFrame = this.pendingChat
                const storedToken = getStoredToken()
                if (!storedToken) {
                    this.pendingChat = null
                    this.expireAuth()
                    return
                }
                if (shouldRefreshBeforeChat(storedToken)) {
                    void this.refreshBeforeSendingPendingChat(pendingFrame)
                    return
                }
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
                void this.recoverFromAuthClose()
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
    sendChat(messages: ChatMessage[], options: ChatGenerationOptions = { generateImage: true, suggestActions: true }): void {
        const frame = JSON.stringify({ type: 'chat', messages, options })
        const token = getStoredToken()
        if (!token) {
            this.expireAuth()
            return
        }
        if (shouldRefreshBeforeChat(token)) {
            this.pendingChat = frame
            void this.refreshBeforeSendingPendingChat(frame)
            return
        }
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

    /**
     * Request narration (TTS) for a finished assistant turn. Best-effort: no-op if
     * the socket isn't OPEN (like `cancel`) — the turn is normally just-finished so
     * the socket is open, and hydration/polling recovers the job after a reconnect.
     * `requestId` is stored server-side for tracing; dedupe itself is content-hash
     * based (an in-flight or completed job for the same turn + text + voice is
     * reused rather than re-enqueued).
     */
    sendTts(assistantMessageId: number, turnId: string, requestId?: string): void {
        if (!this.isOpen) return
        const frame: Record<string, unknown> = { type: 'tts', assistant_message_id: assistantMessageId, turn_id: turnId }
        if (requestId) frame.request_id = requestId
        this.ws!.send(JSON.stringify(frame))
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
        const ws = this.ws
        if (ws) {
            if (ws.readyState === WebSocket.CONNECTING) {
                // Closing a CONNECTING socket triggers the browser's noisy
                // "WebSocket is closed before the connection is established" warning
                // (e.g. the text→voice mode toggle remount). Make every handler inert,
                // then close cleanly once it actually opens — no warning.
                this.detach(ws)
                ws.onopen = () => {
                    try {
                        ws.close(1000)
                    } catch {
                        // ignore
                    }
                }
                console.info('[chat-socket][CLOSED_WHILE_CONNECTING] deferring close until open', { sessionId: this.sessionId })
            } else {
                this.detach(ws)
                try {
                    ws.close(1000)
                } catch {
                    // ignore
                }
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

    private retireCurrentSocketForAuthRefresh(): void {
        this.stopHeartbeat()
        const ws = this.ws
        if (!ws) return
        this.detach(ws)
        if (ws.readyState === WebSocket.CONNECTING) {
            ws.onopen = () => {
                try {
                    ws.close(1000)
                } catch {
                    // ignore
                }
            }
        } else {
            try {
                ws.close(1000)
            } catch {
                // ignore
            }
        }
        this.ws = null
        this.setStatus('closed')
    }

    private async refreshBeforeSendingPendingChat(expectedFrame: string): Promise<void> {
        if (this.closedByUser || this.pendingChat !== expectedFrame) return
        this.retireCurrentSocketForAuthRefresh()
        if (!refreshAccessTokenForSocket) {
            this.pendingChat = null
            this.expireAuth()
            return
        }

        try {
            await refreshAccessTokenForSocket()
            this.authRecoveryAttempted = false
        } catch (error) {
            if (this.pendingChat === expectedFrame) {
                this.pendingChat = null
            }
            if (this.isTerminalRefreshError(error)) {
                if (!this.closedByUser) this.expireAuth()
                return
            }
            if (!this.closedByUser) this.reportRecoverableAuthFailure()
            return
        }

        if (!this.closedByUser && this.pendingChat === expectedFrame) {
            this.connect()
        }
    }

    private async recoverFromAuthClose(): Promise<void> {
        if (this.closedByUser) return
        if (!refreshAccessTokenForSocket) {
            this.expireAuth()
            return
        }
        if (this.authRecoveryAttempted) {
            this.reportRejectedAfterRefresh()
            return
        }

        this.authRecoveryAttempted = true
        try {
            await refreshAccessTokenForSocket()
        } catch (error) {
            if (this.isTerminalRefreshError(error)) {
                if (!this.closedByUser) this.expireAuth()
                return
            }

            if (!this.closedByUser) {
                this.reportRecoverableAuthFailure()
                if (this.isTransientRefreshFailure(error)) {
                    this.authRecoveryAttempted = false
                    this.scheduleReconnect()
                }
            }
            return
        }

        if (!this.closedByUser) {
            this.connect()
        }
    }

    private isTerminalRefreshError(error: unknown): boolean {
        const status = this.refreshFailureStatus(error)
        const message = this.refreshFailureMessage(error)
        return status === 401 || (status === 403 && !/origin not allowed/i.test(message))
    }

    private isTransientRefreshFailure(error: unknown): boolean {
        const status = this.refreshFailureStatus(error)
        const retryable = typeof error === 'object'
            && error !== null
            && (error as RefreshFailureShape).retryable === true
        return retryable || status === null || status === 0 || status >= 500
    }

    private refreshFailureStatus(error: unknown): number | null {
        if (typeof error !== 'object' || error === null) return null
        const rawStatus = (error as RefreshFailureShape).status
        const status = typeof rawStatus === 'number' ? rawStatus : Number(rawStatus)
        return Number.isFinite(status) ? status : null
    }

    private refreshFailureMessage(error: unknown): string {
        if (typeof error !== 'object' || error === null) return ''
        const message = (error as RefreshFailureShape).message
        return typeof message === 'string' ? message : ''
    }

    private reportRecoverableAuthFailure(): void {
        this.handlers.onMessage({
            type: 'error',
            message: 'Authentication service is temporarily unavailable. Please try again shortly.',
            category: 'auth_service_unavailable',
        })
    }

    private reportRejectedAfterRefresh(): void {
        this.handlers.onMessage({
            type: 'error',
            message: 'This chat connection was rejected after refreshing your session.',
            category: 'auth',
        })
    }

    private expireAuth(): void {
        if (this.terminalAuthReported) return
        this.terminalAuthReported = true
        const hadReadableAuthState = Boolean(
            localStorage.getItem('magic_worlds:token') || localStorage.getItem('magic_worlds:user')
        )
        localStorage.removeItem('magic_worlds:token')
        localStorage.removeItem('magic_worlds:user')
        if (hadReadableAuthState) {
            window.dispatchEvent(new CustomEvent('auth:expired'))
        }
        this.handlers.onMessage({
            type: 'error',
            message: 'Your session has expired. Please log in again.',
            category: 'auth',
        })
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

/**
 * Back-compat alias. The transport is identical for adventures and 1:1 character
 * chats (same typed envelope); only the `basePath` URL segment differs. Existing
 * imports keep using `AdventureChatSocket`; new code may use `ChatSocket`.
 */
export const AdventureChatSocket = ChatSocket
