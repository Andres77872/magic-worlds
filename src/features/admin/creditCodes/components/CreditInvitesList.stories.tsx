import type { Meta, StoryObj } from '@storybook/react-vite'
import type { FreeCreditInvite } from '@/shared'
import { CreditInvitesList } from './CreditInvitesList'

const baseInvite: FreeCreditInvite = {
    invite_id: 1,
    email: 'mira@example.com',
    label: 'Closed beta',
    credits: 200,
    status: 'active',
    expires_at: null,
    redeemed_by_user_id: null,
    redeemed_at: null,
    created_by_user_id: 9,
    reason: null,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
}

const invites: FreeCreditInvite[] = [
    baseInvite,
    {
        ...baseInvite,
        invite_id: 2,
        email: 'soren@example.com',
        status: 'redeemed',
        redeemed_at: '2026-06-12T09:30:00Z',
        redeemed_by_user_id: 77,
    },
    { ...baseInvite, invite_id: 3, email: 'disabled@example.com', label: null, status: 'disabled' },
]

const meta = {
    title: 'Admin/CreditCodes/CreditInvitesList',
    component: CreditInvitesList,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Root-only list of email-invite credit grants. Each grant is auto-redeemed when its recipient next signs in; active grants can be disabled.',
            },
        },
    },
    decorators: [(Story) => <div className="w-[760px] max-w-full"><Story /></div>],
    argTypes: { invites: { control: false } },
    args: { invites, loading: false, disablingId: null, onDisable: () => undefined },
} satisfies Meta<typeof CreditInvitesList>

export default meta
type Story = StoryObj<typeof meta>

/** Active, redeemed, and disabled invites together. */
export const Populated: Story = {}

/** No invites issued yet. */
export const Empty: Story = { args: { invites: [] } }
