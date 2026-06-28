import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CardAssistantMessage, CardAssistantStreamEvent } from '@/shared/types/aiCard.types'

const mocks = vi.hoisted(() => ({
    createCardAssistantConversation: vi.fn(),
    listCardAssistantConversations: vi.fn(),
    getCardAssistantConversation: vi.fn(),
    deleteCardAssistantConversation: vi.fn(),
    streamCardAssistantMessage: vi.fn(),
}))

vi.mock('@/infrastructure/api', () => {
    class ApiError extends Error {
        status: number
        category?: string
        code?: string
        retryable?: boolean
        action?: string
        constructor(status: number, message: string, metadata: Record<string, unknown> = {}) {
            super(message)
            this.name = 'ApiError'
            this.status = status
            Object.assign(this, metadata)
        }
        get isTransient(): boolean {
            return this.status >= 500 || this.retryable === true
        }
    }
    return { ApiError, apiService: mocks }
})

import { ApiError } from '@/infrastructure/api'
import { useCardAssistant } from './useCardAssistant'

const CONVO = { conversation_id: 2, card_type: 'world' as const, card_id: null, title: 'Untitled World', updated_at: '2026-06-10T10:00:00Z' }

function message(overrides: Partial<CardAssistantMessage>): CardAssistantMessage {
    return {
        message_id: 1,
        conversation_id: 2,
        sequence_no: 1,
        role: 'user',
        status: 'completed',
        content: '',
        ...overrides,
    }
}

function last<T>(items: T[]): T | undefined {
    return items[items.length - 1]
}

function hookOptions(overrides: Record<string, unknown> = {}) {
    return {
        cardType: 'world' as const,
        cardId: null as string | null,
        title: 'Untitled World',
        currentCard: { name: '' },
        onCard: vi.fn(),
        isAuthenticated: true,
        onAuthRequired: vi.fn(),
        ...overrides,
    }
}

/** Stream mock with externally controllable events and completion. */
function controllableStream() {
    const handles = {
        emit: undefined as ((event: CardAssistantStreamEvent) => void) | undefined,
        resolve: undefined as (() => void) | undefined,
        reject: undefined as ((reason: unknown) => void) | undefined,
        lastOptions: undefined as { signal?: AbortSignal; requestId?: string } | undefined,
    }
    mocks.streamCardAssistantMessage.mockImplementation(
        (_id: number, _body: unknown, onEvent: (event: CardAssistantStreamEvent) => void, options: { signal?: AbortSignal }) => {
            handles.emit = onEvent
            handles.lastOptions = options
            return new Promise<void>((resolve, reject) => {
                handles.resolve = resolve
                handles.reject = reject
                options.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
            })
        },
    )
    return handles
}

beforeEach(() => {
    vi.clearAllMocks()
    mocks.listCardAssistantConversations.mockResolvedValue({ conversations: [] })
    mocks.createCardAssistantConversation.mockResolvedValue({ conversation: CONVO, messages: [], card: null })
    mocks.getCardAssistantConversation.mockResolvedValue({ conversation: CONVO, messages: [], card: null })
    mocks.deleteCardAssistantConversation.mockResolvedValue(undefined)
    mocks.streamCardAssistantMessage.mockResolvedValue(undefined)
})

