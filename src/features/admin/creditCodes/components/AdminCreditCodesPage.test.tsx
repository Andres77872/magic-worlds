import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminCreditCodesPage } from './AdminCreditCodesPage'

const mockUseAuth = vi.fn()
const listCreditCodeGrants = vi.fn()
const createCreditCodeGrant = vi.fn()
const updateCreditCodeGrant = vi.fn()
const disableCreditCodeGrant = vi.fn()
const listEmailCreditGrants = vi.fn()
const createEmailCreditGrants = vi.fn()
const updateEmailCreditGrant = vi.fn()
const disableEmailCreditGrant = vi.fn()
const getCreditGrantsSummary = vi.fn()
const resetMembershipQuotas = vi.fn()

vi.mock('@/app/hooks', () => ({
    useAuth: () => mockUseAuth(),
    useLanguage: () => ({ intlLocale: 'en' }),
}))

vi.mock('@/infrastructure/api', () => ({
    apiService: {
        listCreditCodeGrants: (...args: unknown[]) => listCreditCodeGrants(...args),
        createCreditCodeGrant: (...args: unknown[]) => createCreditCodeGrant(...args),
        updateCreditCodeGrant: (...args: unknown[]) => updateCreditCodeGrant(...args),
        disableCreditCodeGrant: (...args: unknown[]) => disableCreditCodeGrant(...args),
        listEmailCreditGrants: (...args: unknown[]) => listEmailCreditGrants(...args),
        createEmailCreditGrants: (...args: unknown[]) => createEmailCreditGrants(...args),
        updateEmailCreditGrant: (...args: unknown[]) => updateEmailCreditGrant(...args),
        disableEmailCreditGrant: (...args: unknown[]) => disableEmailCreditGrant(...args),
        getCreditGrantsSummary: (...args: unknown[]) => getCreditGrantsSummary(...args),
        resetMembershipQuotas: (...args: unknown[]) => resetMembershipQuotas(...args),
    },
}))

const rootUser = { user_hash: 'usr-root', username: 'root', user_type: 'root', created_at: null, updated_at: null }
const consumerUser = { ...rootUser, user_hash: 'usr-consumer', username: 'lyra', user_type: 'consumer' }

const activeCodeGrant = {
    code_id: 1,
    label: 'Launch code',
    credits: 250,
    status: 'active' as const,
    expires_at: null,
    claimed_by_user_id: null,
    claimed_at: null,
    created_by_user_id: 9,
    reason: null,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    is_expired: false,
}

const emptyCounts = {
    active: 0, active_credits: 0, claimed: 0, claimed_credits: 0,
    expired: 0, expired_credits: 0, disabled: 0, disabled_credits: 0, total: 0, total_credits: 0,
}

