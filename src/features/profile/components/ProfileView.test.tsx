import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Membership, UserProfile } from '@/shared'
import { ProfileView } from './ProfileView'

const membership: Membership = {
    plan_code: 'free',
    display_name: 'Free',
    credits: { period: 'daily', max: 50, used: 4, remaining: 46, usage_date: '2026-06-10' },
    payg: { balance: 4 },
    total_available_credits: 50,
    limits: {
        chat_interaction: { daily_limit: 20, used_today: 2, max_in_flight: 1, in_flight: 0, credit_cost: 1 },
        image_generation: { daily_limit: 20, used_today: 1, max_in_flight: 2, in_flight: 0, credit_cost: 1 },
        card_image_generation: { daily_limit: 5, used_today: 1, max_in_flight: 1, in_flight: 0, credit_cost: 1 },
        voice_call: { daily_limit: 50, used_today: 1, max_in_flight: 1, in_flight: 0, credit_cost: 1, billing_unit: 'audio_seconds', seconds_per_credit: 10, billable_seconds_today: 9 },
    },
    monthly_usage: {
        period: 'calendar_month',
        month: '2026-06',
        start_date: '2026-06-01',
        end_date: '2026-06-10',
        credits_used: 35,
        included_credits_used: 31,
        payg_credits_used: 4,
        operations: {
            chat_interaction: { used: 20, credits_used: 20, included_credits_used: 20, payg_credits_used: 0 },
            image_generation: { used: 14, credits_used: 14, included_credits_used: 10, payg_credits_used: 4 },
            card_image_generation: { used: 0, credits_used: 0, included_credits_used: 0, payg_credits_used: 0 },
            voice_call: { used: 1, credits_used: 1, included_credits_used: 1, payg_credits_used: 0, billable_seconds: 9 },
        },
    },
    profile_cards: {
        current_plan_code: 'free',
        tiers: [
            {
                plan_code: 'free',
                display_name: 'Free',
                status: 'current',
                available: true,
                reference_only: false,
                badge: 'Current',
                description: 'Included daily credits for everyday creation.',
                highlights: ['50 daily included credits', 'PAYG credits cover overage', 'Core generation tools'],
                credits: { period: 'daily', max: 50, used: 4, remaining: 46, usage_date: '2026-06-10', preview: false },
                limits: {
                    chat_interaction: { daily_limit: 20, used_today: 2, max_in_flight: 1, in_flight: 0, credit_cost: 1, preview: false },
                    image_generation: { daily_limit: 20, used_today: 1, max_in_flight: 2, in_flight: 0, credit_cost: 1, preview: false },
                    card_image_generation: { daily_limit: 5, used_today: 1, max_in_flight: 1, in_flight: 0, credit_cost: 1, preview: false },
                    voice_call: { daily_limit: 50, used_today: 1, max_in_flight: 1, in_flight: 0, credit_cost: 1, preview: false },
                },
                visual: { tone: 'current', icon: 'sparkles' },
                action: { state: 'active', label: 'Current plan', enabled: false },
            },
            {
                plan_code: 'plus',
                display_name: 'Plus',
                status: 'locked',
                available: false,
                reference_only: true,
                badge: 'Preview',
                description: 'Reference tier for more active creators.',
                highlights: ['100 daily included credits', 'Higher concurrent generation', 'Reference only'],
                credits: { period: 'daily', max: 100, used: 0, remaining: 100, usage_date: null, preview: true },
                limits: {
                    chat_interaction: { daily_limit: 100, used_today: 0, max_in_flight: 2, in_flight: 0, credit_cost: 1, preview: true },
                    image_generation: { daily_limit: 100, used_today: 0, max_in_flight: 4, in_flight: 0, credit_cost: 1, preview: true },
                    card_image_generation: { daily_limit: 25, used_today: 0, max_in_flight: 2, in_flight: 0, credit_cost: 1, preview: true },
                    voice_call: { daily_limit: 100, used_today: 0, max_in_flight: 1, in_flight: 0, credit_cost: 1, preview: true },
                },
                visual: { tone: 'locked', icon: 'rocket' },
                action: { state: 'reference_only', label: 'Reference only', enabled: false },
            },
            {
                plan_code: 'pro',
                display_name: 'Pro',
                status: 'locked',
                available: false,
                reference_only: true,
                badge: 'Preview',
                description: 'Reference tier for studio-scale creative sessions.',
                highlights: ['500 daily included credits', 'Highest preview limits', 'Reference only'],
                credits: { period: 'daily', max: 500, used: 0, remaining: 500, usage_date: null, preview: true },
                limits: {
                    chat_interaction: { daily_limit: 500, used_today: 0, max_in_flight: 4, in_flight: 0, credit_cost: 1, preview: true },
                    image_generation: { daily_limit: 500, used_today: 0, max_in_flight: 8, in_flight: 0, credit_cost: 1, preview: true },
                    card_image_generation: { daily_limit: 125, used_today: 0, max_in_flight: 4, in_flight: 0, credit_cost: 1, preview: true },
                    voice_call: { daily_limit: 500, used_today: 0, max_in_flight: 1, in_flight: 0, credit_cost: 1, preview: true },
                },
                visual: { tone: 'locked', icon: 'crown' },
                action: { state: 'reference_only', label: 'Reference only', enabled: false },
            },
        ],
        payg: {
            balance: 4,
            credit_cost: 1,
            covered_operations: ['chat_interaction', 'image_generation', 'card_image_generation', 'voice_call'],
            non_expiring: true,
            available: false,
            reference_only: true,
            badge: 'PAYG',
            description: 'Non-expiring credits used after included daily credits are exhausted.',
            highlights: ['4 credits available', '1 credit per action', 'Reference only'],
            visual: { tone: 'payg', icon: 'coins' },
            action: { state: 'reference_only', label: 'Reference only', enabled: false },
        },
    },
}