describe('useCardAssistant: open + initial load', () => {
    it('openPanel lists conversations and loads the newest detail', async () => {
        mocks.listCardAssistantConversations.mockResolvedValue({ conversations: [CONVO, { ...CONVO, conversation_id: 1 }] })
        mocks.getCardAssistantConversation.mockResolvedValue({
            conversation: CONVO,
            messages: [message({ message_id: 10, content: 'hi' }), message({ message_id: 11, role: 'assistant', content: 'Hello!' })],
            card: null,
        })
        const { result } = renderHook(() => useCardAssistant(hookOptions()))

        act(() => result.current.openPanel())
        await waitFor(() => expect(result.current.status).toBe('idle'))

        expect(mocks.listCardAssistantConversations).toHaveBeenCalledWith('world', undefined, expect.any(Object))
        expect(mocks.getCardAssistantConversation).toHaveBeenCalledWith(2, expect.any(Object))
        expect(result.current.conversations).toHaveLength(2)
        expect(result.current.turns.map((turn) => turn.message.content)).toEqual(['hi', 'Hello!'])
    })

    it('requires auth before opening and never fetches', () => {
        const onAuthRequired = vi.fn()
        const { result } = renderHook(() => useCardAssistant(hookOptions({ isAuthenticated: false, onAuthRequired })))

        act(() => result.current.openPanel())

        expect(onAuthRequired).toHaveBeenCalledTimes(1)
        expect(result.current.open).toBe(false)
        expect(mocks.listCardAssistantConversations).not.toHaveBeenCalled()
    })

    it('a cardId change while open refreshes the list but keeps the active conversation', async () => {
        mocks.listCardAssistantConversations.mockResolvedValue({ conversations: [CONVO] })
        mocks.getCardAssistantConversation.mockResolvedValue({ conversation: CONVO, messages: [message({ message_id: 10, content: 'hi' })], card: null })
        const { result, rerender } = renderHook((props) => useCardAssistant(props), { initialProps: hookOptions() })

        act(() => result.current.openPanel())
        await waitFor(() => expect(result.current.activeConversation).not.toBeNull())
        const detailCalls = mocks.getCardAssistantConversation.mock.calls.length

        mocks.listCardAssistantConversations.mockResolvedValue({ conversations: [{ ...CONVO, card_id: 'world-1' }] })
        rerender(hookOptions({ cardId: 'world-1' }))

        await waitFor(() => expect(mocks.listCardAssistantConversations).toHaveBeenLastCalledWith('world', 'world-1', expect.any(Object)))
        // No detail re-fetch: the open conversation survives the card binding.
        expect(mocks.getCardAssistantConversation.mock.calls.length).toBe(detailCalls)
        expect(result.current.turns.map((turn) => turn.message.content)).toEqual(['hi'])
    })
})

