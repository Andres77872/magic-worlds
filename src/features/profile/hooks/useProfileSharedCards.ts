import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/app/hooks'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import type { SharedCardResource } from '@/shared'
import { isCommunityCardsFeatureEnabled, isContentTypeFeatureEnabled } from '@/shared/featureFlags'

export interface ProfileSharedCardsState {
    publicCards: SharedCardResource[]
    shareLinks: SharedCardResource[]
    isLoading: boolean
    error: string | null
    refresh: () => void
    /**
     * Workspace R1: sharing lists are workspace-scoped. The workspace these
     * lists were read in; revoke/unpublish go to the same one.
     */
    workspaceId?: string | null
    /** That workspace's name, for the scope caption. */
    workspaceName?: string | null
}

interface LoadedSharing {
    workspaceId: string
    publicCards: SharedCardResource[]
    shareLinks: SharedCardResource[]
}

export function useProfileSharedCards(): ProfileSharedCardsState {
    const { t } = useTranslation()
    const { isAuthenticated } = useAuth()
    // The profile is an account page (not gated on the handshake), so wait for a committed workspace.
    const { status, selectedWorkspaceId, selectedWorkspace, api, capture, isCurrent } = useWorkspace()
    const enabled = isAuthenticated && isCommunityCardsFeatureEnabled()
    const ready = status === 'ready' && selectedWorkspaceId !== null
    const [loaded, setLoaded] = useState<LoadedSharing | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [reloadKey, setReloadKey] = useState(0)

    const refresh = useCallback(() => {
        setIsLoading(true)
        setError(null)
        setReloadKey((key) => key + 1)
    }, [])

    useEffect(() => {
        if (!enabled) {
            setLoaded(null)
            setIsLoading(false)
            return
        }
        if (!ready || !selectedWorkspaceId || !api) {
            // Still resolving the workspace: keep loading; a failed handshake explains itself.
            setIsLoading(status === 'idle' || status === 'loading')
            setError(status === 'unavailable' || status === 'stale' ? t('workspaceActivity.profile.unavailable') : null)
            return
        }

        let cancelled = false
        const scope = capture()
        const workspaceId = selectedWorkspaceId
        setIsLoading(true)
        setError(null)
        void Promise.all([
            api.listMyPublicCards(0, 24),
            api.listMyShareLinks(0, 24),
        ])
            .then(([publicResponse, shareResponse]) => {
                if (cancelled || !isCurrent(scope)) return
                setLoaded({ workspaceId, publicCards: publicResponse.items ?? [], shareLinks: shareResponse.items ?? [] })
            })
            .catch((err) => {
                if (cancelled || !isCurrent(scope)) return
                console.error('Failed to load profile sharing cards:', err)
                setError(err instanceof Error ? err.message : 'Failed to load shared cards')
            })
            .finally(() => {
                if (!cancelled && isCurrent(scope)) setIsLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [api, capture, enabled, isCurrent, ready, reloadKey, selectedWorkspaceId, status, t])

    // Lists of a previously selected workspace are never shown for the new one.
    const current = loaded && loaded.workspaceId === selectedWorkspaceId ? loaded : null
    return {
        publicCards: (current?.publicCards ?? []).filter(card => isContentTypeFeatureEnabled(card.card_type)),
        shareLinks: (current?.shareLinks ?? []).filter(card => isContentTypeFeatureEnabled(card.card_type)),
        isLoading,
        error,
        refresh,
        workspaceId: current?.workspaceId ?? null,
        workspaceName: current ? selectedWorkspace?.name ?? null : null,
    }
}
