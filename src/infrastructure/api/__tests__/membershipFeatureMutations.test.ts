import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiService } from '../index'
import { authSession } from '../authSession'

const fetchMock = vi.fn()
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
})

beforeEach(() => {
    vi.useFakeTimers()
    authSession.authenticate('new-root-test', 'new-root-token')
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('committed membership feature mutations', () => {
    it('polls publication and reads the saved plan without repeating the write', async () => {
        fetchMock
            .mockResolvedValueOnce(response({ detail: { code: 'FEATURE_FLAG_UPDATING', committed: true, mutation_id: 'new-test-mutation' } }, 503))
            .mockResolvedValueOnce(response({ status: 'pending', entity_kind: 'plan', entity_key: 'new-test-plan' }))
            .mockResolvedValueOnce(response({ status: 'published', entity_kind: 'plan', entity_key: 'new-test-plan' }))
            .mockResolvedValueOnce(response({ plan_code: 'new-test-plan', feature_flags: { novels: true } }))
        const saved = apiService.updateMembershipPlan('new-test-plan', { feature_flags: { novels: true }, expected_version: '1', catalog_revision: '1', mutation_id: 'new-test-mutation' })
        await vi.advanceTimersByTimeAsync(500)
        expect(await saved).toMatchObject({ plan_code: 'new-test-plan', feature_flags: { novels: true } })
        expect(fetchMock.mock.calls.map(([, init]) => init.method)).toEqual(['PATCH', 'GET', 'GET', 'GET'])
        expect(fetchMock.mock.calls[1][0]).toContain('/admin/billing/feature-mutations/new-test-mutation')
    })

    it('does not poll an uncertain mutation after the account changes', async () => {
        fetchMock.mockResolvedValueOnce(response({ detail: { code: 'FEATURE_FLAG_UPDATING', committed: true, mutation_id: 'new-test-mutation' } }, 503))
        const saved = apiService.updateMembershipPlan('new-test-plan', { feature_flags: null, expected_version: '1', catalog_revision: '1' })
        const rejected = expect(saved).rejects.toMatchObject({ code: 'auth_epoch_changed' })
        await vi.advanceTimersByTimeAsync(0)
        authSession.authenticate('another-new-user', 'another-token')
        await vi.advanceTimersByTimeAsync(250)
        await rejected
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })
})
