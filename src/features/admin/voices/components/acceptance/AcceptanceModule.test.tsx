import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { ApiError } from '@/infrastructure/api'
import type { AcceptanceRenderResponse } from '@/shared'
import { SILENT_WAV, auditRenders, draftVoice, makeAcceptance, readyVoice } from '../../fixtures'
import { consoleApiMock, renderInConsole, type ConsoleApiMock } from '../../testUtils'
import { AcceptanceModule } from './AcceptanceModule'

const api = vi.hoisted(() => ({}) as Record<string, unknown>)
vi.mock('@/infrastructure/api', async (importOriginal) => ({ ...(await importOriginal<object>()), apiService: api }))
const mock = () => api as unknown as ConsoleApiMock

function score(form: HTMLElement, legend: RegExp, value: number) {
    const group = within(form).getByRole('group', { name: legend })
    fireEvent.click(within(group).getByRole('radio', { name: String(value) }))
}

function scoreAll(form: HTMLElement, value: number, consistency = value) {
    for (const legend of [/Timbre/, /Naturalness/, /Emotion and tags/, /^Accent/, /Artefacts/]) score(form, legend, value)
    score(form, /Consistency with v4/, consistency)
}

async function renderQueued() {
    mock().renderAcceptance.mockResolvedValue(auditRenders)
    renderInConsole(<AcceptanceModule initialVoiceKey={draftVoice.voice_key} />, 'acceptance')
    await screen.findByRole('checkbox', { name: 'Eldrin' })
    fireEvent.click(screen.getByRole('button', { name: 'Render scripts' }))
    await screen.findByText('Rendered 1 voice.')
}

