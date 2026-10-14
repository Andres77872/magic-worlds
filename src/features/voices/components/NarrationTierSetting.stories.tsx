import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { NarrationTierSettingView } from './NarrationTierSetting'

const meta = {
    title: 'Voices/NarrationTierSetting',
    component: NarrationTierSettingView,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'The account narration tier: Expressive on or off, shown to every signed-in account; locked with the plan hint when the plan offers Standard only. The connected `NarrationTierSetting` renders nothing when the capabilities read fails.',
            },
        },
    },
    argTypes: {
        tier: { control: 'inline-radio', options: ['standard', 'expressive'] },
        locked: { control: 'boolean' },
        saving: { control: 'boolean' },
        error: { control: 'text' },
    },
    args: {
        tier: 'standard',
        locked: false,
        saving: false,
        error: null,
        onChange: fn(),
    },
    decorators: [(Story) => <div className="max-w-md"><Story /></div>],
} satisfies Meta<typeof NarrationTierSettingView>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const States: Story = {
    parameters: { controls: { disable: true } },
    render: (args) => (
        <div className="flex flex-col gap-4">
            <NarrationTierSettingView {...args} tier="standard" />
            <NarrationTierSettingView {...args} tier="expressive" />
            <NarrationTierSettingView {...args} tier="standard" locked />
            <NarrationTierSettingView {...args} tier="expressive" saving />
            <NarrationTierSettingView {...args} tier="standard" error="Expressive narration isn’t available for your account yet. Standard narration keeps working." />
        </div>
    ),
}
