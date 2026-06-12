import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiService, ApiError } from '@/infrastructure/api'
import type {
    CardAssistantCardResponse,
    CardAssistantCardType,
    CardAssistantConversation,
    CardAssistantMessage,
} from '@/shared/types/aiCard.types'
import {
    attachAppliedChanges,
    parseAppliedActions,
    type AppliedChangeSummary,
    type AssistantTurnBase,
} from './appliedActions'

const DEFAULT_TIMEOUT_MS = 120_000
const META_TIMEOUT_MS = 15_000

export type AssistantStatus = 'idle' | 'initializing' | 'switching' | 'streaming'

export interface AssistantNotice {
    kind: 'error' | 'info'
    message: string
    canRetry?: boolean
    canReload?: boolean
}

export interface AssistantTurn extends AssistantTurnBase<CardAssistantMessage> {
    isStreaming: boolean
    isInterrupted: boolean
}

export interface UseCardAssistantOptions<TCard extends CardAssistantCardResponse> {
    cardType: CardAssistantCardType
    cardId?: string | null
    title: string
    currentCard: Record<string, unknown>
    onCard: (card: TCard) => void
    isAuthenticated: boolean
    onAuthRequired: () => void
    timeoutMs?: number
}

export interface UseCardAssistantResult<TCard extends CardAssistantCardResponse> {
    open: boolean
    status: AssistantStatus
    conversations: CardAssistantConversation[]
    activeConversation: CardAssistantConversation | null
    turns: AssistantTurn[]
    notice: AssistantNotice | null
    pendingCard: TCard | null
    openPanel: () => void
    closePanel: () => void
    send: (text: string) => Promise<void>
    stop: () => void
    retry: () => void
    newConversation: () => void
    selectConversation: (id: number) => Promise<void>
    deleteConversation: (id: number) => Promise<void>
    applyPendingCard: () => void
    dismissPendingCard: () => void
    reloadConversation: () => Promise<boolean>
    clearNotice: () => void
}