describe('AcceptanceModule (AC-R3)', () => {
    beforeEach(() => {
        for (const key of Object.keys(api)) delete api[key]
        Object.assign(api, consoleApiMock())
    })

    it('shows progress towards the R0 exit target', async () => {
        renderInConsole(<AcceptanceModule />, 'acceptance')
        expect(await screen.findByText('Published voices: 2 of 40')).toBeInTheDocument()
        expect(screen.getByText('English: 2 of 16')).toBeInTheDocument()
        expect(screen.getByText('Spanish: 0 of 16')).toBeInTheDocument()
    })

    it('batch-renders the fixed scripts on Flash and v4 and plays them side by side', async () => {
        await renderQueued()
        expect(mock().renderAcceptance).toHaveBeenCalledWith(
            { voice_key: draftVoice.voice_key, model_ids: ['eleven_v4'], languages: ['en'], script_version: 'acc-v1' },
            expect.any(AbortSignal),
        )
        const flash = screen.getByRole('region', { name: 'v4' })
        expect(within(flash).getByRole('button', { name: 'Play v4 render, Narration' })).toBeInTheDocument()
        expect(screen.getAllByRole('region', { name: 'v4' })).toHaveLength(1)
        expect(within(flash).getAllByText('The candle gutters low as the hidden door opens.')[0]).toHaveAttribute('lang', 'en')
    })

    it('uses the light script set when light acceptance is on', async () => {
        mock().renderAcceptance.mockResolvedValue(auditRenders)
        renderInConsole(<AcceptanceModule initialVoiceKey={draftVoice.voice_key} />, 'acceptance')
        await screen.findByRole('checkbox', { name: 'Eldrin' })
        fireEvent.click(screen.getByRole('checkbox', { name: 'French' }))
        fireEvent.click(screen.getByRole('switch', { name: /Light acceptance/ }))
        fireEvent.click(screen.getByRole('button', { name: 'Render scripts' }))
        await waitFor(() =>
            expect(mock().renderAcceptance).toHaveBeenCalledWith(expect.objectContaining({ languages: ['fr'], script_version: 'acc-v1' }), expect.any(AbortSignal)),
        )
    })

    it('shows each render\'s script version (per item for light languages) and why a render failed', async () => {
        const lightRenders: AcceptanceRenderResponse = {
            voice_key: draftVoice.voice_key,
            script_version: 'acc-v1',
            items: [
                {
                    render_id: 'fr-flash',
                    voice_key: draftVoice.voice_key,
                    model_id: 'eleven_v4',
                    language: 'fr',
                    script_kind: 'narration',
                    script_version: 'acc-v1-fr',
                    text: 'La bougie vacille.',
                    audio_url: SILENT_WAV,
                    duration_ms: 2100,
                    status: 'ready',
                },
                {
                    render_id: 'fr-v4',
                    voice_key: draftVoice.voice_key,
                    model_id: 'eleven_v4',
                    language: 'fr',
                    script_kind: 'narration',
                    script_version: null,
                    text: null,
                    audio_url: null,
                    duration_ms: null,
                    status: 'failed',
                    error_code: 'acceptance_scripts_missing',
                },
            ],
        }
        mock().renderAcceptance.mockResolvedValue(lightRenders)
        renderInConsole(<AcceptanceModule initialVoiceKey={draftVoice.voice_key} />, 'acceptance')
        await screen.findByRole('checkbox', { name: 'Eldrin' })
        fireEvent.click(screen.getByRole('switch', { name: /Light acceptance/ }))
        fireEvent.click(screen.getByRole('checkbox', { name: 'French' }))
        fireEvent.click(screen.getByRole('button', { name: 'Render scripts' }))
        await screen.findByText('Rendered 1 voice.')

        const flash = screen.getByRole('region', { name: 'v4' })
        expect(within(flash).getByText('Script acc-v1-fr')).toBeInTheDocument()
        expect(within(flash).getByText('Script acc-v1')).toBeInTheDocument()
        expect(within(flash).getByText('No acceptance scripts exist for this language yet.')).toBeInTheDocument()
    })

    it('explains a whole batch refused for missing acceptance scripts', async () => {
        mock().renderAcceptance.mockRejectedValue(new ApiError(422, 'No acceptance scripts exist for these languages.', { code: 'acceptance_scripts_missing' }))
        renderInConsole(<AcceptanceModule initialVoiceKey={draftVoice.voice_key} />, 'acceptance')
        await screen.findByRole('checkbox', { name: 'Eldrin' })
        fireEvent.click(screen.getByRole('button', { name: 'Render scripts' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('No acceptance scripts exist for this language yet.')
    })

    it('has six rubric keys and an explicit verdict before saving', async () => {
        await renderQueued()
        const form = screen.getByRole('form', { name: 'Rubric: v4' })
        expect(within(form).getAllByRole('group')).toHaveLength(7) // six scores + verdict
        fireEvent.click(within(form).getByRole('button', { name: 'Save verdict' }))
        expect(await within(form).findByText('Score every item and choose pass or fail.')).toBeInTheDocument()
        expect(mock().putAcceptanceVerdict).not.toHaveBeenCalled()
    })

    it('shows gain_db = min(0, −18 − LUFS) and warns beyond −6 dB (I-15)', async () => {
        await renderQueued()
        const form = screen.getByRole('form', { name: 'Rubric: v4' })
        // The renders measured −14 LUFS: 4 dB of attenuation.
        expect(within(form).getByText(/Gain: -4.0 dB/)).toBeInTheDocument()
        fireEvent.change(within(form).getByLabelText('Integrated loudness (LUFS)'), { target: { value: '-10' } })
        expect(within(form).getByText(/Gain: -8.0 dB/)).toBeInTheDocument()
        expect(within(form).getByText('Needs more than -6.0 dB of attenuation: this voice cannot pass on this model.')).toBeInTheDocument()
        expect(within(form).getByText('Integrated loudness from an offline meter (BS.1770). Required to pass.')).toBeInTheDocument()
    })

    it('blocks a pass that needs more than −6 dB with the reason, and still records a fail (I-15)', async () => {
        mock().putAcceptanceVerdict.mockResolvedValue({ acceptance: makeAcceptance({ verdict: 'fail', integrated_lufs: -10, gain_db: -8 }), voice: draftVoice })
        await renderQueued()
        const flash = screen.getByRole('form', { name: 'Rubric: v4' })
        scoreAll(flash, 4)
        fireEvent.change(within(flash).getByLabelText('Integrated loudness (LUFS)'), { target: { value: '-10' } })
        fireEvent.click(within(flash).getByRole('radio', { name: 'Pass' }))
        fireEvent.click(within(flash).getByRole('button', { name: 'Save verdict' }))
        const lufs = within(flash).getByLabelText('Integrated loudness (LUFS)')
        const reason = 'A pass is refused: it needs an integrated loudness of -12.0 LUFS or lower (at most -6.0 dB of attenuation). Record a fail, or re-measure the loudness.'
        // The reason sits on the loudness field: invalid, described by it, and focused.
        await waitFor(() => expect(lufs).toHaveAttribute('aria-invalid', 'true'))
        expect(lufs).toHaveAccessibleDescription(reason)
        expect(lufs).toHaveFocus()
        expect(mock().putAcceptanceVerdict).not.toHaveBeenCalled()

        fireEvent.click(within(flash).getByRole('radio', { name: 'Fail' }))
        expect(lufs).not.toHaveAttribute('aria-invalid')
        expect(within(flash).queryByText(reason)).not.toBeInTheDocument()
        fireEvent.click(within(flash).getByRole('button', { name: 'Save verdict' }))
        await waitFor(() =>
            expect(mock().putAcceptanceVerdict).toHaveBeenCalledWith(draftVoice.voice_key, 'eleven_v4', 'en', {
                verdict: 'fail',
                scores: { timbre: 4, naturalness: 4, emotion_tags: 4, accent: 4, artefacts: 4, consistency_vs_v4: 4 },
                integrated_lufs: -10,
            }),
        )
    })

    it('states the limit in LUFS, so a value just over it never reads as "-6.0 beyond -6.0" (I-15)', async () => {
        await renderQueued()
        const flash = screen.getByRole('form', { name: 'Rubric: v4' })
        scoreAll(flash, 4)
        // −11.96 LUFS: an unrounded gain of −6.04 dB, refused; −12 LUFS: exactly −6 dB, accepted.
        fireEvent.change(within(flash).getByLabelText('Integrated loudness (LUFS)'), { target: { value: '-11.96' } })
        fireEvent.click(within(flash).getByRole('radio', { name: 'Pass' }))
        fireEvent.click(within(flash).getByRole('button', { name: 'Save verdict' }))
        expect(await within(flash).findByText(/needs an integrated loudness of -12\.0 LUFS or lower/)).toBeInTheDocument()
        expect(within(flash).queryByText(/-6\.0 dB, beyond/)).not.toBeInTheDocument()
        expect(mock().putAcceptanceVerdict).not.toHaveBeenCalled()

        fireEvent.change(within(flash).getByLabelText('Integrated loudness (LUFS)'), { target: { value: '-12' } })
        fireEvent.click(within(flash).getByRole('button', { name: 'Save verdict' }))
        await waitFor(() => expect(mock().putAcceptanceVerdict).toHaveBeenCalledWith(draftVoice.voice_key, 'eleven_v4', 'en', expect.objectContaining({ verdict: 'pass', integrated_lufs: -12 })))
    })

    it('ignores renders without a loudness value instead of poisoning the pre-fill', async () => {
        // One render omits the optional field, one sends null: the other two still average to −14.
        const [first, second, ...rest] = auditRenders.items
        const withoutLufs = { ...first }
        delete withoutLufs.integrated_lufs
        mock().renderAcceptance.mockResolvedValue({ ...auditRenders, items: [withoutLufs, { ...second, integrated_lufs: null }, ...rest] })
        renderInConsole(<AcceptanceModule initialVoiceKey={draftVoice.voice_key} />, 'acceptance')
        await screen.findByRole('checkbox', { name: 'Eldrin' })
        fireEvent.click(screen.getByRole('button', { name: 'Render scripts' }))
        await screen.findByText('Rendered 1 voice.')
        const flash = screen.getByRole('form', { name: 'Rubric: v4' })
        // Both v4 renders lack a value: the field starts empty, never "NaN".
        expect(within(flash).getByLabelText('Integrated loudness (LUFS)')).toHaveValue(null)
        expect(within(flash).getByText('Gain: enter a loudness value')).toBeInTheDocument()
        expect(screen.queryByText(/NaN/)).not.toBeInTheDocument()
    })

    it('requires the offline-meter loudness before a pass (I-15)', async () => {
        await renderQueued()
        const flash = screen.getByRole('form', { name: 'Rubric: v4' })
        scoreAll(flash, 4)
        fireEvent.change(within(flash).getByLabelText('Integrated loudness (LUFS)'), { target: { value: '' } })
        fireEvent.click(within(flash).getByRole('radio', { name: 'Pass' }))
        fireEvent.click(within(flash).getByRole('button', { name: 'Save verdict' }))
        expect(await within(flash).findByText('Enter the integrated loudness from your offline meter before passing this voice.')).toBeInTheDocument()
        expect(within(flash).getByText('Gain: enter a loudness value')).toBeInTheDocument()
        expect(mock().putAcceptanceVerdict).not.toHaveBeenCalled()
    })

    it('shows the server refusal 422 gain_out_of_range in plain words', async () => {
        mock().putAcceptanceVerdict.mockRejectedValue(new ApiError(422, 'gain_db below -6', { code: 'gain_out_of_range' }))
        await renderQueued()
        const flash = screen.getByRole('form', { name: 'Rubric: v4' })
        scoreAll(flash, 4)
        fireEvent.click(within(flash).getByRole('radio', { name: 'Pass' }))
        fireEvent.click(within(flash).getByRole('button', { name: 'Save verdict' }))
        expect(await within(flash).findByText(/^The server refused the pass: this voice needs more attenuation than a pass allows/)).toBeInTheDocument()
    })

    it('marks call eligibility only for a v4 pass with consistency of 4 or more', async () => {
        await renderQueued()
        const flash = screen.getByRole('form', { name: 'Rubric: v4' })
        scoreAll(flash, 5, 3)
        fireEvent.click(within(flash).getByRole('radio', { name: 'Pass' }))
        expect(within(flash).getByText(/Not call eligible/)).toBeInTheDocument()
        score(flash, /Consistency with v4/, 4)
        expect(within(flash).getByText(/^Call eligible/)).toBeInTheDocument()
    })

    it('saves the verdict and renders the own sample on a pass', async () => {
        const accepted = { ...draftVoice, call_eligible: true, acceptance: [makeAcceptance({ integrated_lufs: -14, gain_db: -4 })] }
        mock().putAcceptanceVerdict.mockResolvedValue({ acceptance: accepted.acceptance[0], voice: accepted })
        mock().renderCatalogSamples.mockResolvedValue({
            voice_key: draftVoice.voice_key,
            items: [{ sample_asset_id: 's1', language: 'en', model_id: 'eleven_v4', kind: 'showcase', url: auditRenders.items[0].audio_url }],
        })
        await renderQueued()
        const flash = screen.getByRole('form', { name: 'Rubric: v4' })
        scoreAll(flash, 4)
        fireEvent.click(within(flash).getByRole('radio', { name: 'Pass' }))
        fireEvent.click(within(flash).getByRole('button', { name: 'Save verdict' }))
        await waitFor(() =>
            expect(mock().putAcceptanceVerdict).toHaveBeenCalledWith(draftVoice.voice_key, 'eleven_v4', 'en', {
                verdict: 'pass',
                scores: { timbre: 4, naturalness: 4, emotion_tags: 4, accent: 4, artefacts: 4, consistency_vs_v4: 4 },
                integrated_lufs: -14,
            }),
        )
        await waitFor(() => expect(mock().renderCatalogSamples).toHaveBeenCalledWith(draftVoice.voice_key, { languages: ['en'], model_ids: ['eleven_v4'] }))
        expect(await screen.findByRole('button', { name: 'Play Sample, v4, English' })).toBeInTheDocument()
    })

    it('does not re-render samples when the server already rendered them', async () => {
        mock().putAcceptanceVerdict.mockResolvedValue({ acceptance: makeAcceptance(), voice: readyVoice })
        await renderQueued()
        const flash = screen.getByRole('form', { name: 'Rubric: v4' })
        scoreAll(flash, 4)
        fireEvent.click(within(flash).getByRole('radio', { name: 'Pass' }))
        fireEvent.click(within(flash).getByRole('button', { name: 'Save verdict' }))
        await screen.findByText('Verdict saved')
        expect(mock().renderCatalogSamples).not.toHaveBeenCalled()
    })

    it('reports a failed render per voice without stopping the batch', async () => {
        mock().renderAcceptance.mockRejectedValue(new ApiError(429, 'Slow down'))
        renderInConsole(<AcceptanceModule initialVoiceKey={draftVoice.voice_key} />, 'acceptance')
        await screen.findByRole('checkbox', { name: 'Eldrin' })
        fireEvent.click(screen.getByRole('button', { name: 'Render scripts' }))
        expect(await screen.findByText('Eldrin: Too many requests. Wait a moment and try again.')).toBeInTheDocument()
    })
})
