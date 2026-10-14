import type { Meta, StoryObj } from '@storybook/react-vite'
import { CallVoiceNote } from './CallVoiceNote'

const meta = {
    title: 'Call/CallVoiceNote',
    component: CallVoiceNote,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component:
                    'The call header voice note (R1), shown next to the always-present "AI voice" badge when the call does not speak with the card’s own voice: a call-ready stand-in, or a replacement. A call with the card’s own voice shows none.',
            },
        },
    },
    args: {
        note: { kind: 'call_voice', name: 'Ava' },
    },
} satisfies Meta<typeof CallVoiceNote>

export default meta
type Story = StoryObj<typeof meta>

export const CallVoice: Story = {}

export const Replaced: Story = {
    args: { note: { kind: 'replaced', name: 'Ava', original: 'Mia' } },
}

export const ReplacedWithoutNames: Story = {
    args: { note: { kind: 'replaced', name: null, original: null } },
}
