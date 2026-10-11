import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiService } from './index'
import { authSession } from './authSession'
import { verifyAgentDetail, verifyAgentTest } from './workflowContract'

const prompts = { system_message: 'Return a scene.', prompt_template: '{{handle_parser_input_0}}', json_output: false }
const builtin = {
    workflow_key: 'story_writer', kind: 'builtin_story', display_name: 'Story writer',
    output_mode: 'markdown', schema_model: null, builtin_version: 3, graph_version: 'mw-story-writer-v3',
    graph_version_prefix: 'mw-story-writer', editable: prompts,
}
const custom = {
    workflow_key: 'custom_demo', kind: 'custom', display_name: 'Demo', output_mode: 'markdown', schema_model: null,
    row_version: 2, has_draft_changes: false, current_version_number: 1, latest_version_number: 1, updated_at: null,
    graph_version_prefix: 'mw-custom-demo', draft: prompts,
    current: { ...prompts, version_number: 1, graph_version: 'mw-custom-demo-v1', output_mode: 'markdown', schema_model: null },
}
const result = { output_mode: 'markdown', graph_version: 'mw-story-writer-v3', text_output: 'The gate opened.', json_output: null,
    llm_execution: { execution_id: '11111111-1111-4111-8111-111111111111', profile_id: '22222222-2222-4222-8222-222222222222',
        revision_id: '33333333-3333-4333-8333-333333333333', resolution_source: 'system_default', credential_mode: 'platform', replayed: false } }
const fetchMock = vi.fn()
const response = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => {
    vi.clearAllMocks()
    authSession.authenticate('root-fixture', 'FAKE_SESSION')
    vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('workflow contract', () => {
    it('accepts builtin and custom prompt-only DTOs', () => {
        expect(verifyAgentDetail(builtin)).toBe(true)
        expect(verifyAgentDetail(custom)).toBe(true)
        expect(verifyAgentTest(result)).toBe(true)
    })
    it.each(['model', 'temperature', 'timeout', 'max_tokens', 'max_messages', 'max_input_tokens', 'top_p', 'truncation_strategy', 'api_key'])('rejects former editable field %s', (field) => {
        expect(verifyAgentDetail({ ...builtin, editable: { ...prompts, [field]: 'FAKE_CANARY' } })).toBe(false)
    })
    it('accepts an unpublished custom only without a current and with draft changes', () => {
        const unpublished = { ...custom, has_draft_changes: true, current_version_number: null, latest_version_number: 0, current: null }
        expect(verifyAgentDetail(unpublished)).toBe(true)
        expect(verifyAgentDetail({ ...unpublished, latest_version_number: 1 })).toBe(true)
        expect(verifyAgentDetail({ ...unpublished, has_draft_changes: false })).toBe(false)
        expect(verifyAgentDetail({ ...unpublished, current: custom.current })).toBe(false)
        expect(verifyAgentDetail({ ...custom, current: null })).toBe(false)
    })
    it('rejects the retired flat response and a malformed current version', () => {
        expect(verifyAgentDetail({ ...builtin, storage: 'file', draft: prompts, published: null })).toBe(false)
        expect(verifyAgentDetail({ ...custom, current: { ...custom.current, version_number: 2 } })).toBe(false)
    })
    it.each([
        { ...result, llm_execution: undefined },
        { ...result, llm_execution: { ...result.llm_execution, api_key: 'FAKE_CANARY' } },
        { ...result, text_output: null },
        { ...result, json_output: { hidden: 'FAKE_CANARY' } },
        { ...result, provider_key: 'FAKE_CANARY' },
    ])('rejects malformed or private test responses', async (body) => {
        fetchMock.mockResolvedValueOnce(response(body))
        await expect(apiService.testAgent('story_writer', { input_text: 'Open the gate', source: 'current', llm: { selection: { mode: 'inherit' } } }, 'test-1'))
            .rejects.toMatchObject({ code: 'workflow_execution_contract', status: 502 })
    })
    it('sends the supplied optimistic version and request ID', async () => {
        fetchMock.mockResolvedValueOnce(response(custom)).mockResolvedValueOnce(response(result))
        await apiService.updateAgentDraft('custom_demo', { system_message: prompts.system_message, prompt_template: prompts.prompt_template }, 2)
        expect(new Headers(fetchMock.mock.calls[0][1].headers).get('If-Match')).toBe('"2"')
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ system_message: prompts.system_message, prompt_template: prompts.prompt_template })
        await apiService.testAgent('story_writer', { input_text: 'Open the gate', source: 'current', llm: { selection: { mode: 'inherit' } } }, 'test-1')
        expect(new Headers(fetchMock.mock.calls[1][1].headers).get('X-Request-Id')).toBe('test-1')
    })
})
