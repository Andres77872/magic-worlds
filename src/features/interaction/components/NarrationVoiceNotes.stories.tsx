import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import type { ChatTtsSegmentClip } from '@/shared/types'
import { NarrationVoiceNotes } from './NarrationVoiceNotes'

const clip = (segment_index: number, extra: Partial<ChatTtsSegmentClip>): ChatTtsSegmentClip => ({ segment_index, status: 'completed', ...extra })

const meta = {
    title: 'Interaction/NarrationVoiceNotes',
    component: NarrationVoiceNotes,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Voice notes next to the always-present "AI voice" label of a narrated turn (R1): "Standard voice" when Expressive was not available, and "Voice replaced" per speaker whose chosen voice could not play, with a menu to use the card’s current voice (or change the narrator voice). Turns stored without substitution fields render nothing.',
            },
        },
    },
    args: {
        clips: [clip(0, { kind: 'speech', speaker_id: 'c1', speaker_name: 'Rook', substitution_reason: 'voice_removed', voice_name: 'Ava', original_voice_name: 'Mia' })],
        onRefreshVoice: fn(async () => ({})),
        onEditNarratorVoice: fn(),
        refreshDisabled: false,
    },
    argTypes: {
        refreshDisabled: { control: 'boolean' },
    },
} satisfies Meta<typeof NarrationVoiceNotes>

export default meta
type Story = StoryObj<typeof meta>

export const Replaced: Story = {}

export const StandardFallback: Story = {
    args: { clips: [clip(0, { kind: 'narrator', substitution_reason: 'tier_fallback' })] },
}

export const ReplacedNarrator: Story = {
    args: { clips: [clip(0, { kind: 'narrator', substitution_reason: 'voice_unavailable', voice_name: 'Theo' })] },
}

export const SeveralSpeakers: Story = {
    args: {
        clips: [
            clip(0, { kind: 'narrator', substitution_reason: 'tier_fallback' }),
            clip(1, { kind: 'speech', speaker_id: 'c1', speaker_name: 'Rook', substitution_reason: 'voice_removed', voice_name: 'Ava', original_voice_name: 'Mia' }),
            clip(2, { kind: 'speech', speaker_id: 'c2', speaker_name: 'Wren', substitution_reason: 'unmapped_legacy' }),
        ],
    },
}

export const ActionsDisabled: Story = {
    args: { refreshDisabled: true },
}
