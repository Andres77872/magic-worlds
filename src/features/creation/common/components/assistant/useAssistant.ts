/**
 * useAssistant — conversation + streaming state for every assistant kind.
 *
 * The adapter supplies what differs per kind (scope, conversation title, turn
 * body); the hook owns the rest: optimistic user bubble, frame-batched deltas,
 * request-scoped ownership, the CAS snapshot of a bound target, a retry that
 * resumes the same request with its frozen body, and reconciliation after a
 * dropped stream.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { apiService, ApiError } from '@/infrastructure/api'
import { isLlmRequestSpent } from '@/infrastructure/api/llmIntent'
import { llmRecoveryMessage } from '@/features/llmProfiles/llmRecovery'
import { frameBatch } from '@/utils/frameBatch'
import { makeRequestId } from '@/utils/uuid'
import type {
    AssistantChatMessage,
    AssistantConversation,
    AssistantConversationScope,
    AssistantKind,
    AssistantTargetOf,
    AssistantTurnRequest,
} from '@/shared/types/assistant.types'
import { attachAppliedChanges, parseAppliedActions, type AppliedChangeSummary } from './appliedActions'
import {
    conversationKey,
    conversationTargetId,
    scopeTargetId,
    type AssistantAdapter,
    type AssistantBindings,
    type AssistantBoundTarget,
    type AssistantNotice,
    type AssistantStatus,
    type AssistantTurn,
} from './assistantModel'

const DEFAULT_TIMEOUT_MS = 180_000
const META_TIMEOUT_MS = 15_000

export interface UseAssistantOptions<K extends AssistantKind, T extends AssistantTargetOf<K> = AssistantTargetOf<K>> {
    adapter: AssistantAdapter<K>
    binding: AssistantBindings[K]
    /** Applies a target the assistant saved (or the reader chose to apply). */
    onTarget?: (target: T) => void
    isAuthenticated: boolean
    onAuthRequired: () => void
    /** The conversation to open first: a page's deep link, or a panel handed off from the assistant page (opens the panel). */
    initialConversationId?: number | null
    /** Reports the active conversation, e.g. so a page can mirror it into the URL. */
    onActiveConversationChange?: (id: number | null) => void
    timeoutMs?: number
}

export interface UseAssistantResult<T> {
    open: boolean
    openPanel: () => void
    closePanel: () => void
    /** True once the conversation list has been fetched (or failed) for this opening. */
    ready: boolean
    /** The server answered `503 ASSISTANT_DISABLED` for this kind. */
    unavailable: boolean
    /** Asks the server again (reloads the history). */
    recheck: () => void
    status: AssistantStatus
    conversations: AssistantConversation[]
    activeConversation: AssistantConversation | null
    turns: AssistantTurn[]
    notice: AssistantNotice | null
    /** A saved target staged for an explicit Apply (after switching or a manual reload). */
    pendingTarget: T | null
    applyPendingTarget: () => void
    dismissPendingTarget: () => void
    send: (text: string) => Promise<void>
    stop: () => void
    retry: () => void
    newConversation: () => void
    selectConversation: (id: number) => Promise<void>
    deleteConversation: (id: number) => Promise<void>
    reloadConversation: (options?: { applyTarget?: boolean }) => Promise<boolean>
    clearNotice: () => void
}

type RetainedTurn<K extends AssistantKind> = { text: string; requestId: string; body?: AssistantTurnRequest<K>; llm?: ApiError['llmRetry'] }

const STALE_TARGET = 'ASSISTANT_TARGET_SNAPSHOT_STALE'

/** Copy for the assistant's own failure codes; null for codes without one. */
function assistantCodeMessage(code: unknown, t: TFunction): string | null {
    if (code === STALE_TARGET) return t('creation.common.assistant.notices.stale')
    if (code === 'ASSISTANT_CONVERSATION_BUSY') return t('creation.common.assistant.notices.busy')
    return null
}

function assistantErrorMessage(error: unknown, t: TFunction): string {
    const recovery = llmRecoveryMessage(error, t)
    if (recovery) return recovery
    const coded = error instanceof ApiError ? assistantCodeMessage(error.code, t) : null
    if (coded) return coded
    if (error instanceof ApiError) {
        return error.isTransient
            ? t('creation.common.assistant.notices.transient')
            : error.message
    }
    return t('creation.common.assistant.notices.generic')
}

