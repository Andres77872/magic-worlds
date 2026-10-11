import { useEffect, useRef, useState } from 'react'
import type { ChatSocketServerMessage, ForwardOption } from '../../../shared'
import { apiService, ChatSocket, type ChatSocketStatus } from '../../../infrastructure/api'
import { authSession } from '@/infrastructure/api/authSession'
import { prepareLlmDispatch } from '@/infrastructure/api/llmPreparation'
import { isLlmRequestSpent, llmIntents } from '@/infrastructure/api/llmIntent'
import type { LlmFeature, LlmRequest } from '@/shared/types/llm.types'
import { generateUUID } from '@/utils/uuid'
import { i18n } from '@/app/i18n'

function bindPreparedTarget(materialize: () => LlmRequest, target: NonNullable<AdventureChatSocketErrorDetail['llmRetry']>): LlmRequest {
    const value = materialize()
    if (target.expected_revision_id && value.expected_revision_id !== target.expected_revision_id
        || value.credentials && !target.expected_revision_id
        || target.selection?.mode === 'profile' && (value.selection?.mode !== 'profile' || value.selection.profile_id !== target.selection.profile_id)) {
        delete value.credentials
        throw new Error('LLM_EXECUTION_INTENT_CHANGED')
    }
    return { selection: target.selection ? { ...target.selection } : { mode: 'inherit' },
        ...(target.expected_revision_id ? { expected_revision_id: target.expected_revision_id } : {}),
        ...(target.retry_of_execution_id ? { retry_of_execution_id: target.retry_of_execution_id } : {}),
        ...(value.credentials ? { credentials: value.credentials } : {}) }
}

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
    /** Stable server code (e.g. `LLM_EXECUTION_RECOVERY_REQUIRED`) when the turn was rejected or needs recovery. */
    code?: string
    requestId?: string
    turnId?: string
    retryPending?: boolean
    llmRetry?: Pick<LlmRequest, 'retry_of_execution_id' | 'selection' | 'expected_revision_id'>
}

