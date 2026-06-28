import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Membership, UserProfile } from '@/shared'
import type { ProfileSharedCardsState } from '../hooks/useProfileSharedCards'
import { ProfileView } from './ProfileView'

// Exported for the UsageSection / MembershipSection stories.
export const membership: Membership = {
    plan_code: 'free',
    display_name: 'Free',
    credits: {
        period: 'daily',
        max: 50,
        used: 8,
        remaining: 42,
        usage_date: '2026-06-10',
    },
    payg: { balance: 12 },
    total_available_credits: 54,
    limits: {
        chat_interaction: { daily_limit: 20, used_today: 3, max_in_flight: 1, in_flight: 0, credit_cost: 1 },
        ai_card_generation: { daily_limit: 20, used_today: 1, max_in_flight: 1, in_flight: 0, credit_cost: 1 },
        image_generation: { daily_limit: 20, used_today: 2, max_in_flight: 2, in_flight: 0, credit_cost: 1 },
        card_image_generation: { daily_limit: 5, used_today: 1, max_in_flight: 1, in_flight: 0, credit_cost: 1 },
        theme_song_generation: { daily_limit: 5, used_today: 0, max_in_flight: 1, in_flight: 0, credit_cost: 1 },
        tts_generation: { daily_limit: 20, used_today: 0, max_in_flight: 1, in_flight: 0, credit_cost: 1 },
        voice_call: { daily_limit: 50, used_today: 2, max_in_flight: 1, in_flight: 0, credit_cost: 1, billing_unit: 'audio_seconds', seconds_per_credit: 10, billable_seconds_today: 17 },
    },
    monthly_usage: {
        period: 'calendar_month',
        month: '2026-06',
        start_date: '2026-06-01',
        end_date: '2026-06-10',
        credits_used: 53,
        included_credits_used: 45,
        payg_credits_used: 8,
        operations: {
            chat_interaction: { used: 24, credits_used: 24, included_credits_used: 24, payg_credits_used: 0 },
            ai_card_generation: { used: 6, credits_used: 6, included_credits_used: 6, payg_credits_used: 0 },
            image_generation: { used: 9, credits_used: 9, included_credits_used: 6, payg_credits_used: 3 },
            card_image_generation: { used: 4, credits_used: 4, included_credits_used: 3, payg_credits_used: 1 },
            theme_song_generation: { used: 2, credits_used: 2, included_credits_used: 0, payg_credits_used: 2 },
            tts_generation: { used: 5, credits_used: 5, included_credits_used: 4, payg_credits_used: 1 },
            voice_call: { used: 3, credits_used: 3, included_credits_used: 2, payg_credits_used: 1, billable_seconds: 27 },
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
                credits: { period: 'daily', max: 50, used: 8, remaining: 42, usage_date: '2026-06-10', preview: false },
                limits: {
                    chat_interaction: { daily_limit: 20, used_today: 3, max_in_flight: 1, in_flight: 0, credit_cost: 1, preview: false },
                    ai_card_generation: { daily_limit: 20, used_today: 1, max_in_flight: 1, in_flight: 0, credit_cost: 1, preview: false },
                    image_generation: { daily_limit: 20, used_today: 2, max_in_flight: 2, in_flight: 0, credit_cost: 1, preview: false },
                    card_image_generation: { daily_limit: 5, used_today: 1, max_in_flight: 1, in_flight: 0, credit_cost: 1, preview: false },
                    theme_song_generation: { daily_limit: 5, used_today: 0, max_in_flight: 1, in_flight: 0, credit_cost: 1, preview: false },
                    tts_generation: { daily_limit: 20, used_today: 0, max_in_flight: 1, in_flight: 0, credit_cost: 1, preview: false },
                    voice_call: { daily_limit: 50, used_today: 2, max_in_flight: 1, in_flight: 0, credit_cost: 1, preview: false },
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
                    ai_card_generation: { daily_limit: 100, used_today: 0, max_in_flight: 2, in_flight: 0, credit_cost: 1, preview: true },
                    image_generation: { daily_limit: 100, used_today: 0, max_in_flight: 4, in_flight: 0, credit_cost: 1, preview: true },
                    card_image_generation: { daily_limit: 25, used_today: 0, max_in_flight: 2, in_flight: 0, credit_cost: 1, preview: true },
                    theme_song_generation: { daily_limit: 25, used_today: 0, max_in_flight: 2, in_flight: 0, credit_cost: 1, preview: true },
                    tts_generation: { daily_limit: 100, used_today: 0, max_in_flight: 2, in_flight: 0, credit_cost: 1, preview: true },
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
                    ai_card_generation: { daily_limit: 500, used_today: 0, max_in_flight: 4, in_flight: 0, credit_cost: 1, preview: true },
                    image_generation: { daily_limit: 500, used_today: 0, max_in_flight: 8, in_flight: 0, credit_cost: 1, preview: true },
                    card_image_generation: { daily_limit: 125, used_today: 0, max_in_flight: 4, in_flight: 0, credit_cost: 1, preview: true },
                    theme_song_generation: { daily_limit: 100, used_today: 0, max_in_flight: 4, in_flight: 0, credit_cost: 1, preview: true },
                    tts_generation: { daily_limit: 500, used_today: 0, max_in_flight: 4, in_flight: 0, credit_cost: 1, preview: true },
                    voice_call: { daily_limit: 500, used_today: 0, max_in_flight: 1, in_flight: 0, credit_cost: 1, preview: true },
                },
                visual: { tone: 'locked', icon: 'crown' },
                action: { state: 'reference_only', label: 'Reference only', enabled: false },
            },
        ],
        payg: {
            balance: 12,
            credit_cost: 1,
            covered_operations: ['chat_interaction', 'ai_card_generation', 'image_generation', 'card_image_generation', 'theme_song_generation', 'tts_generation', 'voice_call'],
            non_expiring: true,
            available: false,
            reference_only: true,
            badge: 'PAYG',
            description: 'Non-expiring credits used after included daily credits are exhausted.',
            highlights: ['12 credits available', '1 credit per action', 'Reference only'],
            visual: { tone: 'payg', icon: 'coins' },
            action: { state: 'reference_only', label: 'Reference only', enabled: false },
        },
    },
}