describe('AdminCreditCodesPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAuth.mockReturnValue({ isAuthenticated: true, user: rootUser, openLoginModal: vi.fn() })
        listCreditCodeGrants.mockResolvedValue({ items: [activeCodeGrant], limit: 25, offset: 0, next_offset: null, total: 1 })
        listEmailCreditGrants.mockResolvedValue({ items: [], limit: 25, offset: 0, next_offset: null, total: 0 })
        getCreditGrantsSummary.mockResolvedValue({
            codes: { ...emptyCounts, active: 1, active_credits: 250, total: 1, total_credits: 250 },
            emails: { ...emptyCounts },
        })
        createCreditCodeGrant.mockResolvedValue({ ...activeCodeGrant, code_id: 2, label: null, credits: 100, code: 'CDE-RAW-XYZ' })
        updateCreditCodeGrant.mockResolvedValue({ ...activeCodeGrant, credits: 300 })
        disableCreditCodeGrant.mockResolvedValue({ ...activeCodeGrant, status: 'disabled' })
        resetMembershipQuotas.mockResolvedValue({
            outcome: 'accepted',
            target: 'all',
            periods: ['daily'],
            reset_at: '2026-06-19T12:00:00Z',
            daily: {
                membership_usage_days: 2,
                membership_operation_usage_days: 3,
                ai_card_quota_days: 4,
                seeded_user_memberships: 1,
            },
            monthly: null,
            membership: null,
        })
        createEmailCreditGrants.mockResolvedValue([
            {
                grant_id: 5,
                email: 'a@b.com',
                label: null,
                credits: 100,
                status: 'active',
                expires_at: null,
                claimed_by_user_id: null,
                claimed_at: null,
                created_by_user_id: 9,
                reason: null,
                created_at: '2026-06-01T00:00:00Z',
                updated_at: '2026-06-01T00:00:00Z',
            },
        ])
    })

    it('asks signed-out users to log in', () => {
        const openLoginModal = vi.fn()
        mockUseAuth.mockReturnValue({ isAuthenticated: false, user: null, openLoginModal })

        render(<AdminCreditCodesPage />)

        expect(screen.getByText('Root access required')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
        expect(openLoginModal).toHaveBeenCalledTimes(1)
        expect(listCreditCodeGrants).not.toHaveBeenCalled()
    })

    it('denies authenticated non-root users', () => {
        mockUseAuth.mockReturnValue({ isAuthenticated: true, user: consumerUser, openLoginModal: vi.fn() })

        render(<AdminCreditCodesPage />)

        expect(screen.getByText('Root access required')).toBeInTheDocument()
        expect(screen.getByText(/limited to root users/i)).toBeInTheDocument()
        expect(listCreditCodeGrants).not.toHaveBeenCalled()
    })

    it('defaults to the active filter and lists existing codes', async () => {
        render(<AdminCreditCodesPage />)

        expect(screen.getByRole('heading', { name: 'Membership Management' })).toBeInTheDocument()
        expect(screen.getByText(/Reset quota counters/i)).toBeInTheDocument()
        expect(await screen.findByText('Launch code')).toBeInTheDocument()
        await waitFor(() => {
            expect(listCreditCodeGrants).toHaveBeenCalledWith(expect.objectContaining({ status: 'active', sort: 'recent', offset: 0 }))
        })
        expect(getCreditGrantsSummary).toHaveBeenCalled()
    })

    it('refetches with the chosen status filter', async () => {
        render(<AdminCreditCodesPage />)
        await screen.findByText('Launch code')

        fireEvent.click(screen.getByRole('button', { name: 'Claimed' }))

        await waitFor(() => {
            expect(listCreditCodeGrants).toHaveBeenCalledWith(expect.objectContaining({ status: 'claimed' }))
        })
    })

    it('creates a new code, revealing the raw code once', async () => {
        render(<AdminCreditCodesPage />)
        await screen.findByText('Launch code')

        fireEvent.click(screen.getByRole('button', { name: 'Create' }))
        fireEvent.click(screen.getByRole('button', { name: 'Create code' }))

        await waitFor(() => {
            expect(createCreditCodeGrant).toHaveBeenCalledWith({ credits: 100, label: null, expires_at: null, reason: null })
        })
        expect(await screen.findByText('CDE-RAW-XYZ')).toBeInTheDocument()
        expect(screen.getByText('Your new code')).toBeInTheDocument()
    })

    it('edits an unclaimed code via the dialog', async () => {
        render(<AdminCreditCodesPage />)
        const row = (await screen.findByText('Launch code')).closest('li')!

        fireEvent.click(within(row).getByRole('button', { name: 'Edit' }))
        const dialog = screen.getByRole('dialog', { name: 'Edit token' })
        fireEvent.change(within(dialog).getByLabelText('Credits'), { target: { value: '300' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

        await waitFor(() => {
            expect(updateCreditCodeGrant).toHaveBeenCalledWith(1, {
                credits: 300,
                label: 'Launch code',
                expires_at: null,
                reason: '',
            })
        })
    })

    it('disables a code through the confirm dialog', async () => {
        render(<AdminCreditCodesPage />)

        const row = (await screen.findByText('Launch code')).closest('li')!
        fireEvent.click(within(row).getByRole('button', { name: 'Disable' }))

        const dialog = screen.getByRole('dialog', { name: 'Disable token' })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Disable' }))

        await waitFor(() => {
            expect(disableCreditCodeGrant).toHaveBeenCalledWith(1)
        })
    })

    it('creates email credit grants after switching to the email inventory', async () => {
        render(<AdminCreditCodesPage />)
        await screen.findByText('Launch code')

        fireEvent.click(screen.getByRole('button', { name: 'Email grants' }))
        fireEvent.click(screen.getByRole('button', { name: 'Create' }))
        fireEvent.change(screen.getByLabelText('Email addresses'), { target: { value: 'a@b.com, c@d.com' } })
        fireEvent.click(screen.getByRole('button', { name: 'Create grants' }))

        await waitFor(() => {
            expect(createEmailCreditGrants).toHaveBeenCalledWith({
                emails: ['a@b.com', 'c@d.com'],
                credits: 100,
                label: null,
                expires_at: null,
                reason: null,
            })
        })
    })

    it('resets daily quotas for all users after confirmation', async () => {
        render(<AdminCreditCodesPage />)
        await screen.findByText('Launch code')

        fireEvent.click(screen.getByRole('button', { name: 'Reset quotas' }))
        const dialog = screen.getByRole('dialog', { name: 'Reset quotas?' })
        expect(within(dialog).getByText(/all users/i)).toBeInTheDocument()
        fireEvent.click(within(dialog).getByRole('button', { name: 'Reset quotas' }))

        await waitFor(() => {
            expect(resetMembershipQuotas).toHaveBeenCalledWith({ target: 'all', periods: ['daily'], reason: null })
        })
        expect(await screen.findByText(/Daily rows: 2 usage \/ 3 operation \/ 4 AI-card/)).toBeInTheDocument()
        expect(screen.getByText('Seeded memberships: 1')).toBeInTheDocument()
    })

    it('resets quotas for one user by user hash', async () => {
        resetMembershipQuotas.mockResolvedValueOnce({
            outcome: 'accepted',
            target: 'user',
            target_user_hash: 'usr-target',
            periods: ['daily', 'monthly'],
            reset_at: '2026-06-19T12:00:00Z',
            daily: {
                membership_usage_days: 1,
                membership_operation_usage_days: 1,
                ai_card_quota_days: 1,
                seeded_user_memberships: 0,
            },
            monthly: { reset_id: 42, effective_month: '2026-06', reset_at: '2026-06-19T12:00:00Z' },
            membership: {
                plan_code: 'basic',
                display_name: 'Basic',
                credits: { used: 0, max: 100, remaining: 100 },
                payg: { balance: 0, enabled: true },
                total_available_credits: 100,
                limits: {},
            },
        })
        render(<AdminCreditCodesPage />)
        await screen.findByText('Launch code')

        fireEvent.click(screen.getByRole('radio', { name: 'One user' }))
        fireEvent.change(screen.getByPlaceholderText('usr-...'), { target: { value: 'usr-target' } })
        fireEvent.click(screen.getByRole('switch', { name: 'Monthly' }))
        fireEvent.click(screen.getByRole('button', { name: 'Reset quotas' }))
        fireEvent.click(within(screen.getByRole('dialog', { name: 'Reset quotas?' })).getByRole('button', { name: 'Reset quotas' }))

        await waitFor(() => {
            expect(resetMembershipQuotas).toHaveBeenCalledWith({
                target: 'user',
                user_hash: 'usr-target',
                periods: ['daily', 'monthly'],
                reason: null,
            })
        })
        expect(await screen.findByText('Monthly reset #42 for 2026-06')).toBeInTheDocument()
        expect(screen.getByText('Target now has 100 of 100 daily credits remaining.')).toBeInTheDocument()
    })

    it('prevents reset submission without a user target or selected period', async () => {
        render(<AdminCreditCodesPage />)
        await screen.findByText('Launch code')

        fireEvent.click(screen.getByRole('radio', { name: 'One user' }))
        expect(screen.getByRole('button', { name: 'Reset quotas' })).toBeDisabled()
        expect(screen.getByText('Enter a target user.')).toBeInTheDocument()

        fireEvent.change(screen.getByPlaceholderText('usr-...'), { target: { value: 'usr-target' } })
        fireEvent.click(screen.getByRole('switch', { name: 'Daily' }))
        expect(screen.getByRole('button', { name: 'Reset quotas' })).toBeDisabled()
        expect(screen.getByText('Select at least one period.')).toBeInTheDocument()
        expect(resetMembershipQuotas).not.toHaveBeenCalled()
    })

    it('surfaces quota reset API errors', async () => {
        resetMembershipQuotas.mockRejectedValueOnce(new Error('quota reset refused'))
        render(<AdminCreditCodesPage />)
        await screen.findByText('Launch code')

        fireEvent.click(screen.getByRole('button', { name: 'Reset quotas' }))
        fireEvent.click(within(screen.getByRole('dialog', { name: 'Reset quotas?' })).getByRole('button', { name: 'Reset quotas' }))

        await waitFor(() => {
            expect(resetMembershipQuotas).toHaveBeenCalledWith({ target: 'all', periods: ['daily'], reason: null })
        })
        expect(await screen.findByText('Quota reset failed')).toBeInTheDocument()
        expect(screen.getAllByRole('alert')[0]).toHaveTextContent('quota reset refused')
    })
})
