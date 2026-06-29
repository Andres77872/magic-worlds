/**
 * Profile route container. Wires the `/user/me` data hook and auth, and renders
 * the appropriate shell (loading / error / signed-out) around {@link ProfileView}.
 */
import { useEffect, useRef } from 'react'
import { UserCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { apiService } from '@/infrastructure/api'
import { useAuth, useData, useNavigation } from '@/app/hooks'
import { Button, Icon } from '@/ui/primitives'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { LoadingSpinner } from '@/ui/components/LoadingSpinner'
import { isBillingFeatureEnabled } from '@/shared/billingFeatureFlag'
import { isCommunityCardsFeatureEnabled } from '@/shared/featureFlags'
import { useBillingCatalog } from '@/features/billing/hooks/useBillingCatalog'
import { useUserProfile } from '../hooks/useUserProfile'
import { useProfileSharedCards } from '../hooks/useProfileSharedCards'
import { ProfileView, type ProfileTab } from './ProfileView'

const PROFILE_TABS: readonly ProfileTab[] = ['membership', 'usage', 'sharing', 'account', 'security']

function hasEmailCreditGrantClaimIntent(): boolean {
    if (typeof window === 'undefined') return false
    const [, query = ''] = window.location.hash.split('?')
    return new URLSearchParams(query).get('claimEmailCredits') === '1'
}

/** Detect a Stripe Checkout/Portal return (`#/profile?billing=success|cancel|portal`). */
function billingReturnIntent(): 'success' | 'cancel' | 'portal' | null {
    if (typeof window === 'undefined') return null
    const [, query = ''] = window.location.hash.split('?')
    const value = new URLSearchParams(query).get('billing')
    return value === 'success' || value === 'cancel' || value === 'portal' ? value : null
}

/** The active section from `#/profile?tab=…`, or null for the default (Membership). */
function tabFromHash(hash: string): ProfileTab | null {
    const [, query = ''] = hash.split('?')
    const value = new URLSearchParams(query).get('tab')
    return PROFILE_TABS.includes(value as ProfileTab) ? (value as ProfileTab) : null
}

export function ProfilePage() {
    const { t } = useTranslation()
    const { isAuthenticated, logout, openLoginModal, updateUser } = useAuth()
    const { clearAllData } = useData()
    const { currentHash, setPage } = useNavigation()
    const { profile, isLoading, error, isTransientError, refresh } = useUserProfile()
    const sharing = useProfileSharedCards()
    const communityCardsEnabled = isCommunityCardsFeatureEnabled()
    // The active section is derived from the URL hash so it's deep-linkable and the
    // browser Back button steps through sections. Billing/claim returns carry no
    // `?tab=` and fall through to Membership, where their content lives.
    const requestedTab = tabFromHash(currentHash)
    const activeTab = requestedTab === 'sharing' && !communityCardsEnabled ? 'membership' : requestedTab ?? 'membership'
    const handleTabChange = (tab: ProfileTab) => {
        if (tab === 'sharing' && !communityCardsEnabled) return
        setPage('profile', { hash: `#/profile?tab=${tab}` })
    }
    // Drives whether the Stripe purchase entry ("Plans & credits") is offered;
    // false until the server confirms billing is enabled.
    const { enabled: billingEnabled } = useBillingCatalog()
    const autoClaimEmailCreditGrants = hasEmailCreditGrantClaimIntent()
    const billingIntent = billingReturnIntent()
    const billingReconciledRef = useRef(false)

    useEffect(() => {
        if (!isAuthenticated && autoClaimEmailCreditGrants) {
            openLoginModal()
        }
    }, [autoClaimEmailCreditGrants, isAuthenticated, openLoginModal])

    // Returning from a Stripe Checkout/Portal: reconcile server-side so the plan
    // upgrade and any purchased credits land, then re-fetch /user/me. Runs once,
    // best-effort (a transient reconcile failure shouldn't block the profile).
    useEffect(() => {
        if (!isBillingFeatureEnabled() || !isAuthenticated || billingReconciledRef.current) return
        if (billingIntent === 'success' || billingIntent === 'portal') {
            billingReconciledRef.current = true
            void apiService.reconcileBilling().catch(() => {}).finally(() => refresh())
        }
    }, [billingIntent, isAuthenticated, refresh])

    // Patch the auth context (updates the sidebar label + localStorage instantly),
    // then re-fetch /user/me so the hero reflects server truth.
    const handleDisplayNameUpdated = (displayName: string | null) => {
        updateUser({ display_name: displayName })
        refresh()
    }

    // Wipe all content server-side (and reset DataProvider caches), then re-fetch
    // /user/me so the profile's stat counts drop to zero. Rejection propagates so
    // the confirm dialog can surface the failure.
    const handleDeleteAllData = async () => {
        await clearAllData()
        refresh()
    }

    // Signed out — invite a login rather than fetching.
    if (!isAuthenticated) {
        return (
            <div className="mx-auto flex w-full max-w-[960px] px-5 py-10 sm:px-8">
                <EmptyState
                    icon={<Icon icon={UserCircle} size={44} />}
                    message={t('profilePage.signedOutTitle')}
                    secondaryText={t('profilePage.signedOutBody')}
                    button={{ label: t('sidebar.login'), onClick: openLoginModal }}
                />
            </div>
        )
    }

    if (isLoading && !profile) {
        return <LoadingSpinner message={t('profilePage.loading')} />
    }

    // A transient backend outage (5xx) is shown gently — a neutral empty state
    // with a retry — rather than an alarming red error banner.
    if (error && !profile && isTransientError) {
        return (
            <div className="mx-auto flex w-full max-w-[960px] px-5 py-10 sm:px-8">
                <EmptyState
                    icon={<Icon icon={UserCircle} size={44} />}
                    message={t('profilePage.transientTitle')}
                    secondaryText={t('profilePage.transientBody')}
                    button={{ label: t('common.tryAgain'), onClick: refresh }}
                />
            </div>
        )
    }

    if (error && !profile) {
        return (
            <div className="mx-auto flex w-full max-w-[960px] flex-col gap-4 px-5 py-10 sm:px-8">
                <div className="rounded-md border border-blood-500/30 bg-blood-500/10 px-4 py-3 text-[14px] text-blood-500">
                    {error}
                </div>
                <div>
                    <Button variant="secondary" size="sm" onClick={refresh}>
                        {t('common.tryAgain')}
                    </Button>
                </div>
            </div>
        )
    }

    if (!profile) {
        return null
    }

    return (
        <ProfileView
            profile={profile}
            sharing={sharing}
            onLogout={logout}
            onDeleteAllData={handleDeleteAllData}
            onDisplayNameUpdated={handleDisplayNameUpdated}
            onRedeemed={refresh}
            autoClaimEmailCreditGrants={autoClaimEmailCreditGrants}
            billingEnabled={billingEnabled}
            sharingEnabled={communityCardsEnabled}
            activeTab={activeTab}
            onTabChange={handleTabChange}
        />
    )
}
