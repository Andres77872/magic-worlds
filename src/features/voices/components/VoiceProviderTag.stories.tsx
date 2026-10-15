import type { Meta, StoryObj } from '@storybook/react-vite'
import { VoiceProviderTag } from './VoiceProviderTag'

const meta = {
    title: 'Voices/VoiceProviderTag',
    component: VoiceProviderTag,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component: 'A neutral tag identifying a voice’s provider across the catalog and admin details. Older rows without a provider identify ElevenLabs.',
            },
        },
    },
    argTypes: {
        provider: { control: 'inline-radio', options: ['elevenlabs', 'fish_audio'] },
    },
    args: { provider: 'elevenlabs' },
} satisfies Meta<typeof VoiceProviderTag>

export default meta
type Story = StoryObj<typeof meta>

export const ElevenLabs: Story = {}
export const FishAudio: Story = { args: { provider: 'fish_audio' } }
export const BothProviders: Story = {
    render: () => (
        <div className="flex flex-wrap gap-2">
            <VoiceProviderTag provider="elevenlabs" />
            <VoiceProviderTag provider="fish_audio" />
        </div>
    ),
}
