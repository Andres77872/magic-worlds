import { useState, type ComponentProps } from 'react'
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import type { EffectiveVoice, StoredCharacterVoice } from '@/shared'
import { voiceDisplayName } from '@/shared/voice'
import { Button } from '@/ui/primitives'
import {
    CAPABILITIES_EL_PLUS,
    EFFECTIVE_BY_REASON,
    PRESET_V2_GLOBAL,
    PRESET_V2_USER,
    V2_VOICE,
    VOICE_KEY_SELA,
    effectiveVoice,
} from '../fixtures'
import { VoiceStoryProviders } from '../storybook/VoiceStoryProviders'
import { installVoiceStoryApi, type VoiceStoryApiOptions } from '../storybook/voiceStoryApi'
import { VoicePickerDialog } from './VoicePickerDialog'

/** Presets (the account's own and a global one) and the catalog. */
const ELEVENLABS_API: VoiceStoryApiOptions = {
    capabilities: CAPABILITIES_EL_PLUS,
    presets: [PRESET_V2_USER, PRESET_V2_GLOBAL],
}

const withProviders: Decorator = function WithVoiceProviders(Story) {
    return (
        <VoiceStoryProviders>
            <Story />
        </VoiceStoryProviders>
    )
}

/** Stories render a trigger; the picker opens into its own drawer. */
function PickerDemo(props: Partial<ComponentProps<typeof VoicePickerDialog>>) {
    const [open, setOpen] = useState(false)
    const [voice, setVoice] = useState<StoredCharacterVoice | null>(props.currentVoice ?? null)
    const [effective, setEffective] = useState<EffectiveVoice | null>(props.currentEffectiveVoice ?? null)
    return (
        <div className="flex flex-col items-start gap-3">
            <p className="font-ui text-sm text-parchment-300">
                Voice: <span className="text-parchment-50">{voice ? voiceDisplayName(voice, effective) ?? 'Unnamed voice' : 'No voice'}</span>
            </p>
            <Button onClick={() => setOpen(true)}>Choose a voice</Button>
            <VoicePickerDialog
                {...props}
                open={open}
                currentVoice={voice}
                currentEffectiveVoice={effective}
                onSelect={(next) => {
                    setVoice(next)
                    setEffective(null)
                    setOpen(false)
                }}
                onClose={() => setOpen(false)}
            />
        </div>
    )
}

const meta = {
    title: 'Voices/VoicePickerDialog',
    component: VoicePickerDialog,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'The character voice picker: presets and the voice catalog. A preset is copied onto the card with its link; a catalog voice starts at the voice defaults. Every story runs against local fakes.',
            },
        },
    },
    beforeEach: (context) => installVoiceStoryApi(context.parameters.voiceApi as VoiceStoryApiOptions | undefined),
    decorators: [withProviders],
    argTypes: {
        open: { control: false },
        currentVoice: { control: false },
        currentEffectiveVoice: { control: false },
        recommendedFor: { control: false },
        language: { control: 'text' },
        onSelect: { control: false },
        onClose: { control: false },
    },
    args: {
        open: false,
        onSelect: () => {},
        onClose: () => {},
    },
} satisfies Meta<typeof VoicePickerDialog>

export default meta
type Story = StoryObj<typeof meta>

/** A removed voice that now plays as a replacement, with its badges. */
export const ElevenLabs: Story = {
    parameters: { voiceApi: ELEVENLABS_API },
    args: { currentVoice: V2_VOICE, currentEffectiveVoice: EFFECTIVE_BY_REASON.voice_removed },
    render: (args) => <PickerDemo {...args} />,
}

/**
 * The current voice is leaving the catalog: the current-voice row offers a
 * sample and "Switch to Maren" (its catalog replacement), which keeps the
 * tuned settings and emotion.
 */
export const ElevenLabsLeavingVoice: Story = {
    parameters: { voiceApi: ELEVENLABS_API },
    args: {
        currentVoice: { ...V2_VOICE, voice_key: VOICE_KEY_SELA, voice_name: 'Sela', emotion: 'calm' },
        currentEffectiveVoice: effectiveVoice({ voice_key: VOICE_KEY_SELA, display_name: 'Sela', badges: ['leaving'] }),
    },
    render: (args) => <PickerDemo {...args} />,
}

/** The current voice needs re-selection: "Choose a voice" opens the catalog, "Keep for now" closes the prompt. */
export const ElevenLabsNeedsReselect: Story = {
    parameters: { voiceApi: ELEVENLABS_API },
    args: {
        currentVoice: { ...V2_VOICE, preset_id: PRESET_V2_USER.preset_id, preset_name: PRESET_V2_USER.name },
        currentEffectiveVoice: effectiveVoice({ badges: ['needs_reselect'] }),
    },
    render: (args) => <PickerDemo {...args} />,
}
