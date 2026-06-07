/**
 * Profile route container. Wires the `/user/me` data hook and auth, and renders
 * the appropriate shell (loading / error / signed-out) around {@link ProfileView}.
 */
import { UserCircle } from 'lucide-react'
import { useAuth } from '@/app/hooks'
import { Button, Icon } from '@/ui/primitives'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { LoadingSpinner } from '@/ui/components/LoadingSpinner'
import { useUserProfile } from '../hooks/useUserProfile'
import { ProfileView } from './ProfileView'

export function ProfilePage() {
    const { isAuthenticated, logout, openLoginModal } = useAuth()
    const { profile, isLoading, error, isTransientError, refresh } = useUserProfile()

    // Signed out — invite a login rather than fetching.
    if (!isAuthenticated) {
        return (
            <div className="mx-auto flex w-full max-w-[960px] px-5 py-10 sm:px-8">
                <EmptyState
                    icon={<Icon icon={UserCircle} size={44} />}
                    message="You're not signed in"
                    secondaryText="Log in to view your profile, role, and everything you've created."
                    button={{ label: 'Log in', onClick: openLoginModal }}
                />
            </div>
        )
    }

    if (isLoading && !profile) {
        return <LoadingSpinner message="Loading your profile…" />
    }

    // A transient backend outage (5xx) is shown gently — a neutral empty state
    // with a retry — rather than an alarming red error banner.
    if (error && !profile && isTransientError) {
        return (
            <div className="mx-auto flex w-full max-w-[960px] px-5 py-10 sm:px-8">
                <EmptyState
                    icon={<Icon icon={UserCircle} size={44} />}
                    message="Couldn't load your profile just now"
                    secondaryText="The service is briefly unavailable. Please try again in a moment."
                    button={{ label: 'Try again', onClick: refresh }}
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
                        Try again
                    </Button>
                </div>
            </div>
        )
    }

    if (!profile) {
        return null
    }

    return <ProfileView profile={profile} onLogout={logout} />
}
