import { describe, expect, it } from 'vitest'
import { ACTIVE_FEATURE_FLAGS, ACTIVE_FEATURE_KEYS } from '@/shared/featureFlagCatalog'
import { parseFeatureFlagSnapshot } from '../featureFlagContract'

function snapshot() {
    return { schema_version: 1, catalog_revision: '1', user_hash: 'member', plan_code: 'custom',
        membership_revision: '1', plan_feature_revision: '1', valid_for_seconds: 900,
        flags: ACTIVE_FEATURE_KEYS.map(key => ({ key, requires: [...ACTIVE_FEATURE_FLAGS[key].requires] })),
        permissions: {} as Record<string, unknown> }
}
describe('membership feature snapshot protocol', () => {
    it('treats omitted and null novel grants as off and accepts explicit true', () => {
        const value = snapshot()
        expect(parseFeatureFlagSnapshot(value).permissions.novels).toBe(false)
        value.permissions.novels = null
        expect(parseFeatureFlagSnapshot(value).permissions.novels).toBe(false)
        value.permissions.novels = true
        expect(parseFeatureFlagSnapshot(value).permissions.novels).toBe(true)
    })
    it.each(['true', 1, {}, []])('rejects a non-boolean novel grant: %j', grant => {
        const value = snapshot()
        value.permissions.novels = grant
        expect(() => parseFeatureFlagSnapshot(value)).toThrow()
    })
    it('rejects a removed flag in an older frontend and TTLs over fifteen minutes', () => {
        const value = snapshot()
        value.flags = value.flags.filter(flag => flag.key !== 'novels')
        expect(() => parseFeatureFlagSnapshot(value)).toThrow()
        expect(() => parseFeatureFlagSnapshot({ ...snapshot(), valid_for_seconds: 901 })).toThrow()
    })
})
