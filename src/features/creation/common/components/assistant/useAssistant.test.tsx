import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
    AssistantCardDocument,
    AssistantChatMessage,
    AssistantConversation,
    AssistantKind,
    AssistantStreamEvent,
    AssistantTargetOf,
    AssistantTurnResponse,
} from '@/shared/types/assistant.types'
import type { Lorebook } from '@/shared/types/lorebook.types'
import {
    createWorkspaceTestState,
    OTHER_WORKSPACE_ID,
    TEST_COLLECTION_ID,
    TEST_WORKSPACE_ID,
    type WorkspaceTestState,
} from '@/shared/hooks/testing/workspaceTestUtils'

const mocks = vi.hoisted(() => ({
    createAssistantConversation: vi.fn(),
    listAssistantConversations: vi.fn(),
    getAssistantConversation: vi.fn(),
    getAssistantTurn: vi.fn(),
    deleteAssistantConversation: vi.fn(),
    streamAssistantMessage: vi.fn(),
    withWorkspace: vi.fn(),
    workspace: null as WorkspaceTestState | null,
}))

// Workspace R1: conversations and turns go through the conversation's workspace client.
vi.mock('@/app/hooks/useWorkspace', () => ({ useWorkspace: () => mocks.workspace!.value() }))

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

import { i18n } from '@/app/i18n'
import { ApiError } from '@/infrastructure/api'
import { appAssistantAdapter } from '@/features/appAssistant/appAssistantAdapter'
import { lorebookAssistantAdapter } from '@/features/lorebook/lorebookAssistantAdapter'
import { DEFAULT_LOREBOOK_SETTINGS } from '@/features/lorebook/lorebookTransforms'
import { assistantConversationFixture, assistantTurnFixture } from '@/test/assistantFixtures'
import type { AssistantAdapter, AssistantBindings } from './assistantModel'
import { cardAssistantAdapter } from './cardAssistantAdapter'
import { useAssistant } from './useAssistant'

type Kind = AssistantKind
type Target = AssistantTargetOf<AssistantKind>

const KINDS = ['card', 'lorebook', 'app'] as const
const DOCUMENT_KINDS = ['card', 'lorebook'] as const

const ADAPTERS = {
    card: cardAssistantAdapter,
    lorebook: lorebookAssistantAdapter,
    app: appAssistantAdapter,
} as unknown as Record<Kind, AssistantAdapter<Kind>>

const LOREBOOK: Lorebook = {
    id: '', name: 'Saltmarsh lore', description: '', tags: [], enabled: true,
    settings: { ...DEFAULT_LOREBOOK_SETTINGS }, entries: [], attachments: [],
}

const PUBLISHED_REVISION = {
    latest_version_id: 'version-3', latest_version_number: 3, has_draft: false,
    draft_updated_at: null, draft_based_on_version_number: null,
}
const TARGET_CAS = { revision: '2026-09-19T00:43:33', content_hash: 'a'.repeat(64) }

/** The saved document a bound conversation of each kind edits. */
const SAVED: Record<'card' | 'lorebook', Target> = {
    card: { id: 'x-1', name: 'Saved Glass', ...PUBLISHED_REVISION } as unknown as AssistantCardDocument,
    lorebook: { ...LOREBOOK, id: 'x-1', name: 'Saved lore' },
}

function binding(kind: Kind, targetId: string | null = null): AssistantBindings[Kind] {
    if (kind === 'card') return { cardType: 'world', targetId, title: 'Untitled World', current: { name: 'Glass' } }
    if (kind === 'lorebook') return { targetId, title: 'Lore', current: targetId ? { ...LOREBOOK, id: targetId } : LOREBOOK }
    return { context: '## Library cards\n- Mira', locale: 'en', page: '#/gallery/lorebooks' }
}

/** The same target with edits that do not move it to another document. */
function edited(kind: Kind): AssistantBindings[Kind] {
    if (kind === 'card') return { ...binding('card'), current: { name: 'Edited' } } as AssistantBindings[Kind]
    if (kind === 'lorebook') return { ...binding('lorebook'), current: { ...LOREBOOK, name: 'Edited' } } as AssistantBindings[Kind]
    return { ...binding('app'), context: 'changed' } as AssistantBindings[Kind]
}

const CREATE: Record<Kind, Record<string, unknown>> = {
    card: { kind: 'card', card_type: 'world', title: 'Untitled World' },
    lorebook: { kind: 'lorebook', title: 'Lore' },
    app: { kind: 'app', title: 'Hello there' },
}

function conversation(kind: Kind, overrides: Partial<AssistantConversation> = {}): AssistantConversation {
    return assistantConversationFixture(kind, { title: 'Alpha', updated_at: '2026-10-10T10:00:00Z', ...overrides })
}

function bound(kind: 'card' | 'lorebook', id = 'x-1', overrides: Partial<AssistantConversation> = {}): AssistantConversation {
    return conversation(kind, { conversation_id: 5, ...(kind === 'card' ? { card_id: id } : { lorebook_id: id }), ...overrides })
}

function message(overrides: Partial<AssistantChatMessage>): AssistantChatMessage {
    return { message_id: 1, conversation_id: 2, sequence_no: 1, role: 'user', status: 'completed', content: '', ...overrides }
}

function finalEvent(kind: Kind, requestId: string, overrides: Partial<AssistantTurnResponse> = {}): AssistantStreamEvent {
    return { type: 'final', ...assistantTurnFixture(kind, requestId, overrides as Partial<AssistantTurnResponse<typeof kind>>) } as AssistantStreamEvent
}

function last<T>(items: T[]): T | undefined {
    return items[items.length - 1]
}

interface HookProps {
    kind: Kind
    binding: AssistantBindings[Kind]
    onTarget: (target: Target) => void
    isAuthenticated: boolean
    onAuthRequired: () => void
    initialConversationId?: number | null
    onActiveConversationChange: (id: number | null) => void
    workspaceId?: string | null
    initialCollectionIds?: readonly string[]
}

function setup(kind: Kind, overrides: Partial<HookProps> = {}) {
    const props: HookProps = {
        kind,
        binding: binding(kind),
        onTarget: vi.fn(),
        isAuthenticated: true,
        onAuthRequired: vi.fn(),
        onActiveConversationChange: vi.fn(),
        ...overrides,
    }
    const view = renderHook(({ kind: hookKind, ...options }: HookProps) => useAssistant({ ...options, adapter: ADAPTERS[hookKind] }), { initialProps: props })
    return { ...view, props }
}

/** Mounts the hook; the page kind loads its history first, a panel stays closed. */
async function mount(kind: Kind, overrides: Partial<HookProps> = {}) {
    const view = setup(kind, overrides)
    if (kind === 'app') await waitFor(() => expect(view.result.current.ready).toBe(true))
    return view
}

