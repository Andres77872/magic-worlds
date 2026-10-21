import type { Meta, StoryObj } from '@storybook/react-vite'
import type { CharacterVoiceV2, CharacterVoiceV3 } from '@/shared/types'
import type { EffectiveLlmProfile } from '@/shared/types/llmProfile.types'
import { V2_VOICE, VOICE_KEY_SELA } from '@/features/voices/fixtures'
import { LlmFeatureControlView, type LlmFeatureControlViewProps } from '@/features/llmProfiles/LlmFeatureControlView'
import { applicationEffective, applicationProfile } from '@/features/llmProfiles/llmFeatureFixtures'
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

const CALL_MODEL: EffectiveLlmProfile = {
    ...applicationEffective,
    roles: { primary: { ...applicationEffective.roles.primary, provider_model_id: 'anthropic/claude-haiku-5.5' } },
}

/** The live setup hosts `LlmFeatureControl` (callbot, setting row); its view keeps these stories free of the profile context. */
function modelRow(props: Partial<LlmFeatureControlViewProps> = {}) {
    return (
        <LlmFeatureControlView variant="setting" feature="callbot" selection={{ mode: 'inherit' }} effective={CALL_MODEL} editable
            onOpen={noop} onSelect={noop} onMore={noop} onRefresh={noop} onForget={noop} {...props} />
    )
}
const MODEL = modelRow()

const meta = {
    title: 'Features/Call/CallSetup',
    component: CallSetup,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'The call’s voice and conversation model, chosen in the start dialog before calling and again from “Call settings” on the end panel. Each is a setting row: the value beside one action, with what it means underneath (the action wraps under the value when the dialog is narrow). A voice picked here is used for calls with this character only (the card and the chat keep their voice), and the picker lists only voices that work in calls. When the voice cannot take calls right now, the row says so and “Change voice” becomes the main action. The model row names the response model and where it comes from; “Change model” opens the compatible app profiles for new calls in this tab. Arcane marks the AI side: the voice and the model.',
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

export const ModelChosenForCalls: Story = {
    name: 'A model chosen for calls',
    args: {
        model: modelRow({
            selection: { mode: 'profile', profile_id: applicationProfile.profile_id },
            effective: { ...CALL_MODEL, resolution_source: 'explicit' },
            choices: [{ profile: { ...applicationProfile, name: 'Quick-witted companion' }, compatible: true }],
        }),
    },
}

export const NoModel: Story = {
    name: 'No conversation model yet',
    args: { model: modelRow({ effective: null, unassigned: true }) },
}

export const NoModelRoot: Story = {
    name: 'No conversation model yet (root assigns)',
    args: { model: modelRow({ effective: null, unassigned: true, canAssign: true, choicesOpen: true, choices: [{ profile: applicationProfile, compatible: true }] }) },
}

export const ModelUnavailable: Story = {
    name: 'Model could not be verified',
    args: { model: modelRow({ effective: null, error: 'The profile could not be verified. Refresh before trying another selection.' }) },
}

export const NoCharacterVoice: Story = {
    name: 'No voice on the card',
    args: { characterVoice: null },
}

export const Starting: Story = {
    name: 'Starting (actions disabled)',
    args: { pick: SELA, disabled: true, model: modelRow({ disabled: true }) },
}
