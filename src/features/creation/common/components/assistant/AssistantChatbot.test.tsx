import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AssistantConversation, AssistantStreamEvent, AssistantTurnResponse } from '@/shared/types/assistant.types'
import type { Lorebook } from '@/shared/types/lorebook.types'

const mocks = vi.hoisted(() => ({
    createAssistantConversation: vi.fn(),
    listAssistantConversations: vi.fn(),
    getAssistantConversation: vi.fn(),
    getAssistantTurn: vi.fn(),
    deleteAssistantConversation: vi.fn(),
    streamAssistantMessage: vi.fn(),
}))

const navigation = vi.hoisted(() => ({ currentHash: '', replaceHash: vi.fn() }))

vi.mock('@/app/hooks', () => ({ useNavigation: () => navigation }))

vi.mock('@/infrastructure/api', () => {
    class ApiError extends Error {
        status: number
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
    return {
        ApiError,
        apiService: mocks,
        resolveMediaUrl: (url?: string | null) => url ?? undefined,
        isProtectedMediaUrl: () => false,
    }
})

import { ApiError } from '@/infrastructure/api'
import { lorebookAssistantAdapter } from '@/features/lorebook/lorebookAssistantAdapter'
import { DEFAULT_LOREBOOK_SETTINGS } from '@/features/lorebook/lorebookTransforms'
import { assistantConversationFixture, assistantTurnFixture } from '@/test/assistantFixtures'
import { AssistantChatbot } from './AssistantChatbot'
import { cardAssistantAdapter } from './cardAssistantAdapter'

const CONVO = assistantConversationFixture('card', { title: 'Alpha', updated_at: '2026-06-10T10:00:00Z' })
const OTHER = assistantConversationFixture('card', { conversation_id: 3, title: 'Beta', updated_at: '2026-06-09T10:00:00Z' })
const CARD_ASSISTANT_POSITION_KEY = 'magic_worlds:assistant_position:v1:card-assistant'

function cardProps(overrides: Record<string, unknown> = {}) {
    return {
        adapter: cardAssistantAdapter,
        binding: { cardType: 'world' as const, targetId: null, title: 'Untitled World', current: { name: '' } },
        onTarget: vi.fn(),
        isAuthenticated: true,
        onAuthRequired: vi.fn(),
        ...overrides,
    }
}

function openPanel(name = /open card assistant/i) {
    fireEvent.click(screen.getByRole('button', { name }))
}

function sendMessage(text: string, placeholder = /ask for a change/i) {
    fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value: text } })
    fireEvent.click(screen.getByRole('button', { name: /send message/i }))
}

function finalEvent(requestId: string, overrides: Partial<AssistantTurnResponse<'card'>> = {}, conversation: AssistantConversation = CONVO): AssistantStreamEvent<'card'> {
    return { type: 'final', ...assistantTurnFixture('card', requestId, { conversation, ...overrides }) }
}

type StreamHandler = (id: number, body: unknown, onEvent: (event: AssistantStreamEvent) => void, settings: { requestId: string; signal?: AbortSignal }) => Promise<void>

beforeEach(() => {
    vi.clearAllMocks()
    navigation.currentHash = ''
    localStorage.removeItem(CARD_ASSISTANT_POSITION_KEY)
    mocks.listAssistantConversations.mockResolvedValue({ conversations: [] })
    mocks.createAssistantConversation.mockResolvedValue({ conversation: CONVO, messages: [], target: null, target_cas: null })
    mocks.getAssistantConversation.mockResolvedValue({ conversation: CONVO, messages: [], target: null, target_cas: null })
    mocks.getAssistantTurn.mockResolvedValue(null)
    mocks.deleteAssistantConversation.mockResolvedValue(undefined)
    mocks.streamAssistantMessage.mockImplementation((async (_id, _body, onEvent, settings) => {
        onEvent(finalEvent(settings.requestId))
    }) satisfies StreamHandler)
})