/** Stream mock with externally controllable events and completion. */
function controllableStream() {
    const handles = {
        emit: undefined as ((event: AssistantStreamEvent) => void) | undefined,
        resolve: undefined as (() => void) | undefined,
        reject: undefined as ((reason: unknown) => void) | undefined,
        requestId: undefined as string | undefined,
        signal: undefined as AbortSignal | undefined,
    }
    mocks.streamAssistantMessage.mockImplementation(
        (_id: number, _body: unknown, onEvent: (event: AssistantStreamEvent) => void, options: { signal?: AbortSignal; requestId?: string }) => {
            handles.emit = onEvent
            handles.requestId = options.requestId
            handles.signal = options.signal
            return new Promise<void>((resolve, reject) => {
                handles.resolve = resolve
                handles.reject = reject
                options.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
            })
        },
    )
    return handles
}

const streamCalls = () => mocks.streamAssistantMessage.mock.calls as [number, Record<string, unknown>, unknown, { requestId: string; llm?: unknown }][]

/** The workspace scope (id + initial collections) a mocked API call was made through. */
function scopeOf(fn: { mock: { contexts: unknown[] } }, index: number) {
    return (fn.mock.contexts[index] as { workspaceScope?: { workspaceId: string; initialCollectionIds: readonly string[] } } | undefined)?.workspaceScope
}

