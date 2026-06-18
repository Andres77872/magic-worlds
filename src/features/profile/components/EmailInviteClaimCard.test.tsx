import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EmailInviteClaimCard } from './EmailInviteClaimCard'

const apiMocks = vi.hoisted(() => ({
    listEmailCreditInvites: vi.fn(),
    claimEmailCreditInvites: vi.fn(),
}))

vi.mock('@/infrastructure/api', () => ({
    apiService: {
        listEmailCreditInvites: (...args: unknown[]) => apiMocks.listEmailCreditInvites(...args),
        claimEmailCreditInvites: (...args: unknown[]) => apiMocks.claimEmailCreditInvites(...args),
    },
}))

describe('EmailInviteClaimCard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        apiMocks.listEmailCreditInvites.mockResolvedValue({
            items: [{ invite_id: 1, email_masked: 'm***@e***.com', credits: 25, label: 'Launch', expires_at: null }],
            total_credits: 25,
        })
        apiMocks.claimEmailCreditInvites.mockResolvedValue({
            credits_added: 25,
            claimed_invites: [{ invite_id: 1, email_masked: 'm***@e***.com', credits: 25, label: 'Launch', expires_at: null }],
            total_available_credits: 75,
        })
    })

    it('shows pending invite credits for activated account emails', async () => {
        render(<EmailInviteClaimCard />)

        expect(await screen.findByText('Credits waiting for your email')).toBeInTheDocument()
        expect(screen.getByText('25 credits')).toBeInTheDocument()
        expect(screen.getByText(/m\*\*\*@e\*\*\*\.com - 25 credits/)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Claim credits' })).toBeEnabled()
    })

    it('claims invite credits without asking for a code', async () => {
        const onClaimed = vi.fn()
        apiMocks.listEmailCreditInvites
            .mockResolvedValueOnce({
                items: [{ invite_id: 1, email_masked: 'm***@e***.com', credits: 25, label: null, expires_at: null }],
                total_credits: 25,
            })
            .mockResolvedValueOnce({ items: [], total_credits: 0 })

        render(<EmailInviteClaimCard onClaimed={onClaimed} />)

        fireEvent.click(await screen.findByRole('button', { name: 'Claim credits' }))

        await waitFor(() => {
            expect(apiMocks.claimEmailCreditInvites).toHaveBeenCalledTimes(1)
        })
        expect(await screen.findByText('Credits claimed')).toBeInTheDocument()
        expect(screen.getByText('25 credits added to your wallet.')).toBeInTheDocument()
        expect(onClaimed).toHaveBeenCalledTimes(1)
    })
})