describe('AssistantChatbot (card)', () => {
    it('opens on a conversation handed over from the assistant page and drops the hand-off from the URL', async () => {
        navigation.currentHash = '#/world?card=x-1&assistant=3'
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [CONVO, OTHER] })
        mocks.getAssistantConversation.mockResolvedValue({
            conversation: OTHER,
            messages: [{ message_id: 1, conversation_id: 3, sequence_no: 1, role: 'user', status: 'completed', content: 'Make it misty' }],
            target: null,
            target_cas: null,
        })
        render(<AssistantChatbot {...cardProps()} />)

        expect(screen.getByRole('dialog', { name: /card assistant/i })).toBeInTheDocument()
        expect(await screen.findByText('Make it misty')).toBeInTheDocument()
        expect(mocks.getAssistantConversation).toHaveBeenCalledWith('card', 3, expect.any(Object))
        expect(navigation.replaceHash).toHaveBeenCalledWith('#/world?card=x-1')
    })

    it('stays closed without a hand-off', () => {
        navigation.currentHash = '#/world?card=x-1'
        render(<AssistantChatbot {...cardProps()} />)
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(navigation.replaceHash).not.toHaveBeenCalled()
    })

    it('opens the panel from the FAB and shows the empty state with suggestions', async () => {
        render(<AssistantChatbot {...cardProps()} />)

        openPanel()

        expect(screen.getByRole('dialog', { name: /card assistant/i })).toBeInTheDocument()
        await waitFor(() => expect(screen.getByText('Shape this card with words')).toBeInTheDocument())
        expect(screen.getByText('Invent a world from scratch')).toBeInTheDocument()
        expect(mocks.listAssistantConversations).toHaveBeenCalledWith({ kind: 'card', card_type: 'world' }, expect.any(Object))
    })

    it('drags the floating panel from the header grip and persists the position', () => {
        render(<AssistantChatbot {...cardProps()} />)

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
        render(<AssistantChatbot {...cardProps()} />)

        openPanel()
        const dialog = screen.getByRole('dialog', { name: /card assistant/i })
        const expectedX = Math.max(16, window.innerWidth - 420 - 16)
        const expectedY = Math.max(16, window.innerHeight - 640 - 16)

        await waitFor(() => expect(dialog).toHaveStyle({ left: `${expectedX}px`, top: `${expectedY}px` }))
    })

    it('keeps the close control clickable while the header has a drag handle', () => {
        render(<AssistantChatbot {...cardProps()} />)

        openPanel()
        fireEvent.click(screen.getByRole('button', { name: /close card assistant/i }))

        expect(screen.queryByRole('dialog', { name: /card assistant/i })).toBeNull()
    })

    it('clicking a suggestion chip sends its prompt through the stream', async () => {
        render(<AssistantChatbot {...cardProps()} />)

        openPanel()
        await waitFor(() => expect(screen.getByText('Invent a world from scratch')).toBeInTheDocument())
        fireEvent.click(screen.getByText('Invent a world from scratch'))

        await waitFor(() => expect(mocks.streamAssistantMessage).toHaveBeenCalledTimes(1))
        expect(mocks.streamAssistantMessage.mock.calls[0][1]).toMatchObject({
            kind: 'card',
            message: expect.stringContaining('Invent a new world from scratch'),
        })
    })

    it('renders assistant replies as markdown', async () => {
        mocks.streamAssistantMessage.mockImplementation((async (_id, _body, onEvent, settings) => {
            onEvent(finalEvent(settings.requestId, {
                assistant_message: { message_id: 21, conversation_id: 2, sequence_no: 2, role: 'assistant', status: 'completed', content: 'I renamed it to **Glass**.' },
            }))
        }) satisfies StreamHandler)
        render(<AssistantChatbot {...cardProps()} />)

        openPanel()
        sendMessage('Rename it')

        await waitFor(() => expect(screen.getByText('Glass')).toBeInTheDocument())
        expect(screen.getByText('Glass').tagName).toBe('STRONG')
    })

    it('shows applied-change chips from the final event', async () => {
        mocks.streamAssistantMessage.mockImplementation((async (_id, _body, onEvent, settings) => {
            onEvent(finalEvent(settings.requestId, {
                applied_actions: [{ type: 'patch_card', target_id: 'world-1', fields: ['name', 'description'] }],
            }))
        }) satisfies StreamHandler)
        render(<AssistantChatbot {...cardProps()} />)

        openPanel()
        sendMessage('Rename it')

        await waitFor(() => expect(screen.getByText('Updated: name, description')).toBeInTheDocument())
    })

    it('offers Stop during a hanging stream and aborts on click', async () => {
        let abortSignal: AbortSignal | undefined
        mocks.streamAssistantMessage.mockImplementation(((_id, _body, _onEvent, options) => {
            abortSignal = options.signal
            return new Promise<void>((_resolve, reject) => {
                options.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
            })
        }) satisfies StreamHandler)
        render(<AssistantChatbot {...cardProps()} />)

        openPanel()
        sendMessage('Generate something long')

        const stopButton = await screen.findByRole('button', { name: /stop response/i })
        fireEvent.click(stopButton)

        await waitFor(() => expect(abortSignal?.aborted).toBe(true))
        await waitFor(() => expect(screen.getByText(/stopped\. the assistant may still finish/i)).toBeInTheDocument())
        expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument()
    })

    it('lists conversations in the menu and resets locally via New chat', async () => {
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [CONVO, OTHER] })
        mocks.getAssistantConversation.mockResolvedValue({
            conversation: CONVO,
            messages: [{ message_id: 10, conversation_id: 2, sequence_no: 1, role: 'user', status: 'completed', content: 'old message' }],
            target: null,
            target_cas: null,
        })
        render(<AssistantChatbot {...cardProps()} />)

        openPanel()
        await waitFor(() => expect(screen.getByText('old message')).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: /conversations/i }))
        expect(screen.getByRole('menu')).toBeInTheDocument()
        expect(screen.getByText('Alpha')).toBeInTheDocument()
        expect(screen.getByText('Beta')).toBeInTheDocument()

        fireEvent.click(screen.getByText('New chat'))

        await waitFor(() => expect(screen.getByText('Shape this card with words')).toBeInTheDocument())
        expect(mocks.createAssistantConversation).not.toHaveBeenCalled()
    })

    it('resets locally from the header New chat shortcut', async () => {
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [CONVO] })
        mocks.getAssistantConversation.mockResolvedValue({
            conversation: CONVO,
            messages: [{ message_id: 10, conversation_id: 2, sequence_no: 1, role: 'user', status: 'completed', content: 'old message' }],
            target: null,
            target_cas: null,
        })
        render(<AssistantChatbot {...cardProps()} />)

        openPanel()
        await waitFor(() => expect(screen.getByText('old message')).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: /new chat/i }))

        await waitFor(() => expect(screen.getByText('Shape this card with words')).toBeInTheDocument())
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
        expect(mocks.createAssistantConversation).not.toHaveBeenCalled()
    })

    it('deletes a conversation after the inline confirm', async () => {
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [CONVO, OTHER] })
        render(<AssistantChatbot {...cardProps()} />)

        openPanel()
        await waitFor(() => expect(mocks.getAssistantConversation).toHaveBeenCalled())

        fireEvent.click(screen.getByRole('button', { name: /conversations/i }))
        fireEvent.click(screen.getByRole('button', { name: /delete beta/i }))
        fireEvent.click(screen.getByText('Delete?'))

        await waitFor(() => expect(mocks.deleteAssistantConversation).toHaveBeenCalledWith('card', 3, expect.any(Object)))
    })

    it('stages a switched conversation card behind an explicit Apply', async () => {
        const onTarget = vi.fn()
        const snapshot = { id: 'world-9', name: 'Older Glass' }
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [CONVO, OTHER] })
        render(<AssistantChatbot {...cardProps({ onTarget })} />)

        openPanel()
        await waitFor(() => expect(mocks.getAssistantConversation).toHaveBeenCalled())

        mocks.getAssistantConversation.mockResolvedValue({
            conversation: OTHER,
            messages: [{ message_id: 30, conversation_id: 3, sequence_no: 1, role: 'user', status: 'completed', content: 'older chat' }],
            target: snapshot,
            target_cas: null,
        })
        fireEvent.click(screen.getByRole('button', { name: /conversations/i }))
        fireEvent.click(screen.getByText('Beta'))

        await waitFor(() => expect(screen.getByText(/saved card snapshot/i)).toBeInTheDocument())
        expect(onTarget).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: /apply to form/i }))
        await waitFor(() => expect(onTarget).toHaveBeenCalledWith(snapshot))
    })

    it('surfaces stream failures with a Retry that re-sends the message', async () => {
        mocks.streamAssistantMessage.mockRejectedValue(new ApiError(502, 'upstream down', { retryable: true }))
        render(<AssistantChatbot {...cardProps()} />)

        openPanel()
        sendMessage('Generate it')

        await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())

        mocks.streamAssistantMessage.mockImplementation((async (_id, _body, onEvent, settings) => {
            onEvent(finalEvent(settings.requestId))
        }) satisfies StreamHandler)
        fireEvent.click(screen.getByRole('button', { name: /retry/i }))

        await waitFor(() => expect(mocks.streamAssistantMessage).toHaveBeenCalledTimes(2))
        expect(mocks.streamAssistantMessage.mock.calls[1][1]).toMatchObject({ message: 'Generate it' })
    })

    it('shows a switched-off assistant as a quiet note with no starters and a disabled composer', async () => {
        mocks.listAssistantConversations.mockRejectedValue(new ApiError(503, 'Disabled', { code: 'ASSISTANT_DISABLED' }))
        render(<AssistantChatbot {...cardProps()} />)

        openPanel()

        await waitFor(() => expect(screen.getByText('This assistant is switched off on this server.')).toBeInTheDocument())
        expect(screen.queryByText('Invent a world from scratch')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument()
        fireEvent.change(screen.getByPlaceholderText(/ask for a change/i), { target: { value: 'Hello' } })
        expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled()
    })
})

