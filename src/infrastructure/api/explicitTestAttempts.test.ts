import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiService } from './index'
import { authSession } from './authSession'
import { configureLlmPreparation } from './llmPreparation'
import { llmIntents } from './llmIntent'

vi.mock('./baseUrl', () => ({ API_BASE_URL: 'https://api.test.invalid' }))
const PROFILE = '11111111-1111-4111-8111-111111111111'
const REVISION = '22222222-2222-4222-8222-222222222222'
const PARENT = '44444444-4444-4444-8444-444444444444'
const CHILD = '55555555-5555-4555-8555-555555555555'
const FIRST = 'FAKE_EXPLICIT_FIRST_CANARY'
const FRESH = 'FAKE_EXPLICIT_FRESH_CANARY'
const fetchMock = vi.fn()
let clearPreparation: (() => void) | undefined
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
const state = (status = 'failed', recovery = true) => ({ execution_id: PARENT, request_id: 'original', status, recovery_required: recovery })
const selection = { mode: 'profile' as const, profile_id: PROFILE }
const studioResult = { output_mode: 'markdown', graph_version: 'mw-story-writer-v3', text_output: 'OK', json_output: null,
    llm_execution: { execution_id: CHILD, profile_id: PROFILE, revision_id: REVISION, resolution_source: 'explicit', credential_mode: 'user_byok', replayed: false } }

beforeEach(() => { fetchMock.mockReset(); llmIntents.clear(); authSession.authenticate('root-fixture', 'FAKE_APP_TOKEN'); vi.stubGlobal('fetch', fetchMock) })
afterEach(() => { clearPreparation?.(); clearPreparation = undefined; llmIntents.clear(); authSession.continueSignedOut(); vi.unstubAllGlobals() })

it('confirms the owned Studio parent, then prepares a fresh key for a new linked request', async () => {
    fetchMock.mockResolvedValueOnce(response({ detail: { code: 'LLM_EXECUTION_UPSTREAM_FAILED' } }, 502)).mockResolvedValueOnce(response(state()))
    const body = { input_text: 'Original input', source: 'current' as const,
        llm: { selection, expected_revision_id: REVISION, credentials: { api_key: FIRST } } }
    const error = await apiService.testAgent('story_writer', body, 'original', 'novel').catch(error => error)
    expect(error.llmRetry).toEqual({ retry_of_execution_id: PARENT, selection, expected_revision_id: REVISION })
    expect(fetchMock.mock.calls[1][0]).toContain('/llm/features/novel/executions/original')
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'GET', cache: 'no-store' })
    expect(JSON.stringify(fetchMock.mock.calls[1])).not.toContain(FIRST)
    const prepare = vi.fn(async () => () => ({ selection, expected_revision_id: REVISION, credentials: { api_key: FRESH } }))
    clearPreparation = configureLlmPreparation(prepare)
    fetchMock.mockResolvedValueOnce(response(studioResult))
    await apiService.testAgent('story_writer', { ...body, llm: error.llmRetry }, 'child', 'novel')
    expect(prepare).toHaveBeenCalledWith('novel', undefined, selection, PARENT)
    const wire = JSON.parse(fetchMock.mock.calls[2][1].body)
    expect(wire).toEqual({ input_text: 'Original input', source: 'current', llm: { ...error.llmRetry, credentials: { api_key: FRESH } } })
    expect(new Headers(fetchMock.mock.calls[2][1].headers).get('X-Request-Id')).toBe('child')
    expect(JSON.stringify(localStorage) + JSON.stringify(sessionStorage) + JSON.stringify(error.llmRetry)).not.toMatch(/FAKE_EXPLICIT_(FIRST|FRESH)_CANARY/)
})

it('keeps an uncertain Studio request and replays it without preparing or sending its old key', async () => {
    fetchMock.mockResolvedValueOnce(response({ detail: { code: 'LLM_EXECUTION_FINISHED' } }, 409)).mockResolvedValueOnce(response(state('running', false)))
    const body = { input_text: 'Original input', source: 'current' as const,
        llm: { selection, expected_revision_id: REVISION, credentials: { api_key: FIRST } } }
    const error = await apiService.testAgent('story_writer', body, 'original', 'novel').catch(error => error)
    expect(error.llmRetry).toBeUndefined()
    const prepare = vi.fn(async () => () => ({ selection, expected_revision_id: REVISION }))
    clearPreparation = configureLlmPreparation(prepare)
    fetchMock.mockResolvedValueOnce(response(studioResult))
    await apiService.testAgent('story_writer', { input_text: body.input_text, source: body.source }, 'original', 'novel')
    expect(prepare).not.toHaveBeenCalled()
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).llm).toEqual({ selection, expected_revision_id: REVISION })
    expect(new Headers(fetchMock.mock.calls[2][1].headers).get('X-Request-Id')).toBe('original')
})

