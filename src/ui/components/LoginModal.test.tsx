import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import { AttestationContext, type AttestationContextValue } from '@/features/legal/attestation/attestationContext'
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

function renderModal(onClose = vi.fn(), attestation: AttestationContextValue | null = null) {
    const localI18n = i18n.cloneInstance({ lng: 'en' })
    render(
        <I18nextProvider i18n={localI18n}>
            <AttestationContext.Provider value={attestation}>
                <LoginModal isOpen onClose={onClose} />
            </AttestationContext.Provider>
        </I18nextProvider>,
    )
    return { onClose }
}

function attestationApi(): AttestationContextValue {
    return {
        gate: 'idle',
        requestAttestation: vi.fn(async () => true),
        withAttestation: vi.fn(async (operation) => operation()),
        expectSignupAttestation: vi.fn(),
        cancelSignupAttestation: vi.fn(),
    }
}

function tickAttestations() {
    fireEvent.click(screen.getByRole('checkbox', { name: 'I am 18 or older' }))
    fireEvent.click(screen.getByRole('checkbox', { name: /I agree to the Terms of Service/ }))
}

function fillCredentials(username = 'aria', password = 'hunter22') {
    fireEvent.change(screen.getByLabelText(/^username$/i), { target: { value: username } })
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: password } })
}

describe('LoginModal', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        authError = null
    })

    it('opens in sign-in mode with the sign-in option checked and a matching submit button', () => {
        renderModal()
        expect(screen.getByRole('radio', { name: 'Sign in' })).toHaveAttribute('aria-checked', 'true')
        expect(screen.getByRole('radio', { name: 'Create account' })).toHaveAttribute('aria-checked', 'false')
        expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
        expect(screen.queryByLabelText(/confirm password/i)).not.toBeInTheDocument()
    })

    it('switches to register mode: option checked, title, confirm field and submit label change', () => {
        renderModal()
        fireEvent.click(screen.getByRole('radio', { name: 'Create account' }))

        expect(screen.getByRole('radio', { name: 'Create account' })).toHaveAttribute('aria-checked', 'true')
        expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
        expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
    })

    it('opens on "Create account" when a sign-up CTA asks for it, and again on each reopening', () => {
        const localI18n = i18n.cloneInstance({ lng: 'en' })
        const ui = (isOpen: boolean, initialMode: 'login' | 'register') => (
            <I18nextProvider i18n={localI18n}>
                <LoginModal isOpen={isOpen} onClose={vi.fn()} initialMode={initialMode} />
            </I18nextProvider>
        )
        const view = render(ui(true, 'register'))
        expect(screen.getByRole('radio', { name: 'Create account' })).toHaveAttribute('aria-checked', 'true')
        expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('radio', { name: 'Sign in' }))
        view.rerender(ui(false, 'register'))
        view.rerender(ui(true, 'register'))
        expect(screen.getByRole('radio', { name: 'Create account' })).toHaveAttribute('aria-checked', 'true')
    })

    it('blocks register and shows an inline error when passwords do not match', async () => {
        renderModal()
        fireEvent.click(screen.getByRole('radio', { name: 'Create account' }))
        fillCredentials('aria', 'hunter22')
        fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'different' } })
        fireEvent.click(screen.getByRole('button', { name: /create account/i }))

        expect(await screen.findByText("Passwords don't match")).toBeInTheDocument()
        expect(register).not.toHaveBeenCalled()
    })

    it('registers with matching passwords and closes on success', async () => {
        register.mockResolvedValue(true)
        const { onClose } = renderModal()
        fireEvent.click(screen.getByRole('radio', { name: 'Create account' }))
        fillCredentials('aria', 'hunter22')
        fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'hunter22' } })
        tickAttestations()
        fireEvent.click(screen.getByRole('button', { name: /create account/i }))

        await waitFor(() => expect(register).toHaveBeenCalledWith({ username: 'aria', password: 'hunter22' }))
        await waitFor(() => expect(onClose).toHaveBeenCalled())
    })

    it('asks for the 18+ and Terms boxes, unticked, only when creating an account', () => {
        renderModal()
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('radio', { name: 'Create account' }))
        const age = screen.getByRole('checkbox', { name: 'I am 18 or older' })
        const terms = screen.getByRole('checkbox', { name: /I agree to the Terms of Service/ })
        expect(age).not.toBeChecked()
        expect(terms).not.toBeChecked()
        expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '#/terms')
    })

    it('names the Terms version being accepted under the register Terms box only', () => {
        renderModal()
        expect(screen.queryByTestId('attestation-terms-version')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('radio', { name: 'Create account' }))
        const version = screen.getByTestId('attestation-terms-version')
        expect(version).toHaveTextContent('Terms of Service, version tos-v1')
        expect(screen.getByRole('checkbox', { name: /I agree to the Terms of Service/ }))
            .toHaveAttribute('aria-describedby', version.id)
        expect(screen.getByRole('checkbox', { name: 'I am 18 or older' })).not.toHaveAttribute('aria-describedby')

        fireEvent.click(screen.getByRole('radio', { name: 'Sign in' }))
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
        expect(screen.queryByTestId('attestation-terms-version')).not.toBeInTheDocument()
    })

    it('blocks register until both boxes are ticked', async () => {
        renderModal()
        fireEvent.click(screen.getByRole('radio', { name: 'Create account' }))
        fillCredentials('aria', 'hunter22')
        fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'hunter22' } })
        fireEvent.click(screen.getByRole('checkbox', { name: 'I am 18 or older' }))
        fireEvent.click(screen.getByRole('button', { name: /create account/i }))

        expect(await screen.findByRole('alert')).toHaveTextContent('Confirm you are 18 or older and accept the Terms of Service')
        expect(screen.getByRole('checkbox', { name: /I agree to the Terms of Service/ })).toHaveAttribute('aria-invalid', 'true')
        expect(register).not.toHaveBeenCalled()
    })

    it('hands the ticked boxes to the attestation gate before registering, and drops them on failure', async () => {
        const attestation = attestationApi()
        register.mockResolvedValue(false)
        renderModal(vi.fn(), attestation)
        fireEvent.click(screen.getByRole('radio', { name: 'Create account' }))
        fillCredentials('aria', 'hunter22')
        fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'hunter22' } })
        tickAttestations()
        fireEvent.click(screen.getByRole('button', { name: /create account/i }))

        await waitFor(() => expect(attestation.cancelSignupAttestation).toHaveBeenCalledTimes(1))
        expect(attestation.expectSignupAttestation).toHaveBeenCalledTimes(1)
        expect(vi.mocked(attestation.expectSignupAttestation).mock.invocationCallOrder[0])
            .toBeLessThan(register.mock.invocationCallOrder[0])
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

        fireEvent.click(screen.getByRole('radio', { name: 'Create account' }))
        expect(clearError).toHaveBeenCalled()
    })

    it('also switches modes from the footer link', () => {
        renderModal()
        fireEvent.click(screen.getByRole('button', { name: 'Create an account' }))
        expect(screen.getByRole('radio', { name: 'Create account' })).toHaveAttribute('aria-checked', 'true')

        // Footer link in register mode reads "Sign in" (the submit reads "Create account",
        // and the tabs have role="tab", so this is unambiguous).
        fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
        expect(screen.getByRole('radio', { name: 'Sign in' })).toHaveAttribute('aria-checked', 'true')
    })
})
