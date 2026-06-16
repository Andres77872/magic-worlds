import { fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it } from 'vitest'
import { AuthContext } from '@/app/providers/AuthProvider'
import { LanguageMenu } from './LanguageMenu'

type AuthValue = NonNullable<ComponentProps<typeof AuthContext.Provider>['value']>

const auth: AuthValue = {
    isAuthenticated: false,
    user: null,
    token: null,
    projects: [],
    isLoading: false,
    error: null,
    isLoginModalOpen: false,
    login: async () => false,
    register: async () => false,
    loginWithGoogle: async () => undefined,
    completeGoogleLogin: async () => false,
    logout: () => undefined,
    updateUser: () => undefined,
    clearError: () => undefined,
    openLoginModal: () => undefined,
    closeLoginModal: () => undefined,
}

function renderMenu(props: Partial<ComponentProps<typeof LanguageMenu>> = {}) {
    return render(
        <AuthContext.Provider value={auth}>
            <LanguageMenu {...props} />
        </AuthContext.Provider>,
    )
}

describe('LanguageMenu', () => {
    it('opens the language menu from the trigger and lists locales', () => {
        renderMenu()
        expect(screen.queryByRole('menu')).toBeNull()

        const trigger = screen.getByRole('button', { name: /language/i })
        expect(trigger).toHaveAttribute('aria-expanded', 'false')
        fireEvent.click(trigger)

        expect(screen.getByRole('menu')).toBeInTheDocument()
        expect(trigger).toHaveAttribute('aria-expanded', 'true')
        expect(screen.getByRole('menuitemradio', { name: /english/i })).toBeInTheDocument()
        expect(screen.getByRole('menuitemradio', { name: /español/i })).toBeInTheDocument()
    })

    it('marks the active locale as checked', () => {
        renderMenu({ defaultOpen: true })
        expect(screen.getByRole('menuitemradio', { name: /english/i })).toHaveAttribute('aria-checked', 'true')
        expect(screen.getByRole('menuitemradio', { name: /español/i })).toHaveAttribute('aria-checked', 'false')
    })

    it('closes after choosing the active locale (no switch needed)', () => {
        renderMenu({ defaultOpen: true })
        fireEvent.click(screen.getByRole('menuitemradio', { name: /english/i }))
        expect(screen.getByRole('button', { name: /language/i })).toHaveAttribute('aria-expanded', 'false')
    })

    it('closes on Escape', () => {
        renderMenu({ defaultOpen: true })
        expect(screen.getByRole('button', { name: /language/i })).toHaveAttribute('aria-expanded', 'true')
        fireEvent.keyDown(window, { key: 'Escape' })
        expect(screen.getByRole('button', { name: /language/i })).toHaveAttribute('aria-expanded', 'false')
    })
})
