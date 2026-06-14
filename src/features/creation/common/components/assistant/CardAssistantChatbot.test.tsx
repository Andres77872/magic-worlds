import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CardAssistantStreamEvent } from '@/shared/types/aiCard.types'

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
    return {
        ApiError,
        apiService: mocks,
        resolveMediaUrl: (url?: string | null) => url ?? undefined,
        isProtectedMediaUrl: () => false,
    }
})

import { ApiError } from '@/infrastructure/api'
import { CardAssistantChatbot } from './CardAssistantChatbot'

const CONVO = { conversation_id: 2, card_type: 'world' as const, card_id: null, title: 'Alpha', updated_at: '2026-06-10T10:00:00Z' }
const OTHER = { conversation_id: 3, card_type: 'world' as const, card_id: null, title: 'Beta', updated_at: '2026-06-09T10:00:00Z' }
const CARD_ASSISTANT_POSITION_KEY = 'magic_worlds:assistant_position:v1:card-assistant'

function defaultProps(overrides: Record<string, unknown> = {}) {
    return {
        cardType: 'world' as const,
        cardId: null,
        title: 'Untitled World',
        currentCard: { name: '' },
        onCard: vi.fn(),
        isAuthenticated: true,
        onAuthRequired: vi.fn(),
        ...overrides,
    }
}

function openPanel() {
    fireEvent.click(screen.getByRole('button', { name: /open card assistant/i }))
}

function sendMessage(text: string) {
    fireEvent.change(screen.getByPlaceholderText(/ask for a change/i), { target: { value: text } })
    fireEvent.click(screen.getByRole('button', { name: /send message/i }))
}

function finalEvent(overrides: Record<string, unknown> = {}): CardAssistantStreamEvent {
    return {
        type: 'final',
        conversation: CONVO,
        user_message: { message_id: 20, conversation_id: 2, sequence_no: 1, role: 'user', status: 'completed', content: 'hi' },
        assistant_message: { message_id: 21, conversation_id: 2, sequence_no: 2, role: 'assistant', status: 'completed', content: 'Done.' },
        ...overrides,
    } as CardAssistantStreamEvent
}

beforeEach(() => {
    vi.clearAllMocks()
    localStorage.removeItem(CARD_ASSISTANT_POSITION_KEY)
    mocks.listCardAssistantConversations.mockResolvedValue({ conversations: [] })
    mocks.createCardAssistantConversation.mockResolvedValue({ conversation: CONVO, messages: [], card: null })
    mocks.getCardAssistantConversation.mockResolvedValue({ conversation: CONVO, messages: [], card: null })
    mocks.deleteCardAssistantConversation.mockResolvedValue(undefined)
    mocks.streamCardAssistantMessage.mockImplementation(async (_id, _body, onEvent: (event: CardAssistantStreamEvent) => void) => {
        onEvent(finalEvent())
    })
})