const profile: UserProfile = {
    user_hash: 'usr-profile',
    username: 'Lyra',
    user_type: 'consumer',
    user_usage: 50,
    membership,
    card_counts: { character: 2, world: 1, item: 6, adventure_template: 3 },
}

const noop = vi.fn()
const deleteAll = vi.fn().mockResolvedValue(undefined)

describe('ProfileView membership section', () => {
    it('renders current membership, locked previews, limits, and PAYG balance', () => {
        render(<ProfileView profile={profile} onLogout={noop} onDeleteAllData={deleteAll} />)

        expect(screen.getByRole('heading', { name: 'Membership' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Free' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Plus' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Pro' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Pay as you go' })).toBeInTheDocument()
        expect(screen.getByText('50 available')).toBeInTheDocument()
        expect(screen.getAllByText('50').length).toBeGreaterThan(0)
        expect(screen.getByText('100')).toBeInTheDocument()
        expect(screen.getByText('500')).toBeInTheDocument()
        expect(screen.getAllByText('4').length).toBeGreaterThan(0)
        expect(screen.getAllByText('credits / day')).toHaveLength(3)
        expect(screen.getAllByText('Chat').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Chat/adventure images').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Card images').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Call mode').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Indicative limits')).toHaveLength(2)
        expect(screen.getAllByText('Daily limits')).toHaveLength(1)
        // Plan cards carry no live usage — that lives in the usage section below.
        expect(screen.queryByText(/used today/)).not.toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Usage monitor' })).toBeInTheDocument()
        expect(screen.getByText('June 2026 to date')).toBeInTheDocument()
        expect(screen.getAllByRole('progressbar')).toHaveLength(5)
        const creditsBar = screen.getByRole('progressbar', { name: 'Included daily credits used' })
        expect(creditsBar).toHaveAttribute('aria-valuenow', '4')
        expect(creditsBar).toHaveAttribute('aria-valuemax', '50')
        expect(screen.getByText('4 of 50')).toBeInTheDocument()
        expect(screen.getByText('46 remaining today')).toBeInTheDocument()
        expect(screen.getByRole('progressbar', { name: 'Chat usage today' })).toHaveAttribute('aria-valuenow', '2')
        expect(screen.getByRole('progressbar', { name: 'Chat/adventure images usage today' })).toHaveAttribute('aria-valuenow', '1')
        expect(screen.getByRole('progressbar', { name: 'Card images usage today' })).toHaveAttribute('aria-valuenow', '1')
        expect(screen.getByRole('progressbar', { name: 'Call mode usage today' })).toHaveAttribute('aria-valuenow', '1')
        expect(screen.getByText('1 credits / 9 sec')).toBeInTheDocument()
        expect(screen.getByText('Credits this month')).toBeInTheDocument()
        expect(screen.getByText('35')).toBeInTheDocument()
        expect(screen.getByText('31')).toBeInTheDocument()
        expect(screen.getByText('10 included / 4 PAYG')).toBeInTheDocument()
        expect(screen.getByText('14 actions')).toBeInTheDocument()
        expect(screen.getByText('9 sec audio time')).toBeInTheDocument()
        expect(screen.getByText('1 credit per action')).toBeInTheDocument()
        expect(screen.getByText('Non-expiring')).toBeInTheDocument()
        expect(screen.queryByText(/checkout/i)).not.toBeInTheDocument()
        for (const action of screen.getAllByRole('button', { name: 'Reference only' })) {
            expect(action).toBeDisabled()
        }
    })

    it('falls back to a legacy credits card when membership cards are absent', () => {
        render(
            <ProfileView
                profile={{ ...profile, user_usage: 1000, membership: undefined }}
                onLogout={noop}
                onDeleteAllData={deleteAll}
            />,
        )

        expect(screen.getByRole('heading', { name: 'Membership' })).toBeInTheDocument()
        expect(screen.getByText('1,000')).toBeInTheDocument()
        expect(screen.getByText(/Detailed membership tiers will appear here/i)).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Plus' })).not.toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Usage monitor' })).not.toBeInTheDocument()
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    })

    it('renders daily usage when the monthly rollout field is absent', () => {
        render(
            <ProfileView
                profile={{ ...profile, membership: { ...membership, monthly_usage: undefined } }}
                onLogout={noop}
                onDeleteAllData={deleteAll}
            />,
        )

        expect(screen.getByRole('heading', { name: 'Usage monitor' })).toBeInTheDocument()
        expect(screen.getAllByRole('progressbar')).toHaveLength(5)
        expect(screen.queryByText('Credits this month')).not.toBeInTheDocument()
        expect(screen.queryByText('June 2026 to date')).not.toBeInTheDocument()
    })

    it('confirms before logging out', () => {
        const onLogout = vi.fn()
        render(<ProfileView profile={profile} onLogout={onLogout} onDeleteAllData={deleteAll} />)

        fireEvent.click(screen.getByRole('button', { name: 'Log out' }))

        const dialog = screen.getByRole('dialog', { name: 'Log out?' })
        expect(within(dialog).getByText(/signed in as/i)).toBeInTheDocument()
        expect(within(dialog).getByText('Lyra')).toBeInTheDocument()
        expect(onLogout).not.toHaveBeenCalled()

        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

        expect(screen.queryByRole('dialog', { name: 'Log out?' })).not.toBeInTheDocument()
        expect(onLogout).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'Log out' }))
        fireEvent.click(within(screen.getByRole('dialog', { name: 'Log out?' })).getByRole('button', { name: 'Log out' }))

        expect(onLogout).toHaveBeenCalledTimes(1)
    })
})

describe('ProfileView identity hero', () => {
    it('shows the display name as the heading with the username beneath', () => {
        render(
            <ProfileView
                profile={{ ...profile, display_name: 'The Loremaster' }}
                onLogout={noop}
                onDeleteAllData={deleteAll}
            />,
        )

        expect(screen.getByRole('heading', { level: 1, name: 'The Loremaster' })).toBeInTheDocument()
        expect(screen.getByText('@Lyra')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Edit display name' })).toBeInTheDocument()
        // The immutable login identity still appears on the account row.
        expect(screen.getByText('Username')).toBeInTheDocument()
    })

    it('falls back to the username as the heading when no display name is set', () => {
        render(<ProfileView profile={profile} onLogout={noop} onDeleteAllData={deleteAll} />)

        expect(screen.getByRole('heading', { level: 1, name: 'Lyra' })).toBeInTheDocument()
        expect(screen.getByText('@Lyra')).toBeInTheDocument()
    })
})
