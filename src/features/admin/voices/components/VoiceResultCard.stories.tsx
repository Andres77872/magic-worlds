import type { Meta, StoryObj } from '@storybook/react-vite'
import { VoiceResultCard } from './VoiceResultCard'

const SILENT_WAV =
    'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='

const meta = {
    title: 'Admin/Voices/VoiceResultCard',
    component: VoiceResultCard,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component:
                    'Shared result surface for a designed / cloned / tested voice: a tone-coded badge, a copyable voice id, an ephemeral clip player, an optional metadata line, an optional amber caveat, and a Send-to-lab action.',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="w-[460px] rounded-xl border border-parchment-50/10 bg-ink-800 p-4">
                <Story />
            </div>
        ),
    ],
    args: {
        onSendToLab: () => undefined,
    },
} satisfies Meta<typeof VoiceResultCard>

export default meta
type Story = StoryObj<typeof meta>

export const Designed: Story = {
    args: {
        tone: 'arcane',
        badgeLabel: 'Designed voice',
        voiceId: 'ttv-voice-2026061712001234-ab12cd34',
        audioSrc: SILENT_WAV,
        audioTitle: 'designed preview',
    },
}

export const TestResult: Story = {
    args: {
        tone: 'ember',
        badgeLabel: 'Test result',
        voiceId: 'English_expressive_narrator',
        audioSrc: SILENT_WAV,
        audioTitle: 'voice test',
        durationMs: 2100,
        metaLine: '2.1s · 32 kHz · 128 kbps · 54 chars',
    },
}

export const ClonedAwaitingActivation: Story = {
    args: {
        tone: 'ember',
        badgeLabel: 'Cloned voice',
        voiceId: 'MyClonedVoice01',
        audioSrc: null,
        caveat: 'Cloned voices appear in the library only after their first synthesis. Send this voice to the lab and run a test to activate it.',
    },
}