function createRequestId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `mw-card-assistant-${crypto.randomUUID()}`
    }
    return `mw-card-assistant-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function conversationKey(conversation: { conversation_id?: number; id?: number } | null | undefined): number | null {
    return conversation?.conversation_id ?? conversation?.id ?? null
}

function assistantErrorMessage(error: unknown): string {
    if (error instanceof ApiError) {
        return error.isTransient
            ? 'The assistant is briefly unavailable. Try again in a moment.'
            : error.message
    }
    return 'The assistant could not complete that request.'
}

function isAbortError(error: unknown): boolean {
    // DOMException does not extend Error in every runtime.
    if (typeof DOMException !== 'undefined' && error instanceof DOMException) return error.name === 'AbortError'
    return error instanceof Error && error.name === 'AbortError'
}

export function useCardAssistant<TCard extends CardAssistantCardResponse = CardAssistantCardResponse>({
    cardType,
    cardId,
    title,
    currentCard,
    onCard,
    isAuthenticated,
    onAuthRequired,
    timeoutMs = DEFAULT_TIMEOUT_MS,
}: UseCardAssistantOptions<TCard>): UseCardAssistantResult<TCard> {
    const [open, setOpen] = useState(false)
    const [status, setStatus] = useState<AssistantStatus>('idle')
    const [conversations, setConversations] = useState<CardAssistantConversation[]>([])
    const [activeConversation, setActiveConversation] = useState<CardAssistantConversation | null>(null)
    const [messages, setMessages] = useState<CardAssistantMessage[]>([])
    const [notice, setNotice] = useState<AssistantNotice | null>(null)
    const [pendingCard, setPendingCard] = useState<TCard | null>(null)
    const [liveActions, setLiveActions] = useState<Map<number, AppliedChangeSummary[]>>(() => new Map())
    const [streamingMessageId, setStreamingMessageId] = useState<number | null>(null)
    const [interruptedIds, setInterruptedIds] = useState<Set<number>>(() => new Set())

    // Prop/state mirrors so long-lived callbacks always read the latest values.
    const currentCardRef = useRef(currentCard)
    const onCardRef = useRef(onCard)
    const titleRef = useRef(title)
    const cardIdRef = useRef<string | null>(cardId ?? null)
    const activeConversationRef = useRef<CardAssistantConversation | null>(null)
    const conversationsRef = useRef<CardAssistantConversation[]>([])
    const pendingCardRef = useRef<TCard | null>(null)
    useEffect(() => {
        currentCardRef.current = currentCard
        onCardRef.current = onCard
        titleRef.current = title
        cardIdRef.current = cardId ?? null
        activeConversationRef.current = activeConversation
        conversationsRef.current = conversations
        pendingCardRef.current = pendingCard
    })

    const localIdRef = useRef(0)
    const streamControllerRef = useRef<AbortController | null>(null)
    const activeRequestRef = useRef<string | null>(null)
    const userStoppedRef = useRef(false)
    const lastSentRef = useRef<string | null>(null)
    const prevCardIdRef = useRef<string | null>(cardId ?? null)

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

    const resetConversationState = useCallback(() => {
        setActiveConversation(null)
        setMessages([])
        setPendingCard(null)
        setLiveActions(new Map())
        setInterruptedIds(new Set())
    }, [])

    // Initial load when the panel opens. Deliberately independent of `cardId`:
    // the assistant binding a freshly created card mid-session must not reset
    // the open conversation (cardId flips null -> id on the first replace_card).
    useEffect(() => {
        if (!open || !isAuthenticated) return
        let cancelled = false
        // `status` was set to 'initializing' by openPanel; this effect only
        // performs the load and settles back to idle.
        // The composer stays usable during this load; if the user already
        // started chatting, only merge the list — never clobber their state.
        const userIsChatting = () => Boolean(streamControllerRef.current || activeConversationRef.current)
        apiService
            .listCardAssistantConversations(cardType, cardIdRef.current ?? undefined, { timeoutMs: META_TIMEOUT_MS })
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
                const detail = await apiService.getCardAssistantConversation(id, { timeoutMs: META_TIMEOUT_MS })
                if (cancelled || userIsChatting()) return
                setActiveConversation(detail.conversation)
                setMessages(detail.messages ?? [])
            })
            .catch((err) => {
                if (!cancelled) setNotice({ kind: 'error', message: assistantErrorMessage(err) })
            })
            .finally(() => {
                if (!cancelled) setStatus((prev) => (prev === 'initializing' ? 'idle' : prev))
            })
        return () => {
            cancelled = true
        }
    }, [open, isAuthenticated, cardType, resetConversationState])

    // When the bound card changes while open, refresh the list for the new
    // scope but keep the conversation the user is in.
    useEffect(() => {
        const normalized = cardId ?? null
        if (prevCardIdRef.current === normalized) return
        prevCardIdRef.current = normalized
        if (!open || !isAuthenticated) return
        let cancelled = false
        apiService
            .listCardAssistantConversations(cardType, normalized ?? undefined, { timeoutMs: META_TIMEOUT_MS })
            .then(({ conversations: loaded }) => {
                if (cancelled) return
                setConversations(() => {
                    const active = activeConversationRef.current
                    const activeId = conversationKey(active)
                    if (!activeId || loaded.some((item) => conversationKey(item) === activeId)) return loaded
                    return [active as CardAssistantConversation, ...loaded]
                })
            })
            .catch(() => {
                // Non-fatal: the open conversation keeps working either way.
            })
        return () => {
            cancelled = true
        }
    }, [cardId, open, isAuthenticated, cardType])

    // Abort any in-flight stream on unmount; the server finishes and persists.
    useEffect(() => () => {
        activeRequestRef.current = null
        streamControllerRef.current?.abort(new DOMException('Assistant unmounted', 'AbortError'))
        streamControllerRef.current = null
    }, [])

    const createConversation = useCallback(async (): Promise<CardAssistantConversation> => {
        const response = await apiService.createCardAssistantConversation(
            {
                card_type: cardType,
                card_id: cardIdRef.current ?? undefined,
                title: titleRef.current,
                current_card: currentCardRef.current,
            },
            { timeoutMs: META_TIMEOUT_MS },
        )
        // Note: does NOT touch `messages` — send() may already hold an
        // optimistic user message that must survive the lazy creation.
        setActiveConversation(response.conversation)
        setConversations((prev) => [
            response.conversation,
            ...prev.filter((item) => conversationKey(item) !== conversationKey(response.conversation)),
        ])
        return response.conversation
    }, [cardType])

    const reloadConversation = useCallback(async (): Promise<boolean> => {
        const id = conversationKey(activeConversationRef.current)
        if (!id) return false
        try {
            const detail = await apiService.getCardAssistantConversation(id, { timeoutMs: META_TIMEOUT_MS })
            setActiveConversation(detail.conversation)
            setMessages(detail.messages ?? [])
            setInterruptedIds(new Set())
            setNotice(null)
            const lastAssistant = [...(detail.messages ?? [])].reverse().find((message) => message.role === 'assistant')
            return Boolean(lastAssistant && lastAssistant.status === 'completed')
        } catch (err) {
            setNotice({ kind: 'error', message: assistantErrorMessage(err), canReload: true })
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
        const requestId = createRequestId()
        const controller = new AbortController()
        activeRequestRef.current = requestId
        streamControllerRef.current = controller

        try {
            const conversation = activeConversationRef.current ?? await createConversation()
            const id = conversationKey(conversation)
            if (!id) throw new Error('Missing assistant conversation id')
            await apiService.streamCardAssistantMessage(
                id,
                { message: text, current_card: currentCardRef.current, request_id: requestId },
                (event) => {
                    if (activeRequestRef.current !== requestId) return
                    if (event.type === 'user_message' && event.user_message) {
                        setMessages((prev) => prev.map((message) => (
                            message.message_id === optimisticId ? event.user_message! : message
                        )))
                        return
                    }
                    if (event.type === 'assistant_delta') {
                        const delta = event.delta || ''
                        if (!delta) return
                        setStreamingMessageId(placeholderId)
                        setMessages((prev) => {
                            const existing = prev.find((message) => message.message_id === placeholderId)
                            if (!existing) {
                                return [
                                    ...prev,
                                    {
                                        message_id: placeholderId,
                                        conversation_id: id,
                                        sequence_no: prev.length + 1,
                                        role: 'assistant',
                                        status: 'pending',
                                        content: delta,
                                    },
                                ]
                            }
                            return prev.map((message) => (
                                message.message_id === placeholderId
                                    ? { ...message, content: `${message.content}${delta}` }
                                    : message
                            ))
                        })
                        return
                    }
                    if (event.type === 'final') {
                        receivedFinal = true
                        setActiveConversation(event.conversation)
                        setConversations((prev) => [
                            event.conversation,
                            ...prev.filter((item) => conversationKey(item) !== conversationKey(event.conversation)),
                        ])
                        if (event.assistant_message) {
                            const summaries = parseAppliedActions(event.applied_actions)
                            if (summaries.length) {
                                const assistantId = event.assistant_message.message_id
                                setLiveActions((prev) => new Map(prev).set(assistantId, summaries))
                            }
                        }
                        if (event.messages?.length) {
                            setMessages(event.messages)
                        } else {
                            setMessages((prev) => [
                                ...prev.filter((message) => message.message_id !== optimisticId && message.message_id !== placeholderId),
                                ...(event.user_message ? [event.user_message] : []),
                                ...(event.assistant_message ? [event.assistant_message] : []),
                            ])
                        }
                        setStreamingMessageId(null)
                        if (event.card) onCardRef.current(event.card as TCard)
                        return
                    }
                    if (event.type === 'error') {
                        receivedError = true
                        const message = event.detail || event.error?.message || 'The assistant could not complete that request.'
                        setMessages((prev) => {
                            const withoutPlaceholder = prev.filter((item) => item.message_id !== placeholderId)
                            return [
                                ...withoutPlaceholder,
                                {
                                    message_id: placeholderId,
                                    conversation_id: id,
                                    sequence_no: withoutPlaceholder.length + 1,
                                    role: 'assistant',
                                    status: 'failed',
                                    content: message,
                                },
                            ]
                        })
                        setStreamingMessageId(null)
                        setNotice({ kind: 'error', message, canRetry: event.error?.retryable !== false })
                    }
                    // 'done' alone never reports success; the post-stream
                    // recovery below handles a missing 'final'.
                },
                { requestId, timeoutMs, signal: controller.signal },
            )
            if (!receivedFinal && !receivedError) {
                // The stream closed without a result. The server may still
                // have persisted the turn — pick up its truth before erroring.
                const recovered = await reloadConversation()
                if (!recovered) {
                    setNotice({
                        kind: 'error',
                        message: 'The assistant stream ended before returning a result.',
                        canRetry: true,
                        canReload: true,
                    })
                }
            }
        } catch (err) {
            if (isAbortError(err)) {
                if (userStoppedRef.current) {
                    setInterruptedIds((prev) => new Set(prev).add(placeholderId))
                    setNotice({
                        kind: 'info',
                        message: 'Stopped. The assistant may still finish and save its reply.',
                        canReload: true,
                    })
                }
                // Otherwise the panel closed/unmounted — nothing to surface.
            } else if (err instanceof ApiError && err.status === 409) {
                setMessages((prev) => prev.filter((message) => message.message_id !== optimisticId && message.message_id !== placeholderId))
                setNotice({
                    kind: 'error',
                    message: 'The assistant is still finishing a previous request.',
                    canRetry: true,
                    canReload: true,
                })
            } else if (err instanceof ApiError && err.action === 'reload_conversation') {
                setInterruptedIds((prev) => new Set(prev).add(placeholderId))
                setNotice({ kind: 'error', message: err.message, canReload: true })
            } else {
                setMessages((prev) => prev.filter((message) => message.message_id !== optimisticId && message.message_id !== placeholderId))
                setNotice({ kind: 'error', message: assistantErrorMessage(err), canRetry: true })
            }
        } finally {
            if (activeRequestRef.current === requestId) {
                activeRequestRef.current = null
            }
            streamControllerRef.current = null
            userStoppedRef.current = false
            setStreamingMessageId(null)
            setStatus('idle')
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
        try {
            const detail = await apiService.getCardAssistantConversation(id, { timeoutMs: META_TIMEOUT_MS })
            setActiveConversation(detail.conversation)
            setMessages(detail.messages ?? [])
            setLiveActions(new Map())
            setInterruptedIds(new Set())
            // Never silently overwrite the form: surface the snapshot and let
            // the user choose to apply it.
            setPendingCard((detail.card as TCard | null | undefined) ?? null)
        } catch (err) {
            setNotice({ kind: 'error', message: assistantErrorMessage(err) })
        } finally {
            setStatus('idle')
        }
    }, [])

    const deleteConversation = useCallback(async (id: number) => {
        if (streamControllerRef.current) return
        try {
            await apiService.deleteCardAssistantConversation(id, { timeoutMs: META_TIMEOUT_MS })
        } catch (err) {
            if (err instanceof ApiError && err.status === 409) {
                setNotice({ kind: 'error', message: 'That conversation is still processing a message. Try again shortly.' })
            } else {
                setNotice({ kind: 'error', message: assistantErrorMessage(err) })
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

    const applyPendingCard = useCallback(() => {
        const card = pendingCardRef.current
        if (!card) return
        onCardRef.current(card)
        setPendingCard(null)
    }, [])

    const dismissPendingCard = useCallback(() => {
        setPendingCard(null)
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
        pendingCard,
        openPanel,
        closePanel,
        send,
        stop,
        retry,
        newConversation,
        selectConversation,
        deleteConversation,
        applyPendingCard,
        dismissPendingCard,
        reloadConversation,
        clearNotice,
    }
}
