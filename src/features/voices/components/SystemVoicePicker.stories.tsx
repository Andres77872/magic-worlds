import type { Meta, StoryObj } from '@storybook/react-vite'
import type { AdminVoiceEntry } from '@/shared'
import { SystemVoicePicker } from './SystemVoicePicker'

function voice(voice_id: string, voice_name: string, description: string): AdminVoiceEntry {
    return { voice_id, voice_type: 'system', voice_name, description: [description], created_time: '1970-01-01', deletable: false }
}

const VOICES: AdminVoiceEntry[] = [
    ...Array.from({ length: 14 }, (_, i) => voice(`English_voice_${i + 1}`, `English Voice ${i + 1}`, 'A warm English voice.')),
    ...Array.from({ length: 6 }, (_, i) => voice(`Japanese_voice_${i + 1}`, `Japanese Voice ${i + 1}`, 'A calm Japanese voice.')),
    voice('presenter_male', 'Presenter Male', 'A legacy presenter voice.'),
]

const meta = {
    title: 'Voices/SystemVoicePicker',
    component: SystemVoicePicker,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component: 'Browse the MiniMax system voice catalog (search + language filter + paging) and pick a base voice. Voices are fetched by the host.',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="w-[560px] rounded-xl border border-parchment-50/10 bg-ink-800 p-5">
                <Story />
            </div>
        ),
    ],
    args: {
        voices: VOICES,
        loading: false,
        onSelect: () => undefined,
    },
} satisfies Meta<typeof SystemVoicePicker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithSelection: Story = {
    args: { selectedVoiceId: 'English_voice_1' },
}
