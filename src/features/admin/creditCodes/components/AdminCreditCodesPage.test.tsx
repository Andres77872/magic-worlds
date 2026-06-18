import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminCreditCodesPage } from './AdminCreditCodesPage'

const mockUseAuth = vi.fn()
const listFreeCreditTokens = vi.fn()
const createFreeCreditToken = vi.fn()
const disableFreeCreditToken = vi.fn()
const listFreeCreditInvites = vi.fn()
const createFreeCreditInvites = vi.fn()
const disableFreeCreditInvite = vi.fn()

vi.mock('@/app/hooks', () => ({
    useAuth: () => mockUseAuth(),
    useLanguage: () => ({ intlLocale: 'en' }),
}))

vi.mock('@/infrastructure/api', () => ({
    apiService: {
        listFreeCreditTokens: (...args: unknown[]) => listFreeCreditTokens(...args),
        createFreeCreditToken: (...args: unknown[]) => createFreeCreditToken(...args),
        disableFreeCreditToken: (...args: unknown[]) => disableFreeCreditToken(...args),
        listFreeCreditInvites: (...args: unknown[]) => listFreeCreditInvites(...args),
        createFreeCreditInvites: (...args: unknown[]) => createFreeCreditInvites(...args),
        disableFreeCreditInvite: (...args: unknown[]) => disableFreeCreditInvite(...args),
    },
}))

const rootUser = { user_hash: 'usr-root', username: 'root', user_type: 'root', created_at: null, updated_at: null }
const consumerUser = { ...rootUser, user_hash: 'usr-consumer', username: 'lyra', user_type: 'consumer' }

const activeToken = {
    token_id: 1,
    label: 'Launch code',
    credits: 250,
    status: 'active' as const,
    expires_at: null,
    redeemed_by_user_id: null,
    redeemed_at: null,
    created_by_user_id: 9,
    reason: null,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
}

describe('AdminCreditCodesPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAuth.mockReturnValue({ isAuthenticated: true, user: rootUser, openLoginModal: vi.fn() })
        listFreeCreditTokens.mockResolvedValue({ items: [activeToken], limit: 100, offset: 0, next_offset: null })
        listFreeCreditInvites.mockResolvedValue({ items: [], limit: 100, offset: 0, next_offset: null })
        createFreeCreditToken.mockResolvedValue({ ...activeToken, token_id: 2, label: null, credits: 100, token: 'CDE-RAW-XYZ' })
        disableFreeCreditToken.mockResolvedValue({ ...activeToken, status: 'disabled' })
        createFreeCreditInvites.mockResolvedValue([
            { ...activeToken, token_id: undefined, invite_id: 5, email: 'a@b.com', credits: 100, status: 'active' },
        ])
    })

    it('asks signed-out users to log in', () => {
        const openLoginModal = vi.fn()
        mockUseAuth.mockReturnValue({ isAuthenticated: false, user: null, openLoginModal })

        render(<AdminCreditCodesPage />)

        expect(screen.getByText('Root access required')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
        expect(openLoginModal).toHaveBeenCalledTimes(1)
        expect(listFreeCreditTokens).not.toHaveBeenCalled()
    })

    it('denies authenticated non-root users', () => {
        mockUseAuth.mockReturnValue({ isAuthenticated: true, user: consumerUser, openLoginModal: vi.fn() })

        render(<AdminCreditCodesPage />)

        expect(screen.getByText('Root access required')).toBeInTheDocument()
        expect(screen.getByText(/limited to root users/i)).toBeInTheDocument()
        expect(listFreeCreditTokens).not.toHaveBeenCalled()
    })

    it('lists existing codes and creates a new one, revealing the raw code once', async () => {
        render(<AdminCreditCodesPage />)

        expect(await screen.findByText('Launch code')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Create code' }))

        await waitFor(() => {
            expect(createFreeCreditToken).toHaveBeenCalledWith({
                credits: 100,
                label: null,
                expires_at: null,
                reason: null,
            })
        })
        expect(await screen.findByText('CDE-RAW-XYZ')).toBeInTheDocument()
        expect(screen.getByText('Your new code')).toBeInTheDocument()
    })

    it('disables a code through the confirm dialog', async () => {
        render(<AdminCreditCodesPage />)

        const row = (await screen.findByText('Launch code')).closest('li')!
        fireEvent.click(within(row).getByRole('button', { name: 'Disable' }))

        const dialog = screen.getByRole('dialog', { name: 'Disable code' })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Disable' }))

        await waitFor(() => {
            expect(disableFreeCreditToken).toHaveBeenCalledWith(1)
        })
    })

    it('creates email invites from a pasted list', async () => {
        render(<AdminCreditCodesPage />)

        await screen.findByText('Launch code')
        fireEvent.change(screen.getByLabelText('Email addresses'), {
            target: { value: 'a@b.com, c@d.com' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Send invites' }))

        await waitFor(() => {
            expect(createFreeCreditInvites).toHaveBeenCalledWith({
                emails: ['a@b.com', 'c@d.com'],
                credits: 100,
                label: null,
                expires_at: null,
                reason: null,
            })
        })
    })
})
