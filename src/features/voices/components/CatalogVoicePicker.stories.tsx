import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn, userEvent, within } from 'storybook/test'
import { i18n } from '@/app/i18n'
import { TEST_WORKSPACE_ID } from '@/shared/hooks/testing/workspaceTestUtils'
import { CATALOG_ELDRIN, CATALOG_IDRIS_ES_UNACCEPTED, CATALOG_PAGE, CATALOG_TOBIAS_LOCKED, VOICE_KEY_SELA, catalogVoice } from '../fixtures'
import { installVoiceStoryApi, type VoiceStoryApiOptions } from '../storybook/voiceStoryApi'
import { CatalogVoicePicker } from './CatalogVoicePicker'
import { CAPABILITIES_FISH, CATALOG_FISH } from '../fishFixtures'

const LOCKED_PAGE = [
    CATALOG_TOBIAS_LOCKED,
    catalogVoice({
        voice_key: 'vk_7777eeee8888ffff9999aaaabbbbcccc',
        display_name: 'Ysolde',
        description: 'A court herald with a voice like brass.',
        gender: 'female',
        locked: true,
        min_plan: 'pro',
    }),
]

const voiceApi = (options: VoiceStoryApiOptions) => ({ voiceApi: options })

const meta = {
    title: 'Voices/CatalogVoicePicker',
    component: CatalogVoicePicker,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'The new voice catalog as a picker (R1): search, language and tag filters, a paged list with "Load more", free samples and "Use". Shared by the voice picker and the preset editor. Every story runs against local fakes; samples do not play in Storybook.',
            },
        },
    },
    beforeEach: (context) => installVoiceStoryApi(context.parameters.voiceApi as VoiceStoryApiOptions | undefined),
    decorators: [(Story) => <div className="max-w-2xl"><Story /></div>],
    argTypes: {
        language: { control: 'text' },
        currentVoiceKey: { control: 'text' },
        pickLabel: { control: 'text' },
        enabled: { control: 'boolean' },
        recommendedFor: { control: false },
        onPick: { control: false },
    },
    args: {
        onPick: fn(),
    },
} satisfies Meta<typeof CatalogVoicePicker>

export default meta
type Story = StoryObj<typeof meta>

/** A house voice, a locked voice, a leaving voice and two everyday voices. */
export const Default: Story = {}

/** The search is debounced; any filter change starts a new list. */
export const Filtered: Story = {
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement)
        await userEvent.type(await canvas.findByRole('searchbox', { name: i18n.t('voices.catalog.search') }), 'harbour')
    },
}

/** Voices above the reader’s plan: a lock and the plan that unlocks them, no "Use". */
export const Locked: Story = {
    parameters: voiceApi({ catalog: LOCKED_PAGE }),
}

/** The current voice is leaving the catalog: its date and its replacement are shown. */
export const LeavingCurrent: Story = {
    args: { currentVoiceKey: VOICE_KEY_SELA },
}

/**
 * Each language lists the tiers it was accepted on: Eldrin is tuned for
 * Standard and Expressive in English, Standard in Spanish. Idris lists Spanish
 * without an acceptance pass, so it shows no tier and, in a Spanish story,
 * "Not tested in Spanish".
 */
export const TierChips: Story = {
    args: { language: 'es' },
    parameters: voiceApi({ catalog: [CATALOG_ELDRIN, CATALOG_IDRIS_ES_UNACCEPTED] }),
}

/** A Japanese story: voices not tested in Japanese say so. */
export const NotTestedLanguage: Story = {
    args: { language: 'ja' },
}

/** A saved character: "Recommended for this character" is offered. */
export const Recommended: Story = {
    args: { recommendedFor: { cardId: 'card-1', workspaceId: TEST_WORKSPACE_ID } },
}

export const Empty: Story = {
    parameters: voiceApi({ catalog: [] }),
}

export const Loading: Story = {
    parameters: voiceApi({ catalog: 'loading' }),
}

/** The catalog answers 404: the picker shows its unavailable state (there is no other list to fall back to). */
export const Unavailable: Story = {
    parameters: voiceApi({ catalog: 'unavailable' }),
}

/** Two voices per page: "Load more" appends the next page. */
export const LoadMore: Story = {
    parameters: voiceApi({ catalog: CATALOG_PAGE, catalogPageSize: 2 }),
}

/** Fish shares the picker and explicitly identifies the narration-only profile. */
export const FishAudio: Story = {
    parameters: voiceApi({ catalog: [CATALOG_FISH, CATALOG_ELDRIN], capabilities: CAPABILITIES_FISH }),
}
