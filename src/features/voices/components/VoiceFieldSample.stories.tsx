import type { Meta, StoryObj } from '@storybook/react-vite'
import { VOICE_KEY_MAREN } from '../fixtures'
import { VoiceStoryProviders } from '../storybook/VoiceStoryProviders'
import { VoiceFieldSample } from './VoiceFieldSample'

const meta = {
    title: 'Voices/VoiceFieldSample',
    component: VoiceFieldSample,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'The character editor’s voice-field sample (R1, AC-C7): plays the free catalog sample of the voice the card is heard as. It sits outside the editor’s read-only fieldset, so in an archived workspace the field is locked but the sample still plays (05 §7.9). Its name says the voice and, once resolved, the sample’s language; it toggles `aria-pressed` while it plays (05 §10). Here the sample read has no backend, so pressing it shows the unavailable message.',
            },
        },
    },
    decorators: [
        (Story) => (
            <VoiceStoryProviders>
                <div className="max-w-xl">
                    <Story />
                </div>
            </VoiceStoryProviders>
        ),
    ],
    argTypes: {
        voiceKey: { control: 'text' },
        name: { control: 'text' },
        language: { control: 'inline-radio', options: [null, 'en', 'es'] },
        className: { control: false },
    },
    args: {
        voiceKey: VOICE_KEY_MAREN,
        name: 'Maren',
        language: null,
    },
} satisfies Meta<typeof VoiceFieldSample>

export default meta
type Story = StoryObj<typeof meta>

/** The voice’s primary-language sample. */
export const Default: Story = {}

/** A card written in Spanish asks for the Spanish sample when the voice has one. */
export const SpanishCard: Story = {
    args: { language: 'es' },
}
