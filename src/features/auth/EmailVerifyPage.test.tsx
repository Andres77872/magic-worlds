import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    token: 'email-token' as string | null,
    verifyEmail: vi.fn(),
    clearAuthDeepLink: vi.fn(),
    isAuthenticated: false,
    logout: vi.fn(),
    openLoginModal: vi.fn(),
    setPage: vi.fn(),
}))

vi.mock('@/app/hooks', () => ({
    useAuth: () => mocks,
    useNavigation: () => ({ setPage: mocks.setPage }),
}))
vi.mock('@/infrastructure/api', () => ({ apiService: { verifyEmail: mocks.verifyEmail } }))
vi.mock('@/app/bootstrap/authDeepLink', () => ({ clearAuthDeepLink: mocks.clearAuthDeepLink }))
vi.mock('@/features/gallery/galleryLinks', () => ({ parseAuthToken: () => mocks.token }))

import { EmailVerifyPage } from './EmailVerifyPage'

beforeEach(() => {
    vi.resetAllMocks()
    mocks.token = 'email-token'
    mocks.isAuthenticated = false
    mocks.logout.mockResolvedValue(undefined)
})

describe('EmailVerifyPage', () => {
    it.each([false, true])('finishes verification in StrictMode with one token submission (signed in: %s)', async (isAuthenticated) => {
        mocks.isAuthenticated = isAuthenticated
        let resolve!: () => void
        mocks.verifyEmail.mockReturnValue(new Promise<void>(done => { resolve = done }))
        render(<EmailVerifyPage />, { reactStrictMode: true })

        expect(screen.getByRole('heading', { name: /confirming your email/i })).toBeInTheDocument()
        await act(async () => resolve())

        expect(screen.queryByRole('heading', { name: /confirming your email/i })).not.toBeInTheDocument()
        const signIn = screen.getByRole('button', { name: /sign in/i })
        expect(mocks.verifyEmail).toHaveBeenCalledExactlyOnceWith('email-token')
        expect(mocks.logout).toHaveBeenCalledTimes(isAuthenticated ? 1 : 0)
        fireEvent.click(signIn)
        expect(mocks.setPage).toHaveBeenCalledWith('landing')
        expect(mocks.openLoginModal).toHaveBeenCalledOnce()
    })

    it('leaves the spinner and shows an error when verification fails in StrictMode', async () => {
        mocks.verifyEmail.mockRejectedValue(new Error('unavailable'))
        render(<EmailVerifyPage />, { reactStrictMode: true })

        expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: /confirming your email/i })).not.toBeInTheDocument()
        expect(mocks.verifyEmail).toHaveBeenCalledOnce()
        expect(mocks.logout).not.toHaveBeenCalled()
    })

    it('handles a missing token without a request', () => {
        mocks.token = null
        render(<EmailVerifyPage />, { reactStrictMode: true })
        expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
        expect(mocks.verifyEmail).not.toHaveBeenCalled()
    })
})
