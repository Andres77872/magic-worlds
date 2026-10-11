import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { apiService } from './index'
import { authSession } from './authSession'

vi.mock('./baseUrl', () => ({ API_BASE_URL: 'https://api.test.invalid' }))

const EXECUTION = '44444444-4444-4444-8444-444444444444'
const PROFILE = '11111111-1111-4111-8111-111111111111'
const REVISION = '22222222-2222-4222-8222-222222222222'
const CANARY = 'FAKE_CHAT_COMMAND_SECRET'
type MutableCommand = Record<string, unknown> & {
    dispatch: Record<string, unknown> & {
        llm: Record<string, unknown> & { selection: Record<string, unknown> }
    }
}
const original = () => ({ status: 'failed', request_id: 'request-1', execution_id: EXECUTION, recovery_required: true,
    dispatch: { content: 'Open the door', existing_user_message_id: null,
        llm: { selection: { mode: 'profile', profile_id: PROFILE }, expected_revision_id: REVISION } } })
const respond = (value: unknown) => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(value), {
    status: 200, headers: { 'Content-Type': 'application/json' },
})))

describe('native chat reconciliation', () => {
    beforeEach(() => { authSession.authenticate('chat-fixture', 'FAKE_TOKEN') })
    afterEach(() => { vi.unstubAllGlobals(); authSession.continueSignedOut() })

    it('returns only the original public command and reads the scoped request', async () => {
        const value = original()
        respond(value)
        const controller = new AbortController()
        expect(await apiService.reconcileChatTurn('character-chats', 7, 'request-1', controller.signal)).toEqual(value)
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/character-chats/7/turns/request-1'),
            expect.objectContaining({ method: 'GET', cache: 'no-store' }))
    })

    it('projects completed state without retaining the saved response in the retry command', async () => {
        respond({ status: 'completed', request_id: 'request-1', execution_id: EXECUTION, recovery_required: false,
            turn: { content: 'The door opens.' } })
        expect(await apiService.reconcileChatTurn('adventure-sessions', 7, 'request-1')).toEqual({
            status: 'completed', request_id: 'request-1', execution_id: EXECUTION, recovery_required: false,
        })
    })

    it.each([
        (value: MutableCommand) => delete value.execution_id,
        (value: Partial<MutableCommand>) => delete value.dispatch,
        (value: MutableCommand) => { value.request_id = 'foreign-request' },
        (value: MutableCommand) => { value.execution_id = 'not-an-execution' },
        (value: MutableCommand) => { value.recovery_required = 1 },
        (value: MutableCommand) => { value.provider_key = CANARY },
        (value: MutableCommand) => { value.dispatch.credentials = { api_key: CANARY } },
        (value: MutableCommand) => { value.dispatch.content = '' },
        (value: MutableCommand) => { value.dispatch.existing_user_message_id = true },
        (value: MutableCommand) => { value.dispatch.existing_user_message_id = -1 },
        (value: MutableCommand) => { value.dispatch.llm.credentials = { api_key: CANARY } },
        (value: MutableCommand) => { value.dispatch.llm.selection.expected_revision_id = REVISION },
        (value: MutableCommand) => { value.dispatch.llm.selection.profile_id = 'invalid' },
        (value: MutableCommand) => { value.dispatch.llm.expected_revision_id = 'invalid' },
        (value: MutableCommand) => { value.dispatch.llm.retry_of_execution_id = 'invalid' },
    ])('rejects missing, foreign, altered or secret-bearing command fields', async mutation => {
        const value = original()
        mutation(value)
        respond(value)
        const error = await apiService.reconcileChatTurn('adventure-sessions', 7, 'request-1').catch(error => error)
        expect(error).toBeInstanceOf(Error)
        expect(String(error)).not.toContain(CANARY)
    })
})
