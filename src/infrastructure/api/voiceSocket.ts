/**
 * VoiceSocket — per-character-chat WebSocket transport for live voice calls.
 *
 * This is intentionally separate from ChatSocket. It carries voice lifecycle,
 * transcript/status, barge-in controls, and assistant MP3 chunks; microphone
 * bytes are uploaded through the HTTP voice-segments route instead.
 *
 * After `voice_ready`, an abnormal close does not end the call: the server keeps
 * it alive for a short grace period, so the socket reconnects with
 * `voice_resume` until `voice_state_snapshot` confirms the call is back, and only
 * gives up once RESUME_WINDOW_MS has passed.
 */

import type { VoiceErrorCategory, VoiceSocketClientFrame, VoiceSocketServerFrame } from '../../shared/types/voice.types'
import { API_BASE_URL } from './baseUrl'
import { authSession, type AuthSessionSnapshot } from './authSession'
import { isWorkspaceUuid } from './workspaceContract'

const WS_BEARER_SUBPROTOCOL = 'mw.bearer.v1'
const HEARTBEAT_MS = 25_000
const LIVENESS_TIMEOUT_MS = HEARTBEAT_MS * 2
const MAX_RECONNECT_MS = 30_000
/** Must stay below the server's VOICE_RESUME_GRACE_SECONDS (20 s). */
const RESUME_WINDOW_MS = 15_000
const MAX_RESUME_BACKOFF_MS = 4_000

/** Stable, greppable code for a voice error category — mirrors the backend `VOICE_<CATEGORY>`. */
export function voiceErrorCode(category: string): string {
    return `VOICE_${category.toUpperCase()}`
}

/** Human label for a WS close code, for traceable logs. */
function voiceCloseLabel(code: number): string {
    switch (code) {
        case 1000:
            return 'NORMAL'
        case 4401:
            return 'AUTH'
        case 4403:
            return 'ORIGIN'
        case 4408:
            return 'NOT_ADMITTED'
        default:
            return 'ABNORMAL'
    }
}

const SERVER_FRAME_TYPES = new Set([
    'voice_ready',
    'voice_state_snapshot',
    'voice_status',
    'voice_segment_ack',
    'transcript_final',
    'voice_turn_start',
    'voice_assistant_delta',
    'voice_audio_chunk',
    'voice_audio_final',
    'voice_turn_end',
    'voice_cancelled',
    'voice_error',
    'voice_ended',
    'voice_pong',
])

const FORBIDDEN_CLIENT_PAYLOAD_KEYS = new Set([
    'raw_audio',
    'audio_bytes',
    'audio_blob',
    'audio_base64',
    'audio_b64',
    'audio_hex',
    'hex_audio',
    'data_b64',
    'provider_url',
    'provider_key',
    'authorization',
    'api_key',
    'access_token',
    'bearer_token',
])

let refreshAccessTokenForVoiceSocket: (() => Promise<string>) | null = null

type RefreshFailureShape = {
    status?: unknown
    message?: unknown
    retryable?: unknown
}

type VoiceStartFrame = Extract<VoiceSocketClientFrame, { type: 'voice_start' }>
type VoiceResumeFrame = Extract<VoiceSocketClientFrame, { type: 'voice_resume' }>
type VoiceBargeInFrame = Extract<VoiceSocketClientFrame, { type: 'voice_barge_in' }>

export type VoiceSocketStatus = 'connecting' | 'open' | 'closed'

export interface VoiceSocketHandlers {
    onMessage: (message: VoiceSocketServerFrame) => void
    onStatusChange?: (status: VoiceSocketStatus) => void
}

