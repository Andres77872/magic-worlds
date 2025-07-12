/**
 * Authentication provider for managing user state and auth operations
 */

import { createContext, useEffect, useState, type ReactNode } from 'react'
import type { AuthState, LoginCredentials, LoginResponse, User, Project } from '../../shared'

interface AuthContextValue extends AuthState {
    login: (credentials: LoginCredentials) => Promise<boolean>
    logout: () => void
    clearError: () => void
    isLoginModalOpen: boolean
    openLoginModal: () => void
    closeLoginModal: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

interface AuthProviderProps {
    children: ReactNode
}

const AUTH_API_URL = 'https://auth-v2.arz.ai/auth/login'
const TOKEN_STORAGE_KEY = 'magic_worlds_token'
const USER_STORAGE_KEY = 'magic_worlds_user'

export function AuthProvider({ children }: AuthProviderProps) {
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [user, setUser] = useState<User | null>(null)
    const [token, setToken] = useState<string | null>(null)
    const [projects, setProjects] = useState<Project[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)

    // Load auth state from localStorage on mount
    useEffect(() => {
        const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY)
        const savedUser = localStorage.getItem(USER_STORAGE_KEY)
        
        if (savedToken && savedUser) {
            try {
                const parsedUser = JSON.parse(savedUser)
                setToken(savedToken)
                setUser(parsedUser)
                setIsAuthenticated(true)
            } catch (error) {
                console.error('Error parsing saved user data:', error)
                // Clear corrupted data
                localStorage.removeItem(TOKEN_STORAGE_KEY)
                localStorage.removeItem(USER_STORAGE_KEY)
            }
        }
    }, [])

    const login = async (credentials: LoginCredentials): Promise<boolean> => {
        setIsLoading(true)
        setError(null)

        try {
            const formData = new FormData()
            formData.append('username', credentials.username)
            formData.append('password', credentials.password)

            const response = await fetch(AUTH_API_URL, {
                method: 'POST',
                body: formData,
            })

            if (!response.ok) {
                throw new Error(`Login failed: ${response.status} ${response.statusText}`)
            }

            const data: LoginResponse = await response.json()

            if (data.success) {
                // Save auth data
                setToken(data.session_token)
                setUser(data.user)
                setProjects(data.accessible_projects)
                setIsAuthenticated(true)

                // Persist to localStorage
                localStorage.setItem(TOKEN_STORAGE_KEY, data.session_token)
                localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user))

                return true
            } else {
                throw new Error(data.message || 'Login failed')
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
            setError(errorMessage)
            return false
        } finally {
            setIsLoading(false)
        }
    }

    const logout = () => {
        setToken(null)
        setUser(null)
        setProjects([])
        setIsAuthenticated(false)
        setError(null)
        
        // Clear localStorage
        localStorage.removeItem(TOKEN_STORAGE_KEY)
        localStorage.removeItem(USER_STORAGE_KEY)
    }

    const clearError = () => {
        setError(null)
    }

    const openLoginModal = () => {
        setIsLoginModalOpen(true)
    }

    const closeLoginModal = () => {
        setIsLoginModalOpen(false)
        setError(null)
    }

    const value: AuthContextValue = {
        isAuthenticated,
        user,
        token,
        projects,
        isLoading,
        error,
        isLoginModalOpen,
        login,
        logout,
        clearError,
        openLoginModal,
        closeLoginModal
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

// Export the context for use in hooks
export { AuthContext } 