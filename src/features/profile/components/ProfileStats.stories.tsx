import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProfileStats } from './ProfileStats'
import { baseProfile } from './ProfileView.stories'

const meta = {
    title: 'Features/Profile/ProfileStats',
    component: ProfileStats,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Compact content-stat strip for the identity header — character, world, item, adventure and credit counts as open inline metrics so the always-visible header stays dense.',
            },
        },
    },
    argTypes: { profile: { control: false } },
    args: { profile: baseProfile },
} satisfies Meta<typeof ProfileStats>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** A brand-new account — every counter at zero. */
export const FreshAccount: Story = {
    args: {
        profile: {
            ...baseProfile,
            membership: { ...baseProfile.membership, total_available_credits: 0 },
            card_counts: { character: 0, world: 0, item: 0, adventure_template: 0 },
        },
    },
}
