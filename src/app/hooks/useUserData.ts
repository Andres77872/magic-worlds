/**
 * Custom hook for fetching user data from API
 */

import { useState, useEffect } from 'react'
import { apiService, type UserData } from '../../infrastructure/api'

interface UseUserDataReturn {
    userData: UserData | null
    isLoading: boolean
    error: string | null
    refetch: () => Promise<void>
}

export function useUserData(): UseUserDataReturn {
    const [userData, setUserData] = useState<UserData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchUserData = async () => {
        try {
            setIsLoading(true)
            setError(null)

            // Get token from localStorage — gracefully handle missing token
            const token = localStorage.getItem('magic_worlds:token')
            if (!token) {
                setUserData(null)
                setIsLoading(false)
                return
            }

            const data = await apiService.getUserData(token)
            setUserData(data)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch user data'
            setError(errorMessage)
            console.error('Error fetching user data:', err)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchUserData()
    }, [])

    return {
        userData,
        isLoading,
        error,
        refetch: fetchUserData
    }
}
