import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProviderCostView } from './ProviderCostByPayer'
import { providerUsage } from '../membership.fixtures'

const meta = {
    title: 'Admin/Membership/ProviderCostByPayer',
    component: ProviderCostView,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Usage tab of the Membership & plans console: provider cost estimates for this project, split by payer. Platform estimates are the app\'s cost; BYOK (arcane) is billed to each member\'s own provider account; historical requests have no known payer. Unpriced calls read as unknown, never zero, and nothing here is app credits.',
            },
        },
    },
    decorators: [(Story) => <div className="w-[1100px] max-w-full"><Story /></div>],
    argTypes: { state: { control: false } },
    args: { state: { status: 'ready', usage: providerUsage } },
} satisfies Meta<typeof ProviderCostView>

export default meta
type Story = StoryObj<typeof meta>

/** A month with platform, BYOK and historical requests. */
export const Populated: Story = {}

/** Waiting for the provider estimates. */
export const Loading: Story = { args: { state: { status: 'loading' } } }

/** The estimates could not be loaded; nothing is shown as zero. */
export const Unavailable: Story = { args: { state: { status: 'unavailable' } } }