beforeEach(() => {
    vi.clearAllMocks()
    mocks.withWorkspace.mockImplementation((workspaceId: string, options: { initialCollectionIds?: readonly string[] } = {}) =>
        Object.assign(Object.create(mocks), { workspaceScope: { workspaceId, initialCollectionIds: [...(options.initialCollectionIds ?? [])] } }))
    mocks.workspace = createWorkspaceTestState({ api: mocks.withWorkspace(TEST_WORKSPACE_ID) })
    mocks.withWorkspace.mockClear()
    mocks.listAssistantConversations.mockResolvedValue({ conversations: [] })
    mocks.createAssistantConversation.mockImplementation(async (body: { kind: Kind }) => ({ conversation: conversation(body.kind), messages: [], target: null, target_cas: null }))
    mocks.getAssistantConversation.mockImplementation(async (kind: Kind, id: number) => ({ conversation: conversation(kind, { conversation_id: id }), messages: [], target: null, target_cas: null }))
    mocks.getAssistantTurn.mockResolvedValue(null)
    mocks.deleteAssistantConversation.mockResolvedValue(undefined)
    mocks.streamAssistantMessage.mockResolvedValue(undefined)
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe.each(KINDS)('useAssistant (%s): send + streaming', (kind) => {
    it('opening or choosing New chat leaves the conversation local until a message is sent', async () => {
        const { result } = await mount(kind)
        act(() => { result.current.newConversation(); result.current.newConversation() })
        await act(async () => { await result.current.send('   ') })
        expect(mocks.createAssistantConversation).not.toHaveBeenCalled()
        expect(mocks.streamAssistantMessage).not.toHaveBeenCalled()
    })

    it('lazily creates a conversation, keeps the optimistic message, streams, and settles on the final history', async () => {
        const stream = controllableStream()
        const { result } = await mount(kind)

        let sending!: Promise<void>
        act(() => { sending = result.current.send('Hello there') })
        await waitFor(() => expect(mocks.streamAssistantMessage).toHaveBeenCalledTimes(1))

        expect(mocks.createAssistantConversation).toHaveBeenCalledWith(CREATE[kind], expect.any(Object))
        expect(mocks.streamAssistantMessage).toHaveBeenCalledWith(
            2,
            ADAPTERS[kind].turnBody(binding(kind), 'Hello there', null),
            expect.any(Function),
            expect.objectContaining({ requestId: expect.stringMatching(new RegExp(`^mw-${kind}-assistant-`)), signal: expect.any(AbortSignal) }),
        )
        // The optimistic user message survives the lazy conversation creation.
        expect(result.current.turns.map((turn) => turn.message.content)).toEqual(['Hello there'])
        expect(result.current.status).toBe('streaming')

        act(() => stream.emit!({ type: 'assistant_delta', delta: 'Once' }))
        act(() => stream.emit!({ type: 'assistant_delta', delta: ' upon' }))
        await waitFor(() => expect(last(result.current.turns)?.message.content).toBe('Once upon'))
        expect(last(result.current.turns)?.isStreaming).toBe(true)

        await act(async () => {
            stream.emit!(finalEvent(kind, stream.requestId!))
            stream.resolve!()
            await sending
        })
        expect(result.current.status).toBe('idle')
        expect(result.current.turns.map((turn) => turn.message.message_id)).toEqual([20, 21])
        expect(result.current.turns[1].isStreaming).toBe(false)
        expect(result.current.activeConversation?.conversation_id).toBe(2)
        expect(result.current.conversations.map((item) => item.conversation_id)).toEqual([2])
        expect(result.current.notice).toBeNull()
    })

    it('marks a failed reply and retries the frozen body under the same request id', async () => {
        const stream = controllableStream()
        const { result, rerender, props } = await mount(kind)

        let sending!: Promise<void>
        act(() => { sending = result.current.send('Hello there') })
        await waitFor(() => expect(stream.emit).toBeDefined())
        await act(async () => {
            stream.emit!({ type: 'error', detail: 'Model overloaded', error: { retryable: true } })
            stream.resolve!()
            await sending
        })
        expect(result.current.notice).toMatchObject({ kind: 'error', message: 'Model overloaded', canRetry: true })
        expect(last(result.current.turns)?.message.status).toBe('failed')

        rerender({ ...props, binding: edited(kind) })
        act(() => result.current.retry())
        await waitFor(() => expect(mocks.streamAssistantMessage).toHaveBeenCalledTimes(2))
        const [first, second] = streamCalls()
        expect(second[1]).toEqual(first[1])
        expect(second[3].requestId).toBe(first[3].requestId)
    })

    it('retry resumes an unfinished turn under its request ID until that request is spent', async () => {
        const stream = controllableStream()
        const { result } = await mount(kind)
        const finish = async (event: AssistantStreamEvent, promise: Promise<void>) => {
            await waitFor(() => expect(stream.emit).toBeDefined())
            act(() => stream.emit!(event))
            act(() => stream.resolve!())
            await act(async () => { await promise })
        }
        const ids = () => streamCalls().map((call) => call[3].requestId)

        let pending!: Promise<void>
        act(() => { pending = result.current.send('Generate it') })
        await finish({ type: 'error', error: { code: 'LLM_EXECUTION_RECOVERY_REQUIRED', retryable: true } }, pending)
        expect(result.current.notice?.message).toBe('The connection dropped before the result arrived. Try again to recover it without running it twice.')

        stream.emit = undefined
        act(() => { result.current.retry() })
        await waitFor(() => expect(mocks.streamAssistantMessage).toHaveBeenCalledTimes(2))
        await finish({ type: 'error', error: { code: 'LLM_EXECUTION_FINISHED', retryable: true } }, Promise.resolve())
        expect(ids()[1]).toBe(ids()[0])

        // The spent request is never reused, and a fresh send never resumes another turn.
        stream.emit = undefined
        act(() => { result.current.retry() })
        await waitFor(() => expect(mocks.streamAssistantMessage).toHaveBeenCalledTimes(3))
        await finish({ type: 'error', error: { code: 'LLM_EXECUTION_RECOVERY_REQUIRED', retryable: true } }, Promise.resolve())
        expect(ids()[2]).not.toBe(ids()[0])
        stream.emit = undefined
        act(() => { pending = result.current.send('Generate it') })
        await waitFor(() => expect(mocks.streamAssistantMessage).toHaveBeenCalledTimes(4))
        await finish({ type: 'error', error: { code: 'LLM_EXECUTION_RECOVERY_REQUIRED', retryable: true } }, pending)
        expect(new Set(ids()).size).toBe(3)
    })

    it('links a confirmed terminal retry, preserves its body, and deduplicates the acknowledged user', async () => {
        const command = { retry_of_execution_id: '44444444-4444-4444-8444-444444444444', selection: { mode: 'inherit' as const } }
        const { result } = await mount(kind)
        let retryEvent: ((event: AssistantStreamEvent) => void) | undefined
        let finishRetry: (() => void) | undefined
        const user = message({ message_id: 20, content: 'Generate it', metadata: { request_id: 'origin' } })
        mocks.streamAssistantMessage.mockImplementationOnce(async (_id: number, _body: unknown, emit: (event: AssistantStreamEvent) => void) => {
            emit({ type: 'user_message', user_message: user })
            const error = new ApiError(502, 'Failed', { code: 'LLM_EXECUTION_UPSTREAM_FAILED', retryable: true })
            error.llmRetry = command
            throw error
        }).mockImplementationOnce((_id: number, _body: unknown, emit: (event: AssistantStreamEvent) => void) => {
            retryEvent = emit
            return new Promise<void>((resolve) => { finishRetry = resolve })
        })
        await act(async () => result.current.send('Generate it'))
        expect(mocks.streamAssistantMessage).toHaveBeenCalledOnce()
        act(() => result.current.retry())
        await waitFor(() => expect(retryEvent).toBeDefined())
        const [first, second] = streamCalls()
        expect(second[1]).toEqual(first[1])
        expect(second[3]).toMatchObject({ llm: command })
        expect(second[3].requestId).not.toBe(first[3].requestId)
        act(() => retryEvent!({ type: 'user_message', user_message: user }))
        expect(result.current.turns.filter((turn) => turn.message.role === 'user')).toHaveLength(1)
        await act(async () => {
            retryEvent!({ type: 'error', detail: 'Stopped' })
            finishRetry!()
        })
    })

    it('409 busy removes the optimistic message and offers reload + retry', async () => {
        mocks.streamAssistantMessage.mockRejectedValue(new ApiError(409, 'busy', { code: 'ASSISTANT_CONVERSATION_BUSY' }))
        const { result } = await mount(kind)

        await act(async () => { await result.current.send('Generate it') })

        expect(result.current.turns).toHaveLength(0)
        expect(result.current.notice).toMatchObject({ kind: 'error', canRetry: true, canReload: true })
    })

    it('a non-retryable quota error removes the optimistic message without offering retry', async () => {
        mocks.streamAssistantMessage.mockRejectedValue(new ApiError(429, 'AI generation credit limit reached.', { category: 'quota_exceeded', retryable: false }))
        const { result } = await mount(kind)

        await act(async () => { await result.current.send('Generate it') })

        expect(result.current.turns).toHaveLength(0)
        expect(result.current.notice).toMatchObject({ kind: 'error', message: 'AI generation credit limit reached.', canRetry: false })
    })

    it('a local timeout keeps the partial reply flagged as interrupted and offers reload', async () => {
        const stream = controllableStream()
        const { result } = await mount(kind)

        let sending!: Promise<void>
        act(() => { sending = result.current.send('Generate it') })
        await waitFor(() => expect(stream.emit).toBeDefined())
        act(() => stream.emit!({ type: 'assistant_delta', delta: 'Partial tale' }))
        act(() => stream.reject!(new ApiError(0, 'Local wait timed out.', { category: 'timeout', retryable: true, action: 'reload_conversation' })))
        await act(async () => { await sending })

        const partial = last(result.current.turns)
        expect(partial?.message.content).toBe('Partial tale')
        expect(partial?.isInterrupted).toBe(true)
        expect(result.current.notice).toMatchObject({ kind: 'error', canReload: true })
    })

    it('stop() aborts the stream, keeps the partial reply, and shows an info notice', async () => {
        const stream = controllableStream()
        const { result } = await mount(kind)

        let sending!: Promise<void>
        act(() => { sending = result.current.send('Generate it') })
        await waitFor(() => expect(stream.emit).toBeDefined())
        act(() => stream.emit!({ type: 'assistant_delta', delta: 'Partial' }))
        act(() => result.current.stop())
        await act(async () => { await sending })

        expect(stream.signal?.aborted).toBe(true)
        const partial = last(result.current.turns)
        expect(partial?.message.content).toBe('Partial')
        expect(partial?.isInterrupted).toBe(true)
        expect(result.current.notice).toMatchObject({ kind: 'info', canReload: true })
        expect(result.current.status).toBe('idle')
    })

    it('preserves a partial reply when the network fails', async () => {
        const stream = controllableStream()
        const { result } = await mount(kind)
        let sending!: Promise<void>
        act(() => { sending = result.current.send('Write') })
        await waitFor(() => expect(stream.emit).toBeDefined())
        act(() => stream.emit!({ type: 'assistant_delta', delta: 'Keep me' }))
        act(() => stream.reject!(new TypeError('Network failed')))
        await act(async () => { await sending })
        expect(last(result.current.turns)?.message.content).toBe('Keep me')
        expect(last(result.current.turns)?.isInterrupted).toBe(true)
        expect(result.current.notice).toMatchObject({ kind: 'error', canRetry: true })
    })

    it('a stream that ends without a result reconciles its request and settles on the recovered reply', async () => {
        const stream = controllableStream()
        mocks.getAssistantTurn.mockImplementation(async (_kind: Kind, _id: number, requestId: string) => assistantTurnFixture(kind, requestId, {
            assistant_message: message({ message_id: 21, sequence_no: 2, role: 'assistant', content: 'Recovered reply.', metadata: { request_id: requestId } }),
        }))
        const { result } = await mount(kind)

        let sending!: Promise<void>
        act(() => { sending = result.current.send('Generate it') })
        await waitFor(() => expect(stream.emit).toBeDefined())
        await act(async () => {
            stream.resolve!()
            await sending
        })

        expect(mocks.getAssistantTurn).toHaveBeenCalledWith(kind, 2, stream.requestId, expect.any(Object))
        expect(last(result.current.turns)?.message.content).toBe('Recovered reply.')
        expect(result.current.notice).toBeNull()
        expect(result.current.status).toBe('idle')
    })

    it('keeps partial text and reports a failed recovery when only an older reply exists', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const stream = controllableStream()
        const { result, props } = await mount(kind)
        let sending!: Promise<void>
        act(() => { sending = result.current.send('New request') })
        await waitFor(() => expect(stream.emit).toBeDefined())
        act(() => stream.emit!({ type: 'assistant_delta', delta: 'New partial' }))
        mocks.getAssistantTurn.mockResolvedValue({
            conversation: conversation(kind),
            messages: [message({ message_id: 40, role: 'assistant', content: 'Old result', metadata: { request_id: 'older-request' } })],
            target: kind === 'app' ? undefined : SAVED[kind],
        })
        await act(async () => {
            stream.resolve!()
            await sending
        })
        expect(last(result.current.turns)?.message.content).toBe('New partial')
        expect(props.onTarget).not.toHaveBeenCalled()
        expect(result.current.notice).toMatchObject({ canRetry: true, canReload: true })
        expect(warn).toHaveBeenCalledWith('text_stream_recovery_failed', { requestId: stream.requestId, surface: `${kind}_assistant` })
    })

    it.each([false, true])('a stale target snapshot is never retried; reload reads the saved state instead (event: %s)', async (asEvent) => {
        // The server sends only the code ({detail: {code}}); the client moves it to `error`.
        const error = { code: 'ASSISTANT_TARGET_SNAPSHOT_STALE' }
        if (asEvent) {
            mocks.streamAssistantMessage.mockImplementation(async (_id: number, _body: unknown, emit: (event: AssistantStreamEvent) => void) => emit({ type: 'error', status_code: 409, error }))
        } else {
            mocks.streamAssistantMessage.mockRejectedValue(new ApiError(409, error.code, error))
        }
        const { result, props } = await mount(kind)
        await act(async () => { await result.current.send('Edit') })
        expect(result.current.notice).toMatchObject({ kind: 'error', message: i18n.t('creation.common.assistant.notices.stale'), canReload: true })
        expect(result.current.notice?.canRetry).toBeFalsy()

        const target = kind === 'app' ? null : SAVED[kind]
        mocks.getAssistantConversation.mockResolvedValue({ conversation: conversation(kind), messages: [], target, target_cas: null })
        await act(async () => { await result.current.reloadConversation() })
        expect(mocks.getAssistantTurn).not.toHaveBeenCalled()
        expect(mocks.getAssistantConversation).toHaveBeenLastCalledWith(kind, 2, expect.any(Object))
        expect(result.current.pendingTarget).toEqual(target)
        expect(props.onTarget).not.toHaveBeenCalled()

        // The retained request is gone: Retry asks again under a new request id.
        mocks.streamAssistantMessage.mockResolvedValue(undefined)
        act(() => result.current.retry())
        await waitFor(() => expect(mocks.streamAssistantMessage).toHaveBeenCalledTimes(2))
        expect(streamCalls()[1][3].requestId).not.toBe(streamCalls()[0][3].requestId)
    })

    it('switches to the unavailable state when the server turns the assistant away mid-send', async () => {
        mocks.createAssistantConversation.mockRejectedValue(new ApiError(503, 'Disabled', { code: 'ASSISTANT_DISABLED' }))
        const { result } = await mount(kind)
        await act(async () => { await result.current.send('Hello there') })
        expect(result.current.unavailable).toBe(true)
        expect(result.current.notice).toBeNull()
        expect(result.current.turns).toEqual([])
        expect(result.current.status).toBe('idle')

        await act(async () => { await result.current.send('Hello again') })
        expect(mocks.createAssistantConversation).toHaveBeenCalledOnce()
    })
})

describe.each(KINDS)('useAssistant (%s): history', (kind) => {
    /** Panels load when opened; the page loads on mount. */
    function activate(result: { current: { openPanel: () => void } }) {
        if (kind !== 'app') act(() => result.current.openPanel())
    }

    it('treats a switched-off assistant as a state, not an error, and can check again', async () => {
        mocks.listAssistantConversations.mockRejectedValue(new ApiError(503, 'Disabled', { code: 'ASSISTANT_DISABLED' }))
        const { result } = setup(kind)
        activate(result)
        await waitFor(() => expect(result.current.ready).toBe(true))
        expect(result.current.unavailable).toBe(true)
        expect(result.current.notice).toBeNull()

        await act(async () => { await result.current.send('Hello') })
        expect(mocks.createAssistantConversation).not.toHaveBeenCalled()

        const listed = conversation(kind)
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [listed] })
        act(() => result.current.recheck())
        expect(result.current.status).toBe('initializing')
        await waitFor(() => expect(result.current.unavailable).toBe(false))
        expect(result.current.ready).toBe(true)
        expect(result.current.conversations).toEqual([listed])
    })

    it('treats 404 as a failed load, not as a missing assistant', async () => {
        mocks.listAssistantConversations.mockRejectedValue(new ApiError(404, 'Not Found'))
        const { result } = setup(kind)
        activate(result)
        await waitFor(() => expect(result.current.ready).toBe(true))
        expect(result.current.unavailable).toBe(false)
        expect(result.current.notice).toMatchObject({ kind: 'error', message: 'Not Found' })
    })

    it('newConversation resets locally, without the API, and forgets the retained retry', async () => {
        mocks.streamAssistantMessage.mockRejectedValueOnce(new ApiError(502, 'upstream down', { retryable: true }))
        const { result } = await mount(kind)
        await act(async () => { await result.current.send('Hello there') })
        expect(result.current.notice?.canRetry).toBe(true)

        act(() => result.current.newConversation())
        expect(result.current.activeConversation).toBeNull()
        expect(result.current.turns).toHaveLength(0)
        expect(mocks.createAssistantConversation).toHaveBeenCalledOnce()

        act(() => result.current.retry())
        await waitFor(() => expect(mocks.streamAssistantMessage).toHaveBeenCalledTimes(2))
        expect(mocks.createAssistantConversation).toHaveBeenCalledTimes(2)
        expect(streamCalls()[1][3].requestId).not.toBe(streamCalls()[0][3].requestId)
    })

    it('selectConversation loads its history, stages its target, and forgets the retained retry', async () => {
        mocks.streamAssistantMessage.mockRejectedValueOnce(new ApiError(502, 'upstream down', { retryable: true }))
        const { result, props } = await mount(kind)
        await act(async () => { await result.current.send('Hello there') })

        const target = kind === 'app' ? null : SAVED[kind]
        mocks.getAssistantConversation.mockResolvedValue({
            conversation: conversation(kind, { conversation_id: 3 }),
            messages: [message({ message_id: 30, conversation_id: 3, content: 'older chat' })],
            target,
            target_cas: null,
        })
        await act(async () => { await result.current.selectConversation(3) })

        expect(mocks.getAssistantConversation).toHaveBeenLastCalledWith(kind, 3, expect.any(Object))
        expect(result.current.turns.map((turn) => turn.message.message_id)).toEqual([30])
        expect(result.current.pendingTarget).toEqual(target)
        expect(props.onTarget).not.toHaveBeenCalled()
        if (target) {
            act(() => result.current.applyPendingTarget())
            expect(props.onTarget).toHaveBeenCalledWith(target, { organizationWarnings: [] })
            expect(result.current.pendingTarget).toBeNull()
        }

        act(() => result.current.retry())
        await waitFor(() => expect(mocks.streamAssistantMessage).toHaveBeenCalledTimes(2))
        expect(streamCalls()[1][3].requestId).not.toBe(streamCalls()[0][3].requestId)
    })

    it('deletes the open conversation, resets to a fresh thread, and reports it', async () => {
        mocks.streamAssistantMessage.mockImplementation(async (_id: number, _body: unknown, emit: (event: AssistantStreamEvent) => void, options: { requestId: string }) => {
            emit(finalEvent(kind, options.requestId))
        })
        const { result, props } = await mount(kind)
        await act(async () => { await result.current.send('Hello there') })
        expect(props.onActiveConversationChange).toHaveBeenLastCalledWith(2)

        await act(async () => { await result.current.deleteConversation(2) })

        expect(mocks.deleteAssistantConversation).toHaveBeenCalledWith(kind, 2, expect.any(Object))
        expect(result.current.conversations).toEqual([])
        expect(result.current.activeConversation).toBeNull()
        expect(result.current.turns).toEqual([])
        expect(props.onActiveConversationChange).toHaveBeenLastCalledWith(null)
    })

    it('a busy delete keeps the list and explains why', async () => {
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [conversation(kind)] })
        mocks.deleteAssistantConversation.mockRejectedValue(new ApiError(409, 'busy', { code: 'ASSISTANT_CONVERSATION_BUSY' }))
        const { result } = setup(kind)
        activate(result)
        await waitFor(() => expect(result.current.ready).toBe(true))

        await act(async () => { await result.current.deleteConversation(2) })

        expect(result.current.conversations).toHaveLength(1)
        expect(result.current.notice).toEqual({ kind: 'error', message: i18n.t('creation.common.assistant.notices.deleteBusy') })
    })

    it('ignores late callbacks after closing and sending a newer request', async () => {
        const first = controllableStream()
        const { result, props } = await mount(kind)
        let firstPending!: Promise<void>
        act(() => { firstPending = result.current.send('First') })
        await waitFor(() => expect(first.emit).toBeDefined())
        const late = first.emit!
        act(() => result.current.closePanel())
        const second = controllableStream()
        second.emit = undefined
        let secondPending!: Promise<void>
        act(() => { secondPending = result.current.send('Second') })
        await waitFor(() => expect(second.emit).toBeDefined())
        await act(async () => { await firstPending })
        expect(result.current.status).toBe('streaming')
        act(() => late({ type: 'assistant_delta', delta: 'Stale' }))
        act(() => late(finalEvent(kind, first.requestId!, kind === 'app' ? {} : { target: SAVED[kind] } as Partial<AssistantTurnResponse>)))
        expect(props.onTarget).not.toHaveBeenCalled()
        act(() => second.emit!({ type: 'assistant_delta', delta: 'Second partial' }))
        act(() => result.current.stop())
        await act(async () => { await secondPending })
        expect(result.current.turns.some((turn) => turn.message.content === 'Stale')).toBe(false)
        expect(last(result.current.turns)?.message.content).toBe('Second partial')
        expect(result.current.status).toBe('idle')
    })

    it('asks for sign-in instead of touching the API', async () => {
        const { result, props } = setup(kind, { isAuthenticated: false })
        await act(async () => { await result.current.send('Hello') })
        expect(props.onAuthRequired).toHaveBeenCalled()
        expect(result.current.status).toBe('idle')
        expect(mocks.listAssistantConversations).not.toHaveBeenCalled()
        expect(mocks.createAssistantConversation).not.toHaveBeenCalled()
    })
})

