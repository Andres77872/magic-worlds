import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VoiceCapabilities, VoicePresetV2 } from '@/shared'
import {
    CAPABILITIES_EL_FREE,
    CAPABILITIES_EL_PLUS,
    CATALOG_ELDRIN,
    CATALOG_IDRIS_ES_UNACCEPTED,
    CATALOG_MAREN_HOUSE,
    CATALOG_ORRIN_UNTESTED,
    CATALOG_PAGE,
    CATALOG_SELA_LEAVING,
    PRESET_V2_GLOBAL,
    PRESET_V2_USER,
    VOICE_KEY_ELDRIN,
    VOICE_KEY_IDRIS,
    VOICE_KEY_MAREN,
    VOICE_KEY_ORRIN,
    VOICE_KEY_SELA,
    catalogVoice,
} from '../fixtures'
import { clearPreferredLanguageCache } from '../hooks/usePreferredLanguage'
import type { PresetEditorV2Mode } from '../presetRowsV2'
import { BUILT_IN_PREVIEW_TEXTS } from '../previewTexts'
import { resetPreviewCreditConfirmation } from '../usePreviewCreditConfirm'
import { clearPreviewTextsCache } from '../usePreviewTexts'
import { PresetEditorV2 } from './PresetEditorV2'

const api = {
    listVoiceCatalog: vi.fn(),
    getVoiceCatalogByKeys: vi.fn(),
    createVoicePreset: vi.fn(),
    updateVoicePreset: vi.fn(),
    previewVoice: vi.fn(),
    getUserProfile: vi.fn(),
    getPreviewTexts: vi.fn(),
    fetchProtectedMediaBlob: vi.fn(),
    getUserPreferences: vi.fn(),
}

vi.mock('@/app/hooks/usePlaylist', () => ({ usePlaylist: () => ({}) }))
vi.mock('@/infrastructure/api', () => ({
    apiService: new Proxy({}, { get: (_target, key: string) => (...args: unknown[]) => (api as Record<string, (...a: unknown[]) => unknown>)[key](...args) }),
    isProtectedMediaUrl: () => false,
}))

interface Props {
    mode?: PresetEditorV2Mode
    source?: VoicePresetV2 | null
    capabilities?: VoiceCapabilities | null
    pickVoiceOnOpen?: boolean
    userHash?: string | null
}

function renderEditor({ mode = 'create', source = null, capabilities = CAPABILITIES_EL_PLUS, pickVoiceOnOpen, userHash = 'user-a' }: Props = {}) {
    const onSaved = vi.fn()
    const onClose = vi.fn()
    const notify = vi.fn()
    render(<PresetEditorV2 open mode={mode} source={source} capabilities={capabilities} pickVoiceOnOpen={pickVoiceOnOpen} userHash={userHash} onSaved={onSaved} onClose={onClose} notify={notify} />)
    return { onSaved, onClose, notify }
}

/** The catalog lookup answers every fixture voice, plus `extra` overrides by key. */
function lookupAnswers(...extra: (typeof CATALOG_PAGE)[number][]) {
    api.getVoiceCatalogByKeys.mockImplementation(async (keys: string[]) => {
        const byKey = new Map([...CATALOG_PAGE, ...extra].map((item) => [item.voice_key, item]))
        return keys.flatMap((key) => (byKey.has(key) ? [byKey.get(key)!] : []))
    })
}

const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save preset' }))

