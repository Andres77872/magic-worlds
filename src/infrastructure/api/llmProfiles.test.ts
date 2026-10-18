import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiService } from './index'
import { authSession } from './authSession'

vi.mock('./baseUrl', () => ({ API_BASE_URL: 'https://api.test.invalid' }))
const fetchMock = vi.fn()
const PROFILE = '11111111-1111-4111-8111-111111111111'
const REVISION = '22222222-2222-4222-8222-222222222222'
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); authSession.continueSignedOut(); authSession.authenticate('alice', 'FAKE_APP_TOKEN'); grantFixtureFeatures(true) })
afterEach(() => { vi.unstubAllGlobals(); authSession.continueSignedOut() })

it('sends the complete preference replacement with a quoted version and no-store', async () => {
    const preferences = { default_profile_id: PROFILE, feature_profiles: { novel: PROFILE } }
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ...preferences, row_version: 8, generation: 3 }), { status: 200 }))
    await apiService.saveLlmPreferences(preferences, 7)
    const [url, config] = fetchMock.mock.calls[0]
    expect(url).toContain('/user/llm/preferences'); expect(config.method).toBe('PUT'); expect(config.cache).toBe('no-store')
    expect(new Headers(config.headers).get('If-Match')).toBe('"7"'); expect(JSON.parse(config.body)).toEqual(preferences)
})
it('rejects a provider key echoed in a profile test even when it contains JSON escapes', async () => {
    const key = 'FAKE_"KEY\\_CANARY'
    const credentials = { api_key: key }
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ execution_id: '33333333-3333-4333-8333-333333333333', profile_id: PROFILE,
        revision_id: REVISION, payer_mode: 'user_byok', replayed: false, output: key }), { status: 200 }))
    await expect(apiService.testLlmProfile(PROFILE, { kind: 'published', revisionId: REVISION }, 'novel', 'test-intent-one', false, credentials)).rejects.toThrow('Invalid profile test response.')
    const config = fetchMock.mock.calls[0][1]
    expect(JSON.parse(config.body).credentials).toEqual(credentials)
    expect(JSON.stringify(localStorage)).not.toContain(key); expect(JSON.stringify(sessionStorage)).not.toContain(key)
})
it('reads own capacity usage without caching and rejects a malformed payer contract', async () => {
    const usage = { usage_day: '2026-06-10', month_start: '2026-06-01', operations: [{ operation: 'chat_interaction', features: ['chat_group'],
        byok_enabled: true, app_credit_billed: true, today: { platform: 0, user_byok: 1, unattributed: 0 }, month: { platform: 0, user_byok: 4, unattributed: 0 } }] }
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(usage), { status: 200 }))
    await expect(apiService.getLlmCapacityUsage()).resolves.toEqual(usage)
    const [url, config] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.test.invalid/llm/capacity-usage'); expect(config.cache).toBe('no-store'); expect(config.method).toBe('GET')
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ...usage, operations: [{ ...usage.operations[0], today: { platform: 0, user_byok: 9, unattributed: 0 } }] }), { status: 200 }))
    await expect(apiService.getLlmCapacityUsage()).rejects.toThrow('Invalid LLM capacity usage.')
})

const TESTED = { execution_id: '33333333-3333-4333-8333-333333333333', profile_id: PROFILE, revision_id: '44444444-4444-4444-8444-444444444444',
    payer_mode: 'platform', feature: 'chat_adventure', roles: ['primary', 'metadata', 'preflight'], target: 'draft', replayed: false, output: 'OKOKOK' }
it('tests the saved system draft version for one feature contract without a key', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(TESTED), { status: 200 }))
    await expect(apiService.testLlmProfile(PROFILE, { kind: 'draft', draftVersion: 6 }, 'chat_adventure', 'draft-intent', true)).resolves.toEqual(TESTED)
    const [url, config] = fetchMock.mock.calls[0]
    expect(url).toBe(`https://api.test.invalid/admin/llm/profiles/${PROFILE}/test`); expect(config.cache).toBe('no-store')
    expect(new Headers(config.headers).get('X-Request-Id')).toBe('draft-intent')
    expect(JSON.parse(config.body)).toEqual({ feature: 'chat_adventure', expected_draft_version: 6 })
})
it('never sends a draft test from a personal profile', async () => {
    await expect(apiService.testLlmProfile(PROFILE, { kind: 'draft', draftVersion: 2 }, 'novel', 'draft-intent', false)).rejects.toThrow('Only system drafts')
    expect(fetchMock).not.toHaveBeenCalled()
})
it.each([
    ['another contract', { feature: 'novel' }],
    ['another target', { target: 'published' }],
    ['a contract without its primary role', { roles: ['metadata'] }],
    ['an unknown role', { roles: ['primary', 'planner'] }],
    ['a malformed execution ID', { execution_id: 'execution-old' }],
    ['a malformed revision ID', { revision_id: 'revision-old' }],
    ['a different payer', { payer_mode: 'user_byok' }],
    ['an invalid replay marker', { replayed: 1 }],
    ['an empty reply', { output: '' }],
    ['an unknown response field', { old_result: 'OK' }],
])('rejects a profile test result for %s', async (_case, change) => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ...TESTED, ...change }), { status: 200 }))
    await expect(apiService.testLlmProfile(PROFILE, { kind: 'draft', draftVersion: 6 }, 'chat_adventure', 'draft-intent', true)).rejects.toThrow('Invalid profile test response.')
})

