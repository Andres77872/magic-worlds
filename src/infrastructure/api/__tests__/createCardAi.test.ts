import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiService } from '../index'

const fetchMock = vi.fn()
function generatedCard(requestId: string, name = 'Nyra') {
    const id = '11111111-1111-4111-8111-111111111111'
    return { id, name, description: 'A quiet forest.', request_id: requestId,
        llm_execution: { execution_id: id, profile_id: '22222222-2222-4222-8222-222222222222',
            revision_id: '33333333-3333-4333-8333-333333333333', resolution_source: 'system_default',
            credential_mode: 'platform', replayed: false } }
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
    return new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
    })
}

describe('AI card API methods', () => {
    beforeEach(() => {
        vi.useRealTimers()
        vi.clearAllMocks()
        fetchMock.mockReset()
        localStorage.clear()
        localStorage.setItem('magic_worlds:token', 'test-token')
        vi.stubGlobal('fetch', fetchMock)
    })

    it('POSTs trimmed character description with auth, request id, idempotency key, and signal', async () => {
        const controller = new AbortController()
        fetchMock.mockResolvedValueOnce(jsonResponse(generatedCard('req-1')))

        await apiService.createCharacterAI('  Create Nyra  ', {
            signal: controller.signal,
            requestId: 'req-1',
            idempotencyKey: 'idem-1',
        })

        expect(fetchMock).toHaveBeenCalledTimes(1)
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
        expect(url).toMatch(/\/characters\/ai\/$/)
        expect(init.method).toBe('POST')
        expect(init.signal).toBe(controller.signal)
        expect(init.headers).toMatchObject({
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
            'X-Request-Id': 'req-1',
            'Idempotency-Key': 'idem-1',
        })
        expect(JSON.parse(String(init.body))).toEqual({ description: 'Create Nyra', llm: { selection: { mode: 'inherit' } } })
    })

    it('uses sibling endpoints for world, item, and adventure template generation', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(generatedCard('req-w', 'Glass')))
            .mockResolvedValueOnce(jsonResponse(generatedCard('req-i', 'Moonlit Compass')))
            .mockResolvedValueOnce(jsonResponse(generatedCard('req-a', 'Gate')))

        await apiService.createWorldAI('Create a world', { requestId: 'req-w', idempotencyKey: 'idem-w' })
        await apiService.createItemAI('Create an item', { requestId: 'req-i', idempotencyKey: 'idem-i' })
        await apiService.createAdventureTemplateAI('Create an adventure', { requestId: 'req-a', idempotencyKey: 'idem-a' })

        expect(fetchMock.mock.calls[0][0]).toMatch(/\/worlds\/ai\/$/)
        expect(fetchMock.mock.calls[1][0]).toMatch(/\/items\/ai\/$/)
        expect(fetchMock.mock.calls[2][0]).toMatch(/\/adventure-templates\/ai\/$/)
    })

    it('parses structured AI-card errors into ApiError metadata', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({
            detail: 'Daily AI generation limit reached.',
            request_id: 'req-quota',
            error: {
                category: 'quota_exceeded',
                code: 'ai_card_quota_exceeded',
                message: 'Daily AI generation limit reached.',
                request_id: 'req-quota',
                retryable: false,
                retry_after_seconds: 3600,
                action: 'try_again_tomorrow',
            },
        }, { status: 429, headers: { 'X-Request-Id': 'req-quota', 'Retry-After': '3600' } }))

        await expect(apiService.createCharacterAI('Generate safely', { requestId: 'req-quota', idempotencyKey: 'idem-quota' }))
            .rejects.toMatchObject({
                status: 429,
                message: 'Daily AI generation limit reached.',
                category: 'quota_exceeded',
                code: 'ai_card_quota_exceeded',
                requestId: 'req-quota',
                retryable: false,
                retryAfterSeconds: 3600,
                action: 'try_again_tomorrow',
            })
    })

    it('rejects unexpected 202/job contracts instead of starting polling', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ job_id: 'job-1', status_url: '/cards/ai/jobs/job-1' }, { status: 202, headers: { 'X-Request-Id': 'req-202' } }))

        await expect(apiService.createCharacterAI('Generate safely', { requestId: 'req-202', idempotencyKey: 'idem-202' }))
            .rejects.toMatchObject({
                status: 502,
                category: 'configuration_unavailable',
                code: 'ai_card_unexpected_async_contract',
            })
    })

    it('turns client-side timeout into retryable ApiError without live backend', async () => {
        vi.useFakeTimers()
        fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        }))

        const promise = apiService.createCharacterAI('Generate safely', {
            requestId: 'req-timeout',
            idempotencyKey: 'idem-timeout',
            timeoutMs: 10,
        })
        const caughtPromise = promise.catch((error) => error)
        await vi.advanceTimersByTimeAsync(11)

        const caught = await caughtPromise

        expect(caught).toBeInstanceOf(ApiError)
        expect(caught).toMatchObject({
            status: 0,
            category: 'timeout',
            code: 'ai_card_client_timeout',
            retryable: true,
        })
    })
})

it('exposes a secret-free retry command only after an owned terminal status is read', async () => {
    localStorage.setItem('magic_worlds:token', 'test-token')
    const parent = '44444444-4444-4444-8444-444444444444'
    const llm = { selection: { mode: 'profile' as const, profile_id: '22222222-2222-4222-8222-222222222222' },
        expected_revision_id: '33333333-3333-4333-8333-333333333333' }
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'Execution failed.', error: { code: 'LLM_EXECUTION_UPSTREAM_FAILED', message: 'Execution failed.' } }, { status: 502 }))
        .mockResolvedValueOnce(jsonResponse({ status: 'failed', request_id: 'terminal-card', execution_id: parent, recovery_required: true }))
    const error = await apiService.createCharacterAI('A quiet moon scout', { requestId: 'terminal-card', idempotencyKey: 'terminal-idem', llm }).catch(error => error)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.llmRetry).toEqual({ ...llm, retry_of_execution_id: parent })
    expect(Object.keys(error.llmRetry).sort()).toEqual(['expected_revision_id', 'retry_of_execution_id', 'selection'])
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/characters\/ai\/result$/)
})

it('keeps an uncertain execution on its original request rather than suggesting a new attempt', async () => {
    localStorage.setItem('magic_worlds:token', 'test-token')
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'Lost upstream response.' }, { status: 502 }))
        .mockResolvedValueOnce(jsonResponse({ status: 'running', request_id: 'uncertain-card', execution_id: '44444444-4444-4444-8444-444444444444', recovery_required: true }))
    const error = await apiService.createCharacterAI('A quiet moon scout', { requestId: 'uncertain-card', idempotencyKey: 'uncertain-idem' }).catch(error => error)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.llmRetry).toBeUndefined()
})
