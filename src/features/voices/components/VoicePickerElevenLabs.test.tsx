import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StoredCharacterVoice } from '@/shared'
import { hasAssignedVoice } from '@/shared/voice'
import {
    CAPABILITIES_EL_PLUS,
    CAPABILITIES_EL_PRO,
    CATALOG_ELDRIN,
    CATALOG_MAREN_HOUSE,
    CATALOG_SELA_LEAVING,
    PRESET_V2_GLOBAL,
    PRESET_V2_USER,
    V2_VOICE,
    VOICE_KEY_ELDRIN,
    VOICE_KEY_IDRIS,
    VOICE_KEY_MAREN,
    VOICE_KEY_ORRIN,
    VOICE_KEY_SELA,
    catalogVoice,
    effectiveVoice,
} from '../fixtures'
import { AuthContext } from '@/app/providers/AuthProvider'
import { resetPreviewCreditConfirmation } from '../usePreviewCreditConfirm'
import { clearPreviewTextsCache } from '../usePreviewTexts'
import { voiceFromPreset } from '../voiceFromPreset'
import { VoicePickerDialog } from './VoicePickerDialog'
import { VoicePickerElevenLabs } from './VoicePickerElevenLabs'

const api = {
    getVoiceCapabilities: vi.fn(),
    peekVoiceCapabilities: vi.fn(),
    listVoicePresets: vi.fn(),
    listVoiceCatalog: vi.fn(),
    getVoiceCatalogByKeys: vi.fn(),
    previewVoice: vi.fn(),
    getUserProfile: vi.fn(),
    getPreviewTexts: vi.fn(),
    fetchProtectedMediaBlob: vi.fn(),
}

vi.mock('@/app/hooks/usePlaylist', () => ({ usePlaylist: () => ({}) }))
vi.mock('@/infrastructure/api', () => ({
    apiService: new Proxy({}, { get: (_target, key: string) => (...args: unknown[]) => (api as Record<string, (...a: unknown[]) => unknown>)[key](...args) }),
    isProtectedMediaUrl: () => false,
}))

/** 05 §10: a preset row's preview names the preset, its voice and the language heard; "Use" names the preset. */
const HARBOUR_PREVIEW = 'Preview Harbour master, Eldrin, English'
// WCAG 2.5.3: a paid preview's name starts with its visible text.
const HARBOUR_PAID = 'Preview · 1 credit: Harbour master, Eldrin, English'
const FIRESIDE_PREVIEW = 'Preview Fireside narrator, Maren, English'

function rowOf(name: string): HTMLElement {
    return screen.getAllByTestId('voice-picker-preset-row').find((row) => within(row).queryByText(name)) as HTMLElement
}

/** Every pick is a recognised stored voice (or a cleared one). */
function expectStoredVoices(onSelect: ReturnType<typeof vi.fn>) {
    for (const [voice] of onSelect.mock.calls as [StoredCharacterVoice | null][]) {
        if (voice !== null) expect(hasAssignedVoice(voice)).toBe(true)
    }
}

