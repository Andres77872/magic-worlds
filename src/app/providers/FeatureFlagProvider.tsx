/** Supplies active rollout state without blocking the application subtree. */
import { useEffect, useLayoutEffect, type ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { apiService } from '@/infrastructure/api'
import { featureFlagRuntime } from '@/shared/featureFlagRuntime'
import { ACTIVE_FEATURE_KEYS } from '@/shared/featureFlagCatalog'
import { useFeatureFlags } from '@/shared/hooks/useFeatureFlags'

export function FeatureFlagProvider({ children }: { children: ReactNode }) {
    const { accountKey, userHash, sessionPhase, user, token } = useAuth()
    const root = user?.user_type === 'root'
    const signedIn = sessionPhase === 'authenticated' && !!userHash
    const state = useFeatureFlags()

    useLayoutEffect(() => {
        featureFlagRuntime.setOwner(signedIn ? accountKey : null, signedIn ? userHash : null, signedIn && root)
    }, [accountKey, root, signedIn, userHash])

    useEffect(() => {
        if (!signedIn || root || ACTIVE_FEATURE_KEYS.length === 0) return
        let live = true
        let refreshTimer: ReturnType<typeof setTimeout> | undefined
        let reconnectTimer: ReturnType<typeof setTimeout> | undefined
        let backoff = 1000
        const controller = new AbortController()
        const refresh = () => {
            const generation = featureFlagRuntime.getSnapshot().generation
            void apiService.getFeatureFlagSnapshot().then(snapshot => {
                if (live) featureFlagRuntime.accept(snapshot, accountKey, generation)
            }).catch((error: unknown) => {
                if (!live) return
                const mismatch = error instanceof Error && ('code' in error && error.code === 'FEATURE_FLAG_CATALOG_MISMATCH')
                featureFlagRuntime.fail(accountKey, generation, mismatch)
            })
        }
        const invalidate = () => {
            featureFlagRuntime.invalidate()
            clearTimeout(refreshTimer)
            refreshTimer = setTimeout(refresh, 50)
        }
        const connect = () => {
            if (!live) return
            void apiService.watchFeatureFlagInvalidations(invalidate, controller.signal).then(() => {
                if (!live) return
                invalidate()
                reconnectTimer = setTimeout(connect, backoff)
                backoff = Math.min(backoff * 2, 30_000)
            }).catch(() => {
                if (!live) return
                invalidate()
                reconnectTimer = setTimeout(connect, backoff)
                backoff = Math.min(backoff * 2, 30_000)
            })
        }
        const focus = () => { if (document.visibilityState !== 'hidden') invalidate() }
        const permissionError = () => invalidate()
        window.addEventListener('focus', focus)
        window.addEventListener('online', focus)
        document.addEventListener('visibilitychange', focus)
        window.addEventListener('feature-flags:invalidate', permissionError)
        refresh()
        connect()
        return () => {
            live = false
            controller.abort()
            clearTimeout(refreshTimer)
            clearTimeout(reconnectTimer)
            window.removeEventListener('focus', focus)
            window.removeEventListener('online', focus)
            document.removeEventListener('visibilitychange', focus)
            window.removeEventListener('feature-flags:invalidate', permissionError)
        }
    }, [accountKey, root, signedIn, token])

    useEffect(() => {
        if (root || state.phase !== 'ready' || !state.expiresAt) return
        const timer = setTimeout(() => {
            featureFlagRuntime.invalidate()
            window.dispatchEvent(new Event('feature-flags:invalidate'))
        }, Math.max(0, state.expiresAt - performance.now()))
        return () => clearTimeout(timer)
    }, [root, state.expiresAt, state.phase])

    return children
}

