import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginModal } from './LoginModal'

const login = vi.fn()
const register = vi.fn()
const clearError = vi.fn()
let authError: string | null = null

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({
        login,
        register,
        isLoading: false,
        error: authError,
        clearError,
    }),
}))

function renderModal(onClose = vi.fn()) {
    render(<LoginModal isOpen onClose={onClose} />)
    return { onClose }
}

function fillCredentials(username = 'aria', password = 'hunter22') {
    fireEvent.change(screen.getByPlaceholderText(/enter your username/i), { target: { value: username } })
    fireEvent.change(screen.getByPlaceholderText(/^(enter your|choose a) password$/i), { target: { value: password } })
}

describe('LoginModal', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        authError = null
    })

    it('opens in sign-in mode with a selected tab and matching submit button', () => {
        renderModal()
        expect(screen.getByRole('tab', { name: 'Sign in' })).toHaveAttribute('aria-selected', 'true')
        expect(screen.getByRole('tab', { name: 'Create account' })).toHaveAttribute('aria-selected', 'false')
        expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
        expect(screen.queryByLabelText(/confirm password/i)).not.toBeInTheDocument()
    })

    it('switches to register mode: tab selected, title, confirm field and submit label change', () => {
        renderModal()
        fireEvent.click(screen.getByRole('tab', { name: 'Create account' }))

        expect(screen.getByRole('tab', { name: 'Create account' })).toHaveAttribute('aria-selected', 'true')
        expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
        expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
    })

    it('blocks register and shows an inline error when passwords do not match', async () => {
        renderModal()
        fireEvent.click(screen.getByRole('tab', { name: 'Create account' }))
        fillCredentials('aria', 'hunter22')
        fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'different' } })
        fireEvent.click(screen.getByRole('button', { name: /create account/i }))

        expect(await screen.findByText("Passwords don't match")).toBeInTheDocument()
        expect(register).not.toHaveBeenCalled()
    })

    it('registers with matching passwords and closes on success', async () => {
        register.mockResolvedValue(true)
        const { onClose } = renderModal()
        fireEvent.click(screen.getByRole('tab', { name: 'Create account' }))
        fillCredentials('aria', 'hunter22')
        fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'hunter22' } })
        fireEvent.click(screen.getByRole('button', { name: /create account/i }))

        await waitFor(() => expect(register).toHaveBeenCalledWith({ username: 'aria', password: 'hunter22' }))
        await waitFor(() => expect(onClose).toHaveBeenCalled())
    })

    it('logs in and closes on success', async () => {
        login.mockResolvedValue(true)
        const { onClose } = renderModal()
        fillCredentials('aria', 'hunter22')
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

        await waitFor(() => expect(login).toHaveBeenCalledWith({ username: 'aria', password: 'hunter22' }))
        await waitFor(() => expect(onClose).toHaveBeenCalled())
    })

    it('clears a stale auth error when switching modes', () => {
        authError = 'Username already exists'
        renderModal()
        expect(screen.getByText('Username already exists')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('tab', { name: 'Create account' }))
        expect(clearError).toHaveBeenCalled()
    })

    it('also switches modes from the footer link', () => {
        renderModal()
        fireEvent.click(screen.getByRole('button', { name: 'Create an account' }))
        expect(screen.getByRole('tab', { name: 'Create account' })).toHaveAttribute('aria-selected', 'true')

        // Footer link in register mode reads "Sign in" (the submit reads "Create account",
        // and the tabs have role="tab", so this is unambiguous).
        fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
        expect(screen.getByRole('tab', { name: 'Sign in' })).toHaveAttribute('aria-selected', 'true')
    })
})