describe('PresetEditorV2 (R1-FE-02, EP-3)', () => {
    beforeEach(() => {
        vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:clip'), revokeObjectURL: vi.fn() })
        clearPreviewTextsCache()
        resetPreviewCreditConfirmation()
        api.listVoiceCatalog.mockReset().mockResolvedValue({ items: [CATALOG_ELDRIN, CATALOG_MAREN_HOUSE], next_cursor: null })
        api.getVoiceCatalogByKeys.mockReset().mockResolvedValue([CATALOG_ELDRIN, CATALOG_MAREN_HOUSE, CATALOG_SELA_LEAVING])
        api.createVoicePreset.mockReset().mockResolvedValue({ ...PRESET_V2_USER, preset_id: 'new-1' })
        api.updateVoicePreset.mockReset().mockResolvedValue(PRESET_V2_USER)
        api.previewVoice.mockReset().mockResolvedValue({ cache_key: 'k', previews_left: 4, tier_used: 'standard' })
        api.getUserProfile.mockReset().mockResolvedValue({ membership: { plan_code: 'plus' } })
        api.getPreviewTexts.mockReset().mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }))
        api.fetchProtectedMediaBlob.mockReset().mockResolvedValue(new Blob(['mp3'], { type: 'audio/mpeg' }))
        clearPreferredLanguageCache()
        api.getUserPreferences.mockReset().mockResolvedValue({ preferred_language: 'en', has_preference: false, narration_tier: 'standard' })
    })

    it('labels emotions by effect on Expressive, notes thought delivery per tier, and links back to Standard (05 §5.1-§5.4)', () => {
        renderEditor({ mode: 'edit', source: PRESET_V2_USER })
        expect(screen.getByRole('combobox')).toHaveTextContent(/^Calm$/)
        expect(screen.getByTestId('thought-note')).toHaveTextContent('Thoughts are spoken a little quieter.')
        fireEvent.click(screen.getByRole('radio', { name: 'Expressive' }))
        expect(screen.getByRole('combobox')).toHaveTextContent('Calm: adds a relaxed delivery')
        expect(screen.queryByText('Subtle on Standard voices')).not.toBeInTheDocument()
        expect(screen.getByTestId('thought-note')).toHaveTextContent('Thoughts are whispered and a little quieter.')
        expect(screen.queryByLabelText('Speed')).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Show Standard controls' }))
        expect(screen.getByRole('radio', { name: 'Standard' })).toHaveAttribute('aria-checked', 'true')
        expect(screen.getByLabelText('Speed')).toBeInTheDocument()
    })

    it('badges a base voice not tested in the preset language: its own, else the preferred one (05 §5.5)', async () => {
        api.getUserPreferences.mockResolvedValue({ preferred_language: 'es', has_preference: true, narration_tier: 'standard' })
        lookupAnswers()
        const orrin: VoicePresetV2 = { ...PRESET_V2_USER, voice_key: VOICE_KEY_ORRIN, voice_name: 'Orrin' }
        const { unmount } = render(<PresetEditorV2 open mode="edit" source={orrin} capabilities={CAPABILITIES_EL_PLUS} onSaved={vi.fn()} onClose={vi.fn()} notify={vi.fn()} />)
        const base = screen.getByTestId('preset-base-voice')
        expect(await within(base).findByText(/^Not tested in Spanish/)).toBeInTheDocument()
        unmount()

        render(<PresetEditorV2 open mode="edit" source={{ ...orrin, language_code: 'en' }} capabilities={CAPABILITIES_EL_PLUS} onSaved={vi.fn()} onClose={vi.fn()} notify={vi.fn()} />)
        // The language line renders only once the catalog item is in, so the absence below is checked against it.
        expect(await within(screen.getByTestId('preset-base-voice')).findByText(/^Primary language:/)).toBeInTheDocument()
        expect(api.getVoiceCatalogByKeys).toHaveBeenCalledTimes(2)
        expect(within(screen.getByTestId('preset-base-voice')).queryByText(/^Not tested in/)).not.toBeInTheDocument()
        expect(CATALOG_ORRIN_UNTESTED.languages.map((entry) => entry.language)).toEqual(['en'])
    })

    it('"Switch to {replacement}" swaps a leaving voice and keeps the recipe (05 §7.8)', async () => {
        lookupAnswers()
        renderEditor({ mode: 'edit', source: { ...PRESET_V2_USER, voice_key: VOICE_KEY_SELA, voice_name: 'Sela' } })
        const base = screen.getByTestId('preset-base-voice')
        expect(await within(base).findByText(/^Leaving on /)).toBeInTheDocument()
        fireEvent.click(within(base).getByRole('button', { name: 'Switch to Maren' }))
        await waitFor(() => expect(within(screen.getByTestId('preset-base-voice')).getByText('Maren')).toBeInTheDocument())
        save()
        await waitFor(() => expect(api.updateVoicePreset).toHaveBeenCalledTimes(1))
        expect(api.updateVoicePreset).toHaveBeenCalledWith('user-v2', expect.objectContaining({
            voice_key: VOICE_KEY_MAREN,
            settings: PRESET_V2_USER.settings,
            emotion: PRESET_V2_USER.emotion,
        }))
    })

    it('"Choose a voice" opens the picker for a voice that needs re-selection; "Keep for now" closes the prompt', async () => {
        lookupAnswers(catalogVoice({ status: 'blocked' }))
        const { unmount } = render(<PresetEditorV2 open mode="edit" source={PRESET_V2_USER} capabilities={CAPABILITIES_EL_PLUS} onSaved={vi.fn()} onClose={vi.fn()} notify={vi.fn()} />)
        const base = screen.getByTestId('preset-base-voice')
        fireEvent.click(await within(base).findByRole('button', { name: 'Keep for now' }))
        expect(within(base).queryByRole('button', { name: 'Choose a voice' })).not.toBeInTheDocument()
        expect(within(base).getByText('Voice needs re-selection')).toBeInTheDocument()
        unmount()

        renderEditor({ mode: 'edit', source: PRESET_V2_USER })
        fireEvent.click(await within(screen.getByTestId('preset-base-voice')).findByRole('button', { name: 'Choose a voice' }))
        expect(await screen.findAllByTestId('catalog-voice-row')).not.toHaveLength(0)
    })

    it('badges and offers no chip for a language listed without an acceptance pass (05 §5.5)', async () => {
        api.getUserPreferences.mockResolvedValue({ preferred_language: 'es', has_preference: true, narration_tier: 'standard' })
        lookupAnswers(CATALOG_IDRIS_ES_UNACCEPTED)
        renderEditor({ mode: 'edit', source: { ...PRESET_V2_USER, voice_key: VOICE_KEY_IDRIS, voice_name: 'Idris' } })
        const base = screen.getByTestId('preset-base-voice')
        expect(await within(base).findByText(/^Not tested in Spanish/)).toBeInTheDocument()
        expect(screen.queryByRole('group', { name: 'Preview language' })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Preview voice' }))
        await waitFor(() => expect(api.previewVoice).toHaveBeenCalledTimes(1))
        expect(api.previewVoice.mock.calls[0][0]).toMatchObject({ voice_key: VOICE_KEY_IDRIS, language: 'en' })
    })

    it('defaults the preview to the preset’s language, else the voice’s primary one, never the interface’s (D17)', async () => {
        api.getUserPreferences.mockResolvedValue({ preferred_language: 'es', has_preference: true, narration_tier: 'standard' })
        lookupAnswers()
        const { unmount } = render(
            <PresetEditorV2 open mode="edit" source={{ ...PRESET_V2_USER, language_code: 'es' }} capabilities={CAPABILITIES_EL_PLUS} onSaved={vi.fn()} onClose={vi.fn()} notify={vi.fn()} />,
        )
        let chips = await screen.findByRole('group', { name: 'Preview language' })
        expect(within(chips).getByRole('button', { name: 'Spanish' })).toHaveAttribute('aria-pressed', 'true')
        unmount()

        // No language_code: Eldrin's primary language (English) comes before the preferred Spanish.
        renderEditor({ mode: 'edit', source: PRESET_V2_USER })
        chips = await screen.findByRole('group', { name: 'Preview language' })
        expect(within(chips).getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('opens on the picker when the Studio asks (an owner prompt)', async () => {
        renderEditor({ mode: 'edit', source: PRESET_V2_USER, pickVoiceOnOpen: true })
        expect(screen.queryByTestId('preset-base-voice')).not.toBeInTheDocument()
        expect(await screen.findAllByTestId('catalog-voice-row')).not.toHaveLength(0)
    })

    it('offers the voice’s other accepted language on the preview panel (05 §5.5)', async () => {
        lookupAnswers()
        renderEditor({ mode: 'edit', source: PRESET_V2_USER })
        const chips = await screen.findByRole('group', { name: 'Preview language' })
        expect(within(chips).getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')
        fireEvent.click(within(chips).getByRole('button', { name: 'Spanish' }))
        expect(within(chips).getByRole('button', { name: 'Spanish' })).toHaveAttribute('aria-pressed', 'true')
        fireEvent.click(screen.getByRole('button', { name: 'Preview voice' }))
        await waitFor(() => expect(api.previewVoice).toHaveBeenCalledTimes(1))
        expect(api.previewVoice.mock.calls[0][0]).toMatchObject({ voice_key: VOICE_KEY_ELDRIN, language: 'es' })
    })

    it('creates a preset from a catalog voice with voice defaults', async () => {
        const { onSaved, onClose, notify } = renderEditor()
        fireEvent.change(screen.getByLabelText('Preset name'), { target: { value: '  Tavern keeper ' } })
        const maren = (await screen.findAllByTestId('catalog-voice-row')).find((row) => within(row).queryByText('Maren')) as HTMLElement
        fireEvent.click(within(maren).getByRole('button', { name: 'Use' }))
        expect(within(screen.getByTestId('preset-base-voice')).getByText('Maren')).toBeInTheDocument()
        expect(screen.getByText(/Your story’s language is used/)).toBeInTheDocument()

        save()
        await waitFor(() => expect(api.createVoicePreset).toHaveBeenCalledTimes(1))
        expect(api.createVoicePreset).toHaveBeenCalledWith({ name: 'Tavern keeper', description: null, voice_key: VOICE_KEY_MAREN, settings: null, emotion: null })
        expect(api.updateVoicePreset).not.toHaveBeenCalled()
        await waitFor(() => expect(onClose).toHaveBeenCalled())
        expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ preset_id: 'new-1' }))
        expect(notify).toHaveBeenCalledWith(expect.objectContaining({ tone: 'success', title: 'Preset saved' }))
    })

    it('edits a V2 preset in place, writing the 0.05 grid only', async () => {
        renderEditor({ mode: 'edit', source: PRESET_V2_USER })
        expect(screen.getByLabelText('Preset name')).toHaveValue('Harbour master')
        fireEvent.change(screen.getByLabelText('Stability'), { target: { value: '0.62' } })
        save()
        await waitFor(() => expect(api.updateVoicePreset).toHaveBeenCalledTimes(1))
        expect(api.updateVoicePreset).toHaveBeenCalledWith('user-v2', {
            name: 'Harbour master',
            description: 'Gruff but kind.',
            voice_key: VOICE_KEY_ELDRIN,
            settings: { stability: 0.6, similarity_boost: 0.8, speed: 0.95 },
            emotion: 'calm',
        })
    })

    it('duplicates a global preset as a new one', async () => {
        renderEditor({ mode: 'duplicate', source: PRESET_V2_GLOBAL })
        expect(screen.getByLabelText('Preset name')).toHaveValue('Fireside narrator (copy)')
        save()
        await waitFor(() => expect(api.createVoicePreset).toHaveBeenCalledWith(expect.objectContaining({ name: 'Fireside narrator (copy)', voice_key: VOICE_KEY_MAREN })))
        expect(api.updateVoicePreset).not.toHaveBeenCalled()
    })

    it('keeps the draft and explains a refused voice (422)', async () => {
        api.updateVoicePreset.mockRejectedValue(Object.assign(new Error('Unprocessable'), { status: 422, code: 'voice_plan_locked' }))
        const { onClose } = renderEditor({ mode: 'edit', source: PRESET_V2_USER })
        fireEvent.change(screen.getByLabelText('Preset name'), { target: { value: 'Renamed' } })
        save()
        const alert = await screen.findByRole('alert')
        expect(alert).toHaveTextContent('Your plan doesn’t include this voice option.')
        expect(screen.getByLabelText('Preset name')).toHaveValue('Renamed')
        expect(onClose).not.toHaveBeenCalled()
    })

    describe('a refused voice at the base-voice field (AC-E6, 05 §7.4)', () => {
        it.each([
            ['voice_not_eligible', 'This voice can’t be picked right now. Choose another.'],
            ['voice_plan_locked', 'Your plan doesn’t include this voice option.'],
        ])('a 422 %s shows inline at the field, described on its control, until another voice is chosen', async (code, copy) => {
            api.updateVoicePreset.mockRejectedValue(Object.assign(new Error('Unprocessable'), { status: 422, code }))
            renderEditor({ mode: 'edit', source: PRESET_V2_USER })
            save()
            const fieldError = await screen.findByTestId('voice-field-error')
            expect(fieldError).toHaveTextContent(copy)
            // The form's save error says it too (the character editor's rule); only that one is announced.
            expect(screen.getByRole('alert')).toHaveTextContent(copy)
            const base = screen.getByRole('region', { name: 'Base voice' })
            expect(base).toContainElement(fieldError)
            expect(base).toHaveAttribute('aria-describedby', fieldError.id)
            expect(within(base).getByRole('button', { name: 'Change voice' })).toHaveAttribute('aria-describedby', fieldError.id)
            expect(within(base).getByRole('button', { name: 'Change voice' })).toHaveAccessibleDescription(copy)

            fireEvent.click(within(base).getByRole('button', { name: 'Change voice' }))
            // Still the refused voice while the picker is open.
            expect(screen.getByTestId('voice-field-error')).toBeInTheDocument()
            const maren = (await screen.findAllByTestId('catalog-voice-row')).find((row) => within(row).queryByText('Maren')) as HTMLElement
            fireEvent.click(within(maren).getByRole('button', { name: 'Use' }))
            expect(screen.queryByTestId('voice-field-error')).not.toBeInTheDocument()
            expect(within(screen.getByRole('region', { name: 'Base voice' })).getByRole('button', { name: 'Change voice' })).not.toHaveAttribute('aria-describedby')
        })

        it('keeps other refusals on the form only', async () => {
            api.updateVoicePreset.mockRejectedValue(Object.assign(new Error('Unprocessable'), { status: 422, code: 'voice_invalid' }))
            renderEditor({ mode: 'edit', source: PRESET_V2_USER })
            save()
            expect(await screen.findByRole('alert')).toBeInTheDocument()
            expect(screen.queryByTestId('voice-field-error')).not.toBeInTheDocument()
            expect(screen.getByRole('region', { name: 'Base voice' })).not.toHaveAttribute('aria-describedby')
        })

        it('a new save clears the field error first', async () => {
            let rejectSecond: (reason: unknown) => void = () => undefined
            api.updateVoicePreset
                .mockRejectedValueOnce(Object.assign(new Error('Unprocessable'), { status: 422, code: 'voice_not_eligible' }))
                .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectSecond = reject }))
            const { onClose } = renderEditor({ mode: 'edit', source: PRESET_V2_USER })
            save()
            expect(await screen.findByTestId('voice-field-error')).toBeInTheDocument()
            expect(screen.getByRole('region', { name: 'Base voice' })).toHaveAttribute('aria-describedby')
            save()
            // While the new save runs, the old refusal is gone from the field.
            await waitFor(() => expect(api.updateVoicePreset).toHaveBeenCalledTimes(2))
            expect(screen.queryByTestId('voice-field-error')).not.toBeInTheDocument()
            expect(screen.getByRole('region', { name: 'Base voice' })).not.toHaveAttribute('aria-describedby')
            // A refusal that is not about the voice keeps it off the field.
            await act(async () => rejectSecond(Object.assign(new Error('Unprocessable'), { status: 422, code: 'voice_invalid' })))
            expect(await screen.findByRole('alert')).toBeInTheDocument()
            expect(screen.queryByTestId('voice-field-error')).not.toBeInTheDocument()
            expect(screen.getByRole('region', { name: 'Base voice' })).not.toHaveAttribute('aria-describedby')
            expect(onClose).not.toHaveBeenCalled()
        })
    })

    describe('preview errors with their action (05 §6.4)', () => {
        it('"Not enough credits" links to the membership page in a new tab, keeping the draft', async () => {
            api.previewVoice.mockRejectedValue(Object.assign(new Error('Payment Required'), { status: 402, code: 'membership_quota_exceeded' }))
            renderEditor({ mode: 'edit', source: PRESET_V2_USER })
            fireEvent.click(screen.getByRole('button', { name: 'Preview voice' }))
            expect(await screen.findByRole('alert')).toHaveTextContent('Not enough credits for another preview.')
            const link = within(screen.getByTestId('preview-problem')).getByRole('link', { name: /View membership/ })
            expect(link).toHaveAttribute('href', '#/profile')
            expect(link).toHaveAttribute('target', '_blank')
            expect(link).toHaveAttribute('rel', 'noopener noreferrer')
            expect(link).toHaveTextContent('(opens in a new tab)')
        })

        it('a 409 voice_unavailable offers "Pick another voice", which opens the picker', async () => {
            api.previewVoice.mockRejectedValue(Object.assign(new Error('Conflict'), { status: 409, code: 'voice_unavailable' }))
            renderEditor({ mode: 'edit', source: PRESET_V2_USER })
            fireEvent.click(screen.getByRole('button', { name: 'Preview voice' }))
            expect(await screen.findByRole('alert')).toHaveTextContent('This voice is not available right now.')
            expect(within(screen.getByTestId('preview-problem')).queryByRole('link')).not.toBeInTheDocument()
            fireEvent.click(screen.getByRole('button', { name: 'Pick another voice' }))
            expect(screen.queryByTestId('preset-base-voice')).not.toBeInTheDocument()
            expect(await screen.findAllByTestId('catalog-voice-row')).not.toHaveLength(0)
            expect(screen.getByRole('region', { name: 'Base voice' })).toHaveFocus()
        })

        it('other preview errors carry no action', async () => {
            api.previewVoice.mockRejectedValue(Object.assign(new Error('Unavailable'), { status: 503, code: 'moderation_unavailable' }))
            renderEditor({ mode: 'edit', source: PRESET_V2_USER })
            fireEvent.click(screen.getByRole('button', { name: 'Preview voice' }))
            expect(await screen.findByRole('alert')).toHaveTextContent('Preview is temporarily unavailable.')
            expect(within(screen.getByTestId('preview-problem')).queryByRole('link')).not.toBeInTheDocument()
            expect(screen.queryByRole('button', { name: 'Pick another voice' })).not.toBeInTheDocument()
        })
    })

    it('needs a name of at most 255 characters and a voice', async () => {
        renderEditor()
        expect(screen.getByRole('button', { name: 'Save preset' })).toBeDisabled()
        fireEvent.change(screen.getByLabelText('Preset name'), { target: { value: 'Named' } })
        expect(screen.getByRole('button', { name: 'Save preset' })).toBeDisabled()
    })

    it('"Use voice defaults" stores no settings', async () => {
        renderEditor({ mode: 'edit', source: PRESET_V2_USER })
        fireEvent.click(screen.getByRole('button', { name: 'Use voice defaults' }))
        save()
        await waitFor(() => expect(api.updateVoicePreset).toHaveBeenCalledWith('user-v2', expect.objectContaining({ settings: null })))
    })

    it('plays the free catalog sample for an untuned voice', async () => {
        renderEditor({ mode: 'duplicate', source: PRESET_V2_GLOBAL })
        await waitFor(() => expect(api.getVoiceCatalogByKeys).toHaveBeenCalledWith([VOICE_KEY_MAREN]))
        expect(await screen.findByText('Free: voice sample')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Preview voice' }))
        await waitFor(() => expect(api.fetchProtectedMediaBlob).toHaveBeenCalledWith(CATALOG_MAREN_HOUSE.languages[0].sample_url, 'audio/mpeg'))
        expect(api.previewVoice).not.toHaveBeenCalled()
    })

    it('renders a metered V2 preview for a tuned recipe, on the chosen tier', async () => {
        renderEditor({ mode: 'edit', source: PRESET_V2_USER })
        fireEvent.click(screen.getByRole('radio', { name: /Expressive/ }))
        // Speed is hidden on Expressive, but kept in the recipe.
        expect(screen.queryByLabelText('Speed')).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Preview voice' }))
        await waitFor(() => expect(api.previewVoice).toHaveBeenCalledTimes(1))
        expect(api.previewVoice.mock.calls[0][0]).toEqual({
            voice_key: VOICE_KEY_ELDRIN,
            settings: { stability: 0.4, similarity_boost: 0.8, speed: 0.95 },
            emotion: 'calm',
            text_id: 'narration',
            language: 'en',
            tier: 'expressive',
        })
        expect(await screen.findByText('Standard voice')).toBeInTheDocument()
    })

    it('shows the emotion select with the Standard hint, and hides it where emotion is unsupported', () => {
        const { unmount } = render(
            <PresetEditorV2 open mode="edit" source={PRESET_V2_USER} capabilities={CAPABILITIES_EL_FREE} onSaved={vi.fn()} onClose={vi.fn()} notify={vi.fn()} />,
        )
        expect(screen.getByRole('combobox')).toHaveTextContent('Calm')
        expect(screen.getByText('Subtle on Standard voices')).toBeInTheDocument()
        unmount()

        const noEmotion: VoiceCapabilities = {
            ...CAPABILITIES_EL_FREE,
            surfaces: CAPABILITIES_EL_FREE.surfaces.map((surface) => ({ ...surface, supports_emotion: false })),
        }
        render(<PresetEditorV2 open mode="edit" source={PRESET_V2_USER} capabilities={noEmotion} onSaved={vi.fn()} onClose={vi.fn()} notify={vi.fn()} />)
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    })

    it('shows a stored value outside the range clamped and flagged, and clamps it only on save (AC-E2)', async () => {
        const outside: VoicePresetV2 = { ...PRESET_V2_USER, settings: { stability: 0.4, similarity_boost: 0.8, speed: 1.45 } }
        renderEditor({ mode: 'edit', source: outside })
        const flagText = 'Speed was saved as 1.45×, outside the supported range, so it shows as 1.20×. Saving this preset stores 1.20×.'
        expect(screen.getByRole('note')).toHaveTextContent(flagText)
        expect(screen.getByLabelText('Speed')).toHaveValue('1.2')
        // On Expressive speed has no slider, but the save still clamps it, so the flag stays.
        fireEvent.click(screen.getByRole('radio', { name: 'Expressive' }))
        expect(screen.queryByLabelText('Speed')).not.toBeInTheDocument()
        expect(screen.getByRole('note')).toHaveTextContent('Speed was saved as 1.45×, outside the supported range. Saving this preset stores 1.20×.')
        // Nothing was written while the flag was on screen.
        expect(api.updateVoicePreset).not.toHaveBeenCalled()
        save()
        await waitFor(() => expect(api.updateVoicePreset).toHaveBeenCalledTimes(1))
        expect(api.updateVoicePreset).toHaveBeenCalledWith('user-v2', expect.objectContaining({ settings: { stability: 0.4, similarity_boost: 0.8, speed: 1.2 } }))
    })

    it('flags nothing for a recipe inside the range', () => {
        renderEditor({ mode: 'edit', source: PRESET_V2_USER })
        expect(screen.queryByTestId('recipe-out-of-range')).not.toBeInTheDocument()
    })

    it('shows the recipe read-only when capabilities failed', () => {
        renderEditor({ mode: 'edit', source: PRESET_V2_USER, capabilities: null })
        expect(screen.getByTestId('recipe-controls-readonly')).toBeInTheDocument()
    })

    describe('credit previews (AC-P5, 05 §6.3)', () => {
        /** A Plus account (hard limit 10) with `left` renders left today: 3 free, then 1 credit each. */
        const plusWith = (left: number) => ({ membership: { plan_code: 'plus', previews_left: left, limits: { voice_preview: { daily_limit: 10 } } } })

        it('past the free renders the button says "1 credit" and the first paid render asks once', async () => {
            api.getUserProfile.mockResolvedValue(plusWith(6))
            api.previewVoice.mockResolvedValue({ cache_key: 'k', previews_left: 5, free_previews_left: 0, tier_used: 'standard', source: 'render' })
            renderEditor({ mode: 'edit', source: PRESET_V2_USER })
            const button = await screen.findByRole('button', { name: 'Preview voice · 1 credit' })
            expect(screen.getByText('6 previews left today')).toBeInTheDocument()

            fireEvent.click(button)
            let dialog = await screen.findByRole('dialog', { name: 'Preview with credits?' })
            expect(dialog).toHaveTextContent('Previews now cost 1 credit each. Continue?')
            fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
            expect(api.previewVoice).not.toHaveBeenCalled()

            fireEvent.click(screen.getByRole('button', { name: 'Preview voice · 1 credit' }))
            dialog = await screen.findByRole('dialog', { name: 'Preview with credits?' })
            fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }))
            await waitFor(() => expect(api.previewVoice).toHaveBeenCalledTimes(1))
            expect(await screen.findByText('5 previews left today')).toBeInTheDocument()

            // Confirmed once for the session: the next paid render goes straight through.
            fireEvent.click(screen.getByRole('button', { name: 'Preview voice · 1 credit' }))
            await waitFor(() => expect(api.previewVoice).toHaveBeenCalledTimes(2))
            expect(screen.queryByRole('dialog', { name: 'Preview with credits?' })).not.toBeInTheDocument()
        })

        it('free renders left: a plain Preview with no confirmation; the answer moves it to credits', async () => {
            api.getUserProfile.mockResolvedValue(plusWith(8))
            api.previewVoice.mockResolvedValue({ cache_key: 'k', previews_left: 7, free_previews_left: 0, tier_used: 'standard', source: 'render' })
            renderEditor({ mode: 'edit', source: PRESET_V2_USER })
            await screen.findByText('8 previews left today')
            fireEvent.click(screen.getByRole('button', { name: 'Preview voice' }))
            await waitFor(() => expect(api.previewVoice).toHaveBeenCalledTimes(1))
            expect(screen.queryByRole('dialog', { name: 'Preview with credits?' })).toBeNull()
            expect(await screen.findByRole('button', { name: 'Preview voice · 1 credit' })).toBeEnabled()
        })

        it('a free catalog sample never costs a credit', async () => {
            api.getUserProfile.mockResolvedValue(plusWith(6))
            renderEditor({ mode: 'duplicate', source: PRESET_V2_GLOBAL })
            expect(await screen.findByText('Free: voice sample')).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Preview voice' })).toBeEnabled()
            expect(screen.queryByRole('button', { name: /1 credit/ })).not.toBeInTheDocument()
        })

        it('stored empty settings are the defaults: the free sample, no credit (the BFF serves its sample too)', async () => {
            api.getUserProfile.mockResolvedValue(plusWith(6))
            renderEditor({ mode: 'edit', source: { ...PRESET_V2_GLOBAL, is_global: false, settings: {} } })
            expect(await screen.findByText('Free: voice sample')).toBeInTheDocument()
            fireEvent.click(screen.getByRole('button', { name: 'Preview voice' }))
            expect(screen.queryByRole('dialog', { name: 'Preview with credits?' })).not.toBeInTheDocument()
            expect(api.previewVoice).not.toHaveBeenCalled()
        })

        it('an untuned voice without a sample renders: "1 credit" and the confirmation', async () => {
            api.getUserProfile.mockResolvedValue(plusWith(6))
            // The BFF sends `sample_url: null` for a language without a sample (CatalogLanguage, `str | None`).
            const silent = catalogVoice({ voice_key: VOICE_KEY_MAREN, display_name: 'Maren', languages: [{ language: 'en', native: true, accent: null, accepted_models: ['standard'], sample_url: null as unknown as string }] })
            lookupAnswers(silent)
            renderEditor({ mode: 'duplicate', source: PRESET_V2_GLOBAL })
            fireEvent.click(await screen.findByRole('button', { name: 'Preview voice · 1 credit' }))
            expect(await screen.findByRole('dialog', { name: 'Preview with credits?' })).toBeInTheDocument()
            expect(api.previewVoice).not.toHaveBeenCalled()
            expect(screen.queryByText('Free: voice sample')).not.toBeInTheDocument()
        })

        it('remembers the confirmation per account: another user is asked again', async () => {
            api.getUserProfile.mockResolvedValue(plusWith(6))
            api.previewVoice.mockResolvedValue({ cache_key: 'k', previews_left: 5, free_previews_left: 0, tier_used: 'standard', source: 'render' })
            const props = { open: true, mode: 'edit' as const, source: PRESET_V2_USER, capabilities: CAPABILITIES_EL_PLUS, onSaved: vi.fn(), onClose: vi.fn(), notify: vi.fn() }
            const { rerender } = render(<PresetEditorV2 {...props} userHash="user-a" />)
            fireEvent.click(await screen.findByRole('button', { name: 'Preview voice · 1 credit' }))
            fireEvent.click(within(await screen.findByRole('dialog', { name: 'Preview with credits?' })).getByRole('button', { name: 'Continue' }))
            await waitFor(() => expect(api.previewVoice).toHaveBeenCalledTimes(1))

            rerender(<PresetEditorV2 {...props} userHash="user-b" />)
            fireEvent.click(await screen.findByRole('button', { name: 'Preview voice · 1 credit' }))
            expect(await screen.findByRole('dialog', { name: 'Preview with credits?' })).toBeInTheDocument()
            expect(api.previewVoice).toHaveBeenCalledTimes(1)
        })

        it('at the hard limit the button is disabled with the limit copy', async () => {
            api.getUserProfile.mockResolvedValue(plusWith(0))
            renderEditor({ mode: 'edit', source: PRESET_V2_USER })
            expect(await screen.findByText('Daily preview limit reached. Previews reset tomorrow.')).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Preview voice' })).toBeDisabled()
        })
    })

    describe('drawer (05 §10 Modals)', () => {
        it('names the preset in the title', () => {
            const { unmount } = render(<PresetEditorV2 open mode="edit" source={PRESET_V2_USER} capabilities={CAPABILITIES_EL_PLUS} onSaved={vi.fn()} onClose={vi.fn()} notify={vi.fn()} />)
            expect(screen.getByRole('dialog', { name: 'Edit “Harbour master”' })).toBeInTheDocument()
            unmount()
            const second = render(<PresetEditorV2 open mode="duplicate" source={PRESET_V2_GLOBAL} capabilities={CAPABILITIES_EL_PLUS} onSaved={vi.fn()} onClose={vi.fn()} notify={vi.fn()} />)
            expect(screen.getByRole('heading', { name: 'Duplicate “Fireside narrator”' })).toBeInTheDocument()
            second.unmount()
            renderEditor()
            expect(screen.getByRole('heading', { name: 'New voice preset' })).toBeInTheDocument()
        })

        it('closes at once without changes', () => {
            const { onClose } = renderEditor({ mode: 'edit', source: PRESET_V2_USER })
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
            expect(onClose).toHaveBeenCalledTimes(1)
            expect(screen.queryByRole('dialog', { name: 'Discard unsaved changes?' })).not.toBeInTheDocument()
        })

        it('asks before discarding unsaved changes, from Cancel and from Escape', async () => {
            const { onClose } = renderEditor({ mode: 'edit', source: PRESET_V2_USER })
            fireEvent.change(screen.getByLabelText('Preset name'), { target: { value: 'Harbour mistress' } })
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
            let dialog = await screen.findByRole('dialog', { name: 'Discard unsaved changes?' })
            expect(dialog).toHaveTextContent('Your changes to “Harbour master” haven’t been saved.')
            fireEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
            expect(onClose).not.toHaveBeenCalled()
            expect(screen.getByLabelText('Preset name')).toHaveValue('Harbour mistress')

            fireEvent.keyDown(document, { key: 'Escape' })
            dialog = await screen.findByRole('dialog', { name: 'Discard unsaved changes?' })
            fireEvent.click(within(dialog).getByRole('button', { name: 'Discard changes' }))
            expect(onClose).toHaveBeenCalledTimes(1)
        })

        it('after discarding, focus returns to what opened the editor', async () => {
            function Host() {
                const [open, setOpen] = useState(false)
                return (
                    <>
                        <button type="button" onClick={() => setOpen(true)}>Open editor</button>
                        <PresetEditorV2 open={open} mode="edit" source={PRESET_V2_USER} capabilities={CAPABILITIES_EL_PLUS} onSaved={vi.fn()} onClose={() => setOpen(false)} notify={vi.fn()} />
                    </>
                )
            }
            render(<Host />)
            const trigger = screen.getByRole('button', { name: 'Open editor' })
            trigger.focus()
            fireEvent.click(trigger)
            fireEvent.change(await screen.findByLabelText('Preset name'), { target: { value: 'Harbour mistress' } })
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
            fireEvent.click(within(await screen.findByRole('dialog', { name: 'Discard unsaved changes?' })).getByRole('button', { name: 'Discard changes' }))
            await waitFor(() => expect(screen.queryByLabelText('Preset name')).not.toBeInTheDocument())
            expect(document.activeElement).toBe(trigger)
        })

        it('a recipe moved back to where it was is not a change; a saved one closes without asking', async () => {
            const { onClose } = renderEditor({ mode: 'edit', source: PRESET_V2_USER })
            fireEvent.change(screen.getByLabelText('Stability'), { target: { value: '0.6' } })
            fireEvent.change(screen.getByLabelText('Stability'), { target: { value: '0.4' } })
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
            expect(onClose).toHaveBeenCalledTimes(1)

            fireEvent.change(screen.getByLabelText('Stability'), { target: { value: '0.6' } })
            save()
            await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2))
            expect(screen.queryByRole('dialog', { name: 'Discard unsaved changes?' })).not.toBeInTheDocument()
        })
    })

    describe('language (AC-E4, 05 §5.5, §10)', () => {
        it('shows the primary language and accent by label, with the language-scope note', async () => {
            lookupAnswers()
            renderEditor({ mode: 'edit', source: PRESET_V2_USER })
            const base = screen.getByTestId('preset-base-voice')
            expect(await within(base).findByTestId('preset-voice-language')).toHaveTextContent('Primary language: English · British accent')
            expect(within(base).getByText('Voices are tuned for English and Spanish; other languages may sound less natural.')).toBeInTheDocument()
            expect(within(base).getByText('Your story’s language is used when it’s known.')).toBeInTheDocument()
            // Read-only: no language select anywhere.
            expect(screen.queryByRole('combobox', { name: /language/i })).not.toBeInTheDocument()
        })

        it('leaves out an accent with no label instead of showing its slug', async () => {
            lookupAnswers(catalogVoice({ accent: 'trans_atlantic', languages: [{ ...CATALOG_ELDRIN.languages[0], accent: null }] }))
            renderEditor({ mode: 'edit', source: PRESET_V2_USER })
            const line = await within(screen.getByTestId('preset-base-voice')).findByTestId('preset-voice-language')
            expect(line).toHaveTextContent(/^Primary language: English$/)
            expect(screen.queryByText(/trans_atlantic/)).not.toBeInTheDocument()
        })

        it('marks the preview text with its language', async () => {
            lookupAnswers()
            renderEditor({ mode: 'edit', source: PRESET_V2_USER })
            const chips = await screen.findByRole('group', { name: 'Preview language' })
            expect(screen.getByText(BUILT_IN_PREVIEW_TEXTS.en.narration).closest('blockquote')).toHaveAttribute('lang', 'en')
            fireEvent.click(within(chips).getByRole('button', { name: 'Spanish' }))
            expect(screen.getByText(BUILT_IN_PREVIEW_TEXTS.es.narration).closest('blockquote')).toHaveAttribute('lang', 'es')
            fireEvent.click(screen.getByRole('button', { name: 'Preview voice' }))
            await waitFor(() => expect(api.previewVoice).toHaveBeenCalledTimes(1))
            // The played clip's transcript keeps the clip's language.
            await waitFor(() => expect(screen.getByText(BUILT_IN_PREVIEW_TEXTS.es.narration).closest('blockquote')).toHaveAttribute('lang', 'es'))
        })
    })
})
