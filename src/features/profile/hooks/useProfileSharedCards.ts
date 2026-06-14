import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/app/hooks'
import { apiService } from '@/infrastructure/api'
import type { SharedCardResource } from '@/shared'

export interface ProfileSharedCardsState {
    publicCards: SharedCardResource[]
    shareLinks: SharedCardResource[]
    isLoading: boolean
    error: string | null
    refresh: () => void
}

export function useProfileSharedCards(): ProfileSharedCardsState {
    const { isAuthenticated } = useAuth()
    const [publicCards, setPublicCards] = useState<SharedCardResource[]>([])
    const [shareLinks, setShareLinks] = useState<SharedCardResource[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [reloadKey, setReloadKey] = useState(0)

    const refresh = useCallback(() => {
        setIsLoading(true)
        setError(null)
        setReloadKey((key) => key + 1)
    }, [])

    useEffect(() => {
        if (!isAuthenticated) {
            setPublicCards([])
            setShareLinks([])
            setIsLoading(false)
            return
        }

        let cancelled = false
        setIsLoading(true)
        setError(null)
        void Promise.all([
            apiService.listMyPublicCards(0, 24),
            apiService.listMyShareLinks(0, 24),
        ])
            .then(([publicResponse, shareResponse]) => {
                if (cancelled) return
                setPublicCards(publicResponse.items ?? [])
                setShareLinks(shareResponse.items ?? [])
            })
            .catch((err) => {
                if (cancelled) return
                console.error('Failed to load profile sharing cards:', err)
                setError(err instanceof Error ? err.message : 'Failed to load shared cards')
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [isAuthenticated, reloadKey])

    return { publicCards, shareLinks, isLoading, error, refresh }
}
