/** Explicit authenticated permission fixtures; never used by production code. */
import { authSession } from '@/infrastructure/api/authSession'
import { ACTIVE_FEATURE_FLAGS, ACTIVE_FEATURE_KEYS, type ActiveFeatureFlag } from '@/shared/featureFlagCatalog'
import { featureFlagRuntime } from '@/shared/featureFlagRuntime'

export function setTestFeatureFlags(grants: Partial<Record<ActiveFeatureFlag, boolean | null>>, options: { root?: boolean; replace?: boolean } = {}) {
    let owner = authSession.getSnapshot()
    if (owner.sessionPhase !== 'authenticated' || !owner.userHash) owner = authSession.authenticate('usr-feature-fixture', 'feature-fixture-token')
    const previous = featureFlagRuntime.getSnapshot()
    const permissions = options.replace ? {} : previous.accountKey === owner.accountKey ? previous.snapshot?.permissions ?? {} : {}
    featureFlagRuntime.setOwner(owner.accountKey, owner.userHash, options.root ?? false)
    featureFlagRuntime.invalidate()
    const current = featureFlagRuntime.getSnapshot()
    featureFlagRuntime.accept({
        schema_version: 1, catalog_revision: '1', user_hash: owner.userHash!,
        plan_code: 'test-preview', membership_revision: '1', plan_feature_revision: '1',
        flags: ACTIVE_FEATURE_KEYS.map(key => ({ key, requires: [...ACTIVE_FEATURE_FLAGS[key].requires] })),
        permissions: Object.fromEntries(ACTIVE_FEATURE_KEYS.map(key => [key, (key in grants ? grants[key] : permissions[key]) === true])),
        valid_for_seconds: 900,
    }, owner.accountKey, current.generation)
}
export function setAllTestFeatureFlags(value: boolean) {
    setTestFeatureFlags(Object.fromEntries(ACTIVE_FEATURE_KEYS.map(key => [key, value])), { replace: true })
}

