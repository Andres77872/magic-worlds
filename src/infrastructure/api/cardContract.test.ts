import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { verifyCardGeneration } from './cardContract'
import { apiService } from './index'
import { authSession } from './authSession'

vi.mock('./baseUrl', () => ({ API_BASE_URL: 'https://api.test.invalid' }))

const id = '11111111-1111-4111-8111-111111111111'
const result = () => ({ id, name: 'Moonlit realm', description: 'A quiet forest.', request_id: 'card-1',
    llm_execution: { execution_id: id, profile_id: '22222222-2222-4222-8222-222222222222',
        revision_id: '33333333-3333-4333-8333-333333333333', resolution_source: 'system_default',
        credential_mode: 'platform', replayed: false } })
const fetchMock = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockReset()
    authSession.authenticate('card-owner', 'FAKE_SESSION')
    vi.stubGlobal('fetch', fetchMock)

})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('card profile contract', () => {
    it('accepts a saved card with its matching frozen execution', () => {
        expect(verifyCardGeneration(result(), 'card-1')).toBe(true)
    })

    it.each(['missing_plan', 'private_field', 'unknown_payer', 'different_execution', 'different_request', 'non_uuid', 'pending'])('rejects %s', (invalid) => {
        const body: Record<string, unknown> = result()
        if (invalid === 'missing_plan') delete body.llm_execution
        else if (invalid === 'private_field') body.llm_execution = { ...result().llm_execution, api_key: 'FAKE_CANARY' }
        else if (invalid === 'unknown_payer') body.llm_execution = { ...result().llm_execution, credential_mode: 'old' }
        else if (invalid === 'different_execution') body.llm_execution = { ...result().llm_execution, execution_id: '44444444-4444-4444-8444-444444444444' }
        else if (invalid === 'different_request') body.request_id = 'card-other'
        else if (invalid === 'non_uuid') body.id = 'old-id'
        else body.status = 'pending'
        expect(verifyCardGeneration(body, 'card-1')).toBe(false)
    })

    it.each(['character', 'world', 'item', 'adventure'] as const)('%s sends an explicit inherit selection and retains both retry IDs', async (kind) => {
        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(result()), { headers: { 'Content-Type': 'application/json' } }))
        const methods = { character: apiService.createCharacterAI.bind(apiService), world: apiService.createWorldAI.bind(apiService),
            item: apiService.createItemAI.bind(apiService), adventure: apiService.createAdventureTemplateAI.bind(apiService) }
        await methods[kind]('  A quiet forest.  ', { requestId: 'card-1', idempotencyKey: 'idem-card-1' })
        const request = fetchMock.mock.calls[0][1]
        expect(JSON.parse(request.body)).toEqual({ description: 'A quiet forest.', llm: { selection: { mode: 'inherit' } } })
        expect(request.headers).toMatchObject({ 'X-Request-Id': 'card-1', 'Idempotency-Key': 'idem-card-1' })
    })

    it('sends BYOK only in the transient block and never stores the key', async () => {
        const body = result()
        body.llm_execution.credential_mode = 'user_byok'
        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } }))
        const llm = { selection: { mode: 'profile' as const, profile_id: body.llm_execution.profile_id },
            expected_revision_id: body.llm_execution.revision_id, credentials: { api_key: 'FAKE_TRANSIENT_CANARY' } }
        await apiService.createWorldAI('A quiet forest.', { requestId: 'card-1', llm })
        expect(JSON.parse(fetchMock.mock.calls[0][1].body).llm).toEqual(llm)
        expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('X-Provider-Key')
        expect(JSON.stringify(localStorage)).not.toContain('FAKE_TRANSIENT_CANARY')
        expect(llm.credentials.api_key).toBe('FAKE_TRANSIENT_CANARY')
    })

    it('rejects a response from the previous server without another generation', async () => {
        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id, name: 'Old result' }), { headers: { 'Content-Type': 'application/json' } }))
        await expect(apiService.createWorldAI('A quiet forest.', { requestId: 'card-1' })).rejects.toMatchObject({ code: 'card_execution_contract' })
        expect(fetchMock).toHaveBeenCalledOnce()
    })
})
