import type { FormEvent, KeyboardEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, ChevronDown, Loader2, MessageCircle, Plus, Send, X } from 'lucide-react'
import { apiService, ApiError } from '@/infrastructure/api'
import type {
    CardAssistantCardResponse,
    CardAssistantCardType,
    CardAssistantConversation,
    CardAssistantMessage,
} from '@/shared/types/aiCard.types'

const DEFAULT_TIMEOUT_MS = 120_000

function createRequestId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `mw-card-assistant-${crypto.randomUUID()}`
    }
    return `mw-card-assistant-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function conversationId(conversation: CardAssistantConversation | null): number | null {
    return conversation?.conversation_id ?? conversation?.id ?? null
}

function visibleMessages(messages: CardAssistantMessage[]): CardAssistantMessage[] {
    return messages.filter((message) => message.role === 'user' || message.role === 'assistant')
}

function assistantErrorMessage(error: unknown): string {
    if (error instanceof ApiError) {
        return error.isTransient
            ? 'The assistant is briefly unavailable. Try again in a moment.'
            : error.message
    }
    return 'The assistant could not complete that request.'
}

export interface CardAssistantChatbotProps<TCard extends CardAssistantCardResponse = CardAssistantCardResponse> {
    cardType: CardAssistantCardType
    cardId?: string | null
    title: string
    currentCard: Record<string, unknown>
    onCard: (card: TCard) => void
    isAuthenticated: boolean
    onAuthRequired: () => void
    timeoutMs?: number
}

export function CardAssistantChatbot<TCard extends CardAssistantCardResponse = CardAssistantCardResponse>({
    cardType,
    cardId,
    title,
    currentCard,
    onCard,
    isAuthenticated,
    onAuthRequired,
    timeoutMs = DEFAULT_TIMEOUT_MS,
}: CardAssistantChatbotProps<TCard>) {
    const [open, setOpen] = useState(false)
    const [input, setInput] = useState('')
    const [conversations, setConversations] = useState<CardAssistantConversation[]>([])
    const [activeConversation, setActiveConversation] = useState<CardAssistantConversation | null>(null)
    const [messages, setMessages] = useState<CardAssistantMessage[]>([])
    const [loading, setLoading] = useState(false)
    const [sending, setSending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const scrollRef = useRef<HTMLDivElement | null>(null)
    const inputRef = useRef<HTMLTextAreaElement | null>(null)

    const renderedMessages = useMemo(() => visibleMessages(messages), [messages])
    const activeId = conversationId(activeConversation)
    const hasStreamingAssistant = renderedMessages.some((message) => message.role === 'assistant' && message.status === 'pending')

    useEffect(() => {
        if (!open || !isAuthenticated) return
        let cancelled = false
        apiService
            .listCardAssistantConversations(cardType, cardId ?? undefined, { timeoutMs: 15_000 })
            .then(async ({ conversations: loaded }) => {
                if (cancelled) return
                setConversations(loaded)
                const first = loaded[0]
                if (!first) {
                    setActiveConversation(null)
                    setMessages([])
                    return
                }
                const id = conversationId(first)
                if (!id) return
                const detail = await apiService.getCardAssistantConversation(id, { timeoutMs: 15_000 })
                if (cancelled) return
                setActiveConversation(detail.conversation)
                setMessages(detail.messages ?? [])
            })
            .catch((err) => {
                if (!cancelled) setError(assistantErrorMessage(err))
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [open, isAuthenticated, cardType, cardId])

    useEffect(() => {
        if (!open) return
        const node = scrollRef.current
        if (!node) return
        if (typeof node.scrollTo === 'function') {
            node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
        } else {
            node.scrollTop = node.scrollHeight
        }
    }, [open, renderedMessages.length, sending])

    const createConversation = async (): Promise<CardAssistantConversation> => {
        const response = await apiService.createCardAssistantConversation(
            {
                card_type: cardType,
                card_id: cardId ?? undefined,
                title,
                current_card: currentCard,
            },
            { timeoutMs: 15_000 },
        )
        setActiveConversation(response.conversation)
        setMessages(response.messages ?? [])
        setConversations((prev) => [response.conversation, ...prev.filter((item) => conversationId(item) !== conversationId(response.conversation))])
        return response.conversation
    }

    const handleOpen = () => {
        if (!isAuthenticated) {
            onAuthRequired()
            return
        }
        setError(null)
        setLoading(true)
        setOpen(true)
    }

    const handleNewConversation = async () => {
        if (!isAuthenticated) {
            onAuthRequired()
            return
        }
        setError(null)
        setLoading(true)
        try {
            await createConversation()
        } catch (err) {
            setError(assistantErrorMessage(err))
        } finally {
            setLoading(false)
        }
    }

    const handleSelectConversation = async (conversation: CardAssistantConversation) => {
        const id = conversationId(conversation)
        if (!id || id === activeId) return
        setError(null)
        setLoading(true)
        try {
            const detail = await apiService.getCardAssistantConversation(id, { timeoutMs: 15_000 })
            setActiveConversation(detail.conversation)
            setMessages(detail.messages ?? [])
            if (detail.card) onCard(detail.card as TCard)
        } catch (err) {
            setError(assistantErrorMessage(err))
        } finally {
            setLoading(false)
        }
    }

    const focusInput = () => {
        requestAnimationFrame(() => inputRef.current?.focus())
    }

    const handleSend = async (event?: FormEvent) => {
        event?.preventDefault()
        if (!isAuthenticated) {
            onAuthRequired()
            return
        }
        const text = input.trim()
        if (!text || sending) return
        setInput('')
        setError(null)
        setSending(true)
        focusInput()
        const optimistic: CardAssistantMessage = {
            message_id: -Date.now(),
            conversation_id: activeId ?? -1,
            sequence_no: messages.length + 1,
            role: 'user',
            status: 'completed',
            content: text,
        }
        const streamingAssistantId = optimistic.message_id - 1
        let receivedFinal = false
        let receivedStreamError = false
        setMessages((prev) => [...prev, optimistic])
        try {
            const conversation = activeConversation ?? await createConversation()
            const id = conversationId(conversation)
            if (!id) throw new Error('Missing assistant conversation id')
            const requestId = createRequestId()
            await apiService.streamCardAssistantMessage(
                id,
                { message: text, current_card: currentCard, request_id: requestId },
                (event) => {
                    if (event.type === 'user_message' && event.user_message) {
                        setMessages((prev) => prev.map((message) => (
                            message.message_id === optimistic.message_id ? event.user_message! : message
                        )))
                        return
                    }
                    if (event.type === 'assistant_delta') {
                        const delta = event.delta || ''
                        if (!delta) return
                        setMessages((prev) => {
                            const existing = prev.find((message) => message.message_id === streamingAssistantId)
                            if (!existing) {
                                return [
                                    ...prev,
                                    {
                                        message_id: streamingAssistantId,
                                        conversation_id: id,
                                        sequence_no: prev.length + 1,
                                        role: 'assistant',
                                        status: 'pending',
                                        content: delta,
                                    },
                                ]
                            }
                            return prev.map((message) => (
                                message.message_id === streamingAssistantId
                                    ? { ...message, content: `${message.content}${delta}` }
                                    : message
                            ))
                        })
                        return
                    }
                    if (event.type === 'final') {
                        receivedFinal = true
                        setActiveConversation(event.conversation)
                        setConversations((prev) => [event.conversation, ...prev.filter((item) => conversationId(item) !== conversationId(event.conversation))])
                        if (event.messages?.length) {
                            setMessages(event.messages)
                        } else {
                            setMessages((prev) => [
                                ...prev.filter((message) => message.message_id !== optimistic.message_id && message.message_id !== streamingAssistantId),
                                ...(event.user_message ? [event.user_message] : [optimistic]),
                                ...(event.assistant_message ? [event.assistant_message] : []),
                            ])
                        }
                        if (event.card) onCard(event.card as TCard)
                        return
                    }
                    if (event.type === 'error') {
                        receivedStreamError = true
                        const message = event.detail || event.error?.message || 'The assistant could not complete that request.'
                        setError(message)
                        setMessages((prev) => {
                            const withoutStreaming = prev.filter((item) => item.message_id !== streamingAssistantId)
                            return [
                                ...withoutStreaming,
                                {
                                    message_id: streamingAssistantId,
                                    conversation_id: id,
                                    sequence_no: withoutStreaming.length + 1,
                                    role: 'assistant',
                                    status: 'failed',
                                    content: message,
                                },
                            ]
                        })
                    }
                },
                { requestId, timeoutMs },
            )
            if (!receivedFinal && !receivedStreamError) {
                setError('The assistant stream ended before returning a result.')
            }
        } catch (err) {
            if (!receivedStreamError) {
                setMessages((prev) => prev.filter((message) => message.message_id !== optimistic.message_id && message.message_id !== streamingAssistantId))
                setInput((current) => current || text)
                setError(assistantErrorMessage(err))
            } else {
                setInput((current) => current || text)
            }
        } finally {
            setSending(false)
            focusInput()
        }
    }

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            void handleSend()
        }
    }

    if (!open) {
        return (
            <button
                type="button"
                onClick={handleOpen}
                className="fixed bottom-5 right-5 z-50 grid h-14 w-14 place-items-center rounded-full border border-amber-300/40 bg-ember-600 text-white shadow-2xl shadow-black/40 transition hover:bg-ember-500 focus:outline-none focus:ring-2 focus:ring-amber-300"
                title="Card assistant"
                aria-label="Open card assistant"
            >
                <MessageCircle size={24} />
            </button>
        )
    }

    return (
        <section className="fixed bottom-5 right-5 z-50 flex h-[min(620px,calc(100vh-2.5rem))] w-[min(420px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-lg border border-parchment-600/50 bg-ink-950 shadow-2xl shadow-black/50">
            <header className="flex items-center justify-between border-b border-parchment-700/50 bg-ink-900 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-ember-600 text-white">
                        <Bot size={17} />
                    </span>
                    <div className="min-w-0">
                        <h2 className="truncate font-ui text-sm font-semibold text-parchment-100">Card assistant</h2>
                        <p className="truncate font-ui text-[11px] text-parchment-400">{title}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => void handleNewConversation()}
                        disabled={loading || sending}
                        className="grid h-8 w-8 place-items-center rounded-md text-parchment-200 hover:bg-parchment-800/60 disabled:cursor-not-allowed disabled:opacity-50"
                        title="New conversation"
                        aria-label="New conversation"
                    >
                        <Plus size={17} />
                    </button>
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="grid h-8 w-8 place-items-center rounded-md text-parchment-200 hover:bg-parchment-800/60"
                        title="Close"
                        aria-label="Close card assistant"
                    >
                        <X size={17} />
                    </button>
                </div>
            </header>

            {conversations.length > 1 && (
                <div className="border-b border-parchment-700/40 bg-ink-900 px-3 py-2">
                    <label className="relative block">
                        <span className="sr-only">Assistant conversation</span>
                        <select
                            value={activeId ?? ''}
                            onChange={(event) => {
                                const selected = conversations.find((item) => String(conversationId(item)) === event.target.value)
                                if (selected) void handleSelectConversation(selected)
                            }}
                            className="h-9 w-full appearance-none rounded-md border border-parchment-700 bg-ink-950 px-3 pr-9 font-ui text-xs text-parchment-100 outline-none focus:border-amber-400"
                        >
                            {conversations.map((conversation, index) => (
                                <option key={conversationId(conversation) ?? index} value={conversationId(conversation) ?? ''}>
                                    {conversation.title || `Conversation ${conversations.length - index}`}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-parchment-400" size={15} />
                    </label>
                </div>
            )}

            <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
                {loading && !renderedMessages.length && (
                    <div className="flex items-center justify-center gap-2 py-8 font-ui text-xs text-parchment-400">
                        <Loader2 size={16} className="animate-spin" />
                        Loading
                    </div>
                )}
                {!loading && !renderedMessages.length && (
                    <div className="rounded-md border border-dashed border-parchment-700 px-3 py-6 text-center font-ui text-xs text-parchment-400">
                        No messages yet.
                    </div>
                )}
                {renderedMessages.map((message) => {
                    const mine = message.role === 'user'
                    return (
                        <div key={message.message_id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                            <div
                                className={`max-w-[86%] rounded-lg px-3 py-2 font-narrative text-sm leading-relaxed ${
                                    mine
                                        ? 'bg-ember-600 text-white'
                                        : message.status === 'failed'
                                          ? 'border border-blood-500/50 bg-blood-950/60 text-blood-100'
                                          : 'border border-parchment-700 bg-ink-900 text-parchment-100'
                                }`}
                            >
                                {message.content}
                            </div>
                        </div>
                    )
                })}
                {sending && !hasStreamingAssistant && (
                    <div className="flex justify-start">
                        <div className="flex items-center gap-2 rounded-lg border border-parchment-700 bg-ink-900 px-3 py-2 font-ui text-xs text-parchment-300">
                            <Loader2 size={14} className="animate-spin" />
                            Thinking
                        </div>
                    </div>
                )}
            </div>

            {error && (
                <div className="border-t border-blood-500/30 bg-blood-950/40 px-3 py-2 font-ui text-xs text-blood-100">
                    {error}
                </div>
            )}

            <form onSubmit={(event) => void handleSend(event)} className="border-t border-parchment-700/50 bg-ink-900 p-3">
                <div className="flex items-end gap-2">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={2}
                        maxLength={4000}
                        placeholder="Ask for a change..."
                        className="min-h-11 flex-1 resize-none rounded-md border border-parchment-700 bg-ink-950 px-3 py-2 font-narrative text-sm text-parchment-100 outline-none placeholder:text-parchment-500 focus:border-amber-400"
                    />
                    <button
                        type="submit"
                        disabled={sending || !input.trim()}
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-ember-600 text-white transition hover:bg-ember-500 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Send"
                        aria-label="Send message"
                    >
                        {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                </div>
            </form>
        </section>
    )
}
