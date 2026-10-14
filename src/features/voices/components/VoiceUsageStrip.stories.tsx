import type { Meta, StoryObj } from '@storybook/react-vite'
import { VoiceUsageStrip } from './VoiceUsageStrip'

const meta = {
    title: 'Voices/VoiceUsageStrip',
    component: VoiceUsageStrip,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component:
                    'The Voice studio usage strip (AC-S3): previews, narration characters and call minutes left today, from the usage DTO. Each item shows only when the server reports it; call time rounds down to whole minutes. With no narration left, the danger `daily_limit` badge follows the narration item (05 §7.7).',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="w-[640px] rounded-xl border border-parchment-50/10 bg-ink-800 p-5">
                <Story />
            </div>
        ),
    ],
    args: {
        previewsLeft: 6,
        usage: {
            narration: { used: 7_250, limit: 20_000, remaining: 12_750 },
            call: { used: 420, limit: 1_800, remaining: 1_380 },
            previewsLeft: 6,
        },
    },
} satisfies Meta<typeof VoiceUsageStrip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** A server that reports only the preview allowance. */
export const PreviewsOnly: Story = {
    args: { usage: null, previewsLeft: 2 },
}

/** Everything spent for today: the narration item carries the danger `daily_limit` badge. */
export const Spent: Story = {
    args: {
        previewsLeft: 0,
        usage: {
            narration: { used: 20_000, limit: 20_000, remaining: 0 },
            call: { used: 1_800, limit: 1_800, remaining: 0 },
            previewsLeft: 0,
        },
    },
}
