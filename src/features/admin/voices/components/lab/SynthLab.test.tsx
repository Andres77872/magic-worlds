import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { ApiError } from '@/infrastructure/api'
import { toVoiceCapabilities } from '@/shared/voice'
import { BFF_R0_BODY } from '@/shared/voice/voiceCapabilities.fixtures'
import { readyVoice } from '../../fixtures'
import { chooseOption, consoleApiMock, renderInConsole, type ConsoleApiMock } from '../../testUtils'
import { SynthLab } from './SynthLab'

const api = vi.hoisted(() => ({}) as Record<string, unknown>)
vi.mock('@/infrastructure/api', async (importOriginal) => ({ ...(await importOriginal<object>()), apiService: api }))
const mock = () => api as unknown as ConsoleApiMock

const labResult = (requestId: string) => ({ blob: new Blob(['a'], { type: 'audio/mpeg' }), content_type: 'audio/mpeg', request_id: requestId, character_cost: 112 })

async function renderLab() {
    renderInConsole(<SynthLab />, 'lab')
    await waitFor(() => expect(mock().listAdminCatalog).toHaveBeenCalled())
    chooseOption('Voice', /Maren/)
}

describe('SynthLab (AC-R10)', () => {
    beforeEach(() => {
        for (const key of Object.keys(api)) delete api[key]
        Object.assign(api, consoleApiMock())
        mock().testAdminVoice.mockResolvedValue(labResult('req-1'))
    })

    it('offers only v4 and its supported voice controls', async () => {
        await renderLab()
        expect(screen.queryByRole('slider', { name: 'Speed' })).not.toBeInTheDocument()
        expect(screen.queryByRole('slider', { name: 'Style' })).not.toBeInTheDocument()
        expect(screen.queryByRole('switch', { name: 'Speaker boost' })).not.toBeInTheDocument()
        expect(screen.getByRole('slider', { name: 'Similarity' })).toBeInTheDocument()
        expect(screen.getByLabelText('Language code')).toBeInTheDocument()
    })

    it('offers model-native inserts only where the model supports them', async () => {
        await renderLab()
        const toolbar = () => screen.getByRole('toolbar', { name: 'Insert markup' })
        expect(within(toolbar()).getByRole('button', { name: /Sigh/ })).toBeInTheDocument()
        chooseOption('Markup mode', 'Model native')
        // Flash has breaks but no audio tags.
        expect(within(toolbar()).queryByRole('button', { name: /Pause/ })).not.toBeInTheDocument()
        expect(within(toolbar()).getByRole('button', { name: /Sigh/ })).toBeInTheDocument()
        chooseOption('Model', 'v4')
        expect(within(toolbar()).getByRole('button', { name: /Sigh/ })).toBeInTheDocument()
        expect(within(toolbar()).getByRole('button', { name: /Pronunciation/ })).toBeInTheDocument()
    })

    it('sends the per-model settings and shows the request id and character cost', async () => {
        await renderLab()
        fireEvent.change(screen.getByLabelText('Language code'), { target: { value: 'EN' } })
        fireEvent.click(screen.getByRole('button', { name: 'Synthesize' }))
        await waitFor(() =>
            expect(mock().testAdminVoice).toHaveBeenCalledWith({
                voice_key: readyVoice.voice_key,
                model_alias: 'el_v4',
                text: expect.stringContaining('<#0.4#>'),
                markup_mode: 'app',
                output_format: 'mp3_44100_128',
                language_code: 'en',
                seed: null,
                apply_text_normalization: 'auto',
                voice_settings: { stability: 0.5, similarity_boost: 0.75 },
            }),
        )
        const result = await screen.findByRole('article', { name: 'Maren, v4' })
        expect(within(result).getByText('Request ID req-1')).toBeInTheDocument()
        expect(within(result).getByText('Character cost 112')).toBeInTheDocument()
        expect(within(result).getByText('Format mp3_44100_128')).toBeInTheDocument()
    })

    it('pins results to compare them', async () => {
        await renderLab()
        fireEvent.click(screen.getByRole('button', { name: 'Synthesize' }))
        const result = await screen.findByRole('article', { name: 'Maren, v4' })
        fireEvent.click(within(result).getByRole('button', { name: 'Compare' }))
        expect(screen.getByRole('region', { name: 'Compare' })).toBeInTheDocument()
        expect(within(result).getByRole('button', { name: 'Unpin' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('blocks text over the model limit', async () => {
        await renderLab()
        fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'a'.repeat(5001) } })
        expect(screen.getByText('The text exceeds the model limit of 5000 characters.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Synthesize' })).toBeDisabled()
    })

    it('takes the Flash and v4 limit from the real R0 capabilities (narration tier), else the BFF lab cap', async () => {
        mock().getVoiceCapabilities.mockResolvedValue(toVoiceCapabilities(BFF_R0_BODY))
        await renderLab()
        await waitFor(() => expect(mock().getVoiceCapabilities).toHaveBeenCalled())
        fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'a'.repeat(1201) } })
        expect(await screen.findByText('The text exceeds the model limit of 1200 characters.')).toBeInTheDocument()
        expect(screen.getByText('1201 / 1200 characters')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Synthesize' })).toBeDisabled()
        // v4 is the Expressive narration row: the same 1,200 characters.
        chooseOption('Model', 'v4')
        expect(screen.getByText('1201 / 1200 characters')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Synthesize' })).toBeDisabled()
    })

    it('prefers an admin_lab entry over the narration tier when one is listed', async () => {
        mock().getVoiceCapabilities.mockResolvedValue(
            toVoiceCapabilities({
                ...BFF_R0_BODY,
                surfaces: { ...BFF_R0_BODY.surfaces, admin_lab: { standard: { controls: [], max_chars: 900 } } },
            }),
        )
        await renderLab()
        await waitFor(() => expect(mock().getVoiceCapabilities).toHaveBeenCalled())
        fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'a'.repeat(901) } })
        expect(await screen.findByText('901 / 900 characters')).toBeInTheDocument()
        chooseOption('Model', 'v4')
        expect(screen.getByText('901 / 900 characters')).toBeInTheDocument()
    })

    it('learns the model limit from a text_over_model_limit answer and explains it', async () => {
        mock().getVoiceCapabilities.mockRejectedValue(new Error('offline'))
        mock().testAdminVoice.mockRejectedValue(
            new ApiError(422, 'The text is longer than the model accepts.', {
                code: 'text_over_model_limit',
                details: { code: 'text_over_model_limit', message: 'The text is longer than the model accepts.', max_chars: 80 },
            }),
        )
        await renderLab()
        fireEvent.click(screen.getByRole('button', { name: 'Synthesize' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('The text is longer than this model accepts (80 characters at most). Shorten it and try again.')
        expect(screen.getByText('The text exceeds the model limit of 80 characters.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Synthesize' })).toBeDisabled()
    })

    it('offers only the output formats and the normalization the BFF lab accepts', async () => {
        await renderLab()
        fireEvent.click(screen.getByRole('combobox', { name: 'Output format' }))
        expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['mp3_44100_128', 'mp3_44100_64'])
        expect(screen.queryByRole('combobox', { name: 'Text normalization' })).not.toBeInTheDocument()
        expect(screen.getByText('Set by the server: always automatic.')).toBeInTheDocument()
    })

    it('explains a moderation refusal', async () => {
        mock().testAdminVoice.mockRejectedValue(new ApiError(422, 'Refused', { code: 'moderation_blocked' }))
        await renderLab()
        fireEvent.click(screen.getByRole('button', { name: 'Synthesize' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('The text was refused by moderation. Edit it and try again.')
    })
})

describe('SynthLab with the lab model list (R1-FE-06, A4)', () => {
    const a4Row = (overrides: Record<string, unknown> = {}) => ({
        model_alias: 'el_v4',
        label: 'Eleven v4',
        tier: 'expressive',
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
        ...overrides,
    })

    beforeEach(() => {
        for (const key of Object.keys(api)) delete api[key]
        Object.assign(api, consoleApiMock())
        mock().testAdminVoice.mockResolvedValue(labResult('req-1'))
    })

    const optionTexts = (combobox: string) => {
        fireEvent.click(screen.getByRole('combobox', { name: combobox }))
        const texts = screen.getAllByRole('option').map((option) => option.textContent)
        fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
        return texts
    }

    it('is exactly the R0 lab when the route answers 501', async () => {
        mock().listAdminLabModels.mockRejectedValue(new ApiError(501, 'Not Implemented'))
        await renderLab()
        await waitFor(() => expect(mock().listAdminLabModels).toHaveBeenCalled())
        expect(optionTexts('Model')).toEqual(['v4'])
        expect(optionTexts('Output format')).toEqual(['mp3_44100_128', 'mp3_44100_64'])
        expect(screen.getByText('Set by the server: always automatic.')).toBeInTheDocument()
        expect(screen.getByLabelText('Seed')).toBeInTheDocument()
        fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'a'.repeat(5001) } })
        expect(screen.getByText('5001 / 5000 characters')).toBeInTheDocument()
    })

    it('offers the listed models, formats and normalization modes, and sends the choice', async () => {
        mock().listAdminLabModels.mockResolvedValue({ models: [a4Row()] })
        await renderLab()
        await waitFor(() => expect(screen.getByRole('combobox', { name: 'Model' })).toHaveTextContent('Eleven v4'))
        expect(optionTexts('Output format')).toEqual(['mp3_44100_128', 'wav_44100', 'pcm_24000'])
        chooseOption('Output format', 'pcm_24000')
        expect(screen.getByText(/plays here through a WAV header/)).toBeInTheDocument()
        chooseOption('Text normalization', 'Off')
        // supports_seed false: no seed field, and none is sent.
        expect(screen.queryByLabelText('Seed')).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Synthesize' }))
        await waitFor(() =>
            expect(mock().testAdminVoice).toHaveBeenCalledWith(
                expect.objectContaining({ model_alias: 'el_v4', output_format: 'pcm_24000', apply_text_normalization: 'off', seed: null }),
            ),
        )
        expect(await screen.findByRole('article', { name: 'Maren, Eleven v4' })).toBeInTheDocument()
    })

    it('limits the text to min(A4 max_chars, the learned 422)', async () => {
        mock().listAdminLabModels.mockResolvedValue({ models: [a4Row({ max_chars: 3000 })] })
        mock().getVoiceCapabilities.mockResolvedValue(toVoiceCapabilities(BFF_R0_BODY))
        await renderLab()
        await waitFor(() => expect(screen.getByRole('combobox', { name: 'Model' })).toHaveTextContent('Eleven v4'))
        fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'a'.repeat(1500) } })
        expect(await screen.findByText('1500 / 3000 characters')).toBeInTheDocument()
        mock().testAdminVoice.mockRejectedValue(new ApiError(422, 'Too long', { code: 'text_over_model_limit', details: { max_chars: 1000 } }))
        fireEvent.click(screen.getByRole('button', { name: 'Synthesize' }))
        expect(await screen.findByText('1500 / 1000 characters')).toBeInTheDocument()
    })

    it('stops offering a format the BFF refused with unsupported_output_format', async () => {
        mock().listAdminLabModels.mockResolvedValue({ models: [a4Row()] })
        mock().testAdminVoice.mockRejectedValue(new ApiError(422, 'Unsupported', { code: 'unsupported_output_format' }))
        await renderLab()
        await waitFor(() => expect(screen.getByRole('combobox', { name: 'Model' })).toHaveTextContent('Eleven v4'))
        chooseOption('Output format', 'wav_44100')
        fireEvent.click(screen.getByRole('button', { name: 'Synthesize' }))
        expect(await screen.findByRole('alert')).toBeInTheDocument()
        expect(optionTexts('Output format')).toEqual(['mp3_44100_128', 'pcm_24000'])
        expect(screen.getByRole('combobox', { name: 'Output format' })).toHaveTextContent('mp3_44100_128')
    })

    it('narrows normalization to auto after unsupported_text_normalization', async () => {
        mock().listAdminLabModels.mockResolvedValue({ models: [a4Row()] })
        mock().testAdminVoice.mockRejectedValue(new ApiError(422, 'Unsupported', { code: 'unsupported_text_normalization' }))
        await renderLab()
        await waitFor(() => expect(screen.getByRole('combobox', { name: 'Model' })).toHaveTextContent('Eleven v4'))
        chooseOption('Text normalization', 'On')
        fireEvent.click(screen.getByRole('button', { name: 'Synthesize' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Text normalization is always automatic.')
        expect(screen.queryByRole('combobox', { name: 'Text normalization' })).not.toBeInTheDocument()
    })

    it('shows an unavailable model as such and does not render with it', async () => {
        mock().listAdminLabModels.mockResolvedValue({ models: [a4Row({ available: false, unavailable_reason: 'not_on_account' })] })
        await renderLab()
        expect(await screen.findByText('This model is not available on the account.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Synthesize' })).toBeDisabled()
    })

    it('lets the markup toolbar follow the listed flags', async () => {
        mock().listAdminLabModels.mockResolvedValue({ models: [a4Row({ model_alias: 'el_v4', label: 'Flash', audio_tags: true, breaks: false, inline_ipa: false })] })
        await renderLab()
        // The A4 label ("Flash") replaces the R0 one ("v4").
        await waitFor(() => expect(screen.getByRole('combobox', { name: 'Model' })).not.toHaveTextContent('v2.5'))
        expect(screen.getByRole('combobox', { name: 'Model' })).toHaveTextContent('Flash')
        chooseOption('Markup mode', 'Model native')
        const toolbar = screen.getByRole('toolbar', { name: 'Insert markup' })
        expect(within(toolbar).getByRole('button', { name: /Sigh/ })).toBeInTheDocument()
        expect(within(toolbar).queryByRole('button', { name: /Pronunciation/ })).not.toBeInTheDocument()
        expect(within(toolbar).queryByRole('button', { name: /^Pause/ })).not.toBeInTheDocument()
    })
})