describe.each(DOCUMENT_KINDS)('useAssistant (%s): floating panel', (kind) => {
    const scope = (targetId: string | null) => ADAPTERS[kind].scope(binding(kind, targetId))

    it('opens on demand, lists its scope, and resumes the newest conversation without staging its target', async () => {
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [conversation(kind), conversation(kind, { conversation_id: 1 })] })
        mocks.getAssistantConversation.mockResolvedValue({
            conversation: conversation(kind),
            messages: [message({ message_id: 10, content: 'hi' }), message({ message_id: 11, role: 'assistant', content: 'Hello!' })],
            target: SAVED[kind],
            target_cas: TARGET_CAS,
        })
        const { result, props } = setup(kind)
        expect(result.current.open).toBe(false)
        expect(mocks.listAssistantConversations).not.toHaveBeenCalled()

        act(() => result.current.openPanel())
        expect(result.current.status).toBe('initializing')
        await waitFor(() => expect(result.current.status).toBe('idle'))

        expect(mocks.listAssistantConversations).toHaveBeenCalledWith(scope(null), expect.any(Object))
        expect(mocks.getAssistantConversation).toHaveBeenCalledWith(kind, 2, expect.any(Object))
        expect(result.current.conversations).toHaveLength(2)
        expect(result.current.turns.map((turn) => turn.message.content)).toEqual(['hi', 'Hello!'])
        expect(result.current.pendingTarget).toBeNull()
        expect(props.onTarget).not.toHaveBeenCalled()
    })

    it('requires auth before opening and never fetches', () => {
        const { result, props } = setup(kind, { isAuthenticated: false })
        act(() => result.current.openPanel())
        expect(props.onAuthRequired).toHaveBeenCalledTimes(1)
        expect(result.current.open).toBe(false)
        expect(mocks.listAssistantConversations).not.toHaveBeenCalled()
    })

    it('a target change while open refreshes the list and keeps the open conversation listed', async () => {
        const open = conversation(kind)
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [open] })
        mocks.getAssistantConversation.mockResolvedValue({ conversation: open, messages: [message({ message_id: 10, content: 'hi' })], target: null, target_cas: null })
        const { result, rerender, props } = setup(kind)
        act(() => result.current.openPanel())
        await waitFor(() => expect(result.current.activeConversation).not.toBeNull())
        const detailCalls = mocks.getAssistantConversation.mock.calls.length

        const other = bound(kind, 'x-1', { conversation_id: 9 })
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [other] })
        rerender({ ...props, binding: binding(kind, 'x-1') })

        await waitFor(() => expect(mocks.listAssistantConversations).toHaveBeenLastCalledWith(scope('x-1'), expect.any(Object)))
        await waitFor(() => expect(result.current.conversations.map((item) => item.conversation_id)).toEqual([2, 9]))
        // No detail re-fetch: the open conversation survives the new binding.
        expect(mocks.getAssistantConversation.mock.calls.length).toBe(detailCalls)
        expect(result.current.turns.map((turn) => turn.message.content)).toEqual(['hi'])
    })

    it('a target change mid-stream invalidates the turn and starts a fresh thread', async () => {
        const stream = controllableStream()
        const { result, rerender, props } = setup(kind)
        let pending!: Promise<void>
        act(() => { pending = result.current.send('Create it') })
        await waitFor(() => expect(stream.emit).toBeDefined())
        rerender({ ...props, binding: binding(kind, 'another-one') })
        expect(stream.signal?.aborted).toBe(true)
        await act(async () => { stream.emit!({ type: 'assistant_delta', delta: 'Stale' }); await pending })
        expect(result.current.status).toBe('idle')
        expect(result.current.turns).toEqual([])
        expect(result.current.activeConversation).toBeNull()
        expect(result.current.notice).toBeNull()
        expect(props.onTarget).not.toHaveBeenCalled()
    })

    it('reuses the open conversation only while it is bound to the current target, reading the saved snapshot for each turn', async () => {
        mocks.streamAssistantMessage.mockImplementation(async (id: number, _body: unknown, emit: (event: AssistantStreamEvent) => void, options: { requestId: string }) => {
            emit(finalEvent(kind, options.requestId, { conversation: id === 5 ? bound(kind) : conversation(kind) }))
        })
        const { result, rerender, props } = setup(kind)
        await act(async () => { await result.current.send('Create it') })
        expect(mocks.createAssistantConversation).toHaveBeenCalledTimes(1)

        // The card got saved: the unbound thread no longer matches it.
        mocks.createAssistantConversation.mockResolvedValue({ conversation: bound(kind), messages: [], target: null, target_cas: null })
        mocks.getAssistantConversation.mockResolvedValue({ conversation: bound(kind), messages: [], target: SAVED[kind], target_cas: TARGET_CAS })
        rerender({ ...props, binding: binding(kind, 'x-1') })
        await act(async () => { await result.current.send('Refine it') })
        expect(mocks.createAssistantConversation).toHaveBeenCalledTimes(2)
        expect(mocks.createAssistantConversation).toHaveBeenLastCalledWith({ ...scope('x-1'), title: kind === 'card' ? 'Untitled World' : 'Lore' }, expect.any(Object))
        expect(mocks.getAssistantConversation).toHaveBeenLastCalledWith(kind, 5, expect.objectContaining({ signal: expect.any(AbortSignal) }))
        expect(streamCalls()[1][0]).toBe(5)
        expect(streamCalls()[1][1]).toEqual(ADAPTERS[kind].turnBody(binding(kind, 'x-1'), 'Refine it', { target: SAVED[kind], cas: TARGET_CAS }))
        expect(streamCalls()[1][1]).toMatchObject({ expected_revision: TARGET_CAS.revision, expected_content_hash: TARGET_CAS.content_hash })

        const nextCas = { revision: '2026-09-19T00:45:00', content_hash: 'b'.repeat(64) }
        mocks.getAssistantConversation.mockResolvedValue({ conversation: bound(kind), messages: [], target: SAVED[kind], target_cas: nextCas })
        await act(async () => { await result.current.send('Once more') })
        expect(mocks.createAssistantConversation).toHaveBeenCalledTimes(2)
        expect(mocks.getAssistantConversation).toHaveBeenCalledTimes(2)
        expect(streamCalls()[2][1]).toMatchObject({ expected_revision: nextCas.revision, expected_content_hash: nextCas.content_hash })
    })

    it('never starts a stream when stopped during the snapshot fetch', async () => {
        mocks.createAssistantConversation.mockResolvedValue({ conversation: bound(kind), messages: [], target: null, target_cas: null })
        let resolveSnapshot: ((value: unknown) => void) | undefined
        mocks.getAssistantConversation.mockImplementation(() => new Promise((resolve) => { resolveSnapshot = resolve }))
        const { result } = setup(kind, { binding: binding(kind, 'x-1') })
        let pending!: Promise<void>
        act(() => { pending = result.current.send('Edit') })
        await waitFor(() => expect(resolveSnapshot).toBeDefined())
        act(() => result.current.stop())
        await act(async () => {
            resolveSnapshot!({ conversation: bound(kind), messages: [], target: SAVED[kind], target_cas: TARGET_CAS })
            await pending
        })
        expect(mocks.streamAssistantMessage).not.toHaveBeenCalled()
        expect(result.current.status).toBe('idle')
    })

    it('fails before sending when the bound target has no snapshot', async () => {
        mocks.createAssistantConversation.mockResolvedValue({ conversation: bound(kind), messages: [], target: null, target_cas: null })
        mocks.getAssistantConversation.mockResolvedValue({ conversation: bound(kind), messages: [], target: SAVED[kind], target_cas: null })
        const { result } = setup(kind, { binding: binding(kind, 'x-1') })
        await act(async () => { await result.current.send('Edit') })
        expect(mocks.streamAssistantMessage).not.toHaveBeenCalled()
        expect(result.current.notice).toMatchObject({ kind: 'error' })
        expect(result.current.turns).toEqual([])
    })

    it('a final applies its saved target and shows the applied changes', async () => {
        const action = kind === 'card' ? 'patch_card' : 'patch_lorebook'
        mocks.streamAssistantMessage.mockImplementation(async (_id: number, _body: unknown, emit: (event: AssistantStreamEvent) => void, options: { requestId: string }) => {
            emit(finalEvent(kind, options.requestId, {
                conversation: conversation(kind, kind === 'card' ? { card_id: 'x-1' } : { lorebook_id: 'x-1' }),
                target: SAVED[kind],
                applied_actions: [{ type: action, target_id: 'x-1', fields: ['name', 'description'] }],
            } as Partial<AssistantTurnResponse>))
        })
        const { result, props } = setup(kind)
        await act(async () => { await result.current.send('Rename it') })

        expect(props.onTarget).toHaveBeenCalledWith(SAVED[kind], { organizationWarnings: [] })
        expect(result.current.turns[1].appliedChanges).toEqual([{
            kind: 'patch', ...(kind === 'lorebook' ? { subject: 'lorebook' } : {}), targetId: 'x-1', fields: ['name', 'description'],
        }])
        expect(result.current.activeConversation).toMatchObject(kind === 'card' ? { card_id: 'x-1' } : { lorebook_id: 'x-1' })
    })

    it('automatic recovery applies the recovered target; a manual reload stages it behind Apply', async () => {
        const stream = controllableStream()
        mocks.getAssistantTurn.mockImplementation(async (_kind: Kind, _id: number, requestId: string) => assistantTurnFixture(kind, requestId, { target: SAVED[kind] } as Partial<AssistantTurnResponse<typeof kind>>))
        const { result, props } = setup(kind)
        let pending!: Promise<void>
        act(() => { pending = result.current.send('Generate it') })
        await waitFor(() => expect(stream.emit).toBeDefined())
        await act(async () => { stream.resolve!(); await pending })

        expect(props.onTarget).toHaveBeenCalledTimes(1)
        expect(props.onTarget).toHaveBeenCalledWith(SAVED[kind], { organizationWarnings: [] })
        expect(result.current.pendingTarget).toBeNull()

        await act(async () => { await result.current.reloadConversation() })
        expect(props.onTarget).toHaveBeenCalledTimes(1)
        expect(result.current.pendingTarget).toEqual(SAVED[kind])
        act(() => result.current.applyPendingTarget())
        expect(props.onTarget).toHaveBeenCalledTimes(2)
        expect(result.current.pendingTarget).toBeNull()
    })
})

