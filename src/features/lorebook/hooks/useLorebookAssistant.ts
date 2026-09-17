import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiService, ApiError } from '@/infrastructure/api'
import { frameBatch } from '@/utils/frameBatch'
import { makeRequestId } from '@/utils/uuid'
import type {
    Lorebook,
    LorebookAssistantConversation,
    LorebookAssistantMessage,
} from '@/shared/types/lorebook.types'
import {
    attachAppliedChanges,
    parseAppliedActions,
    type AppliedChangeSummary,
    type AssistantTurnBase,
} from '@/features/creation/common/components/assistant/appliedActions'
import {
    conversationKey,
    type AssistantNotice,
    type AssistantStatus,
} from '@/features/creation/common/components/assistant/useCardAssistant'
import { lorebookToApiPayload } from '../lorebookTransforms'

const DEFAULT_TIMEOUT_MS = 180_000
const META_TIMEOUT_MS = 15_000

export interface LorebookAssistantTurn extends AssistantTurnBase<LorebookAssistantMessage> {
    isStreaming: boolean
    isInterrupted: boolean
}

export interface UseLorebookAssistantOptions {
    lorebookId?: string | null
    title: string
    currentLorebook: Record<string, unknown>
    onLorebook: (lorebook: Lorebook) => void
    isAuthenticated: boolean
    onAuthRequired: () => void
    timeoutMs?: number
}

export interface UseLorebookAssistantResult {
    open: boolean
    status: AssistantStatus
    conversations: LorebookAssistantConversation[]
    activeConversation: LorebookAssistantConversation | null
    turns: LorebookAssistantTurn[]
    notice: AssistantNotice | null
    pendingLorebook: Lorebook | null
    openPanel: () => void
    closePanel: () => void
    send: (text: string) => Promise<void>
    stop: () => void
    retry: () => void
    newConversation: () => void
    selectConversation: (id: number) => Promise<void>
    deleteConversation: (id: number) => Promise<void>
    applyPendingLorebook: () => void
    dismissPendingLorebook: () => void
    reloadConversation: () => Promise<boolean>
    clearNotice: () => void
}

function createRequestId(): string {
    return makeRequestId('mw-lorebook-assistant')
}

function assistantErrorMessage(error: unknown, t: TFunction): string {
    if (error instanceof ApiError) {
        return error.isTransient
            ? t('creation.common.assistant.notices.transient')
            : error.message
    }
    return t('creation.common.assistant.notices.generic')
}

function isAbortError(error: unknown): boolean {
    if (typeof DOMException !== 'undefined' && error instanceof DOMException) return error.name === 'AbortError'
    return error instanceof Error && error.name === 'AbortError'
}

function currentLorebookPayload(value: Record<string, unknown>): Record<string, unknown> {
    const stored = lorebookToApiPayload(value as unknown as Lorebook)
    delete stored.metadata
    const id = typeof value.id === 'string' && value.id.trim() ? value.id : undefined
    return id ? { id, ...stored } : stored
}