describe('CardAssistantChatbot', () => {
    it('opens the panel from the FAB and shows the empty state with suggestions', async () => {
        render(<CardAssistantChatbot {...defaultProps()} />)

        openPanel()

        expect(screen.getByRole('dialog', { name: /card assistant/i })).toBeInTheDocument()
        await waitFor(() => expect(screen.getByText('Shape this card with words')).toBeInTheDocument())
        expect(screen.getByText('Invent a world from scratch')).toBeInTheDocument()
    })

    it('drags the floating panel from the header grip and persists the position', () => {
        render(<CardAssistantChatbot {...defaultProps()} />)

        openPanel()
        const dialog = screen.getByRole('dialog', { name: /card assistant/i })
        vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
            x: 460,
            y: 40,
            left: 460,
            top: 40,
            right: 880,
            bottom: 680,
            width: 420,
            height: 640,
            toJSON: () => ({}),
        } as DOMRect)

        const handle = screen.getByRole('button', { name: /drag assistant/i })
        fireEvent.pointerDown(handle, { pointerId: 5, button: 0, clientX: 470, clientY: 50 })
        fireEvent.pointerMove(handle, { pointerId: 5, clientX: 520, clientY: 90 })
        fireEvent.pointerUp(handle, { pointerId: 5, clientX: 520, clientY: 90 })

        expect(dialog).toHaveStyle({ left: '510px', top: '80px' })
        expect(JSON.parse(localStorage.getItem(CARD_ASSISTANT_POSITION_KEY) ?? 'null')).toEqual({ x: 510, y: 80 })
    })

    it('restores and clamps a saved floating panel position', async () => {
        localStorage.setItem(CARD_ASSISTANT_POSITION_KEY, JSON.stringify({ x: 9999, y: 9999 }))
        render(<CardAssistantChatbot {...defaultProps()} />)

        openPanel()
        const dialog = screen.getByRole('dialog', { name: /card assistant/i })
        const expectedX = Math.max(16, window.innerWidth - 420 - 16)
        const expectedY = Math.max(16, window.innerHeight - 640 - 16)

        await waitFor(() => expect(dialog).toHaveStyle({ left: `${expectedX}px`, top: `${expectedY}px` }))
    })

    it('keeps the close control clickable while the header has a drag handle', () => {
        render(<CardAssistantChatbot {...defaultProps()} />)

        openPanel()
        fireEvent.click(screen.getByRole('button', { name: /close card assistant/i }))

        expect(screen.queryByRole('dialog', { name: /card assistant/i })).toBeNull()
    })

    it('clicking a suggestion chip sends its prompt through the stream', async () => {
        render(<CardAssistantChatbot {...defaultProps()} />)

        openPanel()
        await waitFor(() => expect(screen.getByText('Invent a world from scratch')).toBeInTheDocument())
        fireEvent.click(screen.getByText('Invent a world from scratch'))

        await waitFor(() => expect(mocks.streamCardAssistantMessage).toHaveBeenCalledTimes(1))
        expect(mocks.streamCardAssistantMessage.mock.calls[0][1]).toMatchObject({
            message: expect.stringContaining('Invent a new world from scratch'),
        })
    })

    it('renders assistant replies as markdown', async () => {
        mocks.streamCardAssistantMessage.mockImplementation(async (_id, _body, onEvent: (event: CardAssistantStreamEvent) => void) => {
            onEvent(finalEvent({
                assistant_message: { message_id: 21, conversation_id: 2, sequence_no: 2, role: 'assistant', status: 'completed', content: 'I renamed it to **Glass**.' },
            }))
        })
        render(<CardAssistantChatbot {...defaultProps()} />)

        openPanel()
        sendMessage('Rename it')

        await waitFor(() => expect(screen.getByText('Glass')).toBeInTheDocument())
        expect(screen.getByText('Glass').tagName).toBe('STRONG')
    })

    it('shows applied-change chips from the final event', async () => {
        mocks.streamCardAssistantMessage.mockImplementation(async (_id, _body, onEvent: (event: CardAssistantStreamEvent) => void) => {
            onEvent(finalEvent({
                applied_actions: [{ type: 'patch_card', card_id: 'world-1', fields: ['name', 'description'] }],
            }))
        })
        render(<CardAssistantChatbot {...defaultProps()} />)

        openPanel()
        sendMessage('Rename it')

        await waitFor(() => expect(screen.getByText('Updated: name, description')).toBeInTheDocument())
    })

    it('offers Stop during a hanging stream and aborts on click', async () => {
        let abortSignal: AbortSignal | undefined
        mocks.streamCardAssistantMessage.mockImplementation(
            (_id, _body, _onEvent, options: { signal?: AbortSignal }) => {
                abortSignal = options.signal
                return new Promise<void>((_resolve, reject) => {
                    options.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
                })
            },
        )
        render(<CardAssistantChatbot {...defaultProps()} />)

        openPanel()
        sendMessage('Generate something long')

        const stopButton = await screen.findByRole('button', { name: /stop response/i })
        fireEvent.click(stopButton)

        await waitFor(() => expect(abortSignal?.aborted).toBe(true))
        await waitFor(() => expect(screen.getByText(/stopped\. the assistant may still finish/i)).toBeInTheDocument())
        expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument()
    })

    it('lists conversations in the menu and resets locally via New chat', async () => {
        mocks.listCardAssistantConversations.mockResolvedValue({ conversations: [CONVO, OTHER] })
        mocks.getCardAssistantConversation.mockResolvedValue({
            conversation: CONVO,
            messages: [{ message_id: 10, conversation_id: 2, sequence_no: 1, role: 'user', status: 'completed', content: 'old message' }],
            card: null,
        })
        render(<CardAssistantChatbot {...defaultProps()} />)

        openPanel()
        await waitFor(() => expect(screen.getByText('old message')).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: /conversations/i }))
        expect(screen.getByRole('menu')).toBeInTheDocument()
        expect(screen.getByText('Alpha')).toBeInTheDocument()
        expect(screen.getByText('Beta')).toBeInTheDocument()

        fireEvent.click(screen.getByText('New chat'))

        await waitFor(() => expect(screen.getByText('Shape this card with words')).toBeInTheDocument())
        expect(mocks.createCardAssistantConversation).not.toHaveBeenCalled()
    })

    it('resets locally from the header New chat shortcut', async () => {
        mocks.listCardAssistantConversations.mockResolvedValue({ conversations: [CONVO] })
        mocks.getCardAssistantConversation.mockResolvedValue({
            conversation: CONVO,
            messages: [{ message_id: 10, conversation_id: 2, sequence_no: 1, role: 'user', status: 'completed', content: 'old message' }],
            card: null,
        })
        render(<CardAssistantChatbot {...defaultProps()} />)

        openPanel()
        await waitFor(() => expect(screen.getByText('old message')).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: /new chat/i }))

        await waitFor(() => expect(screen.getByText('Shape this card with words')).toBeInTheDocument())
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
        expect(mocks.createCardAssistantConversation).not.toHaveBeenCalled()
    })

    it('deletes a conversation after the inline confirm', async () => {
        mocks.listCardAssistantConversations.mockResolvedValue({ conversations: [CONVO, OTHER] })
        render(<CardAssistantChatbot {...defaultProps()} />)

        openPanel()
        await waitFor(() => expect(mocks.getCardAssistantConversation).toHaveBeenCalled())

        fireEvent.click(screen.getByRole('button', { name: /conversations/i }))
        fireEvent.click(screen.getByRole('button', { name: /delete beta/i }))
        fireEvent.click(screen.getByText('Delete?'))

        await waitFor(() => expect(mocks.deleteCardAssistantConversation).toHaveBeenCalledWith(3, expect.any(Object)))
    })

    it('stages a switched conversation card behind an explicit Apply', async () => {
        const onCard = vi.fn()
        const snapshot = { id: 'world-9', name: 'Older Glass' }
        mocks.listCardAssistantConversations.mockResolvedValue({ conversations: [CONVO, OTHER] })
        render(<CardAssistantChatbot {...defaultProps({ onCard })} />)

        openPanel()
        await waitFor(() => expect(mocks.getCardAssistantConversation).toHaveBeenCalled())

        mocks.getCardAssistantConversation.mockResolvedValue({
            conversation: OTHER,
            messages: [{ message_id: 30, conversation_id: 3, sequence_no: 1, role: 'user', status: 'completed', content: 'older chat' }],
            card: snapshot,
        })
        fireEvent.click(screen.getByRole('button', { name: /conversations/i }))
        fireEvent.click(screen.getByText('Beta'))

        await waitFor(() => expect(screen.getByText(/saved card snapshot/i)).toBeInTheDocument())
        expect(onCard).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: /apply to form/i }))
        await waitFor(() => expect(onCard).toHaveBeenCalledWith(snapshot))
    })

    it('surfaces stream failures with a Retry that re-sends the message', async () => {
        mocks.streamCardAssistantMessage.mockRejectedValue(new ApiError(502, 'upstream down', { retryable: true }))
        render(<CardAssistantChatbot {...defaultProps()} />)

        openPanel()
        sendMessage('Generate it')

        await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())

        mocks.streamCardAssistantMessage.mockImplementation(async (_id, _body, onEvent: (event: CardAssistantStreamEvent) => void) => {
            onEvent(finalEvent())
        })
        fireEvent.click(screen.getByRole('button', { name: /retry/i }))

        await waitFor(() => expect(mocks.streamCardAssistantMessage).toHaveBeenCalledTimes(2))
        expect(mocks.streamCardAssistantMessage.mock.calls[1][1]).toMatchObject({ message: 'Generate it' })
    })
})
