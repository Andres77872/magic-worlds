import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProfileIdentityCard } from './ProfileIdentityCard'
import { baseProfile } from './ProfileView.stories'

const meta = {
    title: 'Features/Profile/ProfileIdentityCard',
    component: ProfileIdentityCard,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'The always-visible profile identity header: avatar, inline display-name editor (which owns the page <h1>), role badge, `@username`, the copyable user hash, the content-stat pills, and the log-out action.',
            },
        },
    },
    decorators: [(Story) => <div className="w-[820px] max-w-full"><Story /></div>],
    argTypes: {
        profile: { control: false },
        onDisplayNameUpdated: { control: false },
        onRequestLogout: { action: 'logout requested' },
    },
    args: { profile: baseProfile, onRequestLogout: () => {} },
} satisfies Meta<typeof ProfileIdentityCard>

export default meta
type Story = StoryObj<typeof meta>

/** Adventurer with no display name — the heading falls back to the username. */
export const Default: Story = {}

/** A chosen display name shown above `@username`. */
export const WithDisplayName: Story = {
    args: { profile: { ...baseProfile, display_name: 'The Loremaster' } },
}

/** Elevated role — the badge switches to the arcane accent. */
export const Admin: Story = {
    args: { profile: { ...baseProfile, username: 'Magister Vane', user_type: 'admin' } },
}
