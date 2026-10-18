import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AssistantKind, AssistantTurnRequest } from '@/shared/types/assistant.types'
import { assistantConversationFixture, assistantTurnFixture } from '@/test/assistantFixtures'
import { verifyAssistantTurn } from './assistantContract'
import { apiService } from './index'
import { authSession } from './authSession'

vi.mock('./baseUrl', () => ({ API_BASE_URL: 'https://api.test.invalid' }))

const requestId = 'assistant-contract-1'
const fetchMock = vi.fn()
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const sse = (body: unknown) => new Response(`event: final\ndata: ${JSON.stringify(body)}\n\n`, { headers: { 'Content-Type': 'text/event-stream' } })
const KINDS = ['card', 'lorebook', 'app'] as const

/** A mutable copy of a valid turn, so each case can break one thing. */
function turn(kind: AssistantKind): Record<string, unknown> {
    return structuredClone(assistantTurnFixture(kind, requestId)) as unknown as Record<string, unknown>
}

function turnBody(kind: Exclude<AssistantKind,'novel'>): AssistantTurnRequest {
    if (kind === 'card') return { kind, message: 'Generate it', card_type: 'world' }
    if (kind === 'lorebook') return { kind, message: 'Generate it' }
    return { kind, message: 'Generate it', context: '# Guide', locale: 'en', page: '#/gallery/worlds' }
}

function send(kind: Exclude<AssistantKind,'novel'>, onEvent = vi.fn(), options: Parameters<typeof apiService.streamAssistantMessage>[3] = {}) {
    return apiService.streamAssistantMessage(2, turnBody(kind), onEvent, { requestId, ...options })
}

