import { useState, type ComponentProps } from 'react'
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import type { VoicePresetV2 } from '@/shared'
import { Button } from '@/ui/primitives'
import { CAPABILITIES_EL_PLUS, PRESET_V2_GLOBAL, PRESET_V2_USER, VOICE_KEY_TOBIAS } from '../fixtures'
import { VoiceStoryProviders } from '../storybook/VoiceStoryProviders'
import { installVoiceStoryApi, type VoiceStoryApiOptions } from '../storybook/voiceStoryApi'
import { VoicePickerElevenLabs } from './VoicePickerElevenLabs'

/** A tuned preset on Tobias, a voice this Plus reader's plan does not include. */
const LOCKED_PRESET: VoicePresetV2 = {
    ...PRESET_V2_USER,
    preset_id: 'user-locked',
    name: 'Harbour bellow',
    description: 'A gravel-voiced harbour master.',
    voice_key: VOICE_KEY_TOBIAS,
    voice_name: 'Tobias',
}

/**
 * A Plus reader with 6 previews left today and none of them free: a tuned
 * preset reads "Preview · 1 credit", the untuned "Fireside narrator" is the
 * voice's free sample, and the locked preset cannot be picked.
 */
const PAST_FREE_API: VoiceStoryApiOptions = {
    capabilities: CAPABILITIES_EL_PLUS,
    presets: [PRESET_V2_USER, PRESET_V2_GLOBAL, LOCKED_PRESET],
    membership: { plan_code: 'plus', previews_left: 6, limits: { voice_preview: { daily_limit: 10 } } },
}

const withProviders: Decorator = function WithVoiceProviders(Story) {
    return (
        <VoiceStoryProviders>
            <Story />
        </VoiceStoryProviders>
    )
}

/** Stories render a trigger; the picker opens into its own drawer. */
function PickerDemo(props: ComponentProps<typeof VoicePickerElevenLabs>) {
    const [open, setOpen] = useState(false)
    return (
        <div className="flex flex-col items-start gap-3">
            <Button onClick={() => setOpen(true)}>Choose a voice</Button>
            <VoicePickerElevenLabs {...props} open={open} onClose={() => setOpen(false)} />
        </div>
    )
}

const meta = {
    title: 'Voices/VoicePickerElevenLabs',
    component: VoicePickerElevenLabs,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'The character voice picker: presets and the voice catalog. Past the free renders a tuned preset’s preview costs a credit and the first one asks once; an untuned preset plays the voice’s free sample; a locked voice stays reachable but cannot be picked. Every story runs against local fakes; previews do not render in Storybook.',
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
        capabilities: { control: false },
        language: { control: 'text' },
        onSelect: { control: false },
        onClose: { control: false },
    },
    args: {
        open: false,
        capabilities: CAPABILITIES_EL_PLUS,
        onSelect: fn(),
        onClose: fn(),
    },
} satisfies Meta<typeof VoicePickerElevenLabs>

export default meta
type Story = StoryObj<typeof meta>

/** Credit previews, a free sample and a locked preset in one list. */
export const PresetPreviewsPastFreeAllowance: Story = {
    parameters: { voiceApi: PAST_FREE_API },
    render: (args) => <PickerDemo {...args} />,
}