export const baseProfile: UserProfile = {
    user_hash: 'usr-4f2c9a17-8d3b-4e6a-9c21-7b5e0a1d6f84',
    username: 'Lyra',
    // No display name set → the hero falls back to the username.
    display_name: null,
    user_type: 'consumer',
    user_usage: 54,
    membership,
    card_counts: { character: 7, world: 3, item: 6, adventure_template: 5 },
}

// Empty-but-loaded sharing state so the Sharing tab renders its real section
// (and its empty copy) rather than the signed-out fallback.
const sharingStub: ProfileSharedCardsState = {
    publicCards: [],
    shareLinks: [],
    isLoading: false,
    error: null,
    refresh: () => {},
}

const meta = {
    title: 'Features/Profile',
    component: ProfileView,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Account/profile view backed by `GET /user/me`. A two-column settings shell: an always-visible identity header (avatar, display-name editor, role, content-stat pills, log out) over a sticky section nav — Membership, Usage, Shared cards, Account, Security — beside the active panel, instead of one long scroll. The nav is vertical on desktop and a horizontal scroller on mobile. Use the `initialTab` control to preview each section.',
            },
        },
    },
    decorators: [(Story) => <div className="bg-ink-800 text-parchment-50"><Story /></div>],
    argTypes: {
        profile: { control: false },
        onLogout: { control: false },
        onDeleteAllData: { control: false },
        activeTab: { control: false },
        onTabChange: { control: false },
        initialTab: {
            control: 'inline-radio',
            options: ['membership', 'usage', 'sharing', 'account', 'security'],
            description: 'Section shown on first render (uncontrolled).',
        },
    },
    args: { profile: baseProfile, onLogout: () => {}, onDeleteAllData: async () => {} },
} satisfies Meta<typeof ProfileView>

export default meta
type Story = StoryObj<typeof meta>

export const Adventurer: Story = {}

export const WithDisplayName: Story = {
    args: {
        profile: { ...baseProfile, display_name: 'The Loremaster' },
    },
}

export const Admin: Story = {
    args: {
        profile: { ...baseProfile, username: 'Magister Vane', user_type: 'admin' },
    },
}

export const Root: Story = {
    args: {
        profile: {
            ...baseProfile,
            username: 'Root',
            user_type: 'root',
            user_usage: 554,
            membership: {
                ...membership,
                payg: { balance: 512 },
                total_available_credits: 554,
                profile_cards: {
                    ...membership.profile_cards!,
                    payg: {
                        ...membership.profile_cards!.payg,
                        balance: 512,
                        highlights: ['512 credits available', '1 credit per action', 'Reference only'],
                    },
                },
            },
        },
    },
}

