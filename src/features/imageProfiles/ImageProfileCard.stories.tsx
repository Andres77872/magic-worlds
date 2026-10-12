import type { Meta, StoryObj } from '@storybook/react-vite'
import { ImageProfileCard } from './ImageProfileCard'
import { archivedProfile, geminiProfile, gptProfile, kreaProfile, personalProfile } from './imageProfileFixtures'

const meta = {
    title: 'Profile/Images/Profile card',
    component: ImageProfileCard,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: { description: { component: 'One image profile at a glance: catalog model and provider, price per image (credits, or the user’s own key), tuned settings, custom fields and availability. Arcane marks app profiles (platform key); ember marks personal profiles and the default.' } },
    },
    decorators: [Story => <div className="max-w-sm"><Story /></div>],
    argTypes: { profile: { control: false }, onEdit: { action: 'edit' }, onArchive: { action: 'archive' }, onMakeDefault: { action: 'make default' } },
    args: {
        profile: kreaProfile, isDefault: true, defaultLabel: 'Global default', makeDefaultLabel: 'Make global default',
        onEdit: () => {}, onArchive: () => {}, onMakeDefault: () => {},
    },
} satisfies Meta<typeof ImageProfileCard>

export default meta
type Story = StoryObj<typeof meta>

/** Root view of the global default: it cannot be archived until another profile is the default. */
export const GlobalDefault: Story = {}
/** A pricier profile with one tuned setting, offered as the next default. */
export const Tuned: Story = { args: { profile: gptProfile, isDefault: false } }
/** OpenRouter has no app key on this server, so the profile is unavailable. */
export const Unavailable: Story = { args: { profile: geminiProfile, isDefault: false } }
/** Archived profiles stay listed for root, dimmed and read-only. */
export const Archived: Story = { args: { profile: archivedProfile, isDefault: false } }
/** The user page: a personal profile on the user’s own key, chosen as their default. */
export const Personal: Story = { args: { profile: personalProfile, defaultLabel: 'Your default', makeDefaultLabel: 'Use by default' } }
/** The user page: an app profile is read-only, it can only become the user’s default. */
export const AppProfileForUser: Story = { args: { profile: gptProfile, isDefault: false, makeDefaultLabel: 'Use by default', onEdit: undefined, onArchive: undefined } }
