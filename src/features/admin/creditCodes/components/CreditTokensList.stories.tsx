import type { Meta, StoryObj } from '@storybook/react-vite'
import type { FreeCreditToken } from '@/shared'
import { CreditTokensList } from './CreditTokensList'

const baseToken: FreeCreditToken = {
    token_id: 1,
    label: 'Launch giveaway',
    credits: 250,
    status: 'active',
    expires_at: '2026-09-01T00:00:00Z',
    redeemed_by_user_id: null,
    redeemed_at: null,
    created_by_user_id: 9,
    reason: null,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
}

const tokens: FreeCreditToken[] = [
    baseToken,
    {
        ...baseToken,
        token_id: 2,
        label: 'Beta testers',
        credits: 500,
        status: 'redeemed',
        redeemed_at: '2026-06-10T12:00:00Z',
        redeemed_by_user_id: 42,
    },
    { ...baseToken, token_id: 3, label: null, credits: 100, status: 'disabled', expires_at: null },
]

const meta = {
    title: 'Admin/CreditCodes/CreditTokensList',
    component: CreditTokensList,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Root-only list of redeem codes (free-credit tokens). Status uses the live/ember/neutral badge tones; only active codes expose a Disable action.',
            },
        },
    },
    decorators: [(Story) => <div className="w-[760px] max-w-full"><Story /></div>],
    argTypes: { tokens: { control: false } },
    args: { tokens, loading: false, disablingId: null, onDisable: () => undefined },
} satisfies Meta<typeof CreditTokensList>

export default meta
type Story = StoryObj<typeof meta>

/** Active, redeemed, and disabled codes together. */
export const Populated: Story = {}

/** No codes issued yet. */
export const Empty: Story = { args: { tokens: [] } }
