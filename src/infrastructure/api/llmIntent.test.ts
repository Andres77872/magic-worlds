import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LlmRequest } from '@/shared/types/llm.types'
import { storyStreamFetch } from '@/test-utils/storyStreamFetch'

const FAKE_KEY = 'FAKE_INTENT_KEY_CANARY'
const fetchMock = vi.fn()
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
const selection = { mode: 'profile' as const, profile_id: 'profile-1' }

function storyResult(requestId: string) {
    return { generation: { id: 'execution-1', chapterId: 'chapter-1',sceneId:'scene-1',requestId, output: 'Saved text' },
        scene: { id: 'scene-1' }, stagedCardUpdates: [],
        llm_execution: { execution_id: 'execution-1', profile_id: 'profile-1', revision_id: 'revision-1',
            resolution_source: 'user_feature', credential_mode: 'user_byok', replayed: true } }
}

async function load() {
    vi.resetModules()
    const [{ apiService }, { authSession }, { configureLlmPreparation }, intent] = await Promise.all([
        import('./index'), import('./authSession'), import('./llmPreparation'), import('./llmIntent')])
    authSession.authenticate('intent-test-user', 'test-token')
    const { setAllTestFeatureFlags } = await import('@/shared/hooks/testing/featureFlagTestUtils')
    setAllTestFeatureFlags(true)
    const prepared = vi.fn<(feature: string, signal?: AbortSignal, chosen?: unknown) => LlmRequest>()
    configureLlmPreparation(async (feature, signal, chosen) => () => prepared(feature, signal, chosen))
    const sent = () => fetchMock.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)).llm)
    const generate = (requestId: string) => apiService.generateStory('story-1', { sceneId: 'scene-1', baseRevision:1, command: 'continue' }, { requestId })
    return { authSession, prepared, sent, generate, ...intent }
}

beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', storyStreamFetch(fetchMock))
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.test.invalid')
    setTestFeatureFlags({ novels: true })

})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('LLM request intents', () => {
    it('retries an unfinished request with its frozen target and no key, then releases it', async () => {
        const { prepared, sent, generate } = await load()
        prepared.mockReturnValue({ selection, expected_revision_id: 'revision-1', credentials: { api_key: FAKE_KEY } })
        fetchMock.mockResolvedValueOnce(json({ detail: { code: 'LLM_EXECUTION_IN_PROGRESS' } }, 409))
            .mockResolvedValueOnce(json(storyResult('request-1')))
            .mockResolvedValueOnce(json(storyResult('request-1')))
        await expect(generate('request-1')).rejects.toMatchObject({ code: 'LLM_EXECUTION_IN_PROGRESS' })
        await expect(generate('request-1')).resolves.toMatchObject({ generation: { requestId: 'request-1' } })
        // The retry reached the same plan without resolving a new profile or sending the key.
        expect(prepared).toHaveBeenCalledOnce()
        expect(sent()).toEqual([
            { selection, expected_revision_id: 'revision-1', credentials: { api_key: FAKE_KEY } },
            { selection, expected_revision_id: 'revision-1' },
        ])
        await generate('request-1')
        expect(prepared).toHaveBeenCalledTimes(2)
    })

    it('asks for a key only when the server needs one, and only for the frozen revision', async () => {
        const { prepared, sent, generate } = await load()
        prepared.mockReturnValueOnce({ selection, expected_revision_id: 'revision-1', credentials: { api_key: FAKE_KEY } })
            .mockReturnValueOnce({ selection, expected_revision_id: 'revision-1', credentials: { api_key: FAKE_KEY } })
        fetchMock.mockResolvedValueOnce(json({ detail: { code: 'LLM_EXECUTION_RECOVERY_REQUIRED' } }, 409))
            .mockResolvedValueOnce(json({ detail: { code: 'BYOK_CREDENTIAL_REQUIRED' } }, 409))
            .mockResolvedValueOnce(json(storyResult('request-2')))
        await expect(generate('request-2')).rejects.toMatchObject({ code: 'LLM_EXECUTION_RECOVERY_REQUIRED' })
        await expect(generate('request-2')).resolves.toMatchObject({ generation: { requestId: 'request-2' } })
        expect(prepared).toHaveBeenLastCalledWith('novel', undefined, selection)
        expect(sent().slice(1)).toEqual([
            { selection, expected_revision_id: 'revision-1' },
            { selection, expected_revision_id: 'revision-1', credentials: { api_key: FAKE_KEY } },
        ])
    })

    it('never sends a key to a revision that changed after the request started', async () => {
        const { prepared, sent, generate } = await load()
        prepared.mockReturnValueOnce({ selection, expected_revision_id: 'revision-1' })
            .mockReturnValueOnce({ selection, expected_revision_id: 'revision-2', credentials: { api_key: FAKE_KEY } })
            .mockReturnValueOnce({ selection, expected_revision_id: 'revision-2' })
        fetchMock.mockResolvedValueOnce(json({ detail: { code: 'BYOK_CREDENTIAL_REQUIRED' } }, 409))
            .mockResolvedValueOnce(json(storyResult('request-3')))
        await expect(generate('request-3')).rejects.toMatchObject({ code: 'LLM_EXECUTION_INTENT_CHANGED' })
        expect(fetchMock).toHaveBeenCalledOnce()
        expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(FAKE_KEY)
        // The changed intent spent the frozen target: the next try resolves afresh.
        await generate('request-3')
        expect(sent()[1]).toEqual({ selection, expected_revision_id: 'revision-2' })
    })

    it.each(['LLM_EXECUTION_FINISHED', 'LLM_EXECUTION_UPSTREAM_FAILED', 'PROFILE_REVISION_CHANGED'])('releases the target when %s spends the request', async (code) => {
        const { prepared, generate, isLlmRequestSpent } = await load()
        prepared.mockReturnValue({ selection, expected_revision_id: 'revision-1' })
        fetchMock.mockResolvedValueOnce(json({ detail: { code } }, 409)).mockResolvedValueOnce(json(storyResult('request-4')))
        await expect(generate('request-4')).rejects.toSatisfy(isLlmRequestSpent)
        await generate('request-4')
        expect(prepared).toHaveBeenCalledTimes(2)
    })

    it('keeps targets per account, copies them without keys and forgets them on logout', async () => {
        const { authSession, llmIntents } = await load()
        const frozen = { selection, expected_revision_id: 'revision-1', credentials: { api_key: FAKE_KEY } }
        llmIntents.retain('novel', 'request-5', frozen)
        const retained = llmIntents.retained('novel', 'request-5')
        expect(retained).toEqual({ selection, expected_revision_id: 'revision-1' })
        expect(retained!.selection).not.toBe(frozen.selection)
        expect(llmIntents.retained('card_generation', 'request-5')).toBeNull()
        expect(llmIntents.matches(retained!, { selection, expected_revision_id: 'revision-1' })).toBe(true)
        expect(llmIntents.matches(retained!, { selection: { mode: 'profile', profile_id: 'other' }, expected_revision_id: 'revision-1' })).toBe(false)
        // An expired token keeps the owner, so reauthenticating can still recover.
        authSession.expire()
        authSession.authenticate('intent-test-user', 'test-token'); grantFixtureFeatures(true)
        expect(llmIntents.retained('novel', 'request-5')).toEqual(retained)
        authSession.beginLogout()
        authSession.authenticate('intent-test-user', 'test-token'); grantFixtureFeatures(true)
        expect(llmIntents.retained('novel', 'request-5')).toBeNull()
    })
})
