import type { Meta, StoryObj } from '@storybook/react-vite'
import type { UserProfile } from '@/shared'
import { ProfileView } from './ProfileView'

const baseProfile: UserProfile = {
    user_hash: 'usr-4f2c9a17-8d3b-4e6a-9c21-7b5e0a1d6f84',
    username: 'Lyra',
    user_type: 'consumer',
    user_usage: 1000,
    card_counts: { character: 7, world: 3, adventure_template: 5 },
}

const meta = {
    title: 'Features/Profile',
    component: ProfileView,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Read-only account/profile view backed by `GET /user/me`: identity, role, content stats, and account details. The "Edit profile" affordance is intentionally disabled — the API exposes no profile mutations.',
            },
        },
    },
    decorators: [(Story) => <div className="bg-ink-800 text-parchment-50"><Story /></div>],
    argTypes: {
        profile: { control: false },
        onLogout: { control: false },
        onDeleteAllData: { control: false },
    },
    args: { profile: baseProfile, onLogout: () => {}, onDeleteAllData: async () => {} },
} satisfies Meta<typeof ProfileView>

export default meta
type Story = StoryObj<typeof meta>

export const Adventurer: Story = {}

export const Admin: Story = {
    args: {
        profile: { ...baseProfile, username: 'Magister Vane', user_type: 'admin' },
    },
}

export const Root: Story = {
    args: {
        profile: { ...baseProfile, username: 'Root', user_type: 'root', user_usage: 999999 },
    },
}

export const FreshAccount: Story = {
    args: {
        profile: { ...baseProfile, username: 'Newcomer', card_counts: { character: 0, world: 0, adventure_template: 0 } },
    },
}
