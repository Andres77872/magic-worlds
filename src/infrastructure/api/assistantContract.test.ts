import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cardAssistantTurnFixture } from '@/test/assistantFixtures'
import { verifyAssistantExecution } from './assistantContract'
import { apiService } from './index'
import { authSession } from './authSession'

vi.mock('./baseUrl', () => ({ API_BASE_URL: 'https://api.test.invalid' }))

const requestId = 'assistant-contract-1'
const fetchMock = vi.fn()
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const sse = (body: unknown) => new Response(`event: final\ndata: ${JSON.stringify(body)}\n\nevent: done\ndata: {}\n\n`, { headers: { 'Content-Type': 'text/event-stream' } })

function turn(kind: 'card' | 'lorebook'): Record<string, unknown> {
    const card = cardAssistantTurnFixture(requestId)
    if (kind === 'card') return card as unknown as Record<string, unknown>
    const rest = { ...card } as Partial<typeof card>
    delete rest.card
    return { ...rest, lorebook: null, conversation: { conversation_id: 2, lorebook_id: null, active_request_id: null } }
}

async function send(kind: 'card' | 'lorebook', streaming: boolean, onEvent = vi.fn()) {
    const settings = { requestId }
    if (kind === 'card') return streaming
        ? apiService.streamCardAssistantMessage(2, { message: 'Generate it', card_type: 'world' }, onEvent, settings)
        : apiService.sendCardAssistantMessage(2, { message: 'Generate it', card_type: 'world' }, settings)
    return streaming ? apiService.streamLorebookAssistantMessage(2, { message: 'Generate it' }, onEvent, settings)
        : apiService.sendLorebookAssistantMessage(2, { message: 'Generate it' }, settings)
}

