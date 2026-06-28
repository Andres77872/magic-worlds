import type { Meta, StoryObj } from '@storybook/react-vite'
import { CreditCodeRedemptionCard } from './CreditCodeRedemptionCard'

const meta = {
    title: 'Features/Profile/CreditCodeRedemptionCard',
    component: CreditCodeRedemptionCard,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'End-user redemption affordance in the membership area. The button opens a modal that redeems a credit code via `POST /billing/credit-codes/redeem`, then asks the profile to refresh so the wallet balance updates.',
            },
        },
    },
    decorators: [(Story) => <div className="w-[620px] max-w-full"><Story /></div>],
    argTypes: { onRedeemed: { action: 'redeemed' } },
} satisfies Meta<typeof CreditCodeRedemptionCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
