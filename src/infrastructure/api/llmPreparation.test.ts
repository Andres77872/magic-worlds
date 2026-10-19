import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })
async function preparation(base: string) {
    vi.stubEnv('VITE_API_BASE_URL', base)
    vi.resetModules()
    const { setAllTestFeatureFlags } = await import('@/shared/hooks/testing/featureFlagTestUtils')
    setAllTestFeatureFlags(true)
    return import('./llmPreparation')
}
it('rejects a transient key over HTTP even when the caller supplies a revision', async () => {
    const { prepareLlmRequest } = await preparation('http://api.test.invalid')
    await expect(prepareLlmRequest('novel', { selection: { mode: 'profile', profile_id: 'fixture' },
        expected_revision_id: 'fixture-revision', credentials: { api_key: 'FAKE_TRANSPORT_CANARY' } })).rejects.toThrow('LLM_CREDENTIAL_HTTPS_REQUIRED')
})
it('rejects keys returned by a configured preparation handler over HTTP', async () => {
    const { prepareLlmRequest, configureLlmPreparation } = await preparation('http://api.test.invalid')
    const unsubscribe = configureLlmPreparation(async () => () => ({ credentials: { api_key: 'FAKE_TRANSPORT_CANARY' } }))
    try { await expect(prepareLlmRequest('novel')).rejects.toThrow('LLM_CREDENTIAL_HTTPS_REQUIRED') }
    finally { unsubscribe() }
})
it('allows a transient key to the loopback API during local development', async () => {
    vi.stubEnv('DEV', true)
    const { prepareLlmRequest } = await preparation('http://localhost:8010')
    const input = { selection: { mode: 'profile' as const, profile_id: 'fixture' },
        expected_revision_id: 'fixture-revision', credentials: { api_key: 'FAKE_LOCAL_TRANSPORT_CANARY' } }
    await expect(prepareLlmRequest('chat_character', input)).resolves.toEqual(input)
})
it('rejects a transient key to the loopback API in production', async () => {
    vi.stubEnv('DEV', false)
    const { prepareLlmRequest } = await preparation('http://localhost:8010')
    await expect(prepareLlmRequest('chat_character', { credentials: { api_key: 'FAKE_LOCAL_TRANSPORT_CANARY' } }))
        .rejects.toMatchObject({ code: 'LLM_CREDENTIAL_HTTPS_REQUIRED' })
})
it('allows platform selection on HTTP and copies transient credentials only on HTTPS', async () => {
    let module = await preparation('http://api.test.invalid')
    expect(await module.prepareLlmRequest('novel', { selection: { mode: 'inherit' } })).toEqual({ selection: { mode: 'inherit' } })
    module = await preparation('https://api.test.invalid')
    const input = { selection: { mode: 'profile' as const, profile_id: 'fixture' }, expected_revision_id: 'fixture-revision', credentials: { api_key: 'FAKE_TRANSPORT_CANARY' } }
    const result = await module.prepareLlmRequest('novel', input)
    expect(result).toEqual(input); expect(result.credentials).not.toBe(input.credentials)
    delete result.credentials
    expect(input.credentials.api_key).toBe('FAKE_TRANSPORT_CANARY')
})

it('requires authenticated retained-profile preparation and ignores an old supplied key for a retry', async () => {
    const module = await preparation('https://api.test.invalid')
    const retry = { retry_of_execution_id: 'parent-execution', selection: { mode: 'profile' as const, profile_id: 'original' },
        expected_revision_id: 'original-revision', credentials: { api_key: 'OLD_KEY_CANARY' } }
    await expect(module.prepareLlmRequest('novel', retry)).rejects.toThrow('LLM_RETRY_PREPARATION_REQUIRED')
    const handler = vi.fn(async () => () => ({ selection: retry.selection, expected_revision_id: 'original-revision',
        credentials: { api_key: 'FRESH_KEY_CANARY' } }))
    const unsubscribe = module.configureLlmPreparation(handler)
    try {
        const result = await module.prepareLlmRequest('novel', retry)
        expect(handler).toHaveBeenCalledWith('novel', undefined, retry.selection, 'parent-execution')
        expect(result.credentials?.api_key).toBe('FRESH_KEY_CANARY')
        expect(result.retry_of_execution_id).toBe('parent-execution')
    } finally { unsubscribe() }
})
