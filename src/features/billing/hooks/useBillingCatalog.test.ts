import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import { useBillingCatalog } from './useBillingCatalog'

const apiMocks = vi.hoisted(() => ({ getBillingPlans: vi.fn() }))

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: true }),
}))

vi.mock('@/infrastructure/api', async (importOriginal) => ({
    ...await importOriginal<typeof import('@/infrastructure/api')>(),
    apiService: {
        getBillingPlans: (...args: unknown[]) => apiMocks.getBillingPlans(...args),
    },
}))

beforeEach(() => {
    apiMocks.getBillingPlans.mockReset()
    apiMocks.getBillingPlans.mockResolvedValue({ enabled: true, plans: [], credit_packs: [] })
})

afterEach(() => {
    vi.unstubAllEnvs()
})

describe('useBillingCatalog', () => {
    it('uses the server catalog without a frontend environment switch', async () => {
        const { result } = renderHook(() => useBillingCatalog())

        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.enabled).toBe(true)
        expect(apiMocks.getBillingPlans).toHaveBeenCalledOnce()
    })

    it('fetches and reports the server enabled flag when the frontend flag is on', async () => {

        const { result } = renderHook(() => useBillingCatalog())

        await waitFor(() => expect(result.current.enabled).toBe(true))
        expect(apiMocks.getBillingPlans).toHaveBeenCalledTimes(1)
    })

    it('stays disabled when the server answers 503 because billing is off', async () => {

        apiMocks.getBillingPlans.mockRejectedValueOnce(new ApiError(503, 'Billing is not available.'))

        const { result } = renderHook(() => useBillingCatalog())

        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(apiMocks.getBillingPlans).toHaveBeenCalledTimes(1)
        expect(result.current.enabled).toBe(false)
        expect(result.current.catalog).toBeNull()
        expect(result.current.error).toBe('Billing is not available.')
    })
})
