import type { Meta, StoryObj } from '@storybook/react-vite'
import type { CreditCodeGrant, EmailCreditGrant } from '@/shared'
import { EditCreditGrantDialog } from './EditCreditGrantDialog'

const codeGrant: CreditCodeGrant = {
    code_id: 12,
    label: 'Launch giveaway',
    credits: 250,
    status: 'active',
    expires_at: '2026-09-01T12:00:00Z',
    claimed_by_user_id: null,
    claimed_at: null,
    created_by_user_id: 9,
    reason: 'Community contest reward',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
}

const emailGrant: EmailCreditGrant = {
    grant_id: 5,
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

const meta = {
    title: 'Admin/CreditCodes/EditCreditGrantDialog',
    component: EditCreditGrantDialog,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component:
                    'Modal to adjust an unclaimed token (credits / label / expiry / reason) via the admin PATCH endpoints. Claimed tokens are immutable, so the console never opens this for them.',
            },
        },
    },
    args: {
        open: true,
        kind: 'code',
        grant: codeGrant,
        saving: false,
        onSave: () => undefined,
        onClose: () => undefined,
    },
} satisfies Meta<typeof EditCreditGrantDialog>

export default meta
type Story = StoryObj<typeof meta>

/** Editing a credit code. */
export const Code: Story = {}

/** Editing an email grant (subject is the address). */
export const Email: Story = { args: { kind: 'email', grant: emailGrant } }

/** Save in flight. */
export const Saving: Story = { args: { saving: true } }
