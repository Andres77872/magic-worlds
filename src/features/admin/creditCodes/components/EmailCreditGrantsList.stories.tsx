import type { Meta, StoryObj } from '@storybook/react-vite'
import type { EmailCreditGrant } from '@/shared'
import { EmailCreditGrantsList } from './EmailCreditGrantsList'

const baseGrant: EmailCreditGrant = {
    grant_id: 1,
    email: 'mira@example.com',
    label: 'Closed beta',
    credits: 200,
    status: 'active',
    expires_at: null,
    claimed_by_user_id: null,
    claimed_at: null,
    created_by_user_id: 9,
    reason: null,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
}

const grants: EmailCreditGrant[] = [
    { ...baseGrant, email_delivery_status: 'sent' },
    {
        ...baseGrant,
        grant_id: 2,
        email: 'soren@example.com',
        status: 'claimed',
        claimed_at: '2026-06-12T09:30:00Z',
        claimed_by_user_id: 77,
    },
    {
        ...baseGrant,
        grant_id: 3,
        email: 'lapsed@example.com',
        status: 'active',
        expires_at: '2026-01-01T00:00:00Z',
        is_expired: true,
    },
    { ...baseGrant, grant_id: 4, email: 'disabled@example.com', label: null, status: 'disabled' },
]

const meta = {
    title: 'Admin/CreditCodes/EmailCreditGrantsList',
    component: EmailCreditGrantsList,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Root-only list of email credit grants. Each grant is claimed by a recipient with an activated matching email. Status badges cover active / claimed / expired / disabled; unclaimed grants expose Edit and active grants expose Disable.',
            },
        },
    },
    decorators: [(Story) => <div className="w-[760px] max-w-full"><Story /></div>],
    argTypes: { grants: { control: false } },
    args: {
        grants,
        loading: false,
        mutatingId: null,
        onDisable: () => undefined,
        onEdit: () => undefined,
        hasMore: false,
        loadingMore: false,
        onLoadMore: () => undefined,
    },
} satisfies Meta<typeof EmailCreditGrantsList>

export default meta
type Story = StoryObj<typeof meta>

/** Active, claimed, expired, and disabled grants together. */
export const Populated: Story = {}

/** A long inventory with more pages to load. */
export const WithLoadMore: Story = { args: { hasMore: true } }

/** No email credit grants match the current filter. */
export const Empty: Story = { args: { grants: [] } }