const COMPATIBILITY = { configuration_issue: null, features: [
    { feature: 'novel', roles: ['primary'], compatible: true, issue: null },
    { feature: 'chat_group', roles: ['primary', 'metadata', 'preflight'], compatible: false, issue: { code: 'PROFILE_INCOMPATIBLE', role: 'metadata' } }] }
const CONFIG = { provider_target_key: 'target', catalog_revision: 'catalog-v1', platform_connection_key: null,
    roles: { primary: { catalog_model_key: 'writer', endpoint: 'chat_completions' as const, settings: { max_input_tokens: 1000, max_output_tokens: 100, max_messages: 10, timeout_seconds: 30, truncation_strategy: 'tail' as const } } } }
it('checks an unsaved configuration on the scoped endpoint without caching', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(COMPATIBILITY), { status: 200 }))
    await expect(apiService.checkLlmProfileCompatibility(CONFIG, false)).resolves.toEqual(COMPATIBILITY)
    const [url, config] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.test.invalid/user/llm/profiles/compatibility'); expect(config.method).toBe('POST'); expect(config.cache).toBe('no-store')
    expect(JSON.parse(config.body)).toEqual(CONFIG)
})
it.each([
    ['an incompatible row without a reason', { features: [{ ...COMPATIBILITY.features[1], issue: null }] }],
    ['a compatible row with a reason', { features: [{ ...COMPATIBILITY.features[0], issue: { code: 'PROFILE_INCOMPATIBLE', role: null } }] }],
    ['an unknown feature', { features: [{ ...COMPATIBILITY.features[0], feature: 'telepathy' }] }],
    ['rows beside a configuration issue', { configuration_issue: { code: 'PROVIDER_MODEL_UNAVAILABLE', role: 'primary' } }],
    ['a private field', { features: [{ ...COMPATIBILITY.features[0], api_key: 'FAKE_KEY' }] }],
])('rejects a compatibility report with %s', async (_case, change) => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ...COMPATIBILITY, ...change }), { status: 200 }))
    await expect(apiService.checkLlmProfileCompatibility(CONFIG, true)).rejects.toThrow()
})

const PROVIDER_USAGE = { from_date: '2026-06-01', to_date: '2026-06-19', by_payer: Object.fromEntries(['platform', 'user_byok', 'unattributed'].map(payer => [payer,
    { requests: 1, prompt_tokens: 2, completion_tokens: 3, cached_tokens_read: 0, reasoning_tokens: 0, unknown_cost_calls: 1, provider_estimates: [] }])) }
it('reads root provider cost by payer for an exact range without caching', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(PROVIDER_USAGE), { status: 200 }))
    await expect(apiService.getLlmProviderUsage({ from: '2026-06-01', to: '2026-06-19' })).resolves.toEqual(PROVIDER_USAGE)
    const [url, config] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.test.invalid/admin/llm/provider-usage?from_date=2026-06-01&to_date=2026-06-19')
    expect(config.method).toBe('GET'); expect(config.cache).toBe('no-store')
})
it('rejects a provider usage range the server did not answer, and an invalid request range without a call', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(PROVIDER_USAGE), { status: 200 }))
    await expect(apiService.getLlmProviderUsage({ from: '2026-05-01', to: '2026-06-19' })).rejects.toThrow('Invalid LLM provider usage.')
    await expect(apiService.getLlmProviderUsage({ from: '2026-06-20', to: '2026-06-19' })).rejects.toThrow('Invalid provider usage range.')
    expect(fetchMock).toHaveBeenCalledTimes(1)
})
