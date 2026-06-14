import type { Meta, StoryObj } from '@storybook/react-vite'
import type { AdminVoiceEntry } from '@/shared'
import { SystemVoiceBrowser } from './SystemVoiceBrowser'

function sys(voice_id: string, voice_name: string, description: string): AdminVoiceEntry {
    return { voice_id, voice_type: 'system', voice_name, description: [description], created_time: '2025-01-01', deletable: false }
}

const voices: AdminVoiceEntry[] = [
    ...Array.from({ length: 14 }, (_, i) =>
        sys(`English_voice_${i + 1}`, `English Voice ${i + 1}`, 'A warm English narrator voice.'),
    ),
    ...Array.from({ length: 9 }, (_, i) =>
        sys(`Chinese (Mandarin)_voice_${i + 1}`, `Mandarin Voice ${i + 1}`, 'A clear Mandarin voice.'),
    ),
    ...Array.from({ length: 4 }, (_, i) => sys(`Japanese_voice_${i + 1}`, `Japanese Voice ${i + 1}`, 'A calm Japanese voice.')),
    sys('presenter_male', 'Presenter Male', 'A legacy presenter voice.'),
]

const meta = {
    title: 'Admin/Voices/SystemVoiceBrowser',
    component: SystemVoiceBrowser,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component:
                    'Browsable view of the (large) MiniMax system-voice inventory: live search, a language filter derived from the voice ids, and client-side pagination so only one page renders.',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="w-[620px] rounded-xl border border-parchment-50/10 bg-ink-800 p-5">
                <Story />
            </div>
        ),
    ],
    args: {
        voices,
        loading: false,
        deletingVoiceId: null,
        onTest: () => undefined,
        onDelete: () => undefined,
    },
} satisfies Meta<typeof SystemVoiceBrowser>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = {
    args: { voices: [] },
}
