/**
 * Profile route container. Wires the `/user/me` data hook and auth, and renders
 * the appropriate shell (loading / error / signed-out) around {@link ProfileView}.
 */
import { UserCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth, useData } from '@/app/hooks'
import { Button, Icon } from '@/ui/primitives'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { LoadingSpinner } from '@/ui/components/LoadingSpinner'
import { useUserProfile } from '../hooks/useUserProfile'
import { useProfileSharedCards } from '../hooks/useProfileSharedCards'
import { ProfileView } from './ProfileView'

export function ProfilePage() {
    const { t } = useTranslation()
    const { isAuthenticated, logout, openLoginModal } = useAuth()
    const { clearAllData } = useData()
    const { profile, isLoading, error, isTransientError, refresh } = useUserProfile()
    const sharing = useProfileSharedCards()

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
                    <Button kind="secondary" size="sm" onClick={refresh}>
                        {t('common.tryAgain')}
                    </Button>
                </div>
            </div>
        )
    }

    if (!profile) {
        return null
    }

    return <ProfileView profile={profile} sharing={sharing} onLogout={logout} onDeleteAllData={handleDeleteAllData} />
}