describe('useAssistant (app): page', () => {
    it('reports initializing until the history loads, then idle', async () => {
        const { result } = setup('app')
        expect(result.current.open).toBe(true)
        expect(result.current.status).toBe('initializing')
        await waitFor(() => expect(result.current.ready).toBe(true))
        expect(result.current.status).toBe('idle')
        // The page lists every assistant's history, not one scope.
        expect(mocks.listAssistantConversations).toHaveBeenCalledWith(null, expect.any(Object))
    })

    it('opens the deep-linked conversation once and reports it', async () => {
        const deepLinked = conversation('app', { conversation_id: 7 })
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [conversation('app'), deepLinked] })
        mocks.getAssistantConversation.mockResolvedValue({ conversation: deepLinked, messages: [message({ conversation_id: 7, content: 'Hi' })], target: null, target_cas: null })
        const { result, props } = setup('app', { initialConversationId: 7 })
        await waitFor(() => expect(result.current.activeConversation?.conversation_id).toBe(7))
        expect(mocks.getAssistantConversation).toHaveBeenCalledWith('app', 7, expect.any(Object))
        expect(result.current.turns.map((turn) => turn.message.content)).toEqual(['Hi'])
        expect(props.onActiveConversationChange).toHaveBeenLastCalledWith(7)

        act(() => result.current.recheck())
        await waitFor(() => expect(result.current.ready).toBe(true))
        expect(mocks.getAssistantConversation).toHaveBeenCalledOnce()
    })

    it('starts on a fresh thread without a deep link', async () => {
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [conversation('app')] })
        const { result } = setup('app')
        await waitFor(() => expect(result.current.ready).toBe(true))
        expect(result.current.conversations).toHaveLength(1)
        expect(result.current.activeConversation).toBeNull()
        expect(mocks.getAssistantConversation).not.toHaveBeenCalled()
    })
})

