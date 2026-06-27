import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EmailCreditGrantClaimCard } from './EmailCreditGrantClaimCard'

const apiMocks = vi.hoisted(() => ({
    listEmailCreditGrantOffers: vi.fn(),
    claimEmailCreditGrants: vi.fn(),
}))

vi.mock('@/infrastructure/api', () => ({
    apiService: {
        listEmailCreditGrantOffers: (...args: unknown[]) => apiMocks.listEmailCreditGrantOffers(...args),
        claimEmailCreditGrants: (...args: unknown[]) => apiMocks.claimEmailCreditGrants(...args),
    },
}))

describe('EmailCreditGrantClaimCard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        apiMocks.listEmailCreditGrantOffers.mockResolvedValue({
            items: [{ grant_id: 1, email_masked: 'm***@e***.com', credits: 25, label: 'Launch', expires_at: null }],
            total_credits: 25,
        })
        apiMocks.claimEmailCreditGrants.mockResolvedValue({
            credits_added: 25,
            claimed_grants: [{ grant_id: 1, email_masked: 'm***@e***.com', credits: 25, label: 'Launch', expires_at: null }],
            total_available_credits: 75,
        })
    })

    it('shows pending email credit grants for activated account emails', async () => {
        render(<EmailCreditGrantClaimCard />)

        expect(await screen.findByText('Credits waiting for your email')).toBeInTheDocument()
        expect(screen.getByText('25 credits')).toBeInTheDocument()
        expect(screen.getByText(/m\*\*\*@e\*\*\*\.com - 25 credits/)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Claim credits' })).toBeEnabled()
    })

    it('claims email credit grants without asking for a code', async () => {
        const onClaimed = vi.fn()
        apiMocks.listEmailCreditGrantOffers
            .mockResolvedValueOnce({
                items: [{ grant_id: 1, email_masked: 'm***@e***.com', credits: 25, label: null, expires_at: null }],
                total_credits: 25,
            })
            .mockResolvedValueOnce({ items: [], total_credits: 0 })

        render(<EmailCreditGrantClaimCard onClaimed={onClaimed} />)

        fireEvent.click(await screen.findByRole('button', { name: 'Claim credits' }))

        await waitFor(() => {
            expect(apiMocks.claimEmailCreditGrants).toHaveBeenCalledTimes(1)
        })
        expect(await screen.findByText('Credits claimed')).toBeInTheDocument()
        expect(screen.getByText('25 credits added to your wallet.')).toBeInTheDocument()
        expect(onClaimed).toHaveBeenCalledTimes(1)
    })
})
