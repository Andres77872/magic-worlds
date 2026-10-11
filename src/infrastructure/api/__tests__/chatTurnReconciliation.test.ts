import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiService } from '../index'
import { authSession } from '../authSession'

vi.mock('../baseUrl', () => ({ API_BASE_URL: 'https://api.test.invalid' }))
const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); authSession.continueSignedOut(); authSession.authenticate('alice', 'FAKE_APP_TOKEN') })
afterEach(() => { vi.unstubAllGlobals(); authSession.continueSignedOut() })
const EXECUTION = '44444444-4444-4444-8444-444444444444'
const reply = (body: unknown, status = 200) => fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }))

it('reads a chat request state without caching and never runs it', async () => {
    // An unfinished request carries its original command, so a reloaded page can resume it exactly.
    const dispatch = { content: 'Open the door', existing_user_message_id: null,
        llm: { selection: { mode: 'profile', profile_id: '11111111-1111-4111-8111-111111111111' }, expected_revision_id: '22222222-2222-4222-8222-222222222222' } }
    reply({ status: 'running', request_id: 'req 1', execution_id: EXECUTION, recovery_required: true, dispatch })
    await expect(apiService.reconcileChatTurn('character-chats', 9, 'req 1')).resolves.toEqual({ status: 'running', request_id: 'req 1', execution_id: EXECUTION, recovery_required: true, dispatch })
    const [url, config] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.test.invalid/character-chats/9/turns/req%201')
    expect(config.method).toBe('GET'); expect(config.cache).toBe('no-store')
})
it('accepts a completed turn and leaves its content to the history', async () => {
    reply({ status: 'completed', request_id: 'req-1', execution_id: EXECUTION, recovery_required: false, turn: { turn_id: 'turn-1' } })
    await expect(apiService.reconcileChatTurn('adventure-sessions', 7, 'req-1')).resolves.toEqual({ status: 'completed', request_id: 'req-1', execution_id: EXECUTION, recovery_required: false })
})
it.each([
    ['another request', { status: 'running', request_id: 'req-2', execution_id: EXECUTION, recovery_required: false }],
    ['an unknown status', { status: 'paused', request_id: 'req-1', execution_id: EXECUTION, recovery_required: false }],
    ['a missing execution', { status: 'failed', request_id: 'req-1', recovery_required: true }],
    ['a malformed execution', { status: 'failed', request_id: 'req-1', execution_id: 'turn-1', recovery_required: true }],
    ['a completed turn that needs recovery', { status: 'completed', request_id: 'req-1', execution_id: EXECUTION, recovery_required: true, turn: {} }],
    ['a turn beside an unfinished state', { status: 'running', request_id: 'req-1', execution_id: EXECUTION, recovery_required: false, turn: {} }],
    ['an extra field', { status: 'failed', request_id: 'req-1', execution_id: EXECUTION, recovery_required: false, api_key: 'FAKE_PRIVATE_CANARY' }],
])('rejects a reconciliation with %s', async (_case, body) => {
    reply(body)
    await expect(apiService.reconcileChatTurn('adventure-sessions', 7, 'req-1')).rejects.toThrow('Chat reconciliation returned an invalid state.')
})
it('keeps the server code when the request was never admitted', async () => {
    reply({ detail: { code: 'LLM_EXECUTION_NOT_FOUND' } }, 404)
    await expect(apiService.reconcileChatTurn('adventure-sessions', 7, 'req-1')).rejects.toMatchObject({ status: 404, code: 'LLM_EXECUTION_NOT_FOUND' })
})
