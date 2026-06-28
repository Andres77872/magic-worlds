import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BillingPage } from './BillingPage'

const apiMocks = vi.hoisted(() => ({
    getBillingPlans: vi.fn(),
    getUserProfile: vi.fn(),
}))

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: true, openLoginModal: vi.fn() }),
    useNavigation: () => ({ setPage: vi.fn() }),
}))

vi.mock('@/infrastructure/api', () => ({
    apiService: {
        getBillingPlans: (...args: unknown[]) => apiMocks.getBillingPlans(...args),
        getUserProfile: (...args: unknown[]) => apiMocks.getUserProfile(...args),
    },
}))

const freeProfile = { membership: { plan_code: 'free' } }

const enabledCatalog = {
    enabled: true,
    plans: [
        { plan_code: 'free', display_name: 'Free', monthly_price_cents: 0, daily_credit_limit: 50, kind: 'subscription' },
        { plan_code: 'plus', display_name: 'Plus', monthly_price_cents: 999, daily_credit_limit: 100, kind: 'subscription' },
    ],
    credit_packs: [
        { credit_product_code: 'payg_100', display_name: '100 credits', credits: 100, price_cents: 500, kind: 'credit_pack' },
    ],
}

beforeEach(() => {
    apiMocks.getUserProfile.mockResolvedValue(freeProfile)
})

afterEach(() => {
    vi.unstubAllEnvs()
})

describe('BillingPage', () => {
    it('shows a not-available state and never fetches when the frontend flag is off', async () => {
        // VITE_BILLING_ENABLED is unset (default off): even a server-enabled
        // catalog must not surface a purchase flow, and no catalog call fires.
        apiMocks.getBillingPlans.mockResolvedValue(enabledCatalog)

        render(<BillingPage />)

        await waitFor(() => expect(screen.getByText(/aren't available/i)).toBeInTheDocument())
        expect(apiMocks.getBillingPlans).not.toHaveBeenCalled()
        expect(screen.queryByRole('heading', { name: 'Plus' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Upgrade|Switch|Buy/i })).not.toBeInTheDocument()
    })

    it('shows a not-available state when billing is disabled server-side', async () => {
        vi.stubEnv('VITE_BILLING_ENABLED', 'true')
        apiMocks.getBillingPlans.mockResolvedValue({ ...enabledCatalog, enabled: false })

        render(<BillingPage />)

        await waitFor(() => expect(screen.getByText(/aren't available/i)).toBeInTheDocument())
        // No purchasable plans or credit packs are rendered in the off state.
        expect(screen.queryByRole('heading', { name: 'Plus' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Upgrade|Switch|Buy/i })).not.toBeInTheDocument()
    })

    it('renders purchasable plans and credit packs when the flag and server are both on', async () => {
        vi.stubEnv('VITE_BILLING_ENABLED', 'true')
        apiMocks.getBillingPlans.mockResolvedValue(enabledCatalog)

        render(<BillingPage />)

        await waitFor(() => expect(screen.getByRole('heading', { name: 'Plus' })).toBeInTheDocument())
        expect(screen.getByRole('button', { name: 'Upgrade to Plus' })).toBeEnabled()
        expect(screen.getByRole('button', { name: 'Buy' })).toBeEnabled()
        expect(screen.queryByText(/aren't available/i)).not.toBeInTheDocument()
    })
})