describe('useAssistant (app): every assistant in one history', () => {
    const cardConversation = () => conversation('card', { conversation_id: 9, card_type: 'world', card_id: 'x-1' })

    it('opens another assistant’s conversation with its own kind and never stages its target', async () => {
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [cardConversation(), conversation('app')] })
        mocks.getAssistantConversation.mockResolvedValue({
            conversation: cardConversation(), messages: [message({ conversation_id: 9, content: 'Make it misty' })],
            target: SAVED.card, target_cas: TARGET_CAS,
        })
        const { result, props } = await mount('app')

        await act(async () => { await result.current.selectConversation(9) })

        expect(mocks.getAssistantConversation).toHaveBeenCalledWith('card', 9, expect.any(Object))
        expect(result.current.activeConversation?.kind).toBe('card')
        expect(result.current.turns.map((turn) => turn.message.content)).toEqual(['Make it misty'])
        expect(result.current.pendingTarget).toBeNull()
        expect(props.onTarget).not.toHaveBeenCalled()
        expect(props.onActiveConversationChange).toHaveBeenLastCalledWith(9)
    })

    it('opens a deep-linked conversation of another assistant with its own kind', async () => {
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [conversation('app'), cardConversation()] })
        mocks.getAssistantConversation.mockResolvedValue({ conversation: cardConversation(), messages: [], target: SAVED.card, target_cas: TARGET_CAS })
        const { result } = setup('app', { initialConversationId: 9 })

        await waitFor(() => expect(result.current.activeConversation?.conversation_id).toBe(9))
        expect(mocks.getAssistantConversation).toHaveBeenCalledWith('card', 9, expect.any(Object))
        expect(result.current.pendingTarget).toBeNull()
    })

    it('asks the guide in a new conversation instead of another assistant’s', async () => {
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [cardConversation()] })
        mocks.getAssistantConversation.mockResolvedValue({ conversation: cardConversation(), messages: [], target: null, target_cas: null })
        mocks.streamAssistantMessage.mockImplementation(async (_id: number, _body: unknown, onEvent: (event: AssistantStreamEvent) => void, options: { requestId: string }) => {
            onEvent(finalEvent('app', options.requestId))
        })
        const { result } = await mount('app')
        await act(async () => { await result.current.selectConversation(9) })

        await act(async () => { await result.current.send('Where do resources live?') })

        expect(mocks.createAssistantConversation).toHaveBeenCalledWith(expect.objectContaining({ kind: 'app' }), expect.any(Object))
        const [conversationId, body] = last(streamCalls())!
        expect(conversationId).toBe(2)
        expect(body).toMatchObject({ kind: 'app', message: 'Where do resources live?' })
        expect(result.current.activeConversation?.kind).toBe('app')
    })

    it('deletes another assistant’s conversation with its own kind', async () => {
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [cardConversation(), conversation('app')] })
        const { result } = await mount('app')

        await act(async () => { await result.current.deleteConversation(9) })

        expect(mocks.deleteAssistantConversation).toHaveBeenCalledWith('card', 9, expect.any(Object))
        expect(result.current.conversations.map((item) => item.conversation_id)).toEqual([2])
    })
})