it('refuses a different revision before dispatching a child key', async () => {
    clearPreparation = configureLlmPreparation(async () => () => ({ selection, expected_revision_id: CHILD, credentials: { api_key: FRESH } }))
    await expect(apiService.testAgent('story_writer', { input_text: 'Original input', source: 'current',
        llm: { selection, expected_revision_id: REVISION, retry_of_execution_id: PARENT } }, 'child', 'novel')).rejects.toThrow('LLM_EXECUTION_INTENT_CHANGED')
    expect(fetchMock).not.toHaveBeenCalled()
})

it('preserves inherited platform intent without adding a CAS that the original request never supplied', async () => {
    clearPreparation = configureLlmPreparation(async () => () => ({ selection: { mode: 'inherit' }, expected_revision_id: REVISION }))
    fetchMock.mockResolvedValueOnce(response({ ...studioResult, llm_execution: { ...studioResult.llm_execution, credential_mode: 'platform', resolution_source: 'system_default' } }))
    await apiService.testAgent('story_writer', { input_text: 'Original input', source: 'current',
        llm: { selection: { mode: 'inherit' }, retry_of_execution_id: PARENT } }, 'child', 'novel')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).llm).toEqual({ selection: { mode: 'inherit' }, retry_of_execution_id: PARENT })
})

it('sends a saved draft retry with its original draft version and no personal credential', async () => {
    fetchMock.mockResolvedValueOnce(response({ detail: { code: 'LLM_EXECUTION_UPSTREAM_FAILED' } }, 502)).mockResolvedValueOnce(response(state()))
    const error = await apiService.testLlmProfile(PROFILE, { kind: 'draft', draftVersion: 4 }, 'novel', 'original', true).catch(error => error)
    expect(error.llmRetry).toEqual({ selection, retry_of_execution_id: PARENT })
    fetchMock.mockResolvedValueOnce(response({ execution_id: CHILD, profile_id: PROFILE, revision_id: REVISION,
        payer_mode: 'platform', feature: 'novel', roles: ['primary'], target: 'draft', replayed: false, output: 'OK' }))
    await apiService.testLlmProfile(PROFILE, { kind: 'draft', draftVersion: 4 }, 'novel', 'child', true, undefined, PARENT)
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ feature: 'novel', expected_draft_version: 4, retry_of_execution_id: PARENT })
})

it.each([
    { ...state(), request_id: 'foreign' }, { ...state(), execution_id: 'invalid' }, { ...state(), status: 'paused' },
    { ...state(), recovery_required: 1 }, { ...state(), api_key: FIRST }, { ...state(), status: 'completed', recovery_required: true },
])('rejects an altered or private execution status without exposing it', async value => {
    fetchMock.mockResolvedValueOnce(response(value))
    const error = await apiService.getLlmExecutionState('novel', 'original').catch(error => error)
    expect(error.code).toBe('llm_execution_state_contract')
    expect(String(error)).not.toContain(FIRST)
})

it('recovers inherited BYOK with the same original selection after a newer revision exists', async () => {
    const prepare = vi.fn(async () => () => ({
        selection, expected_revision_id: REVISION, credentials: { api_key: FRESH },
    }))
    clearPreparation = configureLlmPreparation(prepare)
    fetchMock.mockResolvedValueOnce(response({ detail: { code: 'LLM_EXECUTION_RECOVERY_REQUIRED' } }, 409))
    const original = { input_text: 'Original input', source: 'current' as const,
        llm: { selection: { mode: 'inherit' as const }, expected_revision_id: REVISION, credentials: { api_key: FIRST } } }
    await expect(apiService.testAgent('story_writer', original, 'original', 'novel')).rejects.toMatchObject({ code: 'LLM_EXECUTION_RECOVERY_REQUIRED' })
    fetchMock.mockResolvedValueOnce(response({ detail: { code: 'BYOK_CREDENTIAL_REQUIRED' } }, 409)).mockResolvedValueOnce(response(studioResult))
    await apiService.testAgent('story_writer', { input_text: original.input_text, source: original.source }, 'original', 'novel')
    expect(prepare).toHaveBeenCalledWith('novel', undefined, original.llm.selection, undefined, 'original')
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).llm).toEqual({
        selection: { mode: 'inherit' }, expected_revision_id: REVISION, credentials: { api_key: FRESH },
    })
})
