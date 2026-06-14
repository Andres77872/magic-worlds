import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Character } from '@/shared'
import { CallHistoryRow } from './CallHistoryRow'

const CHARACTERS: Character[] = [
    { id: 'c1', name: 'Mira', race: 'Elf', stats: {}, role: 'character' } as Character,
]

const meta = {
    title: 'Features/Call/CallHistoryRow',
    component: CallHistoryRow,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component: 'One past voice call in the call-history list. Opens a saved transcript; optionally offers a one-tap "Call again".',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="mx-auto w-full max-w-[640px]">
                <Story />
            </div>
        ),
    ],
    args: {
        characters: CHARACTERS,
        onView: () => {},
        onCallAgain: () => {},
    },
} satisfies Meta<typeof CallHistoryRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
    args: {
        call: {
            voice_session_id: 'vs-1',
            chat_id: 1,
            character_card_id: 'c1',
            character_name: 'Mira',
            duration_seconds: 192,
            segment_count: 8,
            started_at: '2026-06-13 18:00:00',
        },
    },
}

export const ShortCall: Story = {
    args: {
        call: {
            voice_session_id: 'vs-2',
            chat_id: 1,
            character_card_id: 'c1',
            character_name: 'Mira',
            duration_seconds: 14,
            segment_count: 1,
            started_at: '2026-06-13 12:00:00',
        },
    },
}

export const ViewOnly: Story = {
    args: {
        onCallAgain: undefined,
        call: {
            voice_session_id: 'vs-3',
            chat_id: 1,
            character_name: 'Unknown character',
            duration_seconds: 60,
            segment_count: 4,
            started_at: '2026-06-12 09:00:00',
        },
    },
}
