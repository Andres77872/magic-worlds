import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { activeCapacityUsage, emptyCapacityUsage } from '../llmCapacityUsage.fixtures'
import { baseProfile } from './ProfileView.stories'
import { UsageSection } from './UsageSection'

function byokPanel() {
    return screen.getByRole('group', { name: 'Your provider key (BYOK)' })
}

describe('UsageSection BYOK panel', () => {
    it('shows own-key requests per operation apart from the app credit meters', () => {
        render(<UsageSection profile={baseProfile} llmUsage={{ status: 'ready', usage: activeCapacityUsage }} />)
        const panel = byokPanel()
        const chatLimit = baseProfile.membership!.limits.chat_interaction.daily_limit
        expect(within(panel).getByText(`7 of ${chatLimit} today · 64 this month`)).toBeInTheDocument()
        expect(within(panel).getByRole('progressbar', { name: 'Chat BYOK requests today' })).toHaveAttribute('aria-valuenow', '7')
        expect(within(panel).getByText(/1 of \d+ today · 12 this month/)).toBeInTheDocument()
        // Writers and voice never accept a personal key, so they never appear here.
        expect(within(panel).queryByText(/Image/)).not.toBeInTheDocument()
        expect(within(panel).getByText(/5 earlier requests have no recorded payer/)).toBeInTheDocument()
        // The included-credit meter keeps its own value; BYOK counts never add to it.
        const credits = screen.getByRole('progressbar', { name: 'Included daily credits used' })
        expect(credits).toHaveAttribute('aria-valuenow', String(baseProfile.membership!.credits.used))
    })

    it('states an empty month without zero meters', () => {
        render(<UsageSection profile={baseProfile} llmUsage={{ status: 'ready', usage: emptyCapacityUsage }} />)
        const panel = byokPanel()
        expect(within(panel).getByText('No BYOK requests this month.')).toBeInTheDocument()
        expect(within(panel).queryByRole('progressbar')).not.toBeInTheDocument()
        expect(within(panel).queryByText(/no recorded payer/)).not.toBeInTheDocument()
    })

    it('reports loading and unavailable states without inventing counts', () => {
        const { rerender } = render(<UsageSection profile={baseProfile} llmUsage={{ status: 'loading', usage: null }} />)
        expect(within(byokPanel()).getByRole('status')).toHaveTextContent('Loading BYOK usage…')
        rerender(<UsageSection profile={baseProfile} llmUsage={{ status: 'unavailable', usage: null }} />)
        expect(within(byokPanel()).getByText('BYOK usage is unavailable right now.')).toBeInTheDocument()
        expect(within(byokPanel()).queryByRole('progressbar')).not.toBeInTheDocument()
    })

    it('omits the panel when the caller has no profile execution context', () => {
        render(<UsageSection profile={baseProfile} />)
        expect(screen.queryByRole('group', { name: 'Your provider key (BYOK)' })).not.toBeInTheDocument()
    })
})