export const FreshAccount: Story = {
    args: {
        profile: {
            ...baseProfile,
            username: 'Newcomer',
            user_usage: 50,
            membership: {
                ...membership,
                credits: { ...membership.credits, used: 0, remaining: 50 },
                payg: { balance: 0 },
                total_available_credits: 50,
                monthly_usage: {
                    ...membership.monthly_usage!,
                    credits_used: 0,
                    included_credits_used: 0,
                    payg_credits_used: 0,
                    operations: Object.fromEntries(
                        Object.keys(membership.monthly_usage!.operations).map((operation) => [
                            operation,
                            { used: 0, credits_used: 0, included_credits_used: 0, payg_credits_used: 0 },
                        ]),
                    ),
                },
                limits: Object.fromEntries(
                    Object.entries(membership.limits).map(([operation, limit]) => [
                        operation,
                        { ...limit, used_today: 0, in_flight: 0 },
                    ]),
                ),
                profile_cards: {
                    ...membership.profile_cards!,
                    tiers: membership.profile_cards!.tiers.map((tier) =>
                        tier.plan_code === 'free'
                            ? {
                                  ...tier,
                                  credits: { ...tier.credits, used: 0, remaining: 50 },
                                  limits: Object.fromEntries(
                                      Object.entries(tier.limits).map(([operation, limit]) => [
                                          operation,
                                          { ...limit, used_today: 0, in_flight: 0 },
                                      ]),
                                  ),
                              }
                            : tier,
                    ),
                    payg: {
                        ...membership.profile_cards!.payg,
                        balance: 0,
                        highlights: ['0 credits available', '1 credit per action', 'Reference only'],
                    },
                },
            },
            card_counts: { character: 0, world: 0, item: 0, adventure_template: 0 },
        },
    },
}

/** Usage meters near and at their limits — exercises the ember → amber → blood fill tones. */
export const HeavyUsage: Story = {
    args: {
        initialTab: 'usage',
        profile: {
            ...baseProfile,
            username: 'Nightowl',
            user_usage: 15,
            membership: {
                ...membership,
                credits: { ...membership.credits, used: 47, remaining: 3 },
                total_available_credits: 15,
                limits: {
                    ...membership.limits,
                    chat_interaction: { daily_limit: 20, used_today: 20, max_in_flight: 1, in_flight: 0, credit_cost: 1 },
                    image_generation: { daily_limit: 20, used_today: 17, max_in_flight: 2, in_flight: 1, credit_cost: 1 },
                    card_image_generation: { daily_limit: 5, used_today: 5, max_in_flight: 1, in_flight: 1, credit_cost: 1 },
                    theme_song_generation: { daily_limit: 5, used_today: 2, max_in_flight: 1, in_flight: 0, credit_cost: 1 },
                },
                monthly_usage: {
                    ...membership.monthly_usage!,
                    credits_used: 154,
                    included_credits_used: 101,
                    payg_credits_used: 53,
                    operations: {
                        chat_interaction: { used: 72, credits_used: 72, included_credits_used: 52, payg_credits_used: 20 },
                        ai_card_generation: { used: 16, credits_used: 16, included_credits_used: 12, payg_credits_used: 4 },
                        image_generation: { used: 29, credits_used: 29, included_credits_used: 18, payg_credits_used: 11 },
                        card_image_generation: { used: 9, credits_used: 9, included_credits_used: 4, payg_credits_used: 5 },
                        theme_song_generation: { used: 8, credits_used: 8, included_credits_used: 4, payg_credits_used: 4 },
                        tts_generation: { used: 11, credits_used: 11, included_credits_used: 6, payg_credits_used: 5 },
                        voice_call: { used: 9, credits_used: 9, included_credits_used: 5, payg_credits_used: 4, billable_seconds: 82 },
                    },
                },
            },
        },
    },
}

export const NoMonthlyUsage: Story = {
    args: {
        initialTab: 'usage',
        profile: {
            ...baseProfile,
            membership: {
                ...membership,
                monthly_usage: undefined,
            },
        },
    },
}

export const LegacyProfileResponse: Story = {
    args: {
        profile: {
            user_hash: baseProfile.user_hash,
            username: 'Legacy',
            user_type: 'consumer',
            user_usage: 1000,
            card_counts: baseProfile.card_counts,
        },
    },
}

/** The Usage section — daily quota meters plus the month-to-date breakdown. */
export const UsageTab: Story = { args: { initialTab: 'usage' } }

/** The Shared cards section (empty state) — public cards / unlisted links sub-toggle. */
export const SharingTab: Story = { args: { initialTab: 'sharing', sharing: sharingStub } }

/** The Account section — manage the email addresses linked to the account. */
export const AccountTab: Story = { args: { initialTab: 'account' } }

/** The Security section — change password and the danger zone. */
export const SecurityTab: Story = { args: { initialTab: 'security' } }
