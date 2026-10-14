import type { Meta, StoryObj } from '@storybook/react-vite'
import { UsageMeter } from './UsageMeter'

const meta = {
    title: 'Admin/Voices/UsageMeter',
    component: UsageMeter,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component:
                    'Labelled meter for provider limits (slots, voice operations, characters, daily budget). The value is always shown as text; the alert tone marks a threshold that needs root attention.',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="w-[360px] rounded-xl border border-parchment-50/10 bg-ink-800 p-4">
                <Story />
            </div>
        ),
    ],
    argTypes: {
        alert: { control: 'boolean' },
    },
    args: {
        label: 'Custom voice slots',
        valueText: '48 / 660',
        value: 48,
        max: 660,
        alert: false,
    },
} satisfies Meta<typeof UsageMeter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const NearLimit: Story = {
    args: {
        label: 'Voice operations this month',
        valueText: '1,037 / 1,040',
        value: 1037,
        max: 1040,
        alert: true,
        hint: 'Fewer than 5 left: Library adds are refused.',
    },
}
