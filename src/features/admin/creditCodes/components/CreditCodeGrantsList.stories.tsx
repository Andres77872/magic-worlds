import type { Meta, StoryObj } from '@storybook/react-vite'
import type { CreditCodeGrant } from '@/shared'
import { CreditCodeGrantsList } from './CreditCodeGrantsList'

const baseGrant: CreditCodeGrant = {
    code_id: 1,
    label: 'Launch giveaway',
    credits: 250,
    status: 'active',
    expires_at: '2026-09-01T00:00:00Z',
    claimed_by_user_id: null,
    claimed_at: null,
    created_by_user_id: 9,
    reason: null,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
}

const grants: CreditCodeGrant[] = [
    baseGrant,
    {
        ...baseGrant,
        code_id: 2,
        label: 'Beta testers',
        credits: 500,
        status: 'claimed',
        claimed_at: '2026-06-10T12:00:00Z',
        claimed_by_user_id: 42,
    },
    {
        ...baseGrant,
        code_id: 3,
        label: 'Spring promo',
        credits: 100,
        status: 'active',
        expires_at: '2026-01-01T00:00:00Z',
        is_expired: true,
    },
    { ...baseGrant, code_id: 4, label: null, credits: 100, status: 'disabled', expires_at: null },
]

const meta = {
    title: 'Admin/CreditCodes/CreditCodeGrantsList',
    component: CreditCodeGrantsList,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Root-only list of credit code grants. Status uses the live/ember/danger/neutral badge tones (active / claimed / expired / disabled); unclaimed codes expose Edit, and only active codes expose Disable.',
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
} satisfies Meta<typeof CreditCodeGrantsList>

export default meta
type Story = StoryObj<typeof meta>

/** Active, claimed, expired, and disabled codes together. */
export const Populated: Story = {}

/** A long inventory with more pages to load. */
export const WithLoadMore: Story = { args: { hasMore: true } }

/** No codes match the current filter. */
export const Empty: Story = { args: { grants: [] } }
