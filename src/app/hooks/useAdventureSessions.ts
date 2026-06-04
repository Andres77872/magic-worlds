/**
 * Custom hook for fetching adventure sessions from API
 */

import { useState, useEffect } from 'react'
import { apiService } from '../../infrastructure/api'

interface AdventureSession {
    adventure_id: number
    user_id: number
    adventure_template: string
    adventure_last_turn: string
    adventure_last_update: string
    adventure_created_at: string
}

interface UseAdventureSessionsReturn {
    sessions: AdventureSession[]
    count: number
    isLoading: boolean
    error: string | null
    refetch: () => Promise<void>
}

export function useAdventureSessions(): UseAdventureSessionsReturn {
    const [sessions, setSessions] = useState<AdventureSession[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchSessions = async () => {
        try {
            setIsLoading(true)
            setError(null)

            const data = await apiService.getAdventureSessions()
            setSessions(data || [])
        } catch (err) {
            const token = localStorage.getItem('magic_worlds:token')
            const isAuthError = !token || (err instanceof Error && (
                err.message.includes('401') || err.message.includes('Unauthorized')
            ))

            if (isAuthError) {
                // Gracefully handle auth errors — no error state, just empty data
                setSessions([])
            } else {
                // Only set error for genuine failures (network, 500, etc.)
                const errorMessage = err instanceof Error ? err.message : 'Failed to fetch adventure sessions'
                setError(errorMessage)
                console.error('Error fetching adventure sessions:', err)
            }
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchSessions()
    }, [])

    return {
        sessions,
        count: sessions.length,
        isLoading,
        error,
        refetch: fetchSessions
    }
}