describe('useCardAssistant: send + streaming', () => {
    it('lazily creates a conversation, keeps the optimistic message, and streams with request id + signal', async () => {
        const stream = controllableStream()
        const { result } = renderHook(() => useCardAssistant(hookOptions()))

        let sendPromise!: Promise<void>
        act(() => {
            sendPromise = result.current.send('Generate a glass desert')
        })

        await waitFor(() => expect(mocks.streamCardAssistantMessage).toHaveBeenCalledTimes(1))
        expect(mocks.createCardAssistantConversation).toHaveBeenCalledTimes(1)
        expect(mocks.createCardAssistantConversation).toHaveBeenCalledWith(
            expect.objectContaining({ card_type: 'world', title: 'Untitled World', current_card: { name: '' } }),
            expect.any(Object),
        )
        expect(mocks.streamCardAssistantMessage).toHaveBeenCalledWith(
            2,
            expect.objectContaining({ message: 'Generate a glass desert', card_type: 'world', request_id: expect.stringMatching(/^mw-card-assistant-/) }),
            expect.any(Function),
            expect.objectContaining({ requestId: expect.stringMatching(/^mw-card-assistant-/), signal: expect.any(AbortSignal) }),
        )
        // The optimistic user message survives the lazy conversation creation.
        expect(result.current.turns.map((turn) => turn.message.content)).toEqual(['Generate a glass desert'])
        expect(result.current.status).toBe('streaming')

        act(() => stream.emit!({ type: 'assistant_delta', delta: 'Once' }))
        act(() => stream.emit!({ type: 'assistant_delta', delta: ' upon' }))
        expect(last(result.current.turns)?.message.content).toBe('Once upon')
        expect(last(result.current.turns)?.isStreaming).toBe(true)

        act(() => stream.resolve!())
        await act(async () => { await sendPromise })
    })

    it('final with a messages array replaces history, derives chips, and applies the card', async () => {
        const stream = controllableStream()
        const onCard = vi.fn()
        const { result } = renderHook(() => useCardAssistant(hookOptions({ onCard })))

        let sendPromise!: Promise<void>
        act(() => {
            sendPromise = result.current.send('Generate it')
        })
        await waitFor(() => expect(mocks.streamCardAssistantMessage).toHaveBeenCalled())

        const card = { id: 'world-1', name: 'Glass' }
        act(() => stream.emit!({
            type: 'final',
            conversation: { ...CONVO, card_id: 'world-1' },
            user_message: message({ message_id: 20, content: 'Generate it' }),
            assistant_message: message({ message_id: 21, role: 'assistant', content: 'Created Glass.' }),
            messages: [
                message({ message_id: 20, content: 'Generate it' }),
                message({ message_id: 21, role: 'assistant', content: 'Created Glass.' }),
                message({ message_id: 22, role: 'tool', content: JSON.stringify({ applied_actions: [{ type: 'replace_card', card_id: 'world-1' }] }) }),
            ],
            card,
            applied_actions: [{ type: 'replace_card', card_id: 'world-1' }],
        }))
        act(() => stream.resolve!())
        await act(async () => { await sendPromise })

        expect(onCard).toHaveBeenCalledWith(card)
        expect(result.current.status).toBe('idle')
        expect(result.current.turns.map((turn) => turn.message.message_id)).toEqual([20, 21])
        expect(result.current.turns[1].appliedChanges).toEqual([{ kind: 'replace', cardId: 'world-1', fields: [] }])
        expect(result.current.notice).toBeNull()
    })

    it('final without messages reconciles the optimistic and placeholder messages', async () => {
        const stream = controllableStream()
        const { result } = renderHook(() => useCardAssistant(hookOptions()))

        let sendPromise!: Promise<void>
        act(() => {
            sendPromise = result.current.send('Generate it')
        })
        await waitFor(() => expect(mocks.streamCardAssistantMessage).toHaveBeenCalled())
        act(() => stream.emit!({ type: 'assistant_delta', delta: 'Working' }))
        act(() => stream.emit!({
            type: 'final',
            conversation: CONVO,
            user_message: message({ message_id: 20, content: 'Generate it' }),
            assistant_message: message({ message_id: 21, role: 'assistant', content: 'Done.' }),
        }))
        act(() => stream.resolve!())
        await act(async () => { await sendPromise })

        expect(result.current.turns.map((turn) => turn.message.message_id)).toEqual([20, 21])
        expect(result.current.turns[1].message.content).toBe('Done.')
    })

    it('a stream error event marks a failed turn and offers retry, which re-sends the same text', async () => {
        const stream = controllableStream()
        const { result } = renderHook(() => useCardAssistant(hookOptions()))

        let sendPromise!: Promise<void>
        act(() => {
            sendPromise = result.current.send('Generate it')
        })
        await waitFor(() => expect(mocks.streamCardAssistantMessage).toHaveBeenCalled())
        act(() => stream.emit!({ type: 'error', detail: 'The upstream provider is unavailable.', error: { retryable: true } }))
        act(() => stream.emit!({ type: 'done' }))
        act(() => stream.resolve!())
        await act(async () => { await sendPromise })

        const failed = last(result.current.turns)
        expect(failed?.message.status).toBe('failed')
        expect(result.current.notice).toMatchObject({ kind: 'error', canRetry: true })

        act(() => result.current.retry())
        await waitFor(() => expect(mocks.streamCardAssistantMessage).toHaveBeenCalledTimes(2))
        expect(mocks.streamCardAssistantMessage.mock.calls[1][1]).toMatchObject({ message: 'Generate it' })
    })

    it('409 busy removes the optimistic message and offers reload + retry', async () => {
        mocks.streamCardAssistantMessage.mockRejectedValue(new ApiError(409, 'busy', { category: 'conversation_busy' }))
        const { result } = renderHook(() => useCardAssistant(hookOptions()))

        await act(async () => { await result.current.send('Generate it') })

        expect(result.current.turns).toHaveLength(0)
        expect(result.current.notice).toMatchObject({ kind: 'error', canRetry: true, canReload: true })
    })

    it('a non-retryable quota error removes the optimistic message without offering retry', async () => {
        mocks.streamCardAssistantMessage.mockRejectedValue(new ApiError(429, 'AI card generation credit limit reached.', {
            category: 'quota_exceeded',
            retryable: false,
        }))
        const { result } = renderHook(() => useCardAssistant(hookOptions()))

        await act(async () => { await result.current.send('Generate it') })

        expect(result.current.turns).toHaveLength(0)
        expect(result.current.notice).toMatchObject({
            kind: 'error',
            message: 'AI card generation credit limit reached.',
            canRetry: false,
        })
    })

    it('a local timeout keeps the partial reply flagged as interrupted and offers reload', async () => {
        const stream = controllableStream()
        const { result } = renderHook(() => useCardAssistant(hookOptions()))

        let sendPromise!: Promise<void>
        act(() => {
            sendPromise = result.current.send('Generate it')
        })
        await waitFor(() => expect(mocks.streamCardAssistantMessage).toHaveBeenCalled())
        act(() => stream.emit!({ type: 'assistant_delta', delta: 'Partial tale' }))
        act(() => stream.reject!(new ApiError(0, 'Local wait timed out.', { category: 'timeout', retryable: true, action: 'reload_conversation' })))
        await act(async () => { await sendPromise })

        const partial = last(result.current.turns)
        expect(partial?.message.content).toBe('Partial tale')
        expect(partial?.isInterrupted).toBe(true)
        expect(result.current.notice).toMatchObject({ kind: 'error', canReload: true })
    })

    it('stop() aborts the stream, keeps the partial reply, and shows an info notice', async () => {
        const stream = controllableStream()
        const { result } = renderHook(() => useCardAssistant(hookOptions()))

        let sendPromise!: Promise<void>
        act(() => {
            sendPromise = result.current.send('Generate it')
        })
        await waitFor(() => expect(mocks.streamCardAssistantMessage).toHaveBeenCalled())
        act(() => stream.emit!({ type: 'assistant_delta', delta: 'Partial' }))

        act(() => result.current.stop())
        await act(async () => { await sendPromise })

        expect(stream.lastOptions?.signal?.aborted).toBe(true)
        const partial = last(result.current.turns)
        expect(partial?.message.content).toBe('Partial')
        expect(partial?.isInterrupted).toBe(true)
        expect(result.current.notice).toMatchObject({ kind: 'info', canReload: true })
        expect(result.current.status).toBe('idle')
    })

    it('a stream that ends without final auto-reloads and applies the recovered card', async () => {
        mocks.listCardAssistantConversations.mockResolvedValue({ conversations: [CONVO] })
        const stream = controllableStream()
        const onCard = vi.fn()
        const { result } = renderHook(() => useCardAssistant(hookOptions({ onCard })))

        act(() => result.current.openPanel())
        await waitFor(() => expect(result.current.activeConversation).not.toBeNull())

        const recoveredCard = { id: 'world-1', name: 'Recovered Glass' }
        mocks.getCardAssistantConversation.mockResolvedValue({
            conversation: CONVO,
            messages: [
                message({ message_id: 20, content: 'Generate it' }),
                message({ message_id: 21, role: 'assistant', content: 'Recovered reply.' }),
            ],
            card: recoveredCard,
        })

        let sendPromise!: Promise<void>
        act(() => {
            sendPromise = result.current.send('Generate it')
        })
        await waitFor(() => expect(mocks.streamCardAssistantMessage).toHaveBeenCalled())
        act(() => stream.emit!({ type: 'done' }))
        act(() => stream.resolve!())
        await act(async () => { await sendPromise })

        // Initial open + recovery reload.
        expect(mocks.getCardAssistantConversation).toHaveBeenCalledTimes(2)
        expect(last(result.current.turns)?.message.content).toBe('Recovered reply.')
        expect(onCard).toHaveBeenCalledWith(recoveredCard)
        expect(result.current.pendingCard).toBeNull()
        expect(result.current.notice).toBeNull()
    })
})

