import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import type { SessionVoiceSettings } from '@/shared/types/sessionVoice.types'
import { SessionNarrationTierView } from './SessionNarrationTierToggle'

const settings = (overrides: Partial<SessionVoiceSettings> = {}): SessionVoiceSettings => ({
    session_id: 7,
    tier_override: null,
    effective_tier: 'standard',
    tier_fallback_reason: null,
    tiers_allowed: ['standard', 'expressive'],
    provider_route: 'elevenlabs',
    updated_at: null,
    ...overrides,
})

const meta = {
    title: 'Interaction/SessionNarrationTierToggle',
    component: SessionNarrationTierView,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Per-session narration tier (R1): Default follows the account tier, or pin Standard / Expressive for this adventure or chat. The connected `SessionNarrationTierToggle` renders nothing until its reads succeed; Expressive is disabled when the plan does not include it.',
            },
        },
    },
    argTypes: {
        accountTier: { control: 'inline-radio', options: ['standard', 'expressive'] },
        readOnly: { control: 'boolean' },
        saving: { control: 'boolean' },
        error: { control: 'text' },
    },
    args: {
        settings: settings(),
        accountTier: 'standard',
        readOnly: false,
        saving: false,
        error: null,
        onChange: fn(),
    },
    decorators: [(Story) => <div className="max-w-sm"><Story /></div>],
} satisfies Meta<typeof SessionNarrationTierView>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const States: Story = {
    parameters: { controls: { disable: true } },
    render: (args) => (
        <div className="flex flex-col gap-6">
            <SessionNarrationTierView {...args} settings={settings({ tier_override: 'expressive', effective_tier: 'expressive' })} />
            <SessionNarrationTierView {...args} settings={settings({ tiers_allowed: ['standard'] })} />
            <SessionNarrationTierView {...args} settings={settings({ tier_override: 'expressive', tier_fallback_reason: 'unhealthy' })} />
            <SessionNarrationTierView {...args} readOnly />
            <SessionNarrationTierView {...args} error="Your plan doesn’t include this voice option." />
        </div>
    ),
}
