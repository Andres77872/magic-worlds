import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authSession } from '@/infrastructure/api/authSession'
import { ACTIVE_FEATURE_FLAGS, ACTIVE_FEATURE_KEYS } from '@/shared/featureFlagCatalog'
import type { FeatureFlagSnapshot } from '@/shared/featureFlagRuntime'
import { useFeatureFlags } from '@/shared/hooks/useFeatureFlags'
import { isNovelsFeatureEnabled } from '@/shared/featureFlags'

const mocks = vi.hoisted(() => ({ auth: {} as Record<string, unknown>, snapshot: vi.fn(), events: vi.fn() }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => mocks.auth }))
vi.mock('@/infrastructure/api', () => ({ apiService: {
    getFeatureFlagSnapshot: mocks.snapshot, watchFeatureFlagInvalidations: mocks.events,
} }))
import { FeatureFlagProvider } from './FeatureFlagProvider'

function permission(granted: boolean, user = 'novel-member'): FeatureFlagSnapshot {
    return { schema_version: 1, catalog_revision: '1', user_hash: user, plan_code: 'preview',
        membership_revision: '1', plan_feature_revision: '1', valid_for_seconds: 900,
        flags: ACTIVE_FEATURE_KEYS.map(key => ({ key, requires: [...ACTIVE_FEATURE_FLAGS[key].requires] })),
        permissions: { novels: granted } }
}
function Probe() {
    useFeatureFlags()
    return <span>{isNovelsFeatureEnabled() ? 'Novel access' : 'Novel blocked'}</span>
}
function view() { return <FeatureFlagProvider><Probe /></FeatureFlagProvider> }
beforeEach(() => {
    const owner = authSession.authenticate('novel-member', 'novel-member-token')
    mocks.auth = { ...owner, user: { user_type: 'consumer' }, token: 'novel-member-token' }
    mocks.snapshot.mockReset().mockResolvedValue(permission(true))
    mocks.events.mockReset().mockImplementation(() => new Promise(() => {}))
})

describe('live novel plan permission', () => {
    it('loads grants and blocks immediately while an invalidation refresh is pending', async () => {
        render(view())
        expect(await screen.findByText('Novel access')).toBeInTheDocument()
        mocks.snapshot.mockResolvedValue(permission(false))
        act(() => window.dispatchEvent(new Event('feature-flags:invalidate')))
        expect(screen.getByText('Novel blocked')).toBeInTheDocument()
        await waitFor(() => expect(mocks.snapshot).toHaveBeenCalledTimes(2))
        expect(screen.getByText('Novel blocked')).toBeInTheDocument()
    })

    it('bypasses permission fetches and event subscriptions for root', () => {
        mocks.auth = { ...mocks.auth, user: { user_type: 'root' } }
        render(view())
        expect(screen.getByText('Novel access')).toBeInTheDocument()
        expect(mocks.snapshot).not.toHaveBeenCalled()
        expect(mocks.events).not.toHaveBeenCalled()
    })

    it('ignores an old account response after switching accounts', async () => {
        let finish: ((value: FeatureFlagSnapshot) => void) | undefined
        mocks.snapshot.mockImplementationOnce(() => new Promise<FeatureFlagSnapshot>(resolve => { finish = resolve }))
        const rendered = render(view())
        const owner = authSession.authenticate('another-member', 'another-token')
        mocks.auth = { ...owner, user: { user_type: 'consumer' }, token: 'another-token' }
        mocks.snapshot.mockResolvedValue(permission(false, 'another-member'))
        rendered.rerender(view())
        await act(async () => finish?.(permission(true)))
        expect(screen.getByText('Novel blocked')).toBeInTheDocument()
    })
})
