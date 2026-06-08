import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiService } from '../index'

const fetchMock = vi.fn()

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
        localStorage.clear()
        localStorage.setItem('magic_worlds:token', 'test-token')
        vi.stubGlobal('fetch', fetchMock)
    })

    it('POSTs trimmed character description with auth, request id, idempotency key, and signal', async () => {
        const controller = new AbortController()
        fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'char-1', uuid: 'char-1', name: 'Nyra' }))

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
        expect(JSON.parse(String(init.body))).toEqual({ description: 'Create Nyra' })
    })

    it('uses sibling endpoints for world and adventure template generation', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse({ id: 'world-1', name: 'Glass' }))
            .mockResolvedValueOnce(jsonResponse({ id: 'tmpl-1', name: 'Gate' }))

        await apiService.createWorldAI('Create a world', { requestId: 'req-w', idempotencyKey: 'idem-w' })
        await apiService.createAdventureTemplateAI('Create an adventure', { requestId: 'req-a', idempotencyKey: 'idem-a' })

        expect(fetchMock.mock.calls[0][0]).toMatch(/\/worlds\/ai\/$/)
        expect(fetchMock.mock.calls[1][0]).toMatch(/\/adventure-templates\/ai\/$/)
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