function isAbortError(error: unknown): boolean {
    // DOMException does not extend Error in every runtime.
    if (typeof DOMException !== 'undefined' && error instanceof DOMException) return error.name === 'AbortError'
    return error instanceof Error && error.name === 'AbortError'
}

/** The server switched this assistant kind off: a state of the surface, not an error to dismiss. */
function isAssistantDisabled(error: unknown): boolean {
    return error instanceof ApiError && error.status === 503 && error.code === 'ASSISTANT_DISABLED'
}

/** The saved target a response carries; turns of the app kind have none. */
function targetOf(value: object): unknown {
    return 'target' in value ? value.target : null
}

function appliedActionsOf(turn: object): unknown {
    return 'applied_actions' in turn ? turn.applied_actions : undefined
}

/** The server list, keeping the open conversation listed when the scope no longer includes it. */
function withActive(list: AssistantConversation[], active: AssistantConversation | null): AssistantConversation[] {
    const id = conversationKey(active)
    return !active || !id || list.some((item) => conversationKey(item) === id) ? list : [active, ...list]
}

export function useAssistant<K extends AssistantKind, T extends AssistantTargetOf<K> = AssistantTargetOf<K>>({
    adapter,
    binding,
    onTarget,
    isAuthenticated,
    onAuthRequired,
    initialConversationId = null,
    onActiveConversationChange,
    timeoutMs = DEFAULT_TIMEOUT_MS,
}: UseAssistantOptions<K, T>): UseAssistantResult<T> {
    const { t } = useTranslation()
    const [open, setOpen] = useState(() => initialConversationId != null)
    const [ready, setReady] = useState(false)
    const [unavailable, setUnavailable] = useState(false)
    const [loadAttempt, setLoadAttempt] = useState(0)
    const [rawStatus, setStatus] = useState<AssistantStatus>('idle')
    const [conversations, setConversations] = useState<AssistantConversation[]>([])
    const [activeConversation, setActiveConversationState] = useState<AssistantConversation | null>(null)
    const [messages, setMessages] = useState<AssistantChatMessage[]>([])
    const [notice, setNotice] = useState<AssistantNotice | null>(null)
    const [pendingTarget, setPendingTarget] = useState<T | null>(null)
    const [liveActions, setLiveActions] = useState<Map<number, AppliedChangeSummary[]>>(() => new Map())
    const [streamingMessageId, setStreamingMessageId] = useState<number | null>(null)
    const [interruptedIds, setInterruptedIds] = useState<Set<number>>(() => new Set())

    const { kind, lifecycle } = adapter
    // A page is always open; a panel only while the reader has it open.
    const active = lifecycle === 'page' || open
    const targetId = scopeTargetId(adapter.scope(binding))

    // Prop mirrors so long-lived callbacks always read the latest values.
    const bindingRef = useRef(binding)
    const onTargetRef = useRef(onTarget)
    const onActiveChangeRef = useRef(onActiveConversationChange)
    const tRef = useRef<TFunction>(t)
    useEffect(() => {
        bindingRef.current = binding
        onTargetRef.current = onTarget
        onActiveChangeRef.current = onActiveConversationChange
        tRef.current = t
    })

    // A page lists every assistant's history; a panel only its own scope.
    const listScope = useCallback(
        () => (lifecycle === 'page' ? null : adapter.scope(bindingRef.current)),
        [lifecycle, adapter],
    )

    const activeConversationRef = useRef<AssistantConversation | null>(null)
    const localIdRef = useRef(0)
    const streamControllerRef = useRef<AbortController | null>(null)
    const activeRequestRef = useRef<string | null>(null)
    // Why the running turn was aborted: the reader pressed Stop, or the editor moved to another target.
    const abortReasonRef = useRef<'stopped' | 'target' | null>(null)
    const lastSentRef = useRef<string | null>(null)
    const lastRequestIdRef = useRef<string | null>(null)
    // An unfinished turn's request ID and frozen body; Retry resumes that request instead of starting another.
    const retryRequestRef = useRef<RetainedTurn<K> | null>(null)
    const retryingRef = useRef(false)
    const initialIdRef = useRef(initialConversationId)
    const previousTargetRef = useRef(targetId)

    const nextLocalId = () => {
        localIdRef.current -= 1
        return localIdRef.current
    }

    const turns = useMemo<AssistantTurn[]>(
        () => attachAppliedChanges(messages, liveActions).map((turn) => ({
            ...turn,
            isStreaming: turn.message.message_id === streamingMessageId,
            isInterrupted: interruptedIds.has(turn.message.message_id),
        })),
        [messages, liveActions, streamingMessageId, interruptedIds],
    )

    const setActiveConversation = useCallback((conversation: AssistantConversation | null) => {
        activeConversationRef.current = conversation
        setActiveConversationState(conversation)
        onActiveChangeRef.current?.(conversationKey(conversation))
    }, [])

    const upsertConversation = useCallback((conversation: AssistantConversation) => {
        setConversations((prev) => [
            conversation,
            ...prev.filter((item) => conversationKey(item) !== conversationKey(conversation)),
        ])
    }, [])

    const reportError = useCallback((error: unknown, extra: Partial<AssistantNotice> = {}) => {
        if (isAssistantDisabled(error)) {
            retryRequestRef.current = null
            setUnavailable(true)
            return
        }
        setNotice({ kind: 'error', message: assistantErrorMessage(error, tRef.current), ...extra })
    }, [])

    const resetConversationState = useCallback(() => {
        lastRequestIdRef.current = null
        retryRequestRef.current = null
        setActiveConversation(null)
        setMessages([])
        setPendingTarget(null)
        setLiveActions(new Map())
        setInterruptedIds(new Set())
    }, [setActiveConversation])

    // Load the history when the surface becomes active: a panel on each open
    // (resuming its newest conversation, or the one handed to it), a page once
    // per signed-in session (opening its deep link once). The initial load
    // never stages a target.
    useEffect(() => {
        if (!active || !isAuthenticated) return
        let cancelled = false
        // The composer stays usable during this load; if the reader already
        // started chatting, only refresh the list — never clobber their thread.
        const userIsChatting = () => Boolean(streamControllerRef.current || activeConversationRef.current)
        apiService
            .listAssistantConversations(listScope(), { timeoutMs: META_TIMEOUT_MS })
            .then(async ({ conversations: loaded }) => {
                if (cancelled) return
                setUnavailable(false)
                setConversations(withActive(loaded, activeConversationRef.current))
                const requested = initialIdRef.current
                initialIdRef.current = null
                const id = requested ?? (lifecycle === 'panel' ? conversationKey(loaded[0]) : null)
                if (!id || userIsChatting()) return
                const listedKind = loaded.find((item) => conversationKey(item) === id)?.kind ?? kind
                const detail = await apiService.getAssistantConversation(listedKind, id, { timeoutMs: META_TIMEOUT_MS })
                if (cancelled || userIsChatting()) return
                // A panel only resumes its own kind; the page opens any assistant's conversation.
                if (lifecycle === 'panel' && detail.conversation.kind !== kind) return
                setActiveConversation(detail.conversation)
                setConversations((prev) => withActive(prev, detail.conversation))
                setMessages(detail.messages ?? [])
            })
            .catch((err) => {
                if (!cancelled) reportError(err)
            })
            .finally(() => {
                if (!cancelled) setReady(true)
            })
        return () => {
            cancelled = true
        }
    }, [active, isAuthenticated, loadAttempt, listScope, kind, lifecycle, setActiveConversation, reportError])

    // When the bound target changes, refresh the list for the new scope but keep
    // the conversation the reader is in. A different target supersedes a turn
    // started for the old one (the aborted send resets the thread); a final that
    // binds its own new target updates the conversation first, so it survives.
    useEffect(() => {
        if (previousTargetRef.current === targetId) return
        previousTargetRef.current = targetId
        const controller = streamControllerRef.current
        if (controller && conversationTargetId(activeConversationRef.current) !== targetId) {
            abortReasonRef.current = 'target'
            controller.abort(new DOMException('Assistant target changed', 'AbortError'))
        }
        if (!active || !isAuthenticated) return
        let cancelled = false
        apiService
            .listAssistantConversations(listScope(), { timeoutMs: META_TIMEOUT_MS })
            .then(({ conversations: loaded }) => {
                if (!cancelled) setConversations(withActive(loaded, activeConversationRef.current))
            })
            .catch(() => {
                // Non-fatal: the open conversation keeps working either way.
            })
        return () => {
            cancelled = true
        }
    }, [targetId, active, isAuthenticated, listScope])

    // Abort any in-flight stream on unmount; the server finishes and persists.
    useEffect(() => () => {
        activeRequestRef.current = null
        streamControllerRef.current?.abort(new DOMException('Assistant unmounted', 'AbortError'))
        streamControllerRef.current = null
    }, [])

    const createConversation = useCallback(async (scope: AssistantConversationScope<K>, title: string, signal: AbortSignal): Promise<AssistantConversation> => {
        const response = await apiService.createAssistantConversation<K>({ ...scope, title }, { timeoutMs: META_TIMEOUT_MS, signal })
        // Does NOT touch `messages`: send() may already hold an optimistic user
        // message that must survive the lazy creation.
        signal.throwIfAborted()
        setActiveConversation(response.conversation)
        upsertConversation(response.conversation)
        return response.conversation
    }, [setActiveConversation, upsertConversation])

    const reloadConversation = useCallback(async (options: { applyTarget?: boolean } = {}): Promise<boolean> => {
        const current = activeConversationRef.current
        const id = conversationKey(current)
        if (!current || !id) return false
        const requestId = lastRequestIdRef.current
        const owner = activeRequestRef.current
        try {
            const detail = requestId
                ? await apiService.getAssistantTurn(current.kind, id, requestId, { timeoutMs: META_TIMEOUT_MS })
                : await apiService.getAssistantConversation(current.kind, id, { timeoutMs: META_TIMEOUT_MS })
            if (owner !== activeRequestRef.current || id !== conversationKey(activeConversationRef.current)) return false
            if (!detail) return false
            const lastAssistant = [...(detail.messages ?? [])].reverse().find((message) => message.role === 'assistant')
            const recovered = Boolean(lastAssistant?.status === 'completed'
                && (!requestId || lastAssistant.metadata?.request_id === requestId)
                && !detail.conversation.active_request_id)
            if (requestId && !recovered) {
                console.warn('text_stream_recovery_failed', { requestId, surface: `${current.kind}_assistant` })
                return false
            }
            setActiveConversation(detail.conversation)
            upsertConversation(detail.conversation)
            setMessages(detail.messages ?? [])
            setInterruptedIds(new Set())
            setNotice(null)
            // A dropped stream's own result is applied; a manual reload waits for Apply.
            const target = detail.conversation.kind === kind ? targetOf(detail) as T | null : null
            if (target) {
                if (options.applyTarget) {
                    onTargetRef.current?.(target)
                    setPendingTarget(null)
                } else {
                    setPendingTarget(target)
                }
            }
            return recovered
        } catch (err) {
            if (owner !== activeRequestRef.current || id !== conversationKey(activeConversationRef.current)) return false
            reportError(err, { canReload: true })
            return false
        }
    }, [kind, setActiveConversation, upsertConversation, reportError])

    const send = useCallback(async (rawText: string) => {
        const retrying = retryingRef.current
        retryingRef.current = false
        if (!isAuthenticated) {
            onAuthRequired()
            return
        }
        const text = rawText.trim()
        if (!text || unavailable || streamControllerRef.current) return

        lastSentRef.current = text
        const retryIntent = retrying && retryRequestRef.current?.text === text ? retryRequestRef.current : null
        setNotice(null)
        setStatus('streaming')
        abortReasonRef.current = null

        const optimisticId = nextLocalId()
        const placeholderId = nextLocalId()
        // A linked retry re-asks the question the server kept, without a second bubble.
        setMessages((prev) => retryIntent?.llm ? prev : [
            ...prev,
            {
                message_id: optimisticId,
                conversation_id: conversationKey(activeConversationRef.current) ?? -1,
                sequence_no: prev.length + 1,
                role: 'user',
                status: 'completed',
                content: text,
            },
        ])

        let receivedFinal = false
        let receivedError = false
        let receivedText = false
        let userAcknowledged = false
        const retained = retryIntent && !retryIntent.llm ? retryIntent.requestId : null
        retryRequestRef.current = null
        const requestId = retained ?? makeRequestId(`mw-${kind}-assistant`)
        // Built once the conversation is resolved, then frozen so a retry asks with the same body.
        let turnBody: AssistantTurnRequest<K> | undefined = retryIntent?.body ? structuredClone(retryIntent.body) : undefined
        const keepForRetry = (llm?: ApiError['llmRetry']) => {
            retryRequestRef.current = { text, requestId, ...(turnBody ? { body: structuredClone(turnBody) } : {}), ...(llm ? { llm } : {}) }
        }
        const controller = new AbortController()
        lastRequestIdRef.current = requestId
        activeRequestRef.current = requestId
        streamControllerRef.current = controller
        const updates = frameBatch<string>((chunks) => {
            if (activeRequestRef.current !== requestId) return
            const delta = chunks.join('')
            setStreamingMessageId(placeholderId)
            setMessages((prev) => {
                if (prev.some((message) => message.message_id === placeholderId)) {
                    return prev.map((message) => message.message_id === placeholderId
                        ? { ...message, content: message.content + delta } : message)
                }
                return [...prev, {
                    message_id: placeholderId,
                    conversation_id: conversationKey(activeConversationRef.current) ?? -1,
                    sequence_no: prev.length + 1,
                    role: 'assistant', status: 'pending', content: delta,
                }]
            })
        })

        try {
            // Reuse the open conversation only while it is this kind's and bound to the current target.
            const scope = adapter.scope(bindingRef.current)
            const existing = activeConversationRef.current
            const conversation = existing && existing.kind === kind && conversationTargetId(existing) === scopeTargetId(scope)
                ? existing
                : await createConversation(scope, adapter.title(bindingRef.current, text), controller.signal)
            controller.signal.throwIfAborted()
            if (activeRequestRef.current !== requestId) return
            const id = conversationKey(conversation)
            if (!id) throw new Error('Missing assistant conversation id')
            if (!turnBody) {
                const boundId = conversationTargetId(conversation)
                let bound: AssistantBoundTarget<K> | null = null
                if (boundId) {
                    // Saves, publishes, restores and assistant turns can all advance the
                    // saved snapshot. Fetch it on each send without hydrating the editor
                    // or losing unsaved changes. The server checks these CAS values
                    // before generation and again before committing the result.
                    const detail = await apiService.getAssistantConversation(kind, id, { timeoutMs: META_TIMEOUT_MS, signal: controller.signal })
                    controller.signal.throwIfAborted()
                    if (activeRequestRef.current !== requestId) return
                    if (conversationTargetId(detail.conversation) !== boundId || !detail.target_cas) {
                        throw new Error('Missing assistant target snapshot')
                    }
                    bound = { target: detail.target, cas: detail.target_cas }
                }
                turnBody = adapter.turnBody(bindingRef.current, text, bound)
            }
            await apiService.streamAssistantMessage<K>(
                id,
                turnBody,
                (event) => {
                    if (activeRequestRef.current !== requestId || controller.signal.aborted || (event.request_id && event.request_id !== requestId)) return
                    if (event.type !== 'assistant_delta') updates.flush()
                    if (event.type === 'progress') {
                        setNotice({ kind: 'info', message: tRef.current(`streaming.${event.stage}`) })
                        return
                    }
                    if (event.type === 'user_message') {
                        const acknowledged = event.user_message
                        if (!acknowledged) return
                        userAcknowledged = true
                        setMessages((prev) => {
                            const remaining = prev.filter((message) => message.message_id !== optimisticId)
                            return remaining.some((message) => message.message_id === acknowledged.message_id)
                                ? remaining : [...remaining, acknowledged]
                        })
                        return
                    }
                    if (event.type === 'assistant_delta') {
                        const delta = event.delta || ''
                        if (!delta) return
                        receivedText = true
                        updates.push(delta)
                        return
                    }
                    if (event.type === 'final') {
                        receivedFinal = true
                        setNotice(null)
                        setActiveConversation(event.conversation)
                        upsertConversation(event.conversation)
                        const summaries = parseAppliedActions(appliedActionsOf(event))
                        if (summaries.length) {
                            const assistantId = event.assistant_message.message_id
                            setLiveActions((prev) => new Map(prev).set(assistantId, summaries))
                        }
                        setMessages(event.messages)
                        setStreamingMessageId(null)
                        const target = targetOf(event) as T | null
                        if (target) onTargetRef.current?.(target)
                        return
                    }
                    if (event.type === 'error') {
                        receivedError = true
                        const staleTarget = event.error?.code === STALE_TARGET
                        // A rejected turn has no completed result to recover. Reload
                        // must instead stage the current saved target for review.
                        if (staleTarget) lastRequestIdRef.current = null
                        else if (!isLlmRequestSpent(event.error)) keepForRetry()
                        const message = llmRecoveryMessage(event.error, tRef.current) || assistantCodeMessage(event.error?.code, tRef.current)
                            || event.detail || event.error?.message || tRef.current('creation.common.assistant.notices.generic')
                        setMessages((prev) => prev.some((item) => item.message_id === placeholderId)
                            ? prev.map((item) => item.message_id === placeholderId ? { ...item, status: 'failed' } : item)
                            : [...prev, { message_id: placeholderId, conversation_id: id, sequence_no: prev.length + 1,
                                role: 'assistant', status: 'failed', content: message }])
                        setInterruptedIds((prev) => new Set(prev).add(placeholderId))
                        setStreamingMessageId(null)
                        setNotice({
                            kind: 'error', message,
                            canRetry: !staleTarget && event.error?.retryable !== false,
                            canReload: staleTarget,
                        })
                    }
                },
                { requestId, timeoutMs, signal: controller.signal, ...(retryIntent?.llm ? { llm: retryIntent.llm } : {}) },
            )
            // A stream that resolves after an abort still ends the turn as aborted.
            controller.signal.throwIfAborted()
            if (activeRequestRef.current !== requestId) return
            if (!receivedFinal && !receivedError) {
                // The stream closed without a result. The server may still
                // have persisted the turn — pick up its truth before erroring.
                const recovered = await reloadConversation({ applyTarget: true })
                if (activeRequestRef.current !== requestId) return
                if (!recovered) {
                    keepForRetry()
                    setNotice({
                        kind: 'error',
                        message: tRef.current('creation.common.assistant.notices.streamEnded'),
                        canRetry: true,
                        canReload: true,
                    })
                }
            }
        } catch (err) {
            updates.flush()
            if (activeRequestRef.current !== requestId) return
            if (abortReasonRef.current === 'target') {
                // The editor moved to another target: this thread belongs to the old one.
                resetConversationState()
                return
            }
            if (!userAcknowledged && !receivedText) setMessages((prev) => prev.filter((item) => item.message_id !== optimisticId))
            // A deliberate stop, a stale target, a disabled assistant, or a spent
            // request starts fresh; anything else may still finish.
            const stopped = isAbortError(err) && abortReasonRef.current === 'stopped'
            const stale = err instanceof ApiError && err.code === STALE_TARGET ? err : null
            if (err instanceof ApiError && err.llmRetry) keepForRetry(err.llmRetry)
            else if (!stopped && !stale && !isAssistantDisabled(err) && !isLlmRequestSpent(err)) keepForRetry()
            if (isAbortError(err)) {
                if (stopped) {
                    setInterruptedIds((prev) => new Set(prev).add(placeholderId))
                    setNotice({
                        kind: 'info',
                        message: tRef.current('creation.common.assistant.notices.stopped'),
                        canReload: true,
                    })
                }
                // Otherwise the panel closed/unmounted — nothing to surface.
            } else if (isAssistantDisabled(err)) {
                reportError(err)
            } else if (stale) {
                lastRequestIdRef.current = null
                setNotice({ kind: 'error', message: assistantErrorMessage(stale, tRef.current), canReload: true })
            } else if (err instanceof ApiError && err.status === 409) {
                setInterruptedIds((prev) => new Set(prev).add(placeholderId))
                setNotice({
                    kind: 'error',
                    message: llmRecoveryMessage(err, tRef.current) ?? tRef.current('creation.common.assistant.notices.busy'),
                    canRetry: true,
                    canReload: true,
                })
            } else if (err instanceof ApiError && err.action === 'reload_conversation') {
                if (err.code === 'stream_incomplete' && await reloadConversation({ applyTarget: true })) return
                if (activeRequestRef.current !== requestId) return
                setInterruptedIds((prev) => new Set(prev).add(placeholderId))
                setNotice({ kind: 'error', message: err.message, canReload: true })
            } else {
                setInterruptedIds((prev) => new Set(prev).add(placeholderId))
                setNotice({
                    kind: 'error',
                    message: assistantErrorMessage(err, tRef.current),
                    canRetry: err instanceof ApiError ? err.retryable !== false : true,
                })
            }
        } finally {
            updates.flush()
            updates.cancel()
            if (activeRequestRef.current === requestId) {
                activeRequestRef.current = null
                streamControllerRef.current = null
                abortReasonRef.current = null
                setStreamingMessageId(null)
                setStatus('idle')
            }
        }
    }, [isAuthenticated, onAuthRequired, unavailable, kind, adapter, timeoutMs, createConversation, reloadConversation,
        setActiveConversation, upsertConversation, resetConversationState, reportError])

    const stop = useCallback(() => {
        if (!streamControllerRef.current) return
        abortReasonRef.current = 'stopped'
        streamControllerRef.current.abort(new DOMException('Stopped by user', 'AbortError'))
    }, [])

    const retry = useCallback(() => {
        const text = lastSentRef.current
        if (!text) return
        setNotice(null)
        retryingRef.current = true
        void send(text)
    }, [send])

    const openPanel = useCallback(() => {
        if (!isAuthenticated) {
            onAuthRequired()
            return
        }
        setNotice(null)
        setReady(false)
        setOpen(true)
    }, [isAuthenticated, onAuthRequired])

    const closePanel = useCallback(() => {
        activeRequestRef.current = null
        streamControllerRef.current?.abort(new DOMException('Assistant closed', 'AbortError'))
        streamControllerRef.current = null
        setStreamingMessageId(null)
        setStatus('idle')
        setOpen(false)
    }, [])

    const recheck = useCallback(() => {
        if (streamControllerRef.current) return
        setNotice(null)
        setReady(false)
        setLoadAttempt((attempt) => attempt + 1)
    }, [])

    const newConversation = useCallback(() => {
        if (!isAuthenticated) {
            onAuthRequired()
            return
        }
        if (streamControllerRef.current) return
        setNotice(null)
        resetConversationState()
    }, [isAuthenticated, onAuthRequired, resetConversationState])

    const selectConversation = useCallback(async (id: number) => {
        if (conversationKey(activeConversationRef.current) === id) return
        if (streamControllerRef.current) return
        setNotice(null)
        setStatus('switching')
        const selectionId = makeRequestId(`mw-${kind}-assistant`)
        activeRequestRef.current = selectionId
        try {
            const listedKind = conversations.find((item) => conversationKey(item) === id)?.kind ?? kind
            const detail = await apiService.getAssistantConversation(listedKind, id, { timeoutMs: META_TIMEOUT_MS })
            if (activeRequestRef.current !== selectionId) return
            lastRequestIdRef.current = null
            retryRequestRef.current = null
            setActiveConversation(detail.conversation)
            setMessages(detail.messages ?? [])
            setLiveActions(new Map())
            setInterruptedIds(new Set())
            // Never silently overwrite the editor: surface the snapshot and let
            // the reader choose to apply it. Another assistant's target is not ours.
            setPendingTarget(detail.conversation.kind === kind ? targetOf(detail) as T | null : null)
        } catch (err) {
            if (activeRequestRef.current !== selectionId) return
            reportError(err)
        } finally {
            if (activeRequestRef.current === selectionId) {
                activeRequestRef.current = null
                setStatus('idle')
            }
        }
    }, [kind, conversations, setActiveConversation, reportError])

    const deleteConversation = useCallback(async (id: number) => {
        if (streamControllerRef.current) return
        try {
            const listedKind = conversations.find((item) => conversationKey(item) === id)?.kind ?? kind
            await apiService.deleteAssistantConversation(listedKind, id, { timeoutMs: META_TIMEOUT_MS })
        } catch (err) {
            if (err instanceof ApiError && err.status === 409) {
                setNotice({ kind: 'error', message: tRef.current('creation.common.assistant.notices.deleteBusy') })
            } else {
                reportError(err)
            }
            return
        }
        setConversations((prev) => prev.filter((item) => conversationKey(item) !== id))
        if (conversationKey(activeConversationRef.current) === id) resetConversationState()
    }, [kind, conversations, reportError, resetConversationState])

    const applyPendingTarget = useCallback(() => {
        if (!pendingTarget) return
        onTargetRef.current?.(pendingTarget)
        setPendingTarget(null)
    }, [pendingTarget])

    const dismissPendingTarget = useCallback(() => {
        setPendingTarget(null)
    }, [])

    const clearNotice = useCallback(() => {
        setNotice(null)
    }, [])

    // Until the history arrives the thread is "initializing", unless the reader already started typing.
    const status: AssistantStatus = rawStatus === 'idle' && isAuthenticated && active && !ready ? 'initializing' : rawStatus

    return {
        open: active,
        openPanel,
        closePanel,
        ready,
        unavailable,
        recheck,
        status,
        conversations,
        activeConversation,
        turns,
        notice,
        pendingTarget,
        applyPendingTarget,
        dismissPendingTarget,
        send,
        stop,
        retry,
        newConversation,
        selectConversation,
        deleteConversation,
        reloadConversation,
        clearNotice,
    }
}