beforeEach(() => {
    vi.resetAllMocks()
    localStorage.clear(); sessionStorage.clear()
    authSession.authenticate('assistant-owner', 'FAKE_SESSION')
    vi.stubGlobal('fetch', fetchMock)
    setTestFeatureFlags({ lorebooks: true })
    setTestFeatureFlags({ appAssistant: true })
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('assistant turn organization (Workspace R1)', () => {
    const collectionId = '00000000-0000-4000-8000-0000000000c1'

    it('accepts card organization_warnings and rejects malformed or non-card warnings', () => {
        const card = { ...turn('card'), organization_warnings: [] as unknown[] }
        expect(verifyAssistantTurn(card, 'card', 2, requestId)).toBe(true)
        card.organization_warnings = [{ code: 'COLLECTION_REMOVED', collection_id: collectionId }]
        expect(verifyAssistantTurn(card, 'card', 2, requestId)).toBe(true)
        card.organization_warnings = [{ code: 'COLLECTION_REMOVED', collection_id: collectionId, name: 'x' }]
        expect(verifyAssistantTurn(card, 'card', 2, requestId)).toBe(false)
        expect(verifyAssistantTurn({ ...turn('lorebook'), organization_warnings: [] }, 'lorebook', 2, requestId)).toBe(false)
        expect(verifyAssistantTurn({ ...turn('app'), organization_warnings: [] }, 'app', 2, requestId)).toBe(false)
    })
})

describe.each(KINDS)('%s assistant turn contract', (kind) => {
    const document = kind !== 'app'
    const terminalCount = document ? 3 : 2

    it('retains a canonical system message before the terminal turn', async () => {
        const body = turn(kind)
        const messages = body.messages as Record<string, unknown>[]
        for (const message of messages) message.sequence_no = (message.sequence_no as number) + 1
        messages.unshift({ message_id: 19, conversation_id: 2, sequence_no: 1, role: 'system', status: 'completed', content: 'Conversation context.' })
        expect(verifyAssistantTurn(body, kind, 2, requestId)).toBe(true)
        fetchMock.mockResolvedValueOnce(sse(body))
        await send(kind)
        expect(fetchMock).toHaveBeenCalledOnce()
    })

    it('streams the turn body with its request id and delivers the complete frozen result', async () => {
        const body = turn(kind)
        expect(verifyAssistantTurn(body, kind, 2, requestId)).toBe(true)
        fetchMock.mockResolvedValueOnce(sse(body))
        const events = vi.fn()
        await send(kind, events)
        expect(fetchMock).toHaveBeenCalledOnce()
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('https://api.test.invalid/assistant/conversations/2/messages/stream')
        expect(JSON.parse(init.body)).toEqual({ ...turnBody(kind), llm: { selection: { mode: 'inherit' } } })
        expect(init.headers['X-Request-Id']).toBe(requestId)
        expect(events).toHaveBeenCalledWith({ type: 'final', ...body })
    })

    it.each(['missing_plan', 'private_plan', 'private_root', 'different_request', 'different_conversation',
        'old_id', 'old_sequence', 'pending', 'partial_guard', 'wrong_sequence', 'missing_history',
        'history_mismatch', 'other_kind', 'missing_kind', 'shape_of_other_kind'] as const)('rejects %s before delivery', async (invalid) => {
        const body = turn(kind)
        const conversation = body.conversation as Record<string, unknown>
        const user = body.user_message as Record<string, unknown>
        if (invalid === 'missing_plan') delete body.llm_execution
        else if (invalid === 'private_plan') body.llm_execution = { ...(body.llm_execution as object), api_key: 'FAKE_PRIVATE_CANARY' }
        else if (invalid === 'private_root') body.credentials = { api_key: 'FAKE_PRIVATE_CANARY' }
        else if (invalid === 'different_request') body.request_id = 'another-request'
        else if (invalid === 'different_conversation') conversation.conversation_id = 3
        else if (invalid === 'old_id') conversation.id = 2
        else if (invalid === 'old_sequence') user.sequence = 1
        else if (invalid === 'pending') user.status = 'pending'
        else if (invalid === 'partial_guard') conversation.active_request_started_at = '2000-01-01'
        else if (invalid === 'wrong_sequence') user.sequence_no = 20
        else if (invalid === 'missing_history') delete body.messages
        else if (invalid === 'history_mismatch') body.messages = (body.messages as unknown[]).slice(0, terminalCount - 1)
        else if (invalid === 'other_kind') conversation.kind = kind === 'app' ? 'card' : 'app'
        else if (invalid === 'missing_kind') delete conversation.kind
        else if (document) delete body.tool_message
        else body.tool_message = { ...user, message_id: 22, sequence_no: 3, role: 'tool' }
        expect(verifyAssistantTurn(body, kind, 2, requestId)).toBe(false)
        fetchMock.mockResolvedValueOnce(sse(body))
        const events = vi.fn()
        await expect(send(kind, events)).rejects.toMatchObject({
            code: invalid === 'different_request' ? 'stream_contract' : 'assistant_execution_contract',
            retryable: false,
        })
        expect(events).not.toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledOnce()
    })

    function linkedTurn() {
        const body = turn(kind)
        const user = body.user_message as Record<string, unknown>
        user.metadata = { request_id: 'original-turn' }
        const assistant = body.assistant_message as Record<string, unknown>
        assistant.sequence_no = 3
        assistant.metadata = { request_id: requestId, execution_attempt: {
            execution_id: '11111111-1111-4111-8111-111111111111',
            parent_execution_id: '44444444-4444-4444-8444-444444444444',
            user_message_id: user.message_id, origin_request_id: 'original-turn',
        } }
        const failed = { message_id: 23, conversation_id: 2, sequence_no: 2, role: 'assistant',
            status: 'failed', content: 'Failed.', metadata: { request_id: 'original-turn' } }
        if (document) {
            const tool = body.tool_message as Record<string, unknown>
            tool.sequence_no = 4
            body.messages = [user, failed, assistant, tool]
        } else {
            body.messages = [user, failed, assistant]
        }
        return body
    }

    it('accepts a linked attempt preserving the original user and failed reply', async () => {
        const body = linkedTurn()
        expect(verifyAssistantTurn(body, kind, 2, requestId)).toBe(true)
        fetchMock.mockResolvedValueOnce(sse(body))
        await send(kind)
        expect(fetchMock).toHaveBeenCalledOnce()
    })

    it.each(['parent_self', 'foreign_user', 'changed_origin', 'private_attempt', 'missing_predecessor', 'newer_user'] as const)(
        'rejects a linked result with %s', (invalid) => {
            const body = linkedTurn()
            const assistant = body.assistant_message as Record<string, unknown>
            const attempt = (assistant.metadata as Record<string, unknown>).execution_attempt as Record<string, unknown>
            if (invalid === 'parent_self') attempt.parent_execution_id = attempt.execution_id
            else if (invalid === 'foreign_user') attempt.user_message_id = 999
            else if (invalid === 'changed_origin') attempt.origin_request_id = requestId
            else if (invalid === 'private_attempt') attempt.api_key = 'FAKE_PRIVATE'
            else if (invalid === 'missing_predecessor') (body.messages as unknown[]).splice(1, 1)
            else {
                const predecessor = (body.messages as Record<string, unknown>[])[1]
                predecessor.role = 'user'; predecessor.status = 'completed'
            }
            expect(verifyAssistantTurn(body, kind, 2, requestId)).toBe(false)
        },
    )

    it('delivers a coded stream failure with its code under `error`, never a detail object', async () => {
        const failure = { detail: { code: 'ASSISTANT_TARGET_SNAPSHOT_STALE' }, status_code: 409, request_id: requestId }
        fetchMock.mockResolvedValueOnce(new Response(`event: error\ndata: ${JSON.stringify({ type: 'error', ...failure })}\n\n`, { headers: { 'Content-Type': 'text/event-stream' } }))
        const events = vi.fn()
        await send(kind, events)
        expect(events).toHaveBeenCalledWith({ type: 'error', status_code: 409, request_id: requestId, error: { code: 'ASSISTANT_TARGET_SNAPSHOT_STALE' } })
    })

    it('offers a linked retry only after a terminal status read from the turn route', async () => {
        const failure = { detail: { code: 'LLM_EXECUTION_UPSTREAM_FAILED' } }
        fetchMock.mockResolvedValueOnce(new Response(`event: error\ndata: ${JSON.stringify(failure)}\n\n`, { headers: { 'Content-Type': 'text/event-stream' } }))
            .mockResolvedValueOnce(json({ request_id: requestId, status: 'failed', recovery_required: true,
                execution_id: '44444444-4444-4444-8444-444444444444' }))
        await expect(send(kind)).rejects.toMatchObject({ llmRetry: {
            retry_of_execution_id: '44444444-4444-4444-8444-444444444444', selection: { mode: 'inherit' },
        } })
        expect(fetchMock).toHaveBeenCalledTimes(2)
        const [url, init] = fetchMock.mock.calls[1]
        expect(url).toBe(`https://api.test.invalid/assistant/conversations/2/turns/${requestId}`)
        expect(init).toMatchObject({ method: 'GET' })
        expect(init.body).toBeUndefined()
    })

    it.each(['running', 'wrong_request', 'private_status', 'unconfirmed'] as const)('does not offer a new attempt for %s', async (invalid) => {
        const status: Record<string, unknown> = { request_id: requestId, status: 'failed', recovery_required: true,
            execution_id: '44444444-4444-4444-8444-444444444444' }
        if (invalid === 'running') status.status = 'running'
        if (invalid === 'wrong_request') status.request_id = 'another-turn'
        if (invalid === 'private_status') status.api_key = 'FAKE_PRIVATE'
        if (invalid === 'unconfirmed') status.recovery_required = false
        fetchMock.mockResolvedValueOnce(json({ detail: { code: 'LLM_EXECUTION_UPSTREAM_FAILED' } }, 502))
            .mockResolvedValueOnce(json(status))
        await expect(send(kind)).rejects.toSatisfy((error: unknown) => !!error && typeof error === 'object' && !('llmRetry' in error && (error as { llmRetry?: unknown }).llmRetry))
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('sends a personal selection and key only in the transient execution input', async () => {
        const body = turn(kind)
        body.llm_execution = { ...(body.llm_execution as object), credential_mode: 'user_byok' }
        fetchMock.mockResolvedValueOnce(sse(body))
        const llm = { selection: { mode: 'profile' as const, profile_id: '22222222-2222-4222-8222-222222222222' },
            expected_revision_id: '33333333-3333-4333-8333-333333333333', credentials: { api_key: 'FAKE_TRANSIENT_CANARY' } }
        await send(kind, vi.fn(), { llm })
        expect(JSON.parse(fetchMock.mock.calls[0][1].body).llm).toEqual(llm)
        expect(JSON.stringify(localStorage) + JSON.stringify(sessionStorage)).not.toContain('FAKE_TRANSIENT_CANARY')
    })

    it('reconciles the exact request by GET without another generation or key', async () => {
        const body = turn(kind)
        fetchMock.mockResolvedValueOnce(json({ request_id: requestId, status: 'pending', recovery_required: false }))
            .mockResolvedValueOnce(json({ request_id: requestId, status: 'completed', turn: body, recovery_required: false }))
        expect(await apiService.getAssistantTurn(kind, 2, requestId)).toBeNull()
        expect(await apiService.getAssistantTurn(kind, 2, requestId)).toEqual(body)
        for (const [url, init] of fetchMock.mock.calls) {
            expect(url).toBe(`https://api.test.invalid/assistant/conversations/2/turns/${requestId}`)
            expect(init.method).toBe('GET')
            expect(init.body).toBeUndefined()
        }
    })

    it('rejects reconciliation for a different request or a turn of another kind', async () => {
        const other = turn(kind)
        ;(other.conversation as Record<string, unknown>).kind = kind === 'app' ? 'lorebook' : 'app'
        fetchMock.mockResolvedValueOnce(json({ request_id: 'another', status: 'pending' }))
            .mockResolvedValueOnce(json({ request_id: requestId, status: 'completed', turn: other }))
        await expect(apiService.getAssistantTurn(kind, 2, requestId)).rejects.toThrow('different request')
        await expect(apiService.getAssistantTurn(kind, 2, requestId)).rejects.toMatchObject({ code: 'assistant_execution_contract' })
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })
})

describe('assistant history roles', () => {
    function withEarlierTool(kind: AssistantKind) {
        const body = turn(kind)
        const messages = body.messages as Record<string, unknown>[]
        for (const message of messages) message.sequence_no = (message.sequence_no as number) + 1
        messages.unshift({ message_id: 19, conversation_id: 2, sequence_no: 1, role: 'tool', status: 'completed', content: '{"applied_actions":[]}' })
        return body
    }

    it('keeps an earlier tool row in a document conversation', () => {
        expect(verifyAssistantTurn(withEarlierTool('card'), 'card', 2, requestId)).toBe(true)
        expect(verifyAssistantTurn(withEarlierTool('lorebook'), 'lorebook', 2, requestId)).toBe(true)
    })

    it('refuses any tool row in an app conversation', () => {
        expect(verifyAssistantTurn(withEarlierTool('app'), 'app', 2, requestId)).toBe(false)
    })
})

describe('assistant conversation routes', () => {
    it.each([
        ['card', { kind: 'card', card_type: 'character', card_id: 'char-1', title: 'Nyra' }],
        ['lorebook', { kind: 'lorebook', lorebook_id: 'lb-1', title: 'Saltmarsh lore' }],
        ['app', { kind: 'app', title: 'How do resources work?' }],
    ] as const)('creates a %s conversation with its scope and request id', async (kind, body) => {
        fetchMock.mockResolvedValueOnce(json({ conversation: assistantConversationFixture(kind), messages: [], target: null, target_cas: null }))
            .mockResolvedValueOnce(json({ conversation: assistantConversationFixture(kind), messages: [], target: null, target_cas: null }))
        await apiService.createAssistantConversation(body, { requestId: 'conv-req' })
        await apiService.createAssistantConversation(body)
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('https://api.test.invalid/assistant/conversations')
        expect(init.method).toBe('POST')
        expect(init.headers).toMatchObject({ 'X-Request-Id': 'conv-req', 'Content-Type': 'application/json' })
        expect(JSON.parse(init.body)).toEqual(body)
        expect(fetchMock.mock.calls[1][1].headers['X-Request-Id']).toMatch(/^mw-assistant-req-/)
    })

    it.each([
        [{ kind: 'card', card_type: 'world' }, '?kind=card&card_type=world'],
        [{ kind: 'card', card_type: 'world', card_id: 'world-1' }, '?kind=card&card_type=world&card_id=world-1'],
        [{ kind: 'lorebook' }, '?kind=lorebook'],
        [{ kind: 'lorebook', lorebook_id: 'lb-1' }, '?kind=lorebook&lorebook_id=lb-1'],
        [{ kind: 'app' }, '?kind=app'],
    ] as const)('lists %o', async (scope, query) => {
        fetchMock.mockResolvedValueOnce(json({ conversations: [] }))
        await expect(apiService.listAssistantConversations(scope)).resolves.toEqual({ conversations: [] })
        expect(fetchMock.mock.calls[0][0]).toBe(`https://api.test.invalid/assistant/conversations${query}`)
        expect(fetchMock.mock.calls[0][1].method).toBe('GET')
    })

    it('lists every assistant’s history without a scope', async () => {
        const history = KINDS.map((kind, index) => assistantConversationFixture(kind, { conversation_id: index + 1 }))
        fetchMock.mockResolvedValueOnce(json({ conversations: history }))
        await expect(apiService.listAssistantConversations(null)).resolves.toEqual({ conversations: history })
        expect(fetchMock.mock.calls[0][0]).toBe('https://api.test.invalid/assistant/conversations')
        expect(fetchMock.mock.calls[0][1].method).toBe('GET')
    })

    it('leaves conversations of kinds this build switched off out of the history', async () => {
        setTestFeatureFlags({ lorebooks: false })
        const history = KINDS.map((kind, index) => assistantConversationFixture(kind, { conversation_id: index + 1 }))
        fetchMock.mockResolvedValueOnce(json({ conversations: history }))
        const { conversations } = await apiService.listAssistantConversations(null)
        expect(conversations.map((conversation) => conversation.kind)).toEqual(['card', 'app'])
    })

    it.each(KINDS)('reads and deletes a %s conversation by id', async (kind) => {
        const detail = { conversation: assistantConversationFixture(kind, { conversation_id: 9 }), messages: [], target: null, target_cas: null }
        fetchMock.mockResolvedValueOnce(json(detail)).mockResolvedValueOnce(new Response(null, { status: 204 }))
        await expect(apiService.getAssistantConversation(kind, 9)).resolves.toEqual(detail)
        await expect(apiService.deleteAssistantConversation(kind, 9)).resolves.toBeUndefined()
        expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
            ['https://api.test.invalid/assistant/conversations/9', 'GET'],
            ['https://api.test.invalid/assistant/conversations/9', 'DELETE'],
        ])
    })

    it('surfaces a busy delete as 409', async () => {
        fetchMock.mockResolvedValueOnce(json({ detail: 'A turn is still running.' }, 409))
        await expect(apiService.deleteAssistantConversation('card', 9)).rejects.toMatchObject({ status: 409 })
    })

    it.each(KINDS)('surfaces a switched-off %s assistant as 503 ASSISTANT_DISABLED', async (kind) => {
        const disabled = { detail: { code: 'ASSISTANT_DISABLED', message: 'This assistant is disabled.' } }
        fetchMock.mockResolvedValueOnce(json(disabled, 503)).mockResolvedValueOnce(json(disabled, 503))
        await expect(apiService.listAssistantConversations({ kind } as Parameters<typeof apiService.listAssistantConversations>[0]))
            .rejects.toMatchObject({ status: 503, code: 'ASSISTANT_DISABLED' })
        await expect(send(kind)).rejects.toMatchObject({ status: 503, code: 'ASSISTANT_DISABLED' })
    })

    it('surfaces a turn sent to a conversation of another kind as 409 ASSISTANT_KIND_MISMATCH', async () => {
        fetchMock.mockResolvedValueOnce(json({ detail: { code: 'ASSISTANT_KIND_MISMATCH', message: 'Wrong kind.' } }, 409))
        await expect(send('app')).rejects.toMatchObject({ status: 409, code: 'ASSISTANT_KIND_MISMATCH' })
    })

    it('gates lorebook and app conversations on their feature flags before any request', async () => {
        setTestFeatureFlags({ lorebooks: false })
        setTestFeatureFlags({ appAssistant: false })
        await expect(apiService.listAssistantConversations({ kind: 'lorebook' })).rejects.toThrow('Lorebooks are disabled.')
        await expect(send('lorebook')).rejects.toThrow('Lorebooks are disabled.')
        await expect(apiService.listAssistantConversations({ kind: 'app' })).rejects.toThrow('The app assistant is disabled.')
        await expect(apiService.getAssistantTurn('app', 2, requestId)).rejects.toThrow('The app assistant is disabled.')
        expect(fetchMock).not.toHaveBeenCalled()
        fetchMock.mockResolvedValueOnce(json({ conversations: [] }))
        await apiService.listAssistantConversations({ kind: 'card', card_type: 'item' })
        expect(fetchMock).toHaveBeenCalledOnce()
    })
})
