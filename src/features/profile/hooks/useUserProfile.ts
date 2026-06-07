/**
 * Loads the current user's profile from `GET /user/me`.
 *
 * Kept local to the profile feature rather than folded into AuthProvider: the
 * `/user/me` shape (usage + card counts) differs from the auth `User` (email +
 * timestamps), and this data is only needed while the profile page is open.
 */
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/app/hooks'
import { apiService, ApiError } from '@/infrastructure'
import type { UserProfile } from '@/shared'

interface UseUserProfileResult {
    profile: UserProfile | null
    isLoading: boolean
    error: string | null
    /** True when the failure was a transient backend outage (5xx) worth retrying. */
    isTransientError: boolean
    refresh: () => void
}

export function useUserProfile(): UseUserProfileResult {
    const { isAuthenticated } = useAuth()
    const [profile, setProfile] = useState<UserProfile | null>(null)
    // Start in the loading state so the first fetch shows a spinner without
    // having to call setState synchronously inside the effect.
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isTransientError, setIsTransientError] = useState(false)
    // Bumping this re-runs the effect to refetch on demand.
    const [reloadKey, setReloadKey] = useState(0)

    // Invoked from event handlers (not an effect), so setting state here is safe.
    const refresh = useCallback(() => {
        setIsLoading(true)
        setError(null)
        setIsTransientError(false)
        setReloadKey((k) => k + 1)
    }, [])

    useEffect(() => {
        // Signed-out users never reach the profile route (the container renders
        // a login prompt), so there's nothing to fetch here.
        if (!isAuthenticated) return

        let cancelled = false

        apiService
            .getUserProfile()
            .then((data) => {
                if (cancelled) return
                setError(null)
                setIsTransientError(false)
                // An expired session resolves GET 401s to `{}` (and fires
                // `auth:expired`); ignore that shape rather than render a blank
                // profile — the auth layer will surface the login modal.
                setProfile(data && data.user_hash ? data : null)
            })
            .catch((err) => {
                if (cancelled) return
                // A transient backend outage (5xx) is shown gently with a retry,
                // not as an alarming error banner.
                setIsTransientError(err instanceof ApiError && err.isTransient)
                setError(err instanceof Error ? err.message : 'Failed to load your profile')
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [isAuthenticated, reloadKey])

    return { profile, isLoading, error, isTransientError, refresh }
}
