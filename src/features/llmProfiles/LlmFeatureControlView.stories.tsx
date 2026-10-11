import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { LlmSelection } from '@/shared/types/llm.types'
import { LlmFeatureControlView } from './LlmFeatureControlView'
import { applicationEffective, applicationProfile, personalEffective, personalProfile } from './llmFeatureFixtures'

const meta = {
    title: 'Creation/Models/Profile selection', component: LlmFeatureControlView, tags: ['autodocs'],
    parameters: { layout: 'padded', docs: { description: { component: 'A compact model chip that fits a composer toolbar. Its popover shows effective model roles, profile inheritance and payer, and the profile choice. Credentials never enter its props.' } } },
    decorators: [Story => <div className="max-w-lg"><Story /></div>],
    argTypes: { feature: { control: 'inline-radio', options: ['card_generation', 'novel', 'chat_group', 'image_prompt'] },
        effective: { control: false }, selection: { control: false }, choices: { control: false },
        onOpen: { control: false }, onSelect: { control: false }, onMore: { control: false }, onRefresh: { control: false }, onForget: { control: false } },
    args: { feature: 'novel', selection: { mode: 'inherit' }, effective: applicationEffective, editable: true, defaultOpen: true,
        choices: [{ profile: applicationProfile, compatible: true }, { profile: personalProfile, compatible: true }],
        onOpen: () => {}, onSelect: () => {}, onMore: () => {}, onRefresh: () => {}, onForget: () => {} },
} satisfies Meta<typeof LlmFeatureControlView>
export default meta
type Story = StoryObj<typeof meta>

export const Inherited: Story = {}
export const PersonalKeyRequired: Story = { args: { effective: personalEffective, selection: { mode: 'profile', profile_id: personalProfile.profile_id } } }
export const PersonalKeyAvailable: Story = { args: { ...PersonalKeyRequired.args, keyAvailable: true } }
export const ApplicationWriter: Story = { args: { feature: 'image_prompt', editable: false } }
export const Unavailable: Story = { args: { effective: null, error: 'The profile could not be verified. Refresh before trying another selection.' } }
export const Loading: Story = { args: { effective: null, loading: true } }
export const Incompatible: Story = { args: { choicesOpen: true, more: true, choices: [
    { profile: applicationProfile, compatible: true }, { profile: personalProfile, compatible: false },
] } }
export const ChooseProfile: Story = {
    render: function Choose(args) {
        const [selection, select] = useState<LlmSelection>({ mode: 'inherit' })
        const [open, setOpen] = useState(false)
        return <LlmFeatureControlView {...args} selection={selection} choicesOpen={open}
            effective={selection.mode === 'inherit' || selection.profile_id === applicationProfile.profile_id ? applicationEffective : personalEffective}
            onOpen={() => setOpen(value => !value)} onSelect={select} />
    },
}