beforeEach(() => {
    vi.resetAllMocks()
    localStorage.clear(); sessionStorage.clear()
    authSession.authenticate('assistant-owner', 'FAKE_SESSION')
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('VITE_FEATURE_LOREBOOKS_ENABLED', 'true')
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe.each(['card', 'lorebook'] as const)('%s assistant profile contract', (kind) => {
    it('retains a canonical system message before the terminal turn', async () => {
        const body = turn(kind)
        const messages = body.messages as Record<string, unknown>[]
        for (const message of messages) message.sequence_no = (message.sequence_no as number) + 1
        messages.unshift({ message_id: 19, conversation_id: 2, sequence_no: 1, role: 'system', status: 'completed', content: 'Conversation context.' })
        expect(verifyAssistantExecution(body, kind, 2, requestId)).toBe(true)
        fetchMock.mockResolvedValueOnce(json(body))
        await send(kind, false)
        expect(fetchMock).toHaveBeenCalledOnce()
    })

    it.each([false, true])('accepts the complete frozen result (stream=%s)', async (streaming) => {
        const body = turn(kind)
        expect(verifyAssistantExecution(body, kind, 2, requestId)).toBe(true)
        fetchMock.mockResolvedValueOnce(streaming ? sse(body) : json(body))
        const events = vi.fn()
        await send(kind, streaming, events)
        expect(fetchMock).toHaveBeenCalledOnce()
        const init = fetchMock.mock.calls[0][1]
        expect(JSON.parse(init.body).llm).toEqual({ selection: { mode: 'inherit' } })
        expect(init.headers['X-Request-Id']).toBe(requestId)
        if (streaming) expect(events).toHaveBeenCalledWith({ type: 'final', ...body })
    })

    it.each(['missing_plan', 'private_plan', 'private_root', 'different_request', 'different_conversation',
        'old_id', 'old_sequence', 'pending', 'partial_guard', 'wrong_sequence', 'mixed_kind', 'missing_history',
        'missing_tool', 'history_mismatch', 'wrong_kind'] as const)('rejects %s before delivery', async (invalid) => {
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
        else if (invalid === 'mixed_kind') body[kind === 'card' ? 'lorebook' : 'card'] = null
        else if (invalid === 'missing_history') delete body.messages
        else if (invalid === 'missing_tool') delete body.tool_message
        else if (invalid === 'history_mismatch') body.messages = (body.messages as unknown[]).slice(0, 2)
        else { delete body[kind]; body[kind === 'card' ? 'lorebook' : 'card'] = null }
        expect(verifyAssistantExecution(body, kind, 2, requestId)).toBe(false)
        fetchMock.mockResolvedValueOnce(json(body))
        await expect(send(kind, false)).rejects.toMatchObject({ code: 'assistant_execution_contract', retryable: false })
        expect(fetchMock).toHaveBeenCalledOnce()
        fetchMock.mockReset(); fetchMock.mockResolvedValueOnce(sse(body))
        const events = vi.fn()
        await expect(send(kind, true, events)).rejects.toMatchObject({ code: invalid === 'different_request' ? 'stream_contract' : 'assistant_execution_contract' })
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
        const tool = body.tool_message as Record<string, unknown>
        tool.sequence_no = 4
        body.messages = [user, { message_id: 23, conversation_id: 2, sequence_no: 2, role: 'assistant',
            status: 'failed', content: 'Failed.', metadata: { request_id: 'original-turn' } }, assistant, tool]
        return body
    }

    it.each([false, true])('accepts a linked attempt preserving the original user and failed reply (stream=%s)', async (streaming) => {
        const body = linkedTurn()
        expect(verifyAssistantExecution(body, kind, 2, requestId)).toBe(true)
        fetchMock.mockResolvedValueOnce(streaming ? sse(body) : json(body))
        await send(kind, streaming)
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
            expect(verifyAssistantExecution(body, kind, 2, requestId)).toBe(false)
        },
    )

    it.each([false, true])('offers a linked retry only after a terminal status from the same request (stream=%s)', async (streaming) => {
        const failure = { detail: { code: 'LLM_EXECUTION_UPSTREAM_FAILED' } }
        const failedStream = new Response(`event: error\ndata: ${JSON.stringify(failure)}\n\n`, { headers: { 'Content-Type': 'text/event-stream' } })
        fetchMock.mockResolvedValueOnce(streaming ? failedStream : json(failure, 502))
            .mockResolvedValueOnce(json({ request_id: requestId, status: 'failed', recovery_required: true,
                execution_id: '44444444-4444-4444-8444-444444444444' }))
        await expect(send(kind, streaming)).rejects.toMatchObject({ llmRetry: {
            retry_of_execution_id: '44444444-4444-4444-8444-444444444444', selection: { mode: 'inherit' },
        } })
        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'GET' })
        expect(fetchMock.mock.calls[1][1].body).toBeUndefined()
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
        await expect(send(kind, false)).rejects.toSatisfy((error: unknown) => !!error && typeof error === 'object' && !('llmRetry' in error && (error as { llmRetry?: unknown }).llmRetry))
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('sends a personal selection and key only in the transient execution input', async () => {
        const body = turn(kind)
        body.llm_execution = { ...(body.llm_execution as object), credential_mode: 'user_byok' }
        fetchMock.mockResolvedValueOnce(json(body))
        const llm = { selection: { mode: 'profile' as const, profile_id: '22222222-2222-4222-8222-222222222222' },
            expected_revision_id: '33333333-3333-4333-8333-333333333333', credentials: { api_key: 'FAKE_TRANSIENT_CANARY' } }
        if (kind === 'card') await apiService.sendCardAssistantMessage(2, { message: 'Generate it', card_type: 'world' }, { requestId, llm })
        else await apiService.sendLorebookAssistantMessage(2, { message: 'Generate it' }, { requestId, llm })
        expect(JSON.parse(fetchMock.mock.calls[0][1].body).llm).toEqual(llm)
        expect(JSON.stringify(localStorage) + JSON.stringify(sessionStorage)).not.toContain('FAKE_TRANSIENT_CANARY')
    })

    it('reconciles the exact request by GET without another generation or key', async () => {
        const body = turn(kind)
        fetchMock.mockResolvedValueOnce(json({ request_id: requestId, status: 'pending', recovery_required: false }))
            .mockResolvedValueOnce(json({ request_id: requestId, status: 'completed', turn: body, recovery_required: false }))
        const get = kind === 'card' ? apiService.getCardAssistantTurn.bind(apiService) : apiService.getLorebookAssistantTurn.bind(apiService)
        expect(await get(2, requestId)).toBeNull()
        expect(await get(2, requestId)).toEqual(body)
        for (const [url, init] of fetchMock.mock.calls) {
            expect(url).toMatch(new RegExp(`/${kind}-assistant/conversations/2/turns/${requestId}$`))
            expect(init.method).toBe('GET')
            expect(init.body).toBeUndefined()
        }
    })

    it('rejects reconciliation for a different request', async () => {
        fetchMock.mockResolvedValueOnce(json({ request_id: 'another', status: 'pending' }))
        const get = kind === 'card' ? apiService.getCardAssistantTurn.bind(apiService) : apiService.getLorebookAssistantTurn.bind(apiService)
        await expect(get(2, requestId)).rejects.toThrow('different request')
        expect(fetchMock).toHaveBeenCalledOnce()
    })
})
