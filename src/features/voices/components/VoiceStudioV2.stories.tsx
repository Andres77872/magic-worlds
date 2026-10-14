import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import type { VoicePresetRow } from '@/shared'
import {
    CAPABILITIES_EL_PLUS,
    CAPABILITIES_EL_PRO,
    PRESET_V1_GLOBAL,
    PRESET_V1_USER,
    PRESET_V1_WITH_DRAFT,
    PRESET_V2_GLOBAL,
    PRESET_V2_USER,
    REVIEW_FLAG_CARD,
    REVIEW_FLAG_PRESET,
    VOICE_KEY_MAREN,
    VOICE_KEY_SELA,
    effectiveVoice,
} from '../fixtures'
import { VoiceStoryProviders } from '../storybook/VoiceStoryProviders'
import { installVoiceStoryApi, type VoiceStoryApiOptions } from '../storybook/voiceStoryApi'
import { VoiceStudioV2 } from './VoiceStudioV2'

/** A classic preset with no conversion draft: it cannot be updated, only deleted. */
const PRESET_V1_NO_DRAFT: VoicePresetRow = {
    ...PRESET_V1_USER,
    preset_id: 'user-old-bard',
    name: 'Old bard',
    description: 'Sings the tavern ballads.',
    conversion_draft: null,
    conversion_flags: [],
}

/**
 * Classic presets as every signed-in reader gets them: each carries its projection, and
 * its card names that voice, never the legacy one it was saved with (AC-S1, D35).
 */
const PRESET_V1_PLAYED: VoicePresetRow = { ...PRESET_V1_WITH_DRAFT, effective_voice: effectiveVoice({ voice_key: VOICE_KEY_SELA, display_name: 'Sela' }) }
const PRESET_V1_GLOBAL_PLAYED: VoicePresetRow = { ...PRESET_V1_GLOBAL, effective_voice: effectiveVoice({ voice_key: VOICE_KEY_MAREN, display_name: 'Maren' }) }

const STUDIO_API: VoiceStoryApiOptions = {
    capabilities: CAPABILITIES_EL_PLUS,
    presets: [PRESET_V2_USER, PRESET_V1_PLAYED, PRESET_V1_NO_DRAFT, PRESET_V2_GLOBAL, PRESET_V1_GLOBAL_PLAYED],
    reviewFlags: [REVIEW_FLAG_PRESET, REVIEW_FLAG_CARD],
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
                    'The Voice studio on the new voices (R1). My presets (preview, edit, delete; a classic preset updates through its conversion draft) and Global presets (read-only, duplicate), with the narration tier, the first-exposure notice and the account’s review flags. Every story runs against local fakes; previews do not play in Storybook.',
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

/** New, classic and global presets, two review flags and the first-exposure notice. */
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
