import type { Meta, StoryObj } from '@storybook/react-vite'
import { VoiceClipPlayer } from './VoiceClipPlayer'

// Tiny silent WAV keeps the control interactive without a backend.
const SILENT_WAV =
    'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='

const meta = {
    title: 'Components/Audio/VoiceClipPlayer',
    component: VoiceClipPlayer,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component:
                    'The Reverie play bar for EPHEMERAL audio (voice-studio previews/tests). Same look as AudioWavePlayer but it owns its own <audio> element instead of joining the global playlist, so throwaway blob previews never leak into the dock. Still claims app-wide audio focus.',
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
        src: { control: false },
        title: { control: 'text' },
        durationMs: { control: 'number' },
    },
    args: {
        src: SILENT_WAV,
        title: 'designed preview',
        durationMs: 8000,
    },
} satisfies Meta<typeof VoiceClipPlayer>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** A longer clip with a different pseudo-waveform (seeded by src). */
export const WithMetadata: Story = {
    args: { title: 'voice test', durationMs: 42_000 },
}
