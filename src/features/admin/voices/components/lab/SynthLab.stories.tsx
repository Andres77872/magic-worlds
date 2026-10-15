import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { i18n } from '@/app/i18n'
import { installPlayAdminAuditApi } from '@/features/admin/playAdminAuditFixtures'
import { ApiError, apiService } from '@/infrastructure/api'
import type { AdminLabModel, AdminLabSynthesisResult } from '@/shared'
import { SILENT_WAV, readyVoice } from '../../fixtures'
import { VoiceConsoleProvider } from '../shell/VoiceConsoleContext'
import { SynthLab } from './SynthLab'

type ModelList = 'absent' | 'listed'
type RenderOutcome = 'plays' | 'refused'

/** The A4 model list (05 §8.2): v4 with extra formats and normalization. */
const LISTED_MODELS: AdminLabModel[] = [
    {
        model_alias: 'el_v4',
        label: 'Eleven v4',
        tier: 'standard',
        available: true,
        unavailable_reason: null,
        max_chars: 3000,
        output_formats: ['mp3_44100_128', 'wav_44100', 'pcm_24000'],
        text_normalization: ['auto', 'on', 'off'],
        supports_language_code: true,
        supports_seed: false,
        audio_tags: true,
        breaks: false,
        inline_ipa: true,
        settings: ['stability', 'similarity_boost'],
    },

]

/** A silent WAV render, so results play without any network request. */
function silentRender(requestId: string): AdminLabSynthesisResult {
    const base64 = SILENT_WAV.slice(SILENT_WAV.indexOf(',') + 1)
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
    return { blob: new Blob([bytes], { type: 'audio/wav' }), content_type: 'audio/wav', request_id: requestId, character_cost: 112 }
}

function installLabApi(modelList: ModelList, outcome: RenderOutcome) {
    const restore = installPlayAdminAuditApi('populated')
    let renders = 0
    // The audit fakes answer the catalog and refuse the model list (404: the R0 lab); these replace the lab calls.
    Object.assign(apiService as unknown as Record<string, unknown>, {
        listAdminLabModels: async () => {
            if (modelList === 'absent') throw new ApiError(404, 'Not Found')
            return { models: LISTED_MODELS }
        },
        testAdminVoice: async () => {
            if (outcome === 'refused') throw new ApiError(422, 'Too long', { code: 'text_over_model_limit', details: { max_chars: 80 } })
            renders += 1
            return silentRender(`req-story-${renders}`)
        },
    })
    return restore
}

/** `modelList` and `outcome` pick the offline API answers (installed in `beforeEach`). */
function SynthLabScene({ initialVoiceKey }: { modelList: ModelList; outcome: RenderOutcome; initialVoiceKey: string | null }) {
    return (
        <VoiceConsoleProvider initialModule="lab">
            <SynthLab initialVoiceKey={initialVoiceKey} />
        </VoiceConsoleProvider>
    )
}

const meta = {
    title: 'Admin/Voices/SynthLab',
    component: SynthLabScene,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Root synth lab (05 §8.11): any catalog voice with any allow-listed model, only the settings that model supports, app or model-native markup inserts, and results with request ID, character cost and format, up to three pinned side by side. Without the model list the lab offers two MP3 formats and automatic normalization; with it, each model’s formats, normalization modes and availability. Replaces the classic synth panel. Every API method is replaced offline; renders are silent clips.',
            },
        },
    },
    beforeEach: ({ args }) => installLabApi(args.modelList, args.outcome),
    argTypes: {
        modelList: { control: 'inline-radio', options: ['absent', 'listed'], description: '`absent`: the model list route answers 404 (today’s lab).' },
        outcome: { control: 'inline-radio', options: ['plays', 'refused'], description: '`refused`: a render answers 422 over the model text limit.' },
        initialVoiceKey: { control: false },
    },
    args: { modelList: 'absent', outcome: 'plays', initialVoiceKey: readyVoice.voice_key },
} satisfies Meta<typeof SynthLabScene>

export default meta
type Story = StoryObj<typeof meta>

/** Without the model list: the R0 lab, Maren preselected from "Send to lab". */
export const Default: Story = {}

/** With the model list: Eleven v4 offers WAV and raw PCM, with the server-provided limits. */
export const WithModelList: Story = { args: { modelList: 'listed' } }

/** No voice chosen yet: Synthesize stays disabled until one is picked. */
export const NoVoice: Story = { args: { initialVoiceKey: null } }

/** Two renders in, the first pinned for comparison. */
export const WithResults: Story = {
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement)
        const synthesize = await canvas.findByRole('button', { name: i18n.t('admin.voices.lab.synthesize') })
        // Enabled once the catalog index has loaded the preselected voice.
        await waitFor(() => expect(synthesize).toBeEnabled())
        await userEvent.click(synthesize)
        await canvas.findByText(i18n.t('admin.voices.lab.meta.requestId', { id: 'req-story-1' }))
        await userEvent.click(synthesize)
        await canvas.findByText(i18n.t('admin.voices.lab.meta.requestId', { id: 'req-story-2' }))
        await userEvent.click(canvas.getAllByRole('button', { name: i18n.t('admin.voices.lab.compare') })[0])
    },
}

/** A render over the model limit: the error shows and the counter adopts the server’s limit. */
export const RenderRefused: Story = {
    args: { outcome: 'refused' },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement)
        const synthesize = await canvas.findByRole('button', { name: i18n.t('admin.voices.lab.synthesize') })
        await waitFor(() => expect(synthesize).toBeEnabled())
        await userEvent.click(synthesize)
        await canvas.findByRole('alert')
    },
}
