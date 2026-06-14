import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLanguage } from '@/app/hooks/useLanguage'
import { i18n, LANGUAGE_STORAGE_KEY } from '@/app/i18n'
import { apiService } from '@/infrastructure'
import type { User } from '@/shared/types/auth.types'
import { useAuth } from '@/app/hooks/useAuth'
import { LanguageProvider } from './LanguageProvider'

vi.mock('@/app/hooks/useAuth', () => ({
    useAuth: vi.fn(),
}))

const user: User = {
    user_hash: 'usr-language',
    username: 'Lyra',
    email: null,
    user_type: 'consumer',
    created_at: null,
    updated_at: null,
}

function setAuthState(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
    vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        user: null,
        token: null,
        projects: [],
        isLoading: false,
        error: null,
        isLoginModalOpen: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        clearError: vi.fn(),
        openLoginModal: vi.fn(),
        closeLoginModal: vi.fn(),
        ...overrides,
    } as ReturnType<typeof useAuth>)
}

function Probe() {
    const { language, intlLocale, isSyncing, syncError, setLanguage } = useLanguage()

    return (
        <div>
            <span data-testid="language">{language}</span>
            <span data-testid="intl">{intlLocale}</span>
            <span data-testid="syncing">{isSyncing ? 'syncing' : 'idle'}</span>
            <span data-testid="error">{syncError ?? 'none'}</span>
            <button type="button" onClick={() => void setLanguage('es')}>
                Switch Spanish
            </button>
        </div>
    )
}

function renderLanguageProvider() {
    return render(
        <LanguageProvider>
            <Probe />
        </LanguageProvider>,
    )
}

describe('LanguageProvider', () => {
    beforeEach(async () => {
        vi.clearAllMocks()
        localStorage.clear()
        document.documentElement.lang = ''
        document.documentElement.dir = ''
        await i18n.changeLanguage('en')
        setAuthState()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('persists signed-out language changes locally', async () => {
        const updateSpy = vi.spyOn(apiService, 'updateUserPreferences')

        renderLanguageProvider()
        fireEvent.click(screen.getByRole('button', { name: /switch spanish/i }))

        await waitFor(() => expect(screen.getByTestId('language')).toHaveTextContent('es'))
        expect(screen.getByTestId('intl')).toHaveTextContent('es-MX')
        expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('es')
        expect(document.documentElement.lang).toBe('es')
        expect(updateSpy).not.toHaveBeenCalled()
    })

    it('applies an existing account preference after sign-in', async () => {
        setAuthState({ isAuthenticated: true, token: 'token-1', user })
        vi.spyOn(apiService, 'getUserPreferences').mockResolvedValue({ preferred_language: 'es', has_preference: true })
        const updateSpy = vi.spyOn(apiService, 'updateUserPreferences')

        renderLanguageProvider()

        await waitFor(() => expect(screen.getByTestId('language')).toHaveTextContent('es'))
        expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('es')
        expect(document.documentElement.lang).toBe('es')
        expect(updateSpy).not.toHaveBeenCalled()
    })

    it('bootstraps the local language into a signed-in account with no preference', async () => {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, 'es')
        await i18n.changeLanguage('es')
        setAuthState({ isAuthenticated: true, token: 'token-1', user })
        vi.spyOn(apiService, 'getUserPreferences').mockResolvedValue({ preferred_language: 'en', has_preference: false })
        const updateSpy = vi
            .spyOn(apiService, 'updateUserPreferences')
            .mockResolvedValue({ preferred_language: 'es', has_preference: true })

        renderLanguageProvider()

        await waitFor(() => expect(updateSpy).toHaveBeenCalledWith({ preferred_language: 'es' }))
        expect(screen.getByTestId('language')).toHaveTextContent('es')
    })

    it('does not cache a failed initial account sync as successful', async () => {
        setAuthState({ isAuthenticated: true, token: 'token-1', user })
        const getSpy = vi
            .spyOn(apiService, 'getUserPreferences')
            .mockRejectedValueOnce(new Error('temporarily unavailable'))
            .mockResolvedValueOnce({ preferred_language: 'es', has_preference: true })
        vi.spyOn(apiService, 'updateUserPreferences')
            .mockResolvedValue({ preferred_language: 'es', has_preference: true })
        vi.spyOn(console, 'warn').mockImplementation(() => undefined)

        const first = renderLanguageProvider()

        await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('language.syncError'))
        first.unmount()

        renderLanguageProvider()

        await waitFor(() => expect(screen.getByTestId('language')).toHaveTextContent('es'))
        expect(getSpy).toHaveBeenCalledTimes(2)
    })
})