describe('VoicePickerDialog (R1-FE-01)', () => {
    beforeEach(() => {
        vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() })
        clearPreviewTextsCache()
        resetPreviewCreditConfirmation()
        api.getVoiceCapabilities.mockReset().mockResolvedValue(CAPABILITIES_EL_PLUS)
        api.peekVoiceCapabilities.mockReset().mockReturnValue(null)
        api.listVoicePresets.mockReset().mockResolvedValue([PRESET_V2_USER, PRESET_V2_GLOBAL])
        api.listVoiceCatalog.mockReset().mockResolvedValue({ items: [CATALOG_ELDRIN, CATALOG_MAREN_HOUSE], next_cursor: null })
        api.getVoiceCatalogByKeys.mockReset().mockResolvedValue([CATALOG_ELDRIN, CATALOG_MAREN_HOUSE, CATALOG_SELA_LEAVING])
        api.previewVoice.mockReset().mockResolvedValue({ cache_key: 'k', previews_left: 4, tier_used: 'standard' })
        api.getUserProfile.mockReset().mockResolvedValue({ membership: { plan_code: 'plus' } })
        api.getPreviewTexts.mockReset().mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }))
        api.fetchProtectedMediaBlob.mockReset().mockResolvedValue(new Blob(['mp3'], { type: 'audio/mpeg' }))
    })

    it('offers presets and the catalog, and no system-voice tab', async () => {
        render(<VoicePickerDialog open onSelect={vi.fn()} onClose={vi.fn()} />)
        expect(await screen.findByTestId('voice-picker-elevenlabs')).toBeInTheDocument()
        const tabs = screen.getByRole('group', { name: 'Voice source' })
        expect(within(tabs).getByRole('button', { name: 'Presets' })).toBeInTheDocument()
        expect(within(tabs).getByRole('button', { name: 'Voice catalog' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'System voices' })).not.toBeInTheDocument()
    })

    it('uses a V2 preset as a V2 voice with its preset linkage', async () => {
        const onSelect = vi.fn()
        render(<VoicePickerDialog open onSelect={onSelect} onClose={vi.fn()} />)
        await screen.findByText('Harbour master')
        fireEvent.click(within(rowOf('Harbour master')).getByRole('button', { name: 'Use Harbour master' }))
        expect(onSelect).toHaveBeenCalledWith({
            schema_version: 2,
            provider: 'elevenlabs',
            voice_key: VOICE_KEY_ELDRIN,
            voice_name: 'Eldrin',
            settings: PRESET_V2_USER.settings,
            emotion: 'calm',
            language_code: null,
            preset_id: 'user-v2',
            preset_name: 'Harbour master',
        })
    })

    it('keeps a preset whose voice is locked for this plan reachable, with "Use" aria-disabled and the reason described (AC-K2, 05 §10)', async () => {
        const onSelect = vi.fn()
        api.getVoiceCatalogByKeys.mockResolvedValue([catalogVoice({ locked: true, min_plan: 'pro' }), CATALOG_MAREN_HOUSE])
        render(<VoicePickerDialog open onSelect={onSelect} onClose={vi.fn()} />)
        await screen.findByText('Harbour master')
        const use = within(rowOf('Harbour master')).getByRole('button', { name: 'Use Harbour master' })
        await waitFor(() => expect(use).toHaveAttribute('aria-disabled', 'true'))
        // Not natively disabled: it stays in the tab order and names why it cannot be picked.
        expect(use).not.toBeDisabled()
        expect(use).toHaveAccessibleDescription('Upgrade to pick this voice')
        use.focus()
        expect(use).toHaveFocus()
        fireEvent.click(use)
        expect(onSelect).not.toHaveBeenCalled()
        // Audition stays enabled.
        expect(within(rowOf('Harbour master')).getByRole('button', { name: /^Preview/ })).toBeEnabled()
        // 03 §5.12: the lock names the plan (`min_plan`), and screen readers hear why.
        const lock = within(rowOf('Harbour master')).getByText('Pro').closest('[data-badge="locked"]') as HTMLElement
        expect(lock).toHaveAttribute('title', 'Upgrade to pick this voice')
        expect(within(lock).getByText('Locked: requires Pro')).toHaveClass('sr-only')
        const fireside = within(rowOf('Fireside narrator')).getByRole('button', { name: 'Use Fireside narrator' })
        expect(fireside).toBeEnabled()
        expect(fireside).not.toHaveAttribute('aria-disabled')
        expect(fireside).not.toHaveAttribute('aria-describedby')
    })

    it('keeps an unusable (removed) preset voice natively disabled', async () => {
        api.getVoiceCatalogByKeys.mockResolvedValue([catalogVoice({ status: 'removed' }), CATALOG_MAREN_HOUSE])
        render(<VoicePickerDialog open onSelect={vi.fn()} onClose={vi.fn()} />)
        await screen.findByText('Harbour master')
        const use = within(rowOf('Harbour master')).getByRole('button', { name: 'Use Harbour master' })
        await waitFor(() => expect(use).toBeDisabled())
        expect(use).not.toHaveAttribute('aria-disabled')
    })

    it('keeps a plan-locked voice that is also removed natively disabled, with no upgrade hint (no upgrade makes it pickable)', async () => {
        api.getVoiceCatalogByKeys.mockResolvedValue([catalogVoice({ locked: true, min_plan: 'pro', status: 'removed' }), CATALOG_MAREN_HOUSE])
        render(<VoicePickerDialog open onSelect={vi.fn()} onClose={vi.fn()} />)
        await screen.findByText('Harbour master')
        const use = within(rowOf('Harbour master')).getByRole('button', { name: 'Use Harbour master' })
        await waitFor(() => expect(use).toBeDisabled())
        expect(use).not.toHaveAttribute('aria-disabled')
        expect(use).not.toHaveAttribute('aria-describedby')
        expect(within(rowOf('Harbour master')).queryByText('Upgrade to pick this voice')).not.toBeInTheDocument()
    })

    it('names each row\'s buttons after its preset, the preview also after its voice and language (05 §10)', async () => {
        api.previewVoice.mockReturnValue(new Promise(() => undefined))
        render(<VoicePickerDialog open currentVoice={voiceFromPreset(PRESET_V2_USER)} onSelect={vi.fn()} onClose={vi.fn()} />)
        await screen.findByText('Fireside narrator')
        const harbour = within(rowOf('Harbour master'))
        // The visible text stays short; the name tells the rows apart.
        expect(harbour.getByRole('button', { name: 'Selected: Harbour master' })).toHaveTextContent(/^Selected$/)
        expect(within(rowOf('Fireside narrator')).getByRole('button', { name: 'Use Fireside narrator' })).toHaveTextContent(/^Use$/)
        expect(within(rowOf('Fireside narrator')).getByRole('button', { name: FIRESIDE_PREVIEW })).toHaveTextContent(/^Preview$/)
        const preview = harbour.getByRole('button', { name: HARBOUR_PREVIEW })
        // Not a toggle, as on the Studio card: in flight it is a named "Stop" action (05 §6.3); the clip player carries aria-pressed.
        expect(preview).not.toHaveAttribute('aria-pressed')
        fireEvent.click(preview)
        const stop = await harbour.findByRole('button', { name: 'Stop the preview of Harbour master' })
        expect(stop).toBe(preview)
        expect(stop).toHaveTextContent(/^Stop$/)
        expect(stop).not.toHaveAttribute('aria-pressed')
    })

    it('re-opens on the tab that holds the current voice, keeping a tab chosen while open', async () => {
        const handlers = { onSelect: vi.fn(), onClose: vi.fn() }
        const picker = (open: boolean) => <VoicePickerElevenLabs open={open} currentVoice={V2_VOICE} capabilities={CAPABILITIES_EL_PLUS} {...handlers} />
        const { rerender } = render(picker(true))
        await screen.findByText('Harbour master')
        // A bare catalog voice opens on the catalog tab; a tab chosen right after opening stays chosen.
        expect(screen.getByTestId('voice-picker-presets')).toHaveAttribute('hidden')
        fireEvent.click(screen.getByRole('button', { name: 'Presets' }))
        expect(screen.getByTestId('voice-picker-catalog')).toHaveAttribute('hidden')
        rerender(picker(false))
        rerender(picker(true))
        expect(screen.getByTestId('voice-picker-catalog')).not.toHaveAttribute('hidden')
        expect(screen.getByTestId('voice-picker-presets')).toHaveAttribute('hidden')
    })

    it('marks the selected source tab with aria-pressed', async () => {
        render(<VoicePickerDialog open onSelect={vi.fn()} onClose={vi.fn()} />)
        await screen.findByText('Harbour master')
        const tab = (name: string) => within(screen.getByRole('group', { name: 'Voice source' })).getByRole('button', { name })
        expect(tab('Presets')).toHaveAttribute('aria-pressed', 'true')
        expect(tab('Voice catalog')).toHaveAttribute('aria-pressed', 'false')
        fireEvent.click(tab('Voice catalog'))
        await waitFor(() => expect(tab('Voice catalog')).toHaveAttribute('aria-pressed', 'true'))
        expect(tab('Presets')).toHaveAttribute('aria-pressed', 'false')
        expect(screen.getByTestId('voice-picker-presets')).toHaveAttribute('hidden')
    })

    it('previews a V2 preset with the V2 body', async () => {
        render(<VoicePickerDialog open onSelect={vi.fn()} onClose={vi.fn()} />)
        await screen.findByText('Harbour master')
        fireEvent.click(within(rowOf('Harbour master')).getByRole('button', { name: HARBOUR_PREVIEW }))
        await waitFor(() => expect(api.previewVoice).toHaveBeenCalledTimes(1))
        expect(api.previewVoice.mock.calls[0][0]).toEqual({
            voice_key: VOICE_KEY_ELDRIN,
            settings: PRESET_V2_USER.settings,
            emotion: 'calm',
            text_id: 'narration',
            language: 'en',
            tier: 'standard',
        })
    })

    it('previews a Fish preset with the version-3 Fish body', async () => {
        const gabriel = catalogVoice({
            voice_key: VOICE_KEY_IDRIS, display_name: 'Gabriel', provider: 'fish_audio', primary_language: 'es',
            languages: [{ language: 'es', native: true, accent: null, accepted_models: ['standard'], sample_url: `/voices/catalog/${VOICE_KEY_IDRIS}/preview.mp3` }],
        })
        api.listVoicePresets.mockResolvedValue([{
            preset_id: 'fish-1', name: 'Gabriel · Español', description: null, voice_key: VOICE_KEY_IDRIS,
            voice_name: 'Gabriel', settings: null, emotion: 'calm', language_code: 'es', is_global: false,
            schema_version: 3, provider: 'fish_audio',
        }])
        api.getVoiceCatalogByKeys.mockResolvedValue([gabriel])
        render(<VoicePickerDialog open onSelect={vi.fn()} onClose={vi.fn()} />)
        await screen.findByText('Gabriel · Español')
        fireEvent.click(within(rowOf('Gabriel · Español')).getByRole('button', { name: /^Preview/ }))
        await waitFor(() => expect(api.previewVoice).toHaveBeenCalledTimes(1))
        expect(api.previewVoice.mock.calls[0][0]).toEqual(expect.objectContaining({
            schema_version: 3, provider: 'fish_audio', voice_key: VOICE_KEY_IDRIS, emotion: 'calm', language: 'es',
        }))
    })

    describe('preset previews: credits, free samples and language (AC-P5, AC-P2, 05 §6.3, §10)', () => {
        /** A Pro account (hard limit 20) with `left` renders left today: 3 free, then 1 credit each. */
        const proWith = (left: number) => ({ membership: { plan_code: 'pro', previews_left: left, limits: { voice_preview: { daily_limit: 20 } } } })
        const paidAnswer = { cache_key: 'k', previews_left: 11, free_previews_left: 0, tier_used: 'standard', source: 'render' }

        it('past the free renders a tuned preset reads "Preview · 1 credit" and the first paid render asks once', async () => {
            api.getUserProfile.mockResolvedValue(proWith(12))
            api.previewVoice.mockResolvedValue(paidAnswer)
            render(
                <AuthContext.Provider value={{ userHash: 'user-a' } as never}>
                    <VoicePickerDialog open onSelect={vi.fn()} onClose={vi.fn()} />
                </AuthContext.Provider>,
            )
            await screen.findByText('Harbour master')
            const paid = await within(rowOf('Harbour master')).findByRole('button', { name: HARBOUR_PAID })
            // WCAG 2.5.3: the visible text is the start of the name.
            expect(paid).toHaveTextContent(/^Preview · 1 credit$/)
            expect(screen.getByText('12 previews left today')).toBeInTheDocument()

            fireEvent.click(paid)
            let dialog = await screen.findByRole('dialog', { name: 'Preview with credits?' })
            expect(dialog).toHaveTextContent('Previews now cost 1 credit each. Continue?')
            fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
            expect(api.previewVoice).not.toHaveBeenCalled()
            // Cancelling closes the dialog alone: the picker stays open.
            expect(screen.getByTestId('voice-picker-elevenlabs')).toBeInTheDocument()

            fireEvent.click(within(rowOf('Harbour master')).getByRole('button', { name: HARBOUR_PAID }))
            dialog = await screen.findByRole('dialog', { name: 'Preview with credits?' })
            fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }))
            await waitFor(() => expect(api.previewVoice).toHaveBeenCalledTimes(1))
            expect(await screen.findByText('11 previews left today')).toBeInTheDocument()

            // Confirmed once for the session: the next paid render goes straight through.
            fireEvent.click(await within(rowOf('Harbour master')).findByRole('button', { name: HARBOUR_PAID }))
            await waitFor(() => expect(api.previewVoice).toHaveBeenCalledTimes(2))
            expect(screen.queryByRole('dialog', { name: 'Preview with credits?' })).not.toBeInTheDocument()
        })

        it('free renders left: a plain Preview with no confirmation', async () => {
            api.getUserProfile.mockResolvedValue(proWith(19))
            render(<VoicePickerDialog open onSelect={vi.fn()} onClose={vi.fn()} />)
            await screen.findByText('19 previews left today')
            expect(screen.queryByRole('button', { name: /1 credit/ })).not.toBeInTheDocument()
            fireEvent.click(within(rowOf('Harbour master')).getByRole('button', { name: HARBOUR_PREVIEW }))
            await waitFor(() => expect(api.previewVoice).toHaveBeenCalledTimes(1))
            expect(screen.queryByRole('dialog', { name: 'Preview with credits?' })).toBeNull()
        })

        it('an untuned preset with a catalog sample says "Free: voice sample", never costs a credit and is not gated by the limit', async () => {
            api.getUserProfile.mockResolvedValue(proWith(0))
            api.previewVoice.mockResolvedValue({ cache_key: 'k', previews_left: 0, free_previews_left: 0, tier_used: 'standard', source: 'sample', url: '/voices/catalog/maren/preview.mp3' })
            render(<VoicePickerDialog open onSelect={vi.fn()} onClose={vi.fn()} />)
            await screen.findByText('Daily preview limit reached. Previews reset tomorrow.')
            const fireside = rowOf('Fireside narrator')
            const button = await within(fireside).findByRole('button', { name: FIRESIDE_PREVIEW })
            await waitFor(() => expect(button).toHaveAccessibleDescription('Free: voice sample'))
            expect(button).toBeEnabled()
            // A tuned preset renders: disabled at the hard limit.
            expect(within(rowOf('Harbour master')).getByRole('button', { name: HARBOUR_PREVIEW })).toBeDisabled()
            expect(within(rowOf('Harbour master')).queryByText('Free: voice sample')).not.toBeInTheDocument()

            fireEvent.click(button)
            expect(screen.queryByRole('dialog', { name: 'Preview with credits?' })).not.toBeInTheDocument()
            await waitFor(() => expect(api.previewVoice).toHaveBeenCalledTimes(1))
            expect(api.previewVoice.mock.calls[0][0]).toEqual(expect.objectContaining({ voice_key: VOICE_KEY_MAREN, settings: null, emotion: null }))
            // The sample plays with its own caption (no fixed-text transcript), shown once.
            await waitFor(() => expect(within(fireside).getAllByText('Free: voice sample')).toHaveLength(1))
            expect(fireside.querySelector('blockquote')).toBeNull()
        })

        it('past the free renders an untuned preset with a sample still reads plain "Preview", never asks and leaves the confirmation unspent', async () => {
            api.getUserProfile.mockResolvedValue(proWith(12))
            api.previewVoice.mockResolvedValue({ cache_key: 'k', previews_left: 12, free_previews_left: 0, tier_used: 'standard', source: 'sample', url: `/voices/catalog/${VOICE_KEY_MAREN}/preview.mp3` })
            render(
                <AuthContext.Provider value={{ userHash: 'user-a' } as never}>
                    <VoicePickerDialog open onSelect={vi.fn()} onClose={vi.fn()} />
                </AuthContext.Provider>,
            )
            await screen.findByText('Harbour master')
            await within(rowOf('Harbour master')).findByRole('button', { name: HARBOUR_PAID })
            const fireside = await within(rowOf('Fireside narrator')).findByRole('button', { name: FIRESIDE_PREVIEW })
            expect(within(rowOf('Fireside narrator')).getByText('Free: voice sample')).toBeInTheDocument()

            fireEvent.click(fireside)
            expect(screen.queryByRole('dialog', { name: 'Preview with credits?' })).not.toBeInTheDocument()
            await waitFor(() => expect(api.previewVoice).toHaveBeenCalledTimes(1))
            expect(api.previewVoice.mock.calls[0][0]).toEqual(expect.objectContaining({ voice_key: VOICE_KEY_MAREN }))
            // The session's one confirmation (shared with the Studio) is still due on the first paid render.
            fireEvent.click(await within(rowOf('Harbour master')).findByRole('button', { name: HARBOUR_PAID }))
            expect(await screen.findByRole('dialog', { name: 'Preview with credits?' })).toBeInTheDocument()
            expect(api.previewVoice).toHaveBeenCalledTimes(1)
        })

        it('on the Expressive tier an untuned preset whose only sample is the Expressive one is free', async () => {
            api.getVoiceCapabilities.mockResolvedValue(CAPABILITIES_EL_PRO)
            api.getUserProfile.mockResolvedValue(proWith(12))
            const marenExpressive = catalogVoice({
                voice_key: VOICE_KEY_MAREN,
                display_name: 'Maren',
                languages: [{ language: 'en', native: true, accent: null, accepted_models: ['standard', 'expressive'], sample_url: `/voices/catalog/${VOICE_KEY_MAREN}/preview.mp3?tier=expressive` }],
            })
            api.getVoiceCatalogByKeys.mockResolvedValue([CATALOG_ELDRIN, marenExpressive])
            render(<VoicePickerDialog open onSelect={vi.fn()} onClose={vi.fn()} />)
            await screen.findByText('Harbour master')
            await within(rowOf('Harbour master')).findByRole('button', { name: HARBOUR_PAID })
            const fireside = await within(rowOf('Fireside narrator')).findByRole('button', { name: FIRESIDE_PREVIEW })
            expect(fireside).toHaveAccessibleDescription('Free: voice sample')
        })

        it('past the free renders an emotion or a setting alone is a paid render; an untuned preset is free on the sample the server serves', async () => {
            api.getUserProfile.mockResolvedValue(proWith(12))
            const untuned = { ...PRESET_V2_GLOBAL, is_global: false }
            api.listVoicePresets.mockResolvedValue([
                { ...untuned, preset_id: 'emotion-only', name: 'Calm Maren', emotion: 'calm' },
                { ...untuned, preset_id: 'settings-only', name: 'Slow Maren', settings: { speed: 0.9 } },
                { ...untuned, preset_id: 'idris-es', name: 'Lighthouse keeper', voice_key: VOICE_KEY_IDRIS, voice_name: 'Idris', language_code: null },
                { ...untuned, preset_id: 'orrin-en', name: 'Quayside crier', voice_key: VOICE_KEY_ORRIN, voice_name: 'Orrin', language_code: null },
            ])
            // Idris's English sample is Expressive only: on the Standard tier only its Spanish sample is free.
            const idris = catalogVoice({
                voice_key: VOICE_KEY_IDRIS,
                display_name: 'Idris',
                languages: [
                    { language: 'en', native: true, accent: null, accepted_models: ['standard', 'expressive'], sample_url: `/voices/catalog/${VOICE_KEY_IDRIS}/preview.mp3?language=en&tier=expressive` },
                    { language: 'es', native: false, accent: null, accepted_models: ['standard'], sample_url: `/voices/catalog/${VOICE_KEY_IDRIS}/preview.mp3?language=es` },
                ],
            })
            // Orrin's Spanish sample is Expressive only: the server serves its English (primary) Standard sample.
            const orrin = catalogVoice({
                voice_key: VOICE_KEY_ORRIN,
                display_name: 'Orrin',
                languages: [
                    { language: 'en', native: true, accent: null, accepted_models: ['standard'], sample_url: `/voices/catalog/${VOICE_KEY_ORRIN}/preview.mp3?language=en` },
                    { language: 'es', native: false, accent: null, accepted_models: ['standard', 'expressive'], sample_url: `/voices/catalog/${VOICE_KEY_ORRIN}/preview.mp3?language=es&tier=expressive` },
                ],
            })
            api.getVoiceCatalogByKeys.mockResolvedValue([CATALOG_MAREN_HOUSE, idris, orrin])
            render(<VoicePickerDialog open language="es" onSelect={vi.fn()} onClose={vi.fn()} />)
            await screen.findByText('Calm Maren')
            // One catalog read serves every row: once a sample is offered as free, all the voices are in.
            await within(rowOf('Lighthouse keeper')).findByText('Free: voice sample')
            expect(await within(rowOf('Calm Maren')).findByRole('button', { name: 'Preview · 1 credit: Calm Maren, Maren, English' })).toBeInTheDocument()
            expect(within(rowOf('Slow Maren')).getByRole('button', { name: 'Preview · 1 credit: Slow Maren, Maren, English' })).toBeInTheDocument()
            const lighthouse = within(rowOf('Lighthouse keeper')).getByRole('button', { name: 'Preview Lighthouse keeper, Idris, Spanish' })
            expect(lighthouse).toHaveAccessibleDescription('Free: voice sample')
            // The name gives the language heard (the sample's), not the text's.
            expect(within(rowOf('Quayside crier')).getByRole('button', { name: 'Preview Quayside crier, Orrin, English' })).toHaveAccessibleDescription('Free: voice sample')
        })

        it('marks the transcript with the language of its preview text', async () => {
            render(<VoicePickerDialog open language="es" onSelect={vi.fn()} onClose={vi.fn()} />)
            await screen.findByText('Harbour master')
            // Eldrin speaks Spanish: the row auditions the Spanish narration line.
            await waitFor(() => expect(api.getVoiceCatalogByKeys).toHaveBeenCalled())
            fireEvent.click(within(rowOf('Harbour master')).getByRole('button', { name: 'Preview Harbour master, Eldrin, Spanish' }))
            await waitFor(() => expect(api.previewVoice).toHaveBeenCalledTimes(1))
            expect(api.previewVoice.mock.calls[0][0]).toEqual(expect.objectContaining({ language: 'es' }))
            const transcript = await waitFor(() => {
                const quote = rowOf('Harbour master').querySelector('blockquote')
                expect(quote).not.toBeNull()
                return quote as HTMLElement
            })
            expect(transcript).toHaveAttribute('lang', 'es')
        })

        it('marks the transcript with the clip\'s language, not the card\'s: an English-only voice under a Spanish card', async () => {
            api.listVoicePresets.mockResolvedValue([{ ...PRESET_V2_USER, preset_id: 'user-maren', name: 'Tavern keeper', voice_key: VOICE_KEY_MAREN, voice_name: 'Maren' }])
            render(<VoicePickerDialog open language="es" onSelect={vi.fn()} onClose={vi.fn()} />)
            await screen.findByText('Tavern keeper')
            // Maren speaks only English: the row auditions the English narration line.
            fireEvent.click(await within(rowOf('Tavern keeper')).findByRole('button', { name: 'Preview Tavern keeper, Maren, English' }))
            await waitFor(() => expect(api.previewVoice).toHaveBeenCalledTimes(1))
            expect(api.previewVoice.mock.calls[0][0]).toEqual(expect.objectContaining({ voice_key: VOICE_KEY_MAREN, language: 'en' }))
            const transcript = await waitFor(() => {
                const quote = rowOf('Tavern keeper').querySelector('blockquote')
                expect(quote).not.toBeNull()
                return quote as HTMLElement
            })
            expect(transcript).toHaveAttribute('lang', 'en')
        })

        it('closing the picker while the credit confirmation is open dismisses it and runs nothing', async () => {
            api.getUserProfile.mockResolvedValue(proWith(12))
            const handlers = { onSelect: vi.fn(), onClose: vi.fn() }
            const picker = (open: boolean) => (
                <AuthContext.Provider value={{ userHash: 'user-a' } as never}>
                    <VoicePickerElevenLabs open={open} capabilities={CAPABILITIES_EL_PLUS} {...handlers} />
                </AuthContext.Provider>
            )
            const { rerender } = render(picker(true))
            await screen.findByText('Harbour master')
            fireEvent.click(await within(rowOf('Harbour master')).findByRole('button', { name: HARBOUR_PAID }))
            expect(await screen.findByRole('dialog', { name: 'Preview with credits?' })).toBeInTheDocument()

            rerender(picker(false))
            await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Preview with credits?' })).not.toBeInTheDocument())
            rerender(picker(true))
            await screen.findByText('Harbour master')
            expect(screen.queryByRole('dialog', { name: 'Preview with credits?' })).not.toBeInTheDocument()
            expect(api.previewVoice).not.toHaveBeenCalled()
        })
    })

    describe('preset preview refusals (05 §6.1, §6.4: the Studio\'s notice)', () => {
        const refuse = (status: number, code: string, extra: Record<string, unknown> = {}) =>
            Object.assign(new Error('Refused'), { status, code, ...extra })

        it('402 "Not enough credits" links to the membership page in a new tab (the card keeps its draft)', async () => {
            api.previewVoice.mockRejectedValue(refuse(402, 'membership_quota_exceeded'))
            render(<VoicePickerDialog open onSelect={vi.fn()} onClose={vi.fn()} />)
            await screen.findByText('Harbour master')
            fireEvent.click(within(rowOf('Harbour master')).getByRole('button', { name: HARBOUR_PREVIEW }))
            const row = rowOf('Harbour master')
            expect(await within(row).findByRole('alert')).toHaveTextContent('Not enough credits for another preview.')
            const link = within(row).getByRole('link', { name: /^View membership\s*\(opens in a new tab\)$/ })
            expect(link).toHaveAttribute('href', '#/profile')
            expect(link).toHaveAttribute('target', '_blank')
            expect(link).toHaveAttribute('rel', 'noopener noreferrer')
            expect(within(row).queryByRole('button', { name: 'Pick another voice' })).not.toBeInTheDocument()
            // Only the previewed row shows it.
            expect(within(rowOf('Fireside narrator')).queryByRole('alert')).not.toBeInTheDocument()
        })

        it('409 voice_unavailable offers "Pick another voice": the catalog tab, focus on its search', async () => {
            api.previewVoice.mockRejectedValue(refuse(409, 'voice_unavailable'))
            render(<VoicePickerDialog open onSelect={vi.fn()} onClose={vi.fn()} />)
            await screen.findByText('Harbour master')
            fireEvent.click(within(rowOf('Harbour master')).getByRole('button', { name: HARBOUR_PREVIEW }))
            const row = rowOf('Harbour master')
            expect(await within(row).findByRole('alert')).toHaveTextContent('This voice is not available right now.')
            expect(within(row).queryByRole('link', { name: /View membership/ })).not.toBeInTheDocument()
            fireEvent.click(within(row).getByRole('button', { name: 'Pick another voice' }))
            expect(screen.getByTestId('voice-picker-catalog')).not.toHaveAttribute('hidden')
            expect(screen.getByTestId('voice-picker-presets')).toHaveAttribute('hidden')
            const search = await screen.findByRole('searchbox', { name: 'Search voices' })
            await waitFor(() => expect(search).toHaveFocus())
        })

        it('a token-bucket 429 shows the rate-limit copy, with no action', async () => {
            api.previewVoice.mockRejectedValue(refuse(429, 'rate_limited', { retryable: true, retryAfterSeconds: 0 }))
            render(<VoicePickerDialog open onSelect={vi.fn()} onClose={vi.fn()} />)
            await screen.findByText('Harbour master')
            fireEvent.click(within(rowOf('Harbour master')).getByRole('button', { name: HARBOUR_PREVIEW }))
            const row = rowOf('Harbour master')
            // One automatic retry after Retry-After, then the copy stays.
            await waitFor(() => expect(api.previewVoice).toHaveBeenCalledTimes(2))
            expect(await within(row).findByRole('alert')).toHaveTextContent('Too many previews at once. Try again in a moment.')
            expect(within(row).queryByRole('link')).not.toBeInTheDocument()
            expect(within(row).queryByRole('button', { name: 'Pick another voice' })).not.toBeInTheDocument()
        })

        it('any other failure keeps the generic copy', async () => {
            api.previewVoice.mockRejectedValue(refuse(500, 'internal_error'))
            render(<VoicePickerDialog open onSelect={vi.fn()} onClose={vi.fn()} />)
            await screen.findByText('Harbour master')
            fireEvent.click(within(rowOf('Harbour master')).getByRole('button', { name: HARBOUR_PREVIEW }))
            const row = rowOf('Harbour master')
            const alert = await within(row).findByRole('alert')
            expect(alert.textContent).not.toBe('')
            expect(within(row).queryByRole('link')).not.toBeInTheDocument()
            expect(within(row).queryByRole('button', { name: 'Pick another voice' })).not.toBeInTheDocument()
        })
    })

    it('picks a catalog voice as a bare V2 voice', async () => {
        const onSelect = vi.fn()
        const onClose = vi.fn()
        render(<VoicePickerDialog open onSelect={onSelect} onClose={onClose} />)
        fireEvent.click(await screen.findByRole('button', { name: 'Voice catalog' }))
        const catalog = screen.getByTestId('voice-picker-catalog')
        await within(catalog).findByText('Maren')
        const maren = within(catalog).getAllByTestId('catalog-voice-row').find((row) => within(row).queryByText('Maren')) as HTMLElement
        fireEvent.click(within(maren).getByRole('button', { name: 'Use' }))
        expect(onSelect).toHaveBeenCalledWith({
            schema_version: 2,
            provider: 'elevenlabs',
            voice_key: CATALOG_MAREN_HOUSE.voice_key,
            voice_name: 'Maren',
            settings: null,
            emotion: null,
            language_code: null,
        })
        expect(onClose).toHaveBeenCalled()
        expectStoredVoices(onSelect)
    })

    it('shows the current voice with what it plays as', async () => {
        render(
            <VoicePickerDialog
                open
                currentVoice={V2_VOICE}
                currentEffectiveVoice={effectiveVoice({ display_name: 'Maren', substitution_reason: 'voice_removed', badges: ['replaced'] })}
                onSelect={vi.fn()}
                onClose={vi.fn()}
            />,
        )
        const current = await screen.findByTestId('voice-picker-current')
        expect(within(current).getByText('Eldrin')).toBeInTheDocument()
        expect(within(current).getByText('Plays as Maren')).toBeInTheDocument()
        expect(within(current).getByText('Voice replaced')).toBeInTheDocument()
    })

    it('switches a leaving current voice to its replacement from the current-voice row (05 §7.8, AC-K6)', async () => {
        const onSelect = vi.fn()
        const onClose = vi.fn()
        const sela = { ...V2_VOICE, voice_key: VOICE_KEY_SELA, voice_name: 'Sela', emotion: 'calm' as const }
        render(
            <VoicePickerDialog
                open
                currentVoice={sela}
                currentEffectiveVoice={effectiveVoice({ voice_key: VOICE_KEY_SELA, display_name: 'Sela', badges: ['leaving'] })}
                onSelect={onSelect}
                onClose={onClose}
            />,
        )
        const current = await screen.findByTestId('voice-picker-current')
        expect(await within(current).findByText(/^Leaving on /)).toBeInTheDocument()
        fireEvent.click(await within(current).findByRole('button', { name: 'Switch to Maren' }))
        // The replacement keeps the tuned settings and emotion.
        expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
            schema_version: 2,
            voice_key: VOICE_KEY_MAREN,
            voice_name: 'Maren',
            settings: sela.settings,
            emotion: 'calm',
        }))
        expect(onClose).toHaveBeenCalled()
        expectStoredVoices(onSelect)
    })

    it('"Choose a voice" and "Pick another" open the catalog tab; "Keep for now" closes the prompt', async () => {
        const fromPreset = { ...V2_VOICE, preset_id: 'user-v2', preset_name: 'Harbour master' }
        const { unmount } = render(
            <VoicePickerDialog open currentVoice={fromPreset} currentEffectiveVoice={effectiveVoice({ badges: ['needs_reselect'] })} onSelect={vi.fn()} onClose={vi.fn()} />,
        )
        const current = await screen.findByTestId('voice-picker-current')
        // A preset voice opens on the presets tab.
        expect(screen.getByTestId('voice-picker-catalog')).toHaveAttribute('hidden')
        fireEvent.click(within(current).getByRole('button', { name: 'Choose a voice' }))
        expect(screen.getByTestId('voice-picker-catalog')).not.toHaveAttribute('hidden')
        expect(screen.getByTestId('voice-picker-presets')).toHaveAttribute('hidden')
        fireEvent.click(within(current).getByRole('button', { name: 'Keep for now' }))
        expect(within(current).queryByTestId('voice-owner-prompts')).not.toBeInTheDocument()
        expect(within(current).getByText('Voice needs re-selection')).toBeInTheDocument()
        unmount()

        render(<VoicePickerDialog open currentVoice={fromPreset} currentEffectiveVoice={effectiveVoice({ badges: ['retired'] })} onSelect={vi.fn()} onClose={vi.fn()} />)
        fireEvent.click(within(await screen.findByTestId('voice-picker-current')).getByRole('button', { name: 'Pick another' }))
        expect(screen.getByTestId('voice-picker-catalog')).not.toHaveAttribute('hidden')
    })

    it('"Choose a voice" on a bare catalog voice (already on the catalog tab) moves focus to the catalog search; "Keep for now" to the current row', async () => {
        render(<VoicePickerDialog open currentVoice={V2_VOICE} currentEffectiveVoice={effectiveVoice({ badges: ['needs_reselect'] })} onSelect={vi.fn()} onClose={vi.fn()} />)
        const current = await screen.findByTestId('voice-picker-current')
        expect(screen.getByTestId('voice-picker-catalog')).not.toHaveAttribute('hidden')
        const search = await screen.findByRole('searchbox', { name: 'Search voices' })
        expect(search).not.toHaveFocus()
        fireEvent.click(within(current).getByRole('button', { name: 'Choose a voice' }))
        await waitFor(() => expect(search).toHaveFocus())

        const keep = within(current).getByRole('button', { name: 'Keep for now' })
        keep.focus()
        fireEvent.click(keep)
        expect(within(current).queryByTestId('voice-owner-prompts')).not.toBeInTheDocument()
        await waitFor(() => expect(current).toHaveFocus())
        expect(current).toHaveAccessibleName('Currently using')
    })

    it('dates a leaving current voice and switches it from the picker\'s own lookup (05 §9.3)', async () => {
        const onSelect = vi.fn()
        render(
            <VoicePickerDialog
                open
                currentVoice={{ ...V2_VOICE, voice_key: VOICE_KEY_SELA, voice_name: 'Sela', preset_id: 'gone', preset_name: 'Night ferry' }}
                currentEffectiveVoice={effectiveVoice({ voice_key: VOICE_KEY_SELA, display_name: 'Sela', badges: ['leaving'] })}
                onSelect={onSelect}
                onClose={vi.fn()}
            />,
        )
        const current = await screen.findByTestId('voice-picker-current')
        expect(await within(current).findByText(/^Leaving on /)).toBeInTheDocument()
        expect(within(current).queryByText('Leaving soon')).not.toBeInTheDocument()
        await screen.findByText('Harbour master')
        fireEvent.click(await within(current).findByRole('button', { name: 'Switch to Maren' }))
        expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ schema_version: 2, voice_key: VOICE_KEY_MAREN }))
        // The current row reads the leaving key once; the prompts do not read it again.
        const currentReads = api.getVoiceCatalogByKeys.mock.calls.filter(([keys]) => (keys as string[]).join() === VOICE_KEY_SELA)
        expect(currentReads).toHaveLength(1)
        expectStoredVoices(onSelect)
    })

    it('plays a free sample of the voice the current row plays as, one sample at a time with the catalog (05 §7.2)', async () => {
        render(
            <VoicePickerDialog
                open
                currentVoice={{ ...V2_VOICE, voice_key: VOICE_KEY_SELA, voice_name: 'Sela', preset_id: 'gone', preset_name: 'Night ferry' }}
                currentEffectiveVoice={effectiveVoice({ voice_key: VOICE_KEY_MAREN, display_name: 'Maren', substitution_reason: 'voice_removed', badges: ['replaced'] })}
                onSelect={vi.fn()}
                onClose={vi.fn()}
            />,
        )
        const current = await screen.findByTestId('voice-picker-current')
        // The current row's button names the voice and language, distinct from the catalog row's (05 §10).
        const currentPlay = await within(current).findByRole('button', { name: 'Play sample of the current voice, Maren, English' })
        expect(currentPlay).toHaveAttribute('aria-pressed', 'false')
        fireEvent.click(currentPlay)
        await waitFor(() => expect(api.fetchProtectedMediaBlob).toHaveBeenCalledWith(CATALOG_MAREN_HOUSE.languages[0].sample_url, 'audio/mpeg'))
        await waitFor(() => expect(currentPlay).toHaveAttribute('aria-pressed', 'true'))

        // The catalog's own Maren row did not start it; a catalog sample takes over.
        fireEvent.click(screen.getByRole('button', { name: 'Voice catalog' }))
        const catalog = screen.getByTestId('voice-picker-catalog')
        await within(catalog).findByText('Eldrin')
        expect(within(catalog).getByRole('button', { name: 'Listen to Maren, English' })).toBeEnabled()
        const eldrinPlay = within(catalog).getByRole('button', { name: 'Listen to Eldrin, English' })
        fireEvent.click(eldrinPlay)
        await waitFor(() => expect(eldrinPlay).toHaveAccessibleName('Stop the sample of Eldrin'))
        expect(currentPlay).toHaveAttribute('aria-pressed', 'false')

        // Back on the current row, the catalog row stops.
        fireEvent.click(currentPlay)
        await waitFor(() => expect(currentPlay).toHaveAttribute('aria-pressed', 'true'))
        expect(eldrinPlay).toHaveAccessibleName('Listen to Eldrin, English')
    })

    it('auditions a stored V2 voice in the card language, and offers no sample or prompt without a catalog voice', async () => {
        const { unmount } = render(<VoicePickerDialog open currentVoice={V2_VOICE} language="es" onSelect={vi.fn()} onClose={vi.fn()} />)
        const current = await screen.findByTestId('voice-picker-current')
        fireEvent.click(await within(current).findByRole('button', { name: 'Play sample of the current voice, Eldrin, Spanish' }))
        await waitFor(() => expect(api.fetchProtectedMediaBlob).toHaveBeenCalledWith(CATALOG_ELDRIN.languages[1].sample_url, 'audio/mpeg'))
        unmount()

        // A stored voice the catalog does not list, with no projection, offers no sample.
        render(<VoicePickerDialog open currentVoice={{ ...V2_VOICE, voice_key: VOICE_KEY_IDRIS, voice_name: 'Idris', preset_id: 'gone' }} currentEffectiveVoice={null} onSelect={vi.fn()} onClose={vi.fn()} />)
        const unlisted = await screen.findByTestId('voice-picker-current')
        await screen.findByText('Harbour master')
        expect(within(unlisted).queryByRole('button')).not.toBeInTheDocument()
    })

    it('opens at once and lists the presets while the capabilities read is still out', async () => {
        api.getVoiceCapabilities.mockReturnValue(new Promise(() => undefined))
        render(<VoicePickerDialog open onSelect={vi.fn()} onClose={vi.fn()} />)
        expect(screen.getByTestId('voice-picker-elevenlabs')).toBeInTheDocument()
        expect(await screen.findByText('Harbour master')).toBeInTheDocument()
        expect(api.listVoicePresets).toHaveBeenCalledTimes(1)
    })

    it('previews from Standard when the capabilities read fails', async () => {
        api.getVoiceCapabilities.mockRejectedValue(new Error('offline'))
        render(<VoicePickerDialog open onSelect={vi.fn()} onClose={vi.fn()} />)
        await screen.findByText('Harbour master')
        fireEvent.click(within(rowOf('Harbour master')).getByRole('button', { name: HARBOUR_PREVIEW }))
        await waitFor(() => expect(api.previewVoice).toHaveBeenCalledTimes(1))
        expect(api.previewVoice.mock.calls[0][0]).toMatchObject({ tier: 'standard' })
    })

    it('shows a catalog 404 as unavailable and keeps the presets', async () => {
        api.listVoiceCatalog.mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }))
        render(<VoicePickerDialog open onSelect={vi.fn()} onClose={vi.fn()} />)
        await screen.findByText('Harbour master')
        fireEvent.click(within(screen.getByRole('group', { name: 'Voice source' })).getByRole('button', { name: 'Voice catalog' }))
        expect(await screen.findByText('The voice catalog is unavailable right now.')).toBeInTheDocument()
        expect(screen.getByTestId('voice-picker-elevenlabs')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'System voices' })).not.toBeInTheDocument()
    })
})
