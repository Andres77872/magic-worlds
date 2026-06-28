import { afterEach, describe, expect, it, vi } from 'vitest'
import { isPatreonFeatureEnabled } from './patreonFeatureFlag'

afterEach(() => {
    vi.unstubAllEnvs()
})

describe('isPatreonFeatureEnabled', () => {
    it('is true only for the exact string "true"', () => {
        vi.stubEnv('VITE_PATREON_ENABLED', 'true')
        expect(isPatreonFeatureEnabled()).toBe(true)
    })

    it('is false when unset (default off)', () => {
        vi.stubEnv('VITE_PATREON_ENABLED', undefined as unknown as string)
        expect(isPatreonFeatureEnabled()).toBe(false)
    })

    it('is false for any non-"true" value', () => {
        for (const value of ['false', '1', 'TRUE', 'yes', '']) {
            vi.stubEnv('VITE_PATREON_ENABLED', value)
            expect(isPatreonFeatureEnabled()).toBe(false)
        }
    })
})
