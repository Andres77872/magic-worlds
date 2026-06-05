/**
 * Authentication provider for managing user state and auth operations
 */

import { createContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { AuthState, LoginCredentials, RegisterData, User, Project } from '../../shared'
import { apiService } from '../../infrastructure'

interface AuthContextValue extends AuthState {
    login: (credentials: LoginCredentials) => Promise<boolean>
    register: (data: RegisterData) => Promise<boolean>
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

const TOKEN_STORAGE_KEY = 'magic_worlds:token'
const USER_STORAGE_KEY = 'magic_worlds:user'

export function AuthProvider({ children }: AuthProviderProps) {
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [user, setUser] = useState<User | null>(null)
    const [token, setToken] = useState<string | null>(null)
    const [projects, setProjects] = useState<Project[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)

    const clearAuthState = useCallback(() => {
        setToken(null)
        setUser(null)
        setProjects([])
        setIsAuthenticated(false)
    }, [])

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

    // Listen for 401 auth:expired events from apiService
    useEffect(() => {
        const handleAuthExpired = () => {
            clearAuthState()
            localStorage.removeItem(TOKEN_STORAGE_KEY)
            localStorage.removeItem(USER_STORAGE_KEY)
            setError('Session expired, please log in again')
            setIsLoginModalOpen(true)
        }

        window.addEventListener('auth:expired', handleAuthExpired)
        return () => window.removeEventListener('auth:expired', handleAuthExpired)
    }, [clearAuthState])

    const login = async (credentials: LoginCredentials): Promise<boolean> => {
        setIsLoading(true)
        setError(null)

        try {
            const data = await apiService.login(credentials)

            if (data.success && data.session_token && data.user) {
                // Save auth data
                setToken(data.session_token)
                setUser(data.user)
                setProjects(data.accessible_projects || [])
                setIsAuthenticated(true)

                // Persist to localStorage
                localStorage.setItem(TOKEN_STORAGE_KEY, data.session_token)
                localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user))

                return true
            } else {
                setError(data.message || 'Login failed')
                return false
            }
        } catch (error) {
            if (error instanceof TypeError && error.message === 'Failed to fetch') {
                setError('Authentication service unavailable')
            } else {
                const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
                setError(errorMessage)
            }
            return false
        } finally {
            setIsLoading(false)
        }
    }

    const register = async (data: RegisterData): Promise<boolean> => {
        setIsLoading(true)
        setError(null)

        try {
            const response = await apiService.register(data)

            // Some providers return a session_token on register; most (incl.
            // api.auth) do not. If we got one, use it; otherwise auto-login with
            // the same credentials so the user ends up authenticated with a
            // valid Bearer token instead of a tokenless "authenticated" state.
            const tokenFromRegister =
                'session_token' in response
                    ? (response as { session_token?: string }).session_token
                    : undefined

            if (tokenFromRegister) {
                setToken(tokenFromRegister)
                if (response.user) setUser(response.user)
                setProjects([])
                setIsAuthenticated(true)
                localStorage.setItem(TOKEN_STORAGE_KEY, tokenFromRegister)
                if (response.user) {
                    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.user))
                }
                return true
            }

            // No token on register → log in to obtain one.
            return await login({ username: data.username, password: data.password })
        } catch (error) {
            if (error instanceof TypeError && error.message === 'Failed to fetch') {
                setError('Registration service unavailable')
            } else {
                const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
                // Check for 409 conflict
                if (errorMessage.includes('409') || errorMessage.includes('already exists')) {
                    setError('Username already exists')
                } else {
                    setError(errorMessage)
                }
            }
            return false
        } finally {
            setIsLoading(false)
        }
    }

    const logout = () => {
        // Fire-and-forget: call API logout, then clear local state
        const token = localStorage.getItem(TOKEN_STORAGE_KEY)
        if (token) {
            apiService.authenticatedRequest('/auth/logout', token.replace(/"/g, ''), {
                method: 'POST'
            }).catch(err => {
                // Logout API call is fire-and-forget — ignore failures
                console.warn('Logout API call failed (non-critical):', err)
            })
        }

        clearAuthState()
        setError(null)

        // Clear localStorage
        localStorage.removeItem(TOKEN_STORAGE_KEY)
        localStorage.removeItem(USER_STORAGE_KEY)
    }

    const clearError = () => {
        setError(null)
    }

    const openLoginModal = useCallback(() => {
        setIsLoginModalOpen(true)
    }, [])

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
        register,
        logout,
        clearError,
        openLoginModal,
        closeLoginModal,
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

// Export the context for use in hooks
export { AuthContext }
