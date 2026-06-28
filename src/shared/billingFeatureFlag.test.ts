import { afterEach, describe, expect, it, vi } from 'vitest'
import { isBillingFeatureEnabled } from './billingFeatureFlag'

afterEach(() => {
    vi.unstubAllEnvs()
})

describe('isBillingFeatureEnabled', () => {
    it('is true only for the exact string "true"', () => {
        vi.stubEnv('VITE_BILLING_ENABLED', 'true')
        expect(isBillingFeatureEnabled()).toBe(true)
    })

    it('is false when unset (default off)', () => {
        vi.stubEnv('VITE_BILLING_ENABLED', undefined as unknown as string)
        expect(isBillingFeatureEnabled()).toBe(false)
    })

    it('is false for any non-"true" value', () => {
        for (const value of ['false', '1', 'TRUE', 'yes', '']) {
            vi.stubEnv('VITE_BILLING_ENABLED', value)
            expect(isBillingFeatureEnabled()).toBe(false)
        }
    })
})
