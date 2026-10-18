import type { Meta, StoryObj } from '@storybook/react-vite'
import type { CharacterVoiceV2, CharacterVoiceV3 } from '@/shared/types'
import { V2_VOICE, VOICE_KEY_SELA } from '@/features/voices/fixtures'
import { Badge } from '@/ui/primitives'
import { CallSetup } from './CallSetup'

const noop = () => {}

const SELA: CharacterVoiceV2 = { ...V2_VOICE, voice_key: VOICE_KEY_SELA, voice_name: 'Sela' }
const MARISOL: CharacterVoiceV3 = {
    schema_version: 3,
    provider: 'fish_audio',
    voice_key: 'vk_0a1b2c3d4e5f60718293a4b5c6d7e8f9',
    voice_name: 'Marisol',
    settings: null,
    language_code: 'es',
}

/** The live setup hosts `LlmFeatureControl` (callbot); a stand-in keeps these stories free of the profile context. */
const MODEL = <Badge tone="arcane">Claude Haiku 5.5</Badge>
const NO_MODEL = <Badge tone="danger">Not set up</Badge>

const meta = {
    title: 'Features/Call/CallSetup',
    component: CallSetup,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'The call’s voice and conversation model, chosen in the start dialog before calling and again from “Call settings” on the end panel. A voice picked here is used for calls with this character only (the card and the chat keep their voice), and the picker lists only voices that work in calls. When the voice cannot take calls right now, the row says so and “Change voice” becomes the main action. Arcane marks the AI side: the voice and the model.',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="w-[min(560px,calc(100vw-3rem))]">
                <Story />
            </div>
        ),
    ],
    argTypes: {
        onPick: { action: 'picked' },
        model: { control: false },
        voiceUnavailable: { control: 'boolean' },
        disabled: { control: 'boolean' },
    },
    args: {
        name: 'Lyra Emberwick',
        characterVoice: V2_VOICE,
        pick: null,
        onPick: noop,
        model: MODEL,
    },
} satisfies Meta<typeof CallSetup>

export default meta
type Story = StoryObj<typeof meta>

export const CharacterVoice: Story = {
    name: 'The character’s voice',
}

export const PickedForCalls: Story = {
    name: 'A voice picked for calls',
    args: { pick: SELA },
}

export const VoiceCannotCall: Story = {
    name: 'Voice cannot take calls',
    args: { characterVoice: MARISOL, voiceUnavailable: true },
}

export const NoModel: Story = {
    name: 'No conversation model yet',
    args: { model: NO_MODEL },
}

export const NoCharacterVoice: Story = {
    name: 'No voice on the card',
    args: { characterVoice: null },
}

export const Starting: Story = {
    name: 'Starting (actions disabled)',
    args: { pick: SELA, disabled: true },
}