export function configureVoiceSocketAuthRefresh(handler: (() => Promise<string>) | null): void {
    refreshAccessTokenForVoiceSocket = handler
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

function turnKey(voiceSessionId: string, turnId: string): string {
    return `${voiceSessionId}:${turnId}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}

function containsForbiddenClientPayload(value: unknown, seen = new Set<unknown>()): boolean {
    if (!isRecord(value)) return false
    if (seen.has(value)) return false
    seen.add(value)
    if (typeof Blob !== 'undefined' && value instanceof Blob) return true
    if (value instanceof ArrayBuffer) return true
    if (ArrayBuffer.isView(value)) return true
    for (const [key, nested] of Object.entries(value)) {
        if (FORBIDDEN_CLIENT_PAYLOAD_KEYS.has(key.toLowerCase())) return true
        if (containsForbiddenClientPayload(nested, seen)) return true
    }
    return false
}

export class VoiceSocket {
    private ws: WebSocket | null = null
    private readonly sessionId: number
    private readonly workspaceId: string
    private readonly handlers: VoiceSocketHandlers
    private readonly basePath: string
    private heartbeat: ReturnType<typeof setInterval> | null = null
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null
    private reconnectAttempts = 0
    private closedByUser = false
    private authRecoveryAttempted = false
    private terminalAuthReported = false
    private lastFrameAt = 0
    private socketOwner: Pick<AuthSessionSnapshot, 'authEpoch' | 'accountKey' | 'userHash'> | null = null
    private startFrame: VoiceStartFrame | null = null
    private voiceSessionId: string | null = null
    private lastSegmentSeq = 0
    /** Set while a post-ready connection is being resumed; the deadline ends the call. */
    private resumeDeadline: number | null = null
    private readonly cancelledTurns = new Set<string>()
    private readonly highestAudioSeqByTurn = new Map<string, number>()

    /** `workspaceId` is the caller's captured workspace, sent as the `workspace_id` query (Workspace R1). */
    constructor(sessionId: number, workspaceId: string, handlers: VoiceSocketHandlers, basePath: string = 'character-chats') {
        if (!isWorkspaceUuid(workspaceId)) throw new Error('A voice socket needs a lowercase workspace UUID.')
        this.sessionId = sessionId
        this.workspaceId = workspaceId
        this.handlers = handlers
        this.basePath = basePath
    }

    connect(startFrame?: VoiceStartFrame): void {
        if (startFrame) {
            // A new start is a new call: forget the previous call's identity so the
            // handshake is `voice_start`, never a `voice_resume` of an ended call.
            this.startFrame = startFrame
            this.voiceSessionId = null
            this.lastSegmentSeq = 0
            this.resumeDeadline = null
            this.reconnectAttempts = 0
            this.authRecoveryAttempted = false
            this.terminalAuthReported = false
            this.cancelledTurns.clear()
            this.highestAudioSeqByTurn.clear()
        }
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer)
            this.reconnectTimer = null
        }
        this.closedByUser = false
        this.openSocket()
    }

    /** Highest segment seq the client has uploaded; sent in `voice_resume`. */
    noteSegmentSeq(seq: number): void {
        if (Number.isInteger(seq) && seq > this.lastSegmentSeq) this.lastSegmentSeq = seq
    }

    get isResuming(): boolean {
        return this.resumeDeadline !== null
    }

    sendBargeIn(frame: VoiceBargeInFrame): boolean {
        return this.sendFrame(frame)
    }

    end(): boolean {
        if (!this.voiceSessionId) return false
        const sent = this.sendFrame({ type: 'voice_end', reason: 'user' })
        this.closedByUser = true
        return sent
    }

    ping(): boolean {
        return this.sendFrame({ type: 'voice_ping', voice_session_id: this.voiceSessionId ?? undefined })
    }

    sendFrame(frame: VoiceSocketClientFrame): boolean {
        if (containsForbiddenClientPayload(frame)) {
            this.emitError('unsupported_media', 'Voice control frames cannot include raw audio or provider payloads.', false)
            return false
        }
        if (!this.isOpen) return false
        this.ws!.send(JSON.stringify(frame))
        return true
    }

    close(code = 1000): void {
        this.closedByUser = true
        this.resumeDeadline = null
        this.stopHeartbeat()
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer)
            this.reconnectTimer = null
        }
        if (this.ws) {
            this.detach(this.ws)
            try {
                this.ws.close(code)
            } catch {
                // ignore
            }
            this.ws = null
        }
        this.setStatus('closed')
    }

    get isOpen(): boolean {
        return this.ws?.readyState === WebSocket.OPEN
    }

    private openSocket(): void {
        const token = getStoredToken()
        if (!token) {
            this.setStatus('closed')
            return
        }
        this.socketOwner = authSession.getSnapshot()

        this.setStatus('connecting')
        const url = `${toWsUrl(API_BASE_URL)}/${this.basePath}/${this.sessionId}/ws-voice?workspace_id=${encodeURIComponent(this.workspaceId)}`
        let ws: WebSocket
        try {
            ws = new WebSocket(url, [WS_BEARER_SUBPROTOCOL, token])
        } catch {
            this.reconnectAfterFailure()
            return
        }

        this.detach(this.ws)
        this.ws = ws
        let opened = false

        ws.onopen = () => {
            if (this.ws !== ws) return
            if (!this.isSocketOwnerCurrent()) {
                this.retireSocket()
                return
            }
            opened = true
            if (!this.isResuming) this.reconnectAttempts = 0
            this.lastFrameAt = Date.now()
            this.setStatus('open')
            this.startHeartbeat()
            const handshake = this.buildHandshakeFrame()
            if (handshake) this.sendFrame(handshake)
        }

        ws.onmessage = (event) => {
            if (this.ws !== ws) return
            if (!this.isSocketOwnerCurrent()) {
                this.retireSocket()
                return
            }
            this.handleIncoming(event.data)
        }

        ws.onclose = (event) => {
            if (this.ws !== ws) return
            this.stopHeartbeat()
            this.ws = null
            this.setStatus('closed')

            const label = voiceCloseLabel(event.code)
            // Quiet for clean/user closes; warn on abnormal closes for tracing.
            if (event.code !== 1000 && !this.closedByUser) {
                console.warn(`[voice-call][CLOSE_${label}_${event.code}] voice socket closed`, { voiceSessionId: this.voiceSessionId })
            }

            if (event.code === 4401) {
                if (!this.isSocketOwnerCurrent()) return
                // Before ready, or while resuming, the token may simply have expired:
                // refresh once and reconnect (a resume keeps the same call).
                if (!this.voiceSessionId || this.isResuming) {
                    void this.recoverFromAuthClose()
                } else {
                    this.emitError('auth', 'The voice connection ended after authentication changed. Start a new call.', true)
                }
                return
            }

            if (event.code === 4403) {
                this.resumeDeadline = null
                this.emitError('auth', 'Voice connection was rejected by the origin policy.', true)
                return
            }

            if (event.code === 4408) {
                // The server also sent a typed voice_error frame (with its real category/code/
                // message) just before this close; this is the fallback if that didn't arrive.
                this.resumeDeadline = null
                this.emitError('busy', 'The call could not start. Please try again.', true)
                return
            }

            if (!this.closedByUser && event.code !== 1000) {
                if (this.voiceSessionId) {
                    this.beginResume()
                } else if (!opened && event.code === 1006 && !this.authRecoveryAttempted && refreshAccessTokenForVoiceSocket) {
                    // A rejected handshake (expired token, older servers closing before
                    // accept) reaches the browser as a bare 1006: refresh once first.
                    void this.recoverFromAuthClose()
                } else {
                    this.scheduleReconnect()
                }
            }
        }

        ws.onerror = () => {}
    }

    private buildHandshakeFrame(): VoiceStartFrame | VoiceResumeFrame | null {
        if (this.voiceSessionId) {
            return { type: 'voice_resume', voice_session_id: this.voiceSessionId, last_segment_seq: this.lastSegmentSeq }
        }
        return this.startFrame
    }

    private reconnectAfterFailure(): void {
        if (this.voiceSessionId) this.beginResume()
        else this.scheduleReconnect()
    }

    /** Keep a post-ready call alive across a dropped connection (server grace period). */
    private beginResume(): void {
        if (this.closedByUser || !this.voiceSessionId) return
        if (this.resumeDeadline === null) {
            this.resumeDeadline = Date.now() + RESUME_WINDOW_MS
            this.reconnectAttempts = 0
            console.warn('[voice-call][RESUMING] voice socket dropped; resuming the call', { voiceSessionId: this.voiceSessionId })
        }
        if (Date.now() >= this.resumeDeadline) {
            this.resumeDeadline = null
            this.closedByUser = true
            this.emitError('internal', 'The voice connection was lost. Start a new call.', true, 'VOICE_CONNECTION_LOST')
            return
        }
        this.scheduleReconnect(MAX_RESUME_BACKOFF_MS, 500)
    }

    private handleIncoming(data: unknown): void {
        if (typeof data !== 'string') return
        let parsed: unknown
        try {
            parsed = JSON.parse(data)
        } catch {
            return
        }
        if (!isRecord(parsed) || typeof parsed.type !== 'string' || !SERVER_FRAME_TYPES.has(parsed.type)) return

        const message = parsed as VoiceSocketServerFrame
        this.lastFrameAt = Date.now()
        if (this.shouldDropStaleFrame(message)) return
        this.trackServerFrame(message)
        // The server announces a rejected token with a typed frame and then closes 4401.
        // The close owns the outcome (refresh-and-retry, or a terminal auth error), so the
        // frame must not reach the call first and tear it down mid-recovery.
        if (message.type === 'voice_error' && message.category === 'auth' && message.code === 'auth_required') return
        if (message.type === 'voice_error') {
            const code = message.code || voiceErrorCode(message.category)
            console.error(`[voice-call][${code}] ${message.message}`, { category: message.category, fatal: message.fatal === true, voiceSessionId: this.voiceSessionId })
        }
        this.handlers.onMessage(message)
    }

    private shouldDropStaleFrame(message: VoiceSocketServerFrame): boolean {
        if (message.type === 'voice_assistant_delta') {
            return message.voice_session_id !== this.voiceSessionId || this.cancelledTurns.has(turnKey(message.voice_session_id, message.turn_id))
        }
        if (message.type === 'voice_audio_chunk') {
            const key = turnKey(message.voice_session_id, message.turn_id)
            if (this.cancelledTurns.has(key)) return true
            const highest = this.highestAudioSeqByTurn.get(key) ?? 0
            return message.seq <= highest
        }
        if (message.type === 'voice_audio_final' || message.type === 'voice_turn_end') {
            const key = turnKey(message.voice_session_id, message.turn_id)
            return this.cancelledTurns.has(key) && message.type === 'voice_audio_final'
        }
        return false
    }

    private trackServerFrame(message: VoiceSocketServerFrame): void {
        switch (message.type) {
            case 'voice_ready':
                this.voiceSessionId = message.voice_session_id
                this.authRecoveryAttempted = false
                break
            case 'voice_state_snapshot':
                this.voiceSessionId = message.voice_session_id
                this.resumeDeadline = null
                this.reconnectAttempts = 0
                this.authRecoveryAttempted = false
                break
            case 'voice_segment_ack':
                break
            case 'voice_audio_chunk': {
                const key = turnKey(message.voice_session_id, message.turn_id)
                this.highestAudioSeqByTurn.set(key, message.seq)
                break
            }
            case 'voice_audio_final':
                break
            case 'voice_cancelled':
                if (message.turn_id) this.cancelledTurns.add(turnKey(message.voice_session_id, message.turn_id))
                break
            case 'voice_turn_end':
                if (message.status !== 'completed') this.cancelledTurns.add(turnKey(message.voice_session_id, message.turn_id))
                break
        }
    }

    private detach(ws: WebSocket | null): void {
        if (!ws) return
        ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null
    }

    private async recoverFromAuthClose(): Promise<void> {
        if (this.closedByUser) return
        if (!this.isSocketOwnerCurrent()) return
        if (!refreshAccessTokenForVoiceSocket) {
            this.expireAuth()
            return
        }
        if (this.authRecoveryAttempted) {
            this.reportRejectedAfterRefresh()
            return
        }

        this.authRecoveryAttempted = true
        try {
            await refreshAccessTokenForVoiceSocket()
        } catch (error) {
            if (this.isTerminalRefreshError(error)) {
                if (!this.closedByUser) this.expireAuth()
                return
            }

            if (!this.closedByUser) {
                this.emitError('auth', 'Authentication service is temporarily unavailable. Please try again shortly.', false)
                if (this.isTransientRefreshFailure(error)) {
                    this.authRecoveryAttempted = false
                    this.reconnectAfterFailure()
                }
            }
            return
        }

        if (!this.closedByUser) this.openSocket()
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

    private reportRejectedAfterRefresh(): void {
        this.emitError('auth', 'This voice connection was rejected after refreshing your session.', true)
    }

    private expireAuth(): void {
        if (this.terminalAuthReported) return
        this.terminalAuthReported = true
        const hadReadableAuthState = Boolean(
            localStorage.getItem('magic_worlds:token') || localStorage.getItem('magic_worlds:user')
        )
        authSession.expire()
        localStorage.removeItem('magic_worlds:user')
        if (hadReadableAuthState) window.dispatchEvent(new CustomEvent('auth:expired'))
        this.emitError('auth', 'Your session has expired. Please log in again.', true)
    }

    private emitError(category: VoiceErrorCategory, message: string, fatal: boolean, code = voiceErrorCode(category)): void {
        console.error(`[voice-call][${code}] ${message}`, { category, fatal, voiceSessionId: this.voiceSessionId })
        this.handlers.onMessage({ type: 'voice_error', category, code, message, fatal })
    }

    private setStatus(status: VoiceSocketStatus): void {
        this.handlers.onStatusChange?.(status)
    }

    private startHeartbeat(): void {
        this.stopHeartbeat()
        this.heartbeat = setInterval(() => {
            if (!this.isOpen) return
            if (Date.now() - this.lastFrameAt >= LIVENESS_TIMEOUT_MS) {
                // A silently dead connection (no pong): drop it and reconnect —
                // resuming the call when one is established.
                this.retireSocket()
                if (this.voiceSessionId) this.beginResume()
                else if (!this.closedByUser) this.scheduleReconnect()
                return
            }
            this.ping()
        }, HEARTBEAT_MS)
    }

    private retireSocket(): void {
        this.stopHeartbeat()
        const ws = this.ws
        this.detach(ws)
        try {
            ws?.close()
        } catch {
            // ignore
        }
        this.ws = null
        this.setStatus('closed')
    }

    private isSocketOwnerCurrent(): boolean {
        return this.socketOwner !== null && authSession.isCurrent(this.socketOwner)
    }

    private stopHeartbeat(): void {
        if (this.heartbeat) {
            clearInterval(this.heartbeat)
            this.heartbeat = null
        }
    }

    private scheduleReconnect(maxDelayMs = MAX_RECONNECT_MS, baseDelayMs = 1_000): void {
        if (this.closedByUser || this.reconnectTimer) return
        const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** this.reconnectAttempts)
        this.reconnectAttempts += 1
        this.setStatus('connecting')
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null
            this.openSocket()
        }, delay)
    }
}