export interface AdventureChatSocketApi {
    status: ChatSocketStatus
    /** Sending a request ID again resumes that turn with the target it first froze. */
    sendChat: (content: string, requestId?: string, existingUserMessageId?: number, llmRetry?: AdventureChatSocketErrorDetail['llmRetry'], resumeExisting?: boolean) => void
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
    feature: LlmFeature = basePath === 'adventure-sessions' ? 'chat_adventure' : 'chat_character',
): AdventureChatSocketApi {
    const handlersRef = useRef(handlers)
    useEffect(() => {
        handlersRef.current = handlers
    })

    const socketRef = useRef<ChatSocket | null>(null)
    const requestRef = useRef<string | undefined>(undefined)
    const preparation = useRef<AbortController | null>(null)
    const preparing = useRef(false)
    // The frame of the turn in flight, so a key the server asks for can resend it unchanged.
    const turnRef = useRef<{ requestId: string; content: string; existingUserMessageId?: number; keyed: boolean; target?: LlmRequest; turnId?: string } | null>(null)
    const [status, setStatus] = useState<ChatSocketStatus>('closed')
    const intentKey = (id: string) => JSON.stringify([basePath, sessionId, id])

    // Dispatch one frame; `check` vets the materialized target (with any key) before it leaves.
    const dispatch = (socket: ChatSocket, turn: NonNullable<typeof turnRef.current>, materialize: () => LlmRequest, check?: (llm: LlmRequest) => void) =>
        socket.sendChat(turn.content, turn.requestId, turn.existingUserMessageId, () => {
            const llm = materialize()
            check?.(llm)
            llmIntents.retain(feature, intentKey(turn.requestId), llm)
            turn.target = { selection: llm.selection ? { ...llm.selection } : { mode: 'inherit' },
                ...(llm.expected_revision_id ? { expected_revision_id: llm.expected_revision_id } : {}),
                ...(llm.retry_of_execution_id ? { retry_of_execution_id: llm.retry_of_execution_id } : {}) }
            turn.keyed = Boolean(llm.credentials)
            return llm
        })

    const prepare = (socket: ChatSocket | null, id: string, run: (signal: AbortSignal) => Promise<(() => void) | null>) => {
        preparation.current?.abort()
        const controller = new AbortController()
        preparation.current = controller
        preparing.current = true
        void run(controller.signal).then(send => {
            if (preparation.current === controller) preparing.current = false
            if (send && socket && socketRef.current === socket && !controller.signal.aborted) send()
        }).catch(failure => {
            if (preparation.current === controller) preparing.current = false
            if (controller.signal.aborted || socket !== socketRef.current) return
            if (failure instanceof DOMException && failure.name === 'AbortError') handlersRef.current.onDone?.({ interrupted: true })
            else if (failure instanceof Error && failure.message === 'LLM_EXECUTION_INTENT_CHANGED') {
                llmIntents.settle(feature, intentKey(id))
                handlersRef.current.onError?.(i18n.t('llmProfiles.recovery.LLM_EXECUTION_INTENT_CHANGED'), { category: 'conflict', code: 'LLM_EXECUTION_INTENT_CHANGED', requestId: id })
            } else handlersRef.current.onError?.(i18n.t('llmProfiles.failed'), { category: 'request', requestId: id })
        })
    }

    // A resumed turn went out without a key and the server needs one to run it:
    // ask for it, but only send it for the same profile revision.
    const resendWithKey = (socket: ChatSocket, requestId: string | undefined): boolean => {
        const turn = turnRef.current
        const target = turn && requestId === turn.requestId && !turn.keyed ? llmIntents.retained(feature, intentKey(turn.requestId)) : null
        if (!turn || !target?.expected_revision_id) return false
        const matches = (llm: LlmRequest) => {
            if (llm.credentials && llmIntents.matches(target, llm)) return
            delete llm.credentials
            throw new Error('LLM_EXECUTION_INTENT_CHANGED')
        }
        prepare(socket, turn.requestId, async signal => {
            const prepared = await prepareLlmDispatch(feature, signal, target.selection, target.retry_of_execution_id, turn.requestId)
            const materialize = () => bindPreparedTarget(prepared, target)
            const probe = materialize()
            try { matches(probe) } finally { delete probe.credentials }
            return () => dispatch(socket, turn, materialize, matches)
        })
        return true
    }

    const confirmTerminal = (socket: ChatSocket, message: string, detail: AdventureChatSocketErrorDetail) => {
        const turn = turnRef.current
        const target = turn?.target
        if (!turn || !target || detail.requestId !== turn.requestId
            || (basePath !== 'adventure-sessions' && basePath !== 'character-chats') || sessionId === null) return false
        const owner = authSession.getSnapshot()
        const signal = preparation.current?.signal
        handlersRef.current.onError?.(message, { ...detail, retryPending: true })
        void apiService.reconcileChatTurn(basePath, sessionId, turn.requestId, signal).then(state => {
            if (signal?.aborted || turnRef.current !== turn || socketRef.current !== socket || !authSession.isCurrent(owner)) return
            const original = state.dispatch
            const terminal = ['failed', 'cancelled'].includes(state.status) && state.recovery_required && original
                && original.content === turn.content && (original.existing_user_message_id ?? undefined) === turn.existingUserMessageId
                && (!turn.turnId || state.execution_id === turn.turnId)
            handlersRef.current.onError?.(message, { ...detail, retryPending: false,
                ...(terminal ? { llmRetry: { retry_of_execution_id: state.execution_id,
                    selection: original!.llm.selection ? { ...original!.llm.selection } : { mode: 'inherit' },
                    ...(original!.llm.expected_revision_id ? { expected_revision_id: original!.llm.expected_revision_id } : {}) } } : {}) })
        }).catch(() => {
            if (!signal?.aborted && turnRef.current === turn && socketRef.current === socket && authSession.isCurrent(owner)) {
                handlersRef.current.onError?.(message, { ...detail, retryPending: false })
            }
        })
        return true
    }

    // The socket effect outlives renders; it reads the current feature and resend through this ref.
    const latest = useRef({ feature, resendWithKey, confirmTerminal, intentKey })
    useEffect(() => {
        latest.current = { feature, resendWithKey, confirmTerminal, intentKey }
    })

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
                        if (message.execution_attempt || turnRef.current?.target?.retry_of_execution_id) {
                            const attempt = message.execution_attempt
                            if (!attempt || Object.keys(attempt).sort().join(',') !== 'accepted_conversation_version,parent_execution_id,user_message_id'
                                || attempt.parent_execution_id !== turnRef.current?.target?.retry_of_execution_id
                                || attempt.user_message_id !== message.user_message_id || !Number.isSafeInteger(attempt.user_message_id) || attempt.user_message_id < 1
                                || !Number.isSafeInteger(attempt.accepted_conversation_version) || attempt.accepted_conversation_version < 1) {
                                requestRef.current = undefined
                                current.onError?.(i18n.t('llmProfiles.failed'), { category: 'upstream_contract', code: 'CHAT_EXECUTION_RECORD_INVALID', requestId: message.request_id })
                                break
                            }
                        }
                        if (turnRef.current && message.request_id === turnRef.current.requestId) turnRef.current.turnId = message.turn_id
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
                        // Completed or stopped, the request is spent. `interrupted` only
                        // answers this client's own cancel, after the server settled the
                        // turn: nothing to recover, and no dropped connection to report.
                        if (message.request_id) llmIntents.settle(latest.current.feature, latest.current.intentKey(message.request_id))
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
                        if (message.code === 'BYOK_CREDENTIAL_REQUIRED' && latest.current.resendWithKey(socket, message.request_id)) break
                        if (['LLM_EXECUTION_UPSTREAM_FAILED', 'LLM_EXECUTION_FINISHED'].includes(message.code || '') && turnRef.current?.target) {
                            // The request is spent either way; a linked retry reads the turn's own target.
                            if (message.request_id) llmIntents.settle(latest.current.feature, latest.current.intentKey(message.request_id))
                            if (latest.current.confirmTerminal(socket, message.message, { category: message.category, code: message.code,
                                requestId: message.request_id, turnId: message.turn_id })) break
                        }
                        if (message.request_id && isLlmRequestSpent(message)) llmIntents.settle(latest.current.feature, latest.current.intentKey(message.request_id))
                        current.onError?.(message.message, {
                            category: message.category,
                            code: message.code,
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
            preparation.current?.abort()
            preparation.current = null
            socket.close()
            socketRef.current = null
            turnRef.current = null
            requestRef.current = undefined
        }
        // basePath in deps so switching session kinds tears down + reconnects cleanly.
    }, [sessionId, authDisabled, basePath])

    const sendChat = (content: string, requestId?: string, existingUserMessageId?: number, llmRetry?: AdventureChatSocketErrorDetail['llmRetry'], resumeExisting = false) => {
        const socket = socketRef.current
        const id = requestId ?? generateUUID()
        const previous = turnRef.current
        if (previous?.requestId === id && (previous.content !== content || previous.existingUserMessageId !== existingUserMessageId)) {
            handlersRef.current.onError?.(i18n.t('llmProfiles.recovery.LLM_EXECUTION_INTENT_CHANGED'), {
                category: 'conflict', code: 'LLM_EXECUTION_INTENT_CHANGED', requestId: id })
            return
        }
        requestRef.current = id
        const turn = { requestId: id, content, existingUserMessageId, keyed: false }
        turnRef.current = turn
        // A request already admitted must resend exactly the target it froze, without a key first.
        const frozen = llmIntents.retained(feature, intentKey(id)) ?? (previous?.requestId === id ? previous.target : undefined)
        prepare(socket, id, async signal => {
            const retained = frozen ?? (resumeExisting || !llmRetry?.retry_of_execution_id ? llmRetry : undefined)
            const prepared = retained ? () => ({ ...retained, selection: retained.selection ? { ...retained.selection } : { mode: 'inherit' as const } })
                : await prepareLlmDispatch(feature, signal, llmRetry?.selection, llmRetry?.retry_of_execution_id)
            const materialize = llmRetry?.retry_of_execution_id && !retained ? () => bindPreparedTarget(prepared, llmRetry) : prepared
            return () => { if (socket) dispatch(socket, turn, materialize) }
        })
    }
    const sendTts = (assistantMessageId: number, turnId: string, requestId?: string) =>
        socketRef.current?.sendTts(assistantMessageId, turnId, requestId)
    const cancel = () => {
        const wasPreparing = preparing.current
        preparing.current = false
        preparation.current?.abort()
        if (wasPreparing) handlersRef.current.onDone?.({ interrupted: true })
        else socketRef.current?.cancel()
    }

    return { status, sendChat, sendTts, cancel }
}
