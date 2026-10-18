import { beforeEach, describe, expect, it } from 'vitest'
import { ACTIVE_FEATURE_KEYS, type ActiveFeatureFlag } from './featureFlagCatalog'
import { featureFlagRuntime } from './featureFlagRuntime'
import { authSession } from '@/infrastructure/api/authSession'
import { setAllTestFeatureFlags, setTestFeatureFlags } from './hooks/testing/featureFlagTestUtils'
import { isFeatureEnabled, isCallsFeatureEnabled, isLorebookResourcesFeatureEnabled, isPageFeatureEnabled, isLlmFeatureEnabled, isContentTypeFeatureEnabled } from './featureFlags'

beforeEach(() => setAllTestFeatureFlags(false))

describe('temporary membership permissions', () => {
    it('defaults omitted, null and false grants off', () => {
        setTestFeatureFlags({ voices: null, calls: false })
        expect(isFeatureEnabled('voices')).toBe(false)
        expect(isFeatureEnabled('adventures')).toBe(false)
        expect(isCallsFeatureEnabled()).toBe(false)
    })
    it('requires parents across all combinations of nine active grants', () => {
        for (let bits = 0; bits < 512; bits++) {
            const raw = Object.fromEntries(ACTIVE_FEATURE_KEYS.map((key, index) => [key, Boolean(bits & (1 << index))]))
            setTestFeatureFlags(raw, { replace: true })
            expect(isCallsFeatureEnabled()).toBe(raw.calls && raw.voices)
            expect(isLorebookResourcesFeatureEnabled()).toBe(raw.lorebookResources && raw.lorebooks)
            expect(isLlmFeatureEnabled('chat_group')).toBe(raw.groupChats)
            expect(isContentTypeFeatureEnabled('adventure_template')).toBe(raw.adventures)
        }
    })
    it('invalidates previous grants immediately and ignores delayed responses', () => {
        setTestFeatureFlags({ voices: true })
        const old = featureFlagRuntime.getSnapshot()
        featureFlagRuntime.invalidate()
        expect(isFeatureEnabled('voices')).toBe(false)
        expect(featureFlagRuntime.accept(old.snapshot!, old.accountKey!, old.generation)).toBe(false)
    })
    it('does not transfer grants to a different account', () => {
        setTestFeatureFlags({ voices: true })
        authSession.authenticate('usr-next-account', 'next-account-token')
        expect(isFeatureEnabled('voices')).toBe(false)
    })
    it('bypasses all temporary restrictions for root without a permission snapshot', () => {
        const owner = authSession.getSnapshot()
        featureFlagRuntime.setOwner(owner.accountKey, owner.userHash, true)
        expect(featureFlagRuntime.getSnapshot().snapshot).toBeNull()
        for (const key of ACTIVE_FEATURE_KEYS) expect(isFeatureEnabled(key)).toBe(true)
        expect(isFeatureEnabled('notRegistered' as ActiveFeatureFlag)).toBe(false)
    })
    it('keeps workspaces and ordinary character chat independent of the permission runtime', () => {
        featureFlagRuntime.setOwner(null, null)
        expect(ACTIVE_FEATURE_KEYS).not.toContain('workspaces')
        expect(isPageFeatureEnabled('library')).toBe(true)
        expect(isPageFeatureEnabled('character-chat')).toBe(true)
        expect(isLlmFeatureEnabled('moderation')).toBe(true)
    })
})
