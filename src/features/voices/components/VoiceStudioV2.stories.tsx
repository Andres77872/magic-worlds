import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import type { VoicePresetV2 } from '@/shared'
import {
    CAPABILITIES_EL_PLUS,
    CAPABILITIES_EL_PRO,
    PRESET_V2_GLOBAL,
    PRESET_V2_USER,
    VOICE_KEY_SELA,
} from '../fixtures'
import { VoiceStoryProviders } from '../storybook/VoiceStoryProviders'
import { installVoiceStoryApi, type VoiceStoryApiOptions } from '../storybook/voiceStoryApi'
import { VoiceStudioV2 } from './VoiceStudioV2'

/** A preset on a leaving voice: its card offers "Switch to Maren" (05 §7.8). */
const PRESET_LEAVING: VoicePresetV2 = {
    ...PRESET_V2_USER,
    preset_id: 'user-night-ferry',
    name: 'Night ferry',
    description: 'Calls the last crossing.',
    voice_key: VOICE_KEY_SELA,
    voice_name: 'Sela',
}

const STUDIO_API: VoiceStoryApiOptions = {
    capabilities: CAPABILITIES_EL_PLUS,
    presets: [PRESET_V2_USER, PRESET_LEAVING, PRESET_V2_GLOBAL],
}

const withProviders: Decorator = function WithVoiceProviders(Story) {
    return (
        <VoiceStoryProviders>
            <div className="mx-auto max-w-5xl p-6">
                <Story />
            </div>
        </VoiceStoryProviders>
    )
}

const meta = {
    title: 'Voices/VoiceStudioV2',
    component: VoiceStudioV2,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        voiceApi: STUDIO_API,
        docs: {
            description: {
                component:
                    'The Voice studio (R1). My presets (preview, edit, delete, and the owner prompts of a leaving voice) and Global presets (read-only, duplicate), with the narration tier and the usage strip. Every story runs against local fakes; previews do not play in Storybook.',
            },
        },
    },
    beforeEach: (context) => installVoiceStoryApi(context.parameters.voiceApi as VoiceStoryApiOptions | undefined),
    decorators: [withProviders],
    argTypes: {
        capabilities: { control: false },
        onRetryCapabilities: { control: false },
    },
    args: {
        capabilities: CAPABILITIES_EL_PLUS,
        onRetryCapabilities: fn(),
    },
} satisfies Meta<typeof VoiceStudioV2>

export default meta
type Story = StoryObj<typeof meta>

/** The account's presets (one on a leaving voice) and a global preset. */
export const Default: Story = {}

/** A Pro account: previews offer Expressive. */
export const ProPlan: Story = {
    parameters: { voiceApi: { ...STUDIO_API, capabilities: CAPABILITIES_EL_PRO } },
    args: { capabilities: CAPABILITIES_EL_PRO },
}

export const Empty: Story = {
    parameters: { voiceApi: { capabilities: CAPABILITIES_EL_PLUS, presets: [] } },
}

/** Capabilities could not be read: recipes show read-only with a retry in the editor. */
export const CapabilitiesUnavailable: Story = {
    args: { capabilities: null },
}

/**
 * AC-S3 / AC-P5: the usage strip (previews, narration characters, call minutes left
 * today) and a Plus account past its 3 free renders: tuned presets read
 * "Preview · 1 credit" and the first paid render asks once per session.
 */
export const UsageAndCredits: Story = {
    parameters: {
        voiceApi: {
            ...STUDIO_API,
            membership: {
                plan_code: 'plus',
                previews_left: 6,
                limits: { voice_preview: { daily_limit: 10, used_today: 4, max_in_flight: 1, in_flight: 0, credit_cost: 1 } },
                narration_chars_used: 7_250,
                narration_chars_limit: 20_000,
                call_seconds_used: 420,
                call_seconds_limit: 1_800,
            },
        },
    },
}

/** 05 §7.7: no narration left today, so the usage strip carries the danger `daily_limit` badge. */
export const NarrationSpent: Story = {
    parameters: {
        voiceApi: {
            ...STUDIO_API,
            membership: {
                plan_code: 'plus',
                previews_left: 6,
                narration_chars_used: 20_000,
                narration_chars_limit: 20_000,
                call_seconds_used: 420,
                call_seconds_limit: 1_800,
            },
        },
    },
}
