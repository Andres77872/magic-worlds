import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import type { NarrationTier } from '@/shared'
import { CAPABILITIES_EL_FREE, CAPABILITIES_EL_PRO } from '../fixtures'
import { TierToggle } from './TierToggle'

const meta = {
    title: 'Voices/TierToggle',
    component: TierToggle,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Standard or Expressive for a preview in the Voice studio (R1). Only the tiers the plan allows are offered; a plan without Expressive shows nothing, or the upsell line when the host asks for it.',
            },
        },
    },
    argTypes: {
        value: { control: 'inline-radio', options: ['standard', 'expressive'] },
        showUpsell: { control: 'boolean' },
        capabilities: { control: false },
        onChange: { control: false },
        className: { control: false },
    },
    args: {
        capabilities: CAPABILITIES_EL_PRO,
        value: 'standard',
        onChange: fn(),
    },
} satisfies Meta<typeof TierToggle>

export default meta
type Story = StoryObj<typeof meta>

function Interactive() {
    const [tier, setTier] = useState<NarrationTier>('expressive')
    return <TierToggle capabilities={CAPABILITIES_EL_PRO} value={tier} onChange={setTier} />
}

export const Playground: Story = {}

/** Switch tiers: Expressive adds its description. */
export const Interactively: Story = {
    parameters: { controls: { disable: true } },
    render: () => <Interactive />,
}

/** A plan with Standard only: the upsell line instead of the toggle. */
export const StandardOnlyPlan: Story = {
    args: { capabilities: CAPABILITIES_EL_FREE, showUpsell: true },
}

