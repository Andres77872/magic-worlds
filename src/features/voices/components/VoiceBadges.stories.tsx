import type { Meta, StoryObj } from '@storybook/react-vite'
import type { VoiceBadgeKey } from '@/shared'
import { VoiceBadges, type VoiceBadgeContext } from './VoiceBadges'

const ALL_BADGES: VoiceBadgeKey[] = [
    'needs_reselect', 'review', 'leaving', 'retired', 'replaced', 'locked',
    'call_voice', 'standard_fallback', 'not_tested_language', 'expressive_only', 'house_voice',
]

const CONTEXT: VoiceBadgeContext = {
    date: '2026-12-01T00:00:00Z',
    language: 'ja',
    name: 'Maren',
    original: 'Sela',
    minPlan: 'plus',
}

const meta = {
    title: 'Voices/VoiceBadges',
    component: VoiceBadges,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Voice state badges (R1). The keys are the server badge values, so a voice’s `effective_voice.badges` renders as is; unknown keys are ignored. Every badge says its meaning in text, and the ones with a hint (replacement, plan, fallback) expose it as a tooltip.',
            },
        },
    },
    argTypes: {
        badges: { control: 'check', options: ALL_BADGES },
        context: { control: 'object' },
        className: { control: false },
    },
    args: {
        badges: ['leaving', 'review'],
        context: CONTEXT,
    },
} satisfies Meta<typeof VoiceBadges>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

/** Every badge, in display order, with its context filled in. */
export const AllBadges: Story = {
    args: { badges: ALL_BADGES },
}

/** Each badge on its own, the way a single voice row shows it. */
export const OneByOne: Story = {
    parameters: { controls: { disable: true } },
    render: (args) => (
        <ul className="flex flex-col gap-3">
            {ALL_BADGES.map((badge) => (
                <li key={badge} className="flex items-center gap-4">
                    <code className="w-44 font-mono text-caption text-fg-subtle">{badge}</code>
                    <VoiceBadges badges={[badge]} context={args.context} />
                </li>
            ))}
        </ul>
    ),
}

/** Without context the copy falls back: "Leaving soon", a generic replacement hint. */
export const WithoutContext: Story = {
    args: { badges: ['leaving', 'replaced', 'call_voice'], context: {} },
}

/** A locked voice names the plan that unlocks it (`min_plan`); the lock icon never carries the meaning alone. */
export const LockedPlans: Story = {
    parameters: { controls: { disable: true } },
    render: () => (
        <ul className="flex flex-col gap-3">
            {(['plus', 'pro', null] as const).map((plan) => (
                <li key={plan ?? 'none'} className="flex items-center gap-4">
                    <code className="w-44 font-mono text-caption text-fg-subtle">min_plan: {plan ?? 'null'}</code>
                    <VoiceBadges badges={['locked']} context={{ minPlan: plan }} />
                </li>
            ))}
        </ul>
    ),
}