describe.each(DOCUMENT_KINDS)('useAssistant (%s): panel hand-off', (kind) => {
    it('opens the panel on the handed-off conversation instead of the newest', async () => {
        const handed = bound(kind)
        mocks.listAssistantConversations.mockResolvedValue({ conversations: [conversation(kind, { conversation_id: 8 }), handed] })
        mocks.getAssistantConversation.mockResolvedValue({ conversation: handed, messages: [message({ conversation_id: 5, content: 'Earlier' })], target: SAVED[kind], target_cas: TARGET_CAS })
        const { result } = setup(kind, { binding: binding(kind, 'x-1'), initialConversationId: 5 })

        expect(result.current.open).toBe(true)
        await waitFor(() => expect(result.current.activeConversation?.conversation_id).toBe(5))
        expect(mocks.getAssistantConversation).toHaveBeenCalledWith(kind, 5, expect.any(Object))
        expect(result.current.turns.map((turn) => turn.message.content)).toEqual(['Earlier'])
        expect(result.current.pendingTarget).toBeNull()
    })

    it('ignores a handed-off conversation of another assistant', async () => {
        mocks.getAssistantConversation.mockResolvedValue({ conversation: conversation('app', { conversation_id: 4 }), messages: [], target: null, target_cas: null })
        const { result } = setup(kind, { initialConversationId: 4 })

        await waitFor(() => expect(result.current.ready).toBe(true))
        expect(result.current.activeConversation).toBeNull()
        expect(result.current.turns).toEqual([])
    })
})

