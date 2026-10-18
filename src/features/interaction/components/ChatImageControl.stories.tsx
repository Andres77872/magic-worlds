import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { gptProfile, kreaProfile, personalProfile } from '@/features/imageProfiles/imageProfileFixtures'
import { ChatImageControl } from './ChatImageControl'

const meta = {
    title: 'Interaction/ChatImageControl', component: ChatImageControl, tags: ['autodocs'],
    parameters: { layout: 'padded', docs: { description: { component: 'The composer’s scene image control: an ember toggle for images in the next turns of this chat and, while on, a compact model chip. App profiles show their credit cost; a personal profile runs on the player’s own key, asked for when it is picked without one.' } } },
    decorators: [Story => <div className="flex max-w-lg items-center gap-1 rounded-xl border border-parchment-50/[.13] bg-ink-700 p-2"><Story /></div>],
    argTypes: {
        enabled: { control: 'boolean' }, loading: { control: 'boolean' }, failed: { control: 'boolean' }, disabled: { control: 'boolean' },
        profiles: { control: false }, onToggle: { control: false }, onSelectProfile: { control: false }, onRetry: { control: false },
    },
    args: {
        enabled: true, profileId: null, profiles: [gptProfile, kreaProfile, personalProfile], defaultId: kreaProfile.profile_id,
        onToggle: () => {}, onSelectProfile: () => {}, onRetry: () => {},
    },
} satisfies Meta<typeof ChatImageControl>
export default meta
type Story = StoryObj<typeof meta>

export const DefaultModel: Story = {}
export const Off: Story = { args: { enabled: false } }
export const ChooseModel: Story = { args: { defaultOpen: true } }
export const ChosenAppModel: Story = { args: { profileId: gptProfile.profile_id, defaultOpen: true } }
export const PersonalKeyNeeded: Story = { args: { profileId: personalProfile.profile_id, defaultOpen: true } }
export const Loading: Story = { args: { profiles: [], loading: true, defaultOpen: true } }
export const LoadFailed: Story = { args: { profiles: [], failed: true, defaultOpen: true } }
export const Interactive: Story = {
    render: function Interactive(args) {
        const [enabled, setEnabled] = useState(true)
        const [profileId, setProfileId] = useState<string | null>(null)
        return <ChatImageControl {...args} enabled={enabled} profileId={profileId}
            onToggle={() => setEnabled(value => !value)} onSelectProfile={setProfileId} />
    },
}
