import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { activeCapacityUsage, emptyCapacityUsage } from '../llmCapacityUsage.fixtures'
import { baseProfile } from './ProfileView.stories'
import { UsageSection } from './UsageSection'

afterEach(() => vi.unstubAllEnvs())

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

describe('UsageSection voice panel (D24)', () => {
    function voicePanel() {
        return screen.queryByRole('group', { name: 'Voice' })
    }

    it('stays hidden on a server without the voice usage fields', () => {
        render(<UsageSection profile={baseProfile} />)
        expect(voicePanel()).not.toBeInTheDocument()
    })

    it('shows characters, call minutes and previews left from the flat membership fields (I-1)', () => {
        const profile = {
            ...baseProfile,
            membership: {
                ...baseProfile.membership!,
                narration_chars_used: 500, narration_chars_limit: 2500, call_seconds_used: 90, call_seconds_limit: 180, previews_left: 2,
            },
        }
        render(<UsageSection profile={profile} />)
        const panel = within(voicePanel()!)

        expect(panel.getByRole('progressbar', { name: 'Narration characters used today' })).toHaveAttribute('aria-valuenow', '500')
        expect(panel.getByText('2,000 characters left today')).toBeInTheDocument()
        expect(panel.getByText('1.5 of 3 min')).toBeInTheDocument()
        expect(panel.getByText('1.5 minutes left today')).toBeInTheDocument()
        expect(panel.getByText('2 previews left today')).toBeInTheDocument()
    })

    it('falls back to the nested block of the dropped 09 §1.8 shape', () => {
        const profile = {
            ...baseProfile,
            membership: { ...baseProfile.membership!, voice_usage: { previews_left: 2 } },
        }
        render(<UsageSection profile={profile} />)
        expect(within(voicePanel()!).getByText('2 previews left today')).toBeInTheDocument()
    })

    it('shows only what is reported and the daily-limit copy at the cap', () => {
        const profile = {
            ...baseProfile,
            membership: { ...baseProfile.membership!, narration_chars_used: 2500, narration_chars_limit: 2500 },
        }
        render(<UsageSection profile={profile} />)
        const panel = within(voicePanel()!)

        expect(panel.getByText('Daily voice limit reached. Narration resumes tomorrow.')).toBeInTheDocument()
        expect(panel.queryByText(/min/)).not.toBeInTheDocument()
        expect(panel.queryByText(/previews? left/)).not.toBeInTheDocument()
    })
})


it('hides voice usage and quota rows while preserving other usage', () => {
    vi.stubEnv('VITE_FEATURE_VOICES_ENABLED', 'false')
    vi.stubEnv('VITE_FEATURE_CALLS_ENABLED', 'true')
    render(<UsageSection profile={{ ...baseProfile, membership: { ...baseProfile.membership!,
        narration_chars_used: 500, narration_chars_limit: 2500, call_seconds_used: 90, call_seconds_limit: 180, previews_left: 2,
    } }} />)
    expect(screen.queryByRole('group', { name: 'Voice' })).not.toBeInTheDocument()
    expect(screen.queryByText('Call mode')).not.toBeInTheDocument()
    expect(screen.queryByText('TTS')).not.toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Included daily credits used' })).toBeInTheDocument()
})