describe('useAssistant: Workspace R1', () => {
    const CARD = { id: 'x-1', name: 'New glass', ...PUBLISHED_REVISION } as unknown as AssistantCardDocument

    it('sends initial collections only on the unbound card turn that creates the first card', async () => {
        mocks.streamAssistantMessage.mockImplementation(async (_id: number, _body: unknown, emit: (event: AssistantStreamEvent) => void, options: { requestId: string }) => {
            emit(finalEvent('card', options.requestId, {
                conversation: conversation('card', { card_id: 'x-1' }), target: CARD,
                organization_warnings: [],
            } as Partial<AssistantTurnResponse>))
        })
        const { result, rerender, props } = setup('card', { initialCollectionIds: [TEST_COLLECTION_ID] })
        await act(async () => { await result.current.send('Create a glass world') })

        // Conversation creation rides the plain client; only the first-card turn adds the header.
        expect(scopeOf(mocks.createAssistantConversation, 0)).toEqual({ workspaceId: TEST_WORKSPACE_ID, initialCollectionIds: [] })
        expect(scopeOf(mocks.streamAssistantMessage, 0)).toEqual({ workspaceId: TEST_WORKSPACE_ID, initialCollectionIds: [TEST_COLLECTION_ID] })

        // The form now edits the created card and the conversation is bound to it:
        // later turns never re-send collections, even if the origin still has some.
        rerender({ ...props, binding: binding('card', 'x-1') })
        mocks.getAssistantConversation.mockResolvedValue({ conversation: bound('card'), messages: [], target: CARD, target_cas: TARGET_CAS })
        await act(async () => { await result.current.send('Make it darker') })
        expect(mocks.streamAssistantMessage).toHaveBeenCalledTimes(2)
        expect(scopeOf(mocks.streamAssistantMessage, 1)).toEqual({ workspaceId: TEST_WORKSPACE_ID, initialCollectionIds: [] })
    })

    it('replays and reconciles the first-card request with the same initial collections', async () => {
        const stream = controllableStream()
        const { result } = setup('card', { initialCollectionIds: [TEST_COLLECTION_ID] })
        let pending!: Promise<void>
        act(() => { pending = result.current.send('Create a glass world') })
        await waitFor(() => expect(stream.emit).toBeDefined())
        await act(async () => { stream.resolve!(); await pending })

        // The stream ended without a result: the reconcile reads that request back with its set.
        expect(mocks.getAssistantTurn).toHaveBeenCalledTimes(1)
        expect(scopeOf(mocks.getAssistantTurn, 0)).toEqual({ workspaceId: TEST_WORKSPACE_ID, initialCollectionIds: [TEST_COLLECTION_ID] })

        mocks.streamAssistantMessage.mockRejectedValueOnce(new ApiError(502, 'upstream down', { retryable: true }))
        act(() => result.current.retry())
        await waitFor(() => expect(mocks.streamAssistantMessage).toHaveBeenCalledTimes(2))
        expect(streamCalls()[1][3].requestId).toBe(streamCalls()[0][3].requestId)
        expect(scopeOf(mocks.streamAssistantMessage, 1)).toEqual({ workspaceId: TEST_WORKSPACE_ID, initialCollectionIds: [TEST_COLLECTION_ID] })
    })

    it('never sends initial collections on a bound card turn', async () => {
        mocks.createAssistantConversation.mockResolvedValue({ conversation: bound('card'), messages: [], target: null, target_cas: null })
        mocks.getAssistantConversation.mockResolvedValue({ conversation: bound('card'), messages: [], target: SAVED.card, target_cas: TARGET_CAS })
        const { result } = setup('card', { binding: binding('card', 'x-1'), initialCollectionIds: [TEST_COLLECTION_ID] })
        await act(async () => { await result.current.send('Edit') })

        expect(mocks.streamAssistantMessage).toHaveBeenCalledTimes(1)
        expect(scopeOf(mocks.streamAssistantMessage, 0)?.initialCollectionIds).toEqual([])
    })

    it('never sends initial collections on a lorebook turn', async () => {
        const { result } = setup('lorebook', { initialCollectionIds: [TEST_COLLECTION_ID] })
        await act(async () => { await result.current.send('Start a lorebook') })

        expect(mocks.streamAssistantMessage).toHaveBeenCalledTimes(1)
        expect(scopeOf(mocks.streamAssistantMessage, 0)?.initialCollectionIds).toEqual([])
    })

    it('hands a removed initial collection to the form as an organization warning', async () => {
        const warnings = [{ code: 'COLLECTION_REMOVED', collection_id: TEST_COLLECTION_ID }]
        mocks.streamAssistantMessage.mockImplementation(async (_id: number, _body: unknown, emit: (event: AssistantStreamEvent) => void, options: { requestId: string }) => {
            emit(finalEvent('card', options.requestId, {
                conversation: conversation('card', { card_id: 'x-1' }), target: CARD, organization_warnings: warnings,
            } as Partial<AssistantTurnResponse>))
        })
        const { result, props } = setup('card', { initialCollectionIds: [TEST_COLLECTION_ID] })
        await act(async () => { await result.current.send('Create a glass world') })

        expect(props.onTarget).toHaveBeenCalledWith(CARD, { organizationWarnings: warnings })
    })

    it('uses the captured workspace over the committed one', async () => {
        const { result } = setup('card', { workspaceId: OTHER_WORKSPACE_ID })
        await act(async () => { await result.current.send('Hello there') })

        expect(scopeOf(mocks.createAssistantConversation, 0)?.workspaceId).toBe(OTHER_WORKSPACE_ID)
        expect(scopeOf(mocks.streamAssistantMessage, 0)?.workspaceId).toBe(OTHER_WORKSPACE_ID)
    })

    it('a workspace switch mid-turn resets the panel and never applies the old target', async () => {
        const stream = controllableStream()
        const { result, rerender, props } = setup('card')
        let pending!: Promise<void>
        act(() => { pending = result.current.send('Create a glass world') })
        await waitFor(() => expect(stream.emit).toBeDefined())
        expect(result.current.turns).toHaveLength(1)

        mocks.workspace!.switchTo(OTHER_WORKSPACE_ID)
        rerender({ ...props })
        expect(result.current.turns).toEqual([])
        expect(result.current.activeConversation).toBeNull()
        expect(result.current.status).toBe('idle')

        await act(async () => {
            stream.emit!(finalEvent('card', stream.requestId!, { conversation: conversation('card', { card_id: 'x-1' }), target: CARD } as Partial<AssistantTurnResponse>))
            stream.resolve!()
            await pending.catch(() => {})
        })
        expect(props.onTarget).not.toHaveBeenCalled()
        expect(result.current.turns).toEqual([])
    })
})