describe('useCardAssistant: sessions', () => {
    it('newConversation resets locally without calling the API', async () => {
        mocks.listCardAssistantConversations.mockResolvedValue({ conversations: [CONVO] })
        mocks.getCardAssistantConversation.mockResolvedValue({ conversation: CONVO, messages: [message({ message_id: 10, content: 'old' })], card: null })
        const { result } = renderHook(() => useCardAssistant(hookOptions()))

        act(() => result.current.openPanel())
        await waitFor(() => expect(result.current.turns).toHaveLength(1))

        act(() => result.current.newConversation())

        expect(result.current.activeConversation).toBeNull()
        expect(result.current.turns).toHaveLength(0)
        expect(mocks.createCardAssistantConversation).not.toHaveBeenCalled()
    })

    it('selectConversation loads history and stages the card snapshot instead of applying it', async () => {
        const onCard = vi.fn()
        mocks.listCardAssistantConversations.mockResolvedValue({ conversations: [CONVO, { ...CONVO, conversation_id: 3 }] })
        const { result } = renderHook(() => useCardAssistant(hookOptions({ onCard })))

        act(() => result.current.openPanel())
        await waitFor(() => expect(result.current.activeConversation).not.toBeNull())

        const snapshot = { id: 'world-9', name: 'Older Glass' }
        mocks.getCardAssistantConversation.mockResolvedValue({
            conversation: { ...CONVO, conversation_id: 3 },
            messages: [message({ message_id: 30, conversation_id: 3, content: 'older chat' })],
            card: snapshot,
        })

        await act(async () => { await result.current.selectConversation(3) })

        expect(result.current.turns.map((turn) => turn.message.message_id)).toEqual([30])
        expect(onCard).not.toHaveBeenCalled()
        expect(result.current.pendingCard).toEqual(snapshot)

        act(() => result.current.applyPendingCard())
        expect(onCard).toHaveBeenCalledWith(snapshot)
        expect(result.current.pendingCard).toBeNull()
    })

    it('manual reload stages a recovered card snapshot behind explicit Apply', async () => {
        const onCard = vi.fn()
        mocks.listCardAssistantConversations.mockResolvedValue({ conversations: [CONVO] })
        mocks.getCardAssistantConversation.mockResolvedValue({ conversation: CONVO, messages: [], card: null })
        const { result } = renderHook(() => useCardAssistant(hookOptions({ onCard })))

        act(() => result.current.openPanel())
        await waitFor(() => expect(result.current.activeConversation).not.toBeNull())

        const snapshot = { id: 'world-10', name: 'Reloaded Glass' }
        mocks.getCardAssistantConversation.mockResolvedValue({
            conversation: { ...CONVO, card_id: 'world-10' },
            messages: [message({ message_id: 40, role: 'assistant', content: 'Recovered card.' })],
            card: snapshot,
        })

        await act(async () => { await result.current.reloadConversation() })

        expect(onCard).not.toHaveBeenCalled()
        expect(result.current.pendingCard).toEqual(snapshot)

        act(() => result.current.applyPendingCard())
        expect(onCard).toHaveBeenCalledWith(snapshot)
        expect(result.current.pendingCard).toBeNull()
    })

    it('deleteConversation removes the row and switches to the next conversation when active', async () => {
        const other = { ...CONVO, conversation_id: 3, title: 'Other' }
        mocks.listCardAssistantConversations.mockResolvedValue({ conversations: [CONVO, other] })
        mocks.getCardAssistantConversation.mockResolvedValue({ conversation: CONVO, messages: [], card: null })
        const { result } = renderHook(() => useCardAssistant(hookOptions()))

        act(() => result.current.openPanel())
        await waitFor(() => expect(result.current.activeConversation).not.toBeNull())

        mocks.getCardAssistantConversation.mockResolvedValue({ conversation: other, messages: [message({ message_id: 31, conversation_id: 3, content: 'other history' })], card: null })
        await act(async () => { await result.current.deleteConversation(2) })

        expect(mocks.deleteCardAssistantConversation).toHaveBeenCalledWith(2, expect.any(Object))
        expect(result.current.conversations.map((item) => item.conversation_id)).toEqual([3])
        expect(result.current.activeConversation?.conversation_id).toBe(3)
        expect(result.current.turns.map((turn) => turn.message.content)).toEqual(['other history'])
    })

    it('deleteConversation surfaces a busy notice on 409 and keeps the list intact', async () => {
        mocks.listCardAssistantConversations.mockResolvedValue({ conversations: [CONVO] })
        mocks.getCardAssistantConversation.mockResolvedValue({ conversation: CONVO, messages: [], card: null })
        mocks.deleteCardAssistantConversation.mockRejectedValue(new ApiError(409, 'busy', { category: 'conversation_busy' }))
        const { result } = renderHook(() => useCardAssistant(hookOptions()))

        act(() => result.current.openPanel())
        await waitFor(() => expect(result.current.activeConversation).not.toBeNull())

        await act(async () => { await result.current.deleteConversation(2) })

        expect(result.current.conversations).toHaveLength(1)
        expect(result.current.notice).toMatchObject({ kind: 'error' })
    })
})
