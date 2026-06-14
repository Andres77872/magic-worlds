import type { Meta, StoryObj } from '@storybook/react-vite'
import { AudioDropzone } from './AudioDropzone'

const meta = {
    title: 'Admin/Voices/AudioDropzone',
    component: AudioDropzone,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component:
                    'Drag-and-drop / click file picker for the clone source audio, with a selected-file chip, busy state, and an error slot. Validation happens in the parent form.',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="w-[420px] rounded-xl border border-parchment-50/10 bg-ink-800 p-4">
                <Story />
            </div>
        ),
    ],
    args: {
        label: 'Drop a voice sample or browse',
        hint: 'MP3, M4A, or WAV · 10 seconds to 5 minutes · up to 20 MB',
        onSelect: () => undefined,
    },
} satisfies Meta<typeof AudioDropzone>

export default meta
type Story = StoryObj<typeof meta>

export const Idle: Story = {}

export const Uploading: Story = {
    args: { busy: true },
}

export const Selected: Story = {
    args: {
        selection: { name: 'narration-take-3.wav', sizeBytes: 4_812_000, durationSec: 42 },
        onClear: () => undefined,
    },
}

export const WithError: Story = {
    args: { error: 'Audio must be 10 seconds to 5 minutes long.' },
}
