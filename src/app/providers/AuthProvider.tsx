/**
 * Authentication provider for managing user state and auth operations
 */

import { createContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { AuthState, BrowserAuthResponse, LoginCredentials, RegisterData, User, Project } from '../../shared'
import { apiService } from '../../infrastructure'
import { i18n } from '@/app/i18n'

interface AuthContextValue extends AuthState {
    login: (credentials: LoginCredentials) => Promise<boolean>
    register: (data: RegisterData) => Promise<boolean>
    loginWithGoogle: (rememberMe?: boolean) => Promise<void>
    completeGoogleLogin: (code: string) => Promise<boolean>
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

type AuthRefreshedDetail = BrowserAuthResponse & { token?: string }

function selectAccessToken(data: BrowserAuthResponse | AuthRefreshedDetail): string {
    return (data as AuthRefreshedDetail).token || data.session_token || data.access_token || ''
}

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

    // Listen for terminal auth expiry events. The API layer emits this only after
    // refresh itself is denied, not for every protected endpoint 401.
    useEffect(() => {
        const handleAuthExpired = () => {
            clearAuthState()
            localStorage.removeItem(TOKEN_STORAGE_KEY)
            localStorage.removeItem(USER_STORAGE_KEY)
            setError(i18n.t('auth.errors.sessionExpired'))
            setIsLoginModalOpen(true)
        }

        window.addEventListener('auth:expired', handleAuthExpired)
        return () => window.removeEventListener('auth:expired', handleAuthExpired)
    }, [clearAuthState])

    // Refresh succeeds outside React (API/WebSocket layer), then publishes the
    // new short-lived access token. Keep React state in sync without ever
    // touching the HttpOnly refresh cookie.
    useEffect(() => {
        const handleAuthRefreshed = (event: Event) => {
            const detail = (event as CustomEvent<AuthRefreshedDetail>).detail
            const nextToken = detail ? selectAccessToken(detail) : ''
            if (!nextToken) return

            setToken(nextToken)
            setIsAuthenticated(true)
            setError(null)
            localStorage.setItem(TOKEN_STORAGE_KEY, nextToken)

            if (detail.user) {
                setUser(detail.user)
                localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(detail.user))
            }
            if (detail.accessible_projects) {
                setProjects(detail.accessible_projects)
            }
        }

        window.addEventListener('auth:refreshed', handleAuthRefreshed)
        return () => window.removeEventListener('auth:refreshed', handleAuthRefreshed)
    }, [])

    const login = async (credentials: LoginCredentials): Promise<boolean> => {
        setIsLoading(true)
        setError(null)

        try {
            const data = await apiService.login(credentials)
            const nextToken = selectAccessToken(data)

            if (data.success && nextToken && data.user) {
                // Save auth data
                setToken(nextToken)
                setUser(data.user)
                setProjects(data.accessible_projects || [])
                setIsAuthenticated(true)

                // Persist to localStorage
                localStorage.setItem(TOKEN_STORAGE_KEY, nextToken)
                localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user))

                return true
            } else {
                setError(data.message || i18n.t('auth.errors.loginFailed'))
                return false
            }
        } catch (error) {
            if (error instanceof TypeError && error.message === 'Failed to fetch') {
                setError(i18n.t('auth.errors.authUnavailable'))
            } else {
                const errorMessage = error instanceof Error ? error.message : i18n.t('auth.errors.unexpected')
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
            const tokenFromRegister = selectAccessToken(response)

            if (tokenFromRegister) {
                setToken(tokenFromRegister)
                if (response.user) setUser(response.user)
                setProjects(response.accessible_projects || [])
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
                setError(i18n.t('auth.errors.registrationUnavailable'))
            } else {
                const errorMessage = error instanceof Error ? error.message : i18n.t('auth.errors.unexpected')
                // Check for 409 conflict
                if (errorMessage.includes('409') || errorMessage.includes('already exists')) {
                    setError(i18n.t('auth.errors.usernameExists'))
                } else {
                    setError(errorMessage)
                }
            }
            return false
        } finally {
            setIsLoading(false)
        }
    }

    // Step 1 of "Continue with Google": mint a provider-init token, then navigate
    // the browser top-level to the BFF start-shim (→ Google). This call ends by
    // leaving the page, so the success path does not reset isLoading.
    const loginWithGoogle = useCallback(async (rememberMe = false): Promise<void> => {
        setIsLoading(true)
        setError(null)
        try {
            const origin = window.location.origin
            const init = await apiService.createGoogleProviderInit(origin)
            if (!init.provider_init_token) {
                throw new Error('missing provider_init_token')
            }
            window.location.assign(apiService.buildGoogleStartUrl(init.provider_init_token, rememberMe, origin))
        } catch (error) {
            if (error instanceof TypeError && error.message === 'Failed to fetch') {
                setError(i18n.t('auth.errors.authUnavailable'))
            } else {
                setError(i18n.t('auth.errors.unexpected'))
            }
            setIsLoading(false)
        }
    }, [])

    // Final step: the BFF redirected back with a one-time delivery code (the
    // GoogleCallbackPage calls this). Exchange it for the session, mirroring the
    // password-login success path, and notify the WS/API layers via auth:refreshed.
    const completeGoogleLogin = useCallback(async (code: string): Promise<boolean> => {
        setIsLoading(true)
        setError(null)
        try {
            const data = await apiService.exchangeGoogleReturn(code)
            const nextToken = selectAccessToken(data)

            if (data.success && nextToken && data.user) {
                setToken(nextToken)
                setUser(data.user)
                setProjects(data.accessible_projects || [])
                setIsAuthenticated(true)
                localStorage.setItem(TOKEN_STORAGE_KEY, nextToken)
                localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user))
                window.dispatchEvent(new CustomEvent<AuthRefreshedDetail>('auth:refreshed', { detail: { ...data, token: nextToken } }))
                return true
            }
            setError(data.message || i18n.t('auth.errors.loginFailed'))
            return false
        } catch (error) {
            if (error instanceof TypeError && error.message === 'Failed to fetch') {
                setError(i18n.t('auth.errors.authUnavailable'))
            } else {
                const errorMessage = error instanceof Error ? error.message : i18n.t('auth.errors.unexpected')
                setError(errorMessage)
            }
            return false
        } finally {
            setIsLoading(false)
        }
    }, [])

    const logout = () => {
        // Fire-and-forget: call API logout, then clear local state
        apiService.logout().catch(err => {
            // Logout API call is fire-and-forget — ignore failures
            console.warn('Logout API call failed (non-critical):', err)
        })

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
        loginWithGoogle,
        completeGoogleLogin,
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