describe('AssistantChatbot (lorebook)', () => {
    const draft: Lorebook = {
        id: '', name: 'Saltmarsh lore', description: '', tags: [], enabled: true,
        settings: { ...DEFAULT_LOREBOOK_SETTINGS }, entries: [], attachments: [],
    }

    it('uses the lorebook copy, starters, and conversation scope, and applies a saved lorebook', async () => {
        const saved = { ...draft, id: 'lb-1' }
        const conversation = assistantConversationFixture('lorebook', { title: 'Saltmarsh lore' })
        mocks.createAssistantConversation.mockResolvedValue({ conversation, messages: [], target: null, target_cas: null })
        mocks.streamAssistantMessage.mockImplementation((async (_id, _body, onEvent, settings) => {
            onEvent({ type: 'final', ...assistantTurnFixture('lorebook', settings.requestId, {
                conversation: { ...conversation, lorebook_id: 'lb-1' },
                target: saved,
                applied_actions: [{ type: 'replace_lorebook', target_id: 'lb-1' }],
            }) })
        }) satisfies StreamHandler)
        const onTarget = vi.fn()
        render(
            <AssistantChatbot
                adapter={lorebookAssistantAdapter}
                binding={{ targetId: null, title: 'Saltmarsh lore', current: draft }}
                onTarget={onTarget}
                isAuthenticated
                onAuthRequired={vi.fn()}
            />,
        )

        openPanel(/open lorebook assistant/i)

        expect(screen.getByRole('dialog', { name: /lorebook assistant/i })).toBeInTheDocument()
        await waitFor(() => expect(screen.getByText('Shape this lorebook with words')).toBeInTheDocument())
        expect(screen.getByText('Create a new lorebook')).toBeInTheDocument()
        expect(mocks.listAssistantConversations).toHaveBeenCalledWith({ kind: 'lorebook' }, expect.any(Object))

        sendMessage('Add a guild', /ask for a lorebook change/i)

        await waitFor(() => expect(onTarget).toHaveBeenCalledWith(saved))
        expect(mocks.createAssistantConversation).toHaveBeenCalledWith({ kind: 'lorebook', title: 'Saltmarsh lore' }, expect.any(Object))
        expect(mocks.streamAssistantMessage.mock.calls[0][1]).toMatchObject({ kind: 'lorebook', message: 'Add a guild', current: { name: 'Saltmarsh lore' } })
        expect(screen.getByText('Lorebook saved')).toBeInTheDocument()
    })
})