export function useLorebookAssistant({
    lorebookId,
    title,
    currentLorebook,
    onLorebook,
    isAuthenticated,
    onAuthRequired,
    timeoutMs = DEFAULT_TIMEOUT_MS,
}: UseLorebookAssistantOptions): UseLorebookAssistantResult {
    const { t } = useTranslation()
    const tRef = useRef(t)
    useEffect(() => { tRef.current = t }, [t])
    const [open, setOpen] = useState(false)
    const [status, setStatus] = useState<AssistantStatus>('idle')
    const [conversations, setConversations] = useState<LorebookAssistantConversation[]>([])
    const [activeConversation, setActiveConversation] = useState<LorebookAssistantConversation | null>(null)
    const [messages, setMessages] = useState<LorebookAssistantMessage[]>([])
    const [notice, setNotice] = useState<AssistantNotice | null>(null)
    const [pendingLorebook, setPendingLorebook] = useState<Lorebook | null>(null)
    const [liveActions, setLiveActions] = useState<Map<number, AppliedChangeSummary[]>>(() => new Map())
    const [streamingMessageId, setStreamingMessageId] = useState<number | null>(null)
    const [interruptedIds, setInterruptedIds] = useState<Set<number>>(() => new Set())

    const currentLorebookRef = useRef(currentLorebook)
    const onLorebookRef = useRef(onLorebook)
    const titleRef = useRef(title)
    const lorebookIdRef = useRef<string | null>(lorebookId ?? null)
    const activeConversationRef = useRef<LorebookAssistantConversation | null>(null)
    const conversationsRef = useRef<LorebookAssistantConversation[]>([])
    const pendingLorebookRef = useRef<Lorebook | null>(null)
    useEffect(() => {
        currentLorebookRef.current = currentLorebook
        onLorebookRef.current = onLorebook
        titleRef.current = title
        lorebookIdRef.current = lorebookId ?? null
        activeConversationRef.current = activeConversation
        conversationsRef.current = conversations
        pendingLorebookRef.current = pendingLorebook
    })

    const localIdRef = useRef(0)
    const streamControllerRef = useRef<AbortController | null>(null)
    const activeRequestRef = useRef<string | null>(null)
    const userStoppedRef = useRef(false)
    const lastSentRef = useRef<string | null>(null)
    const lastRequestIdRef = useRef<string | null>(null)
    const prevLorebookIdRef = useRef<string | null>(lorebookId ?? null)

    const nextLocalId = () => {
        localIdRef.current -= 1
        return localIdRef.current
    }

    const turns = useMemo<LorebookAssistantTurn[]>(
        () => attachAppliedChanges(messages, liveActions).map((turn) => ({
            ...turn,
            isStreaming: turn.message.message_id === streamingMessageId,
            isInterrupted: interruptedIds.has(turn.message.message_id),
        })) as LorebookAssistantTurn[],
        [messages, liveActions, streamingMessageId, interruptedIds],
    )

    const resetConversationState = useCallback(() => {
        activeConversationRef.current = null
        lastRequestIdRef.current = null
        setActiveConversation(null)
        setMessages([])
        setPendingLorebook(null)
        setLiveActions(new Map())
        setInterruptedIds(new Set())
    }, [])

    useEffect(() => {
        if (!open || !isAuthenticated) return
        let cancelled = false
        const userIsChatting = () => Boolean(streamControllerRef.current || activeConversationRef.current)
        apiService
            .listLorebookAssistantConversations(lorebookIdRef.current ?? undefined, { timeoutMs: META_TIMEOUT_MS })
            .then(async ({ conversations: loaded }) => {
                if (cancelled) return
                setConversations((prev) => {
                    const known = new Set(prev.map(conversationKey))
                    return [...prev, ...loaded.filter((item) => !known.has(conversationKey(item)))]
                })
                if (userIsChatting()) return
                const first = loaded[0]
                const id = conversationKey(first)
                if (!id) return
                const detail = await apiService.getLorebookAssistantConversation(id, { timeoutMs: META_TIMEOUT_MS })
                if (cancelled || userIsChatting()) return
                setActiveConversation(detail.conversation)
                setMessages(detail.messages ?? [])
            })
            .catch((err) => {
                if (!cancelled) setNotice({ kind: 'error', message: assistantErrorMessage(err, tRef.current) })
            })
            .finally(() => {
                if (!cancelled) setStatus((prev) => (prev === 'initializing' ? 'idle' : prev))
            })
        return () => {
            cancelled = true
        }
    }, [open, isAuthenticated])

    useEffect(() => {
        const normalized = lorebookId ?? null
        if (prevLorebookIdRef.current === normalized) return
        prevLorebookIdRef.current = normalized
        // A different editor target supersedes work started for the old one.
        // A final that binds its own new card updates the conversation first.
        if (streamControllerRef.current && activeConversationRef.current?.lorebook_id !== normalized) {
            activeRequestRef.current = null
            streamControllerRef.current.abort(new DOMException('Assistant target changed', 'AbortError'))
            streamControllerRef.current = null
            setStreamingMessageId(null)
            setStatus('idle')
            resetConversationState()
        }
        if (!open || !isAuthenticated) return
        let cancelled = false
        apiService
            .listLorebookAssistantConversations(normalized ?? undefined, { timeoutMs: META_TIMEOUT_MS })
            .then(({ conversations: loaded }) => {
                if (cancelled) return
                setConversations(() => {
                    const active = activeConversationRef.current
                    const activeId = conversationKey(active)
                    if (!activeId || loaded.some((item) => conversationKey(item) === activeId)) return loaded
                    return [active as LorebookAssistantConversation, ...loaded]
                })
            })
            .catch(() => {
                // Non-fatal: keep the open conversation usable.
            })
        return () => {
            cancelled = true
        }
    }, [lorebookId, open, isAuthenticated, resetConversationState])

    useEffect(() => () => {
        activeRequestRef.current = null
        streamControllerRef.current?.abort(new DOMException('Assistant unmounted', 'AbortError'))
        streamControllerRef.current = null
    }, [])

    const createConversation = useCallback(async (signal?: AbortSignal): Promise<LorebookAssistantConversation> => {
        const response = await apiService.createLorebookAssistantConversation(
            {
                lorebookId: lorebookIdRef.current ?? undefined,
                title: titleRef.current,
            },
            { timeoutMs: META_TIMEOUT_MS, signal },
        )
        signal?.throwIfAborted()
        activeConversationRef.current = response.conversation
        setActiveConversation(response.conversation)
        setConversations((prev) => [
            response.conversation,
            ...prev.filter((item) => conversationKey(item) !== conversationKey(response.conversation)),
        ])
        return response.conversation
    }, [])

    const reloadConversation = useCallback(async (): Promise<boolean> => {
        const id = conversationKey(activeConversationRef.current)
        if (!id) return false
        const requestId = lastRequestIdRef.current
        const owner = activeRequestRef.current
        try {
            const detail = await apiService.getLorebookAssistantConversation(id, { timeoutMs: META_TIMEOUT_MS })
            if (owner !== activeRequestRef.current || id !== conversationKey(activeConversationRef.current)) return false
            const lastAssistant = [...(detail.messages ?? [])].reverse().find((message) => message.role === 'assistant')
            const recovered = Boolean(lastAssistant?.status === 'completed'
                && (!requestId || lastAssistant.metadata?.request_id === requestId)
                && !detail.conversation.active_request_id)
            if (requestId && !recovered) {
                console.warn('text_stream_recovery_failed', { requestId, surface: 'lorebook_assistant' })
                return false
            }
            setActiveConversation(detail.conversation)
            setMessages(detail.messages ?? [])
            setInterruptedIds(new Set())
            setNotice(null)
            if (requestId && detail.lorebook) onLorebookRef.current(detail.lorebook)
            return recovered
        } catch (err) {
            if (owner !== activeRequestRef.current || id !== conversationKey(activeConversationRef.current)) return false
            setNotice({ kind: 'error', message: assistantErrorMessage(err, tRef.current), canReload: true })
            return false
        }
    }, [])

    const send = useCallback(async (rawText: string) => {
        if (!isAuthenticated) {
            onAuthRequired()
            return
        }
        const text = rawText.trim()
        if (!text || streamControllerRef.current) return

        lastSentRef.current = text
        setNotice(null)
        setStatus('streaming')
        userStoppedRef.current = false

        const optimisticId = nextLocalId()
        const placeholderId = nextLocalId()
        setMessages((prev) => [
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
        const requestId = createRequestId()
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
            const conversation = activeConversationRef.current ?? await createConversation(controller.signal)
            controller.signal.throwIfAborted()
            if (activeRequestRef.current !== requestId) return
            const id = conversationKey(conversation)
            if (!id) throw new Error('Missing assistant conversation id')
            await apiService.streamLorebookAssistantMessage(
                id,
                { message: text, currentLorebook: currentLorebookPayload(currentLorebookRef.current) },
                (event) => {
                    if (activeRequestRef.current !== requestId || controller.signal.aborted || (event.request_id && event.request_id !== requestId)) return
                    if (event.type !== 'assistant_delta') updates.flush()
                    if (event.type === 'progress') {
                        setNotice({ kind: 'info', message: tRef.current(`streaming.${event.stage}`) })
                        return
                    }
                    if (event.type === 'user_message' && event.user_message) {
                        userAcknowledged = true
                        setMessages((prev) => prev.map((message) => (
                            message.message_id === optimisticId ? event.user_message! : message
                        )))
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
                        activeConversationRef.current = event.conversation
                        setActiveConversation(event.conversation)
                        setConversations((prev) => [
                            event.conversation,
                            ...prev.filter((item) => conversationKey(item) !== conversationKey(event.conversation)),
                        ])
                        if (event.assistant_message) {
                            const summaries = parseAppliedActions(event.applied_actions)
                            if (summaries.length) {
                                setLiveActions((prev) => new Map(prev).set(event.assistant_message!.message_id, summaries))
                            }
                        }
                        if (event.messages?.length) {
                            setMessages(event.messages)
                        } else {
                            setMessages((prev) => [
                                ...prev.filter((message) => message.message_id !== optimisticId && message.message_id !== placeholderId && message.message_id !== event.user_message?.message_id && message.message_id !== event.assistant_message?.message_id),
                                ...(event.user_message ? [event.user_message] : []),
                                ...(event.assistant_message ? [event.assistant_message] : []),
                            ])
                        }
                        setStreamingMessageId(null)
                        if (event.lorebook) onLorebookRef.current(event.lorebook)
                        return
                    }
                    if (event.type === 'error') {
                        receivedError = true
                        const message = event.detail || event.error?.message || tRef.current('creation.common.assistant.notices.generic')
                        setMessages((prev) => prev.some((item) => item.message_id === placeholderId)
                            ? prev.map((item) => item.message_id === placeholderId ? { ...item, status: 'failed' } : item)
                            : [...prev, { message_id: placeholderId, conversation_id: id, sequence_no: prev.length + 1,
                                role: 'assistant', status: 'failed', content: message }])
                        setInterruptedIds((prev) => new Set(prev).add(placeholderId))
                        setStreamingMessageId(null)
                        setNotice({ kind: 'error', message, canRetry: event.error?.retryable !== false })
                    }
                },
                { requestId, timeoutMs, signal: controller.signal },
            )
            if (activeRequestRef.current !== requestId) return
            if (!receivedFinal && !receivedError) {
                const recovered = await reloadConversation()
                if (activeRequestRef.current !== requestId) return
                if (!recovered) {
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
            if (!userAcknowledged && !receivedText) setMessages((prev) => prev.filter((item) => item.message_id !== optimisticId))
            if (isAbortError(err)) {
                if (userStoppedRef.current) {
                    setInterruptedIds((prev) => new Set(prev).add(placeholderId))
                    setNotice({
                        kind: 'info',
                        message: tRef.current('creation.common.assistant.notices.stopped'),
                        canReload: true,
                    })
                }
            } else if (err instanceof ApiError && err.status === 409) {
                setInterruptedIds((prev) => new Set(prev).add(placeholderId))
                setNotice({
                    kind: 'error',
                    message: tRef.current('creation.common.assistant.notices.busy'),
                    canRetry: true,
                    canReload: true,
                })
            } else if (err instanceof ApiError && err.action === 'reload_conversation') {
                if (err.code === 'stream_incomplete' && await reloadConversation()) return
                if (activeRequestRef.current !== requestId) return
                setInterruptedIds((prev) => new Set(prev).add(placeholderId))
                setNotice({ kind: 'error', message: err.message, canReload: true })
            } else {
                setInterruptedIds((prev) => new Set(prev).add(placeholderId))
                setNotice({ kind: 'error', message: assistantErrorMessage(err, tRef.current), canRetry: true })
            }
        } finally {
            updates.flush()
            updates.cancel()
            if (activeRequestRef.current === requestId) {
                activeRequestRef.current = null
                streamControllerRef.current = null
                userStoppedRef.current = false
                setStreamingMessageId(null)
                setStatus('idle')
            }
        }
    }, [isAuthenticated, onAuthRequired, timeoutMs, createConversation, reloadConversation])

    const stop = useCallback(() => {
        if (!streamControllerRef.current) return
        userStoppedRef.current = true
        streamControllerRef.current.abort(new DOMException('Stopped by user', 'AbortError'))
    }, [])

    const retry = useCallback(() => {
        const text = lastSentRef.current
        if (!text) return
        setNotice(null)
        void send(text)
    }, [send])

    const openPanel = useCallback(() => {
        if (!isAuthenticated) {
            onAuthRequired()
            return
        }
        setNotice(null)
        setStatus('initializing')
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
        const selectionId = createRequestId()
        activeRequestRef.current = selectionId
        try {
            const detail = await apiService.getLorebookAssistantConversation(id, { timeoutMs: META_TIMEOUT_MS })
            if (activeRequestRef.current !== selectionId) return
            lastRequestIdRef.current = null
            activeConversationRef.current = detail.conversation
            setActiveConversation(detail.conversation)
            setMessages(detail.messages ?? [])
            setLiveActions(new Map())
            setInterruptedIds(new Set())
            setPendingLorebook(detail.lorebook ?? null)
        } catch (err) {
            if (activeRequestRef.current !== selectionId) return
            setNotice({ kind: 'error', message: assistantErrorMessage(err, tRef.current) })
        } finally {
            if (activeRequestRef.current === selectionId) {
                activeRequestRef.current = null
                setStatus('idle')
            }
        }
    }, [])

    const deleteConversation = useCallback(async (id: number) => {
        if (streamControllerRef.current) return
        try {
            await apiService.deleteLorebookAssistantConversation(id, { timeoutMs: META_TIMEOUT_MS })
        } catch (err) {
            if (err instanceof ApiError && err.status === 409) {
                setNotice({ kind: 'error', message: 'That conversation is still processing a message. Try again shortly.' })
            } else {
                setNotice({ kind: 'error', message: assistantErrorMessage(err, tRef.current) })
            }
            return
        }
        const remaining = conversationsRef.current.filter((item) => conversationKey(item) !== id)
        setConversations(remaining)
        if (conversationKey(activeConversationRef.current) !== id) return
        const nextId = conversationKey(remaining[0])
        if (nextId) {
            await selectConversation(nextId)
        } else {
            resetConversationState()
        }
    }, [selectConversation, resetConversationState])

    const applyPendingLorebook = useCallback(() => {
        const lorebook = pendingLorebookRef.current
        if (!lorebook) return
        onLorebookRef.current(lorebook)
        setPendingLorebook(null)
    }, [])

    const dismissPendingLorebook = useCallback(() => {
        setPendingLorebook(null)
    }, [])

    const clearNotice = useCallback(() => {
        setNotice(null)
    }, [])

    return {
        open,
        status,
        conversations,
        activeConversation,
        turns,
        notice,
        pendingLorebook,
        openPanel,
        closePanel,
        send,
        stop,
        retry,
        newConversation,
        selectConversation,
        deleteConversation,
        applyPendingLorebook,
        dismissPendingLorebook,
        reloadConversation,
        clearNotice,
    }
}
