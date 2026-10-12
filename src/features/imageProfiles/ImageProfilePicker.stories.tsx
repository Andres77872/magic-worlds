import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ImageProfilePicker, type ImageProfilePickerProps } from './ImageProfilePicker'
import { gptProfile, kreaProfile, personalProfile } from './imageProfileFixtures'

function PickerDemo(props: ImageProfilePickerProps) {
    const [selectedId, setSelectedId] = useState(props.selected?.profile_id)
    return <ImageProfilePicker {...props} selected={props.profiles.find(profile => profile.profile_id === selectedId)} onSelect={setSelectedId} />
}

const meta = {
    title: 'Profile/Images/Picker',
    component: ImageProfilePicker,
    tags: ['autodocs'],
    parameters: {
        docs: { description: { component: 'The image model choice beside a portrait generator: the caller’s default is labelled, each option shows its price, and a personal profile says whether the user’s key is set for this tab.' } },
    },
    decorators: [Story => <div className="w-80"><Story /></div>],
    render: args => <PickerDemo {...args} />,
    argTypes: { profiles: { control: false }, selected: { control: false }, onSelect: { control: false }, onForgetKey: { action: 'forget key' },
        onRetry: { action: 'retry' } },
    args: {
        profiles: [kreaProfile, gptProfile, personalProfile], selected: kreaProfile, defaultId: kreaProfile.profile_id,
        loaded: true, failed: false, keyHeld: false, onSelect: () => {}, onForgetKey: () => {},
    },
} satisfies Meta<typeof ImageProfilePicker>

export default meta
type Story = StoryObj<typeof meta>

/** The app default, priced in credits. */
export const AppDefault: Story = {}
/** A personal profile whose key will be asked for on generate. */
export const PersonalKeyNeeded: Story = { args: { selected: personalProfile } }
/** A personal profile with the key already entered in this tab. */
export const PersonalKeyHeld: Story = { args: { selected: personalProfile, keyHeld: true } }
/** Nothing the user can generate with yet. */
export const NoProfiles: Story = { args: { profiles: [], selected: undefined } }
/** The list could not be loaded: the user can try again (generating also retries it first). */
export const LoadFailed: Story = { args: { failed: true, onRetry: () => {} } }
