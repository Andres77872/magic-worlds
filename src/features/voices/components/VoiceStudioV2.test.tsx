import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    CAPABILITIES_EL_PRO,
    CATALOG_ELDRIN,
    CATALOG_MAREN_HOUSE,
    CATALOG_ORRIN_UNTESTED,
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
import { resetPreviewCreditConfirmation } from '../usePreviewCreditConfirm'
import { paidPreviewResponse } from '@/test-utils/previewBilling'
import { clearPreviewTextsCache } from '../usePreviewTexts'
import { NavigationContext } from '@/app/providers/NavigationProvider'
import type { ComponentProps } from 'react'
import { PresetCardV2 } from './PresetCardV2'
import { VoiceStudioPage } from './VoiceStudioPage'
import { CAPABILITIES_FISH, CATALOG_FISH, PRESET_FISH } from '../fishFixtures'

const mockUseAuth = vi.fn()
const api = {
    getVoiceCapabilities: vi.fn(),
    listVoicePresets: vi.fn(),
    listVoiceCatalog: vi.fn(),
    getVoiceCatalogByKeys: vi.fn(),
    deleteVoicePreset: vi.fn(),
    createVoicePreset: vi.fn(),
    updateVoicePreset: vi.fn(),
    previewVoice: vi.fn(),
    getUserProfile: vi.fn(),
    getPreviewTexts: vi.fn(),
    fetchProtectedMediaBlob: vi.fn(),
    getUserPreferences: vi.fn(),
}

vi.mock('@/app/hooks', () => ({ useAuth: () => mockUseAuth() }))
vi.mock('@/app/hooks/usePlaylist', () => ({ usePlaylist: () => ({}) }))
vi.mock('./NarrationTierSetting', () => ({ NarrationTierSetting: () => <div data-testid="narration-tier-setting" /> }))
vi.mock('@/features/workspaces/originNavigation', () => ({
    useOriginNavigation: () => ({ navigateToOrigin: vi.fn(), registerOriginNavigator: () => () => undefined }),
}))
vi.mock('@/infrastructure/api', () => ({
    apiService: new Proxy({}, {
        get: (_target, key: string) => (key in api ? (...args: unknown[]) => (api as Record<string, (...a: unknown[]) => unknown>)[key](...args) : undefined),
    }),
    isProtectedMediaUrl: () => false,
}))

function cardOf(name: string): HTMLElement {
    return screen.getAllByTestId('preset-card-v2').find((card) => within(card).queryByText(name)) as HTMLElement
}

/** 05 §10 audio controls: a card's Preview names the preset, its voice and the language heard; the visible text stays short. */
const HARBOUR_PREVIEW = 'Preview Harbour master, Eldrin, English'
// WCAG 2.5.3: a paid preview's name starts with its visible text.
const HARBOUR_PAID = 'Preview · 1 credit: Harbour master, Eldrin, English'
const FIRESIDE_PREVIEW = 'Preview Fireside narrator, Maren, English'
const FIRESIDE_PAID = 'Preview · 1 credit: Fireside narrator, Maren, English'
const NIGHT_FERRY_PREVIEW = 'Preview Night ferry, Sela, English'

describe('VoiceStudioPage (R1-FE-02)', () => {
    beforeEach(() => {
        window.history.replaceState(null, '', '/#/voices?view=saved')
        api.listVoiceCatalog.mockReset().mockResolvedValue({ items: [], next_cursor: null })
        mockUseAuth.mockReturnValue({ isAuthenticated: true, openLoginModal: vi.fn(), userHash: 'user-a' })
        api.listVoicePresets.mockReset().mockResolvedValue([PRESET_V2_USER])
        api.getUserProfile.mockReset().mockResolvedValue({ membership: {} })
        api.getPreviewTexts.mockReset().mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }))
        api.getVoiceCatalogByKeys.mockReset().mockResolvedValue([])
    })

    it('shows a spinner while the capabilities load, then the studio', async () => {
        let resolve: (value: unknown) => void = () => undefined
        api.getVoiceCapabilities.mockReset().mockImplementation(() => new Promise((done) => { resolve = done }))
        render(<VoiceStudioPage />)
        expect(screen.getByText(/Loading/)).toBeInTheDocument()
        expect(screen.queryByTestId('voice-studio-v2')).not.toBeInTheDocument()
        await waitFor(() => expect(api.getVoiceCapabilities).toHaveBeenCalled())
        resolve(CAPABILITIES_EL_PRO)
        expect(await screen.findByTestId('voice-studio-v2')).toBeInTheDocument()
        expect(await screen.findByText('Harbour master')).toBeInTheDocument()
    })

    it('still opens the studio when the capabilities read fails', async () => {
        api.getVoiceCapabilities.mockReset().mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }))
        render(<VoiceStudioPage />)
        expect(await screen.findByTestId('voice-studio-v2')).toBeInTheDocument()
        expect(await screen.findByText('Harbour master')).toBeInTheDocument()
    })

    it('keeps the studio and the open draft while the editor retries a failed capabilities read', async () => {
        let release: (value: unknown) => void = () => undefined
        api.getVoiceCapabilities.mockReset()
            .mockRejectedValueOnce(Object.assign(new Error('Not Found'), { status: 404 }))
            .mockImplementation(() => new Promise((done) => { release = done }))
        api.listVoiceCatalog.mockReset().mockResolvedValue({ items: [], next_cursor: null })
        api.getUserPreferences.mockReset().mockResolvedValue({ preferred_language: 'en', has_preference: false, narration_tier: 'standard' })
        render(<VoiceStudioPage />)
        await screen.findByText('Harbour master')
        fireEvent.click(screen.getByRole('button', { name: 'New voice setting' }))
        fireEvent.change(await screen.findByLabelText('Name for these settings'), { target: { value: 'My draft' } })
        // The failed read leaves the recipe read-only, with its retry.
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
        await waitFor(() => expect(api.getVoiceCapabilities).toHaveBeenLastCalledWith({ fresh: true }))
        // In flight: no page spinner, the studio and the draft stay.
        expect(screen.getByTestId('voice-studio-v2')).toBeInTheDocument()
        expect(screen.getByLabelText('Name for these settings')).toHaveValue('My draft')
        release(CAPABILITIES_EL_PRO)
        // The read lands in the open editor: the recipe controls appear, the draft is untouched.
        expect(await screen.findByRole('slider', { name: /Stability/ })).toBeInTheDocument()
        expect(screen.getByLabelText('Name for these settings')).toHaveValue('My draft')
    })
})

describe('VoiceStudioV2 (R1-FE-02)', () => {
    beforeEach(() => {
        vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:clip'), revokeObjectURL: vi.fn() })
        clearPreviewTextsCache()
        resetPreviewCreditConfirmation()
        localStorage.clear()
        window.history.replaceState(null, '', '/#/voices?view=saved')
        mockUseAuth.mockReturnValue({ isAuthenticated: true, openLoginModal: vi.fn(), userHash: 'user-a' })
        api.getVoiceCapabilities.mockReset().mockResolvedValue(CAPABILITIES_EL_PRO)
        api.listVoicePresets.mockReset().mockResolvedValue([PRESET_V2_USER, PRESET_V2_GLOBAL])
        api.listVoiceCatalog.mockReset().mockResolvedValue({ items: [CATALOG_ELDRIN], next_cursor: null })
        api.getVoiceCatalogByKeys.mockReset().mockResolvedValue([CATALOG_ELDRIN, CATALOG_MAREN_HOUSE, CATALOG_SELA_LEAVING])
        api.deleteVoicePreset.mockReset().mockResolvedValue(undefined)
        api.createVoicePreset.mockReset().mockResolvedValue(PRESET_V2_USER)
        api.updateVoicePreset.mockReset().mockResolvedValue(PRESET_V2_USER)
        api.previewVoice.mockReset().mockResolvedValue({ cache_key: 'k', previews_left: 4, tier_used: 'expressive' })
        api.getUserProfile.mockReset().mockResolvedValue({ membership: { plan_code: 'pro' } })
        api.getPreviewTexts.mockReset().mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }))
        api.fetchProtectedMediaBlob.mockReset().mockResolvedValue(new Blob(['mp3'], { type: 'audio/mpeg' }))
        clearPreferredLanguageCache()
        api.getUserPreferences.mockReset().mockResolvedValue({ preferred_language: 'en', has_preference: false, narration_tier: 'expressive' })
    })

    afterEach(() => {
        window.history.replaceState(null, '', '/')
    })

    it('opens on distinct voices in both languages and saves a selected Fish voice without searching again', async () => {
        window.history.replaceState(null, '', '/#/voices')
        const gabriel = { ...CATALOG_FISH, display_name: 'Gabriel', primary_language: 'es',
            languages: [{ ...CATALOG_FISH.languages[0], language: 'es', sample_url: '/voices/catalog/gabriel/sample.mp3' }] }
        api.getVoiceCapabilities.mockResolvedValue(CAPABILITIES_FISH)
        api.listVoiceCatalog.mockResolvedValue({ items: [CATALOG_ELDRIN, gabriel], next_cursor: null })
        const saved = { ...PRESET_FISH, name: 'Gabriel', voice_name: 'Gabriel' }
        api.createVoicePreset.mockResolvedValue(saved)
        render(<VoiceStudioPage />)

        expect(await screen.findByRole('tab', { name: 'Explore voices' })).toHaveAttribute('aria-selected', 'true')
        const catalogue = screen.getByRole('tabpanel', { name: 'Explore voices' })
        await within(catalogue).findByText('Gabriel')
        expect(api.listVoiceCatalog.mock.calls[0][0]).not.toHaveProperty('language')
        expect(within(catalogue).getByText('Eldrin')).toBeVisible()
        expect(screen.queryByRole('button', { name: 'New voice setting' })).not.toBeInTheDocument()
        expect(screen.getByTestId('narration-tier-setting')).not.toBeVisible()

        const row = within(catalogue).getAllByTestId('catalog-voice-row').find((item) => within(item).queryByText('Gabriel'))!
        expect(within(row).getByRole('button', { name: 'Listen to Gabriel, Spanish' })).toHaveTextContent('Listen')
        fireEvent.click(within(row).getByRole('button', { name: 'Use this voice' }))
        expect(await screen.findByLabelText('Name for these settings')).toHaveValue('Gabriel')
        expect(screen.queryByRole('slider', { name: /Stability/ })).not.toBeInTheDocument()
        expect(within(screen.getByRole('dialog')).queryByRole('searchbox', { name: 'Search voices' })).not.toBeInTheDocument()
        api.listVoicePresets.mockResolvedValue([saved])
        fireEvent.click(screen.getByRole('button', { name: 'Save settings' }))
        await waitFor(() => expect(api.createVoicePreset).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Gabriel', voice_key: gabriel.voice_key, provider: 'fish_audio', schema_version: 3,
        })))
        expect(screen.getByRole('tab', { name: 'Saved settings' })).toHaveAttribute('aria-selected', 'true')
        expect(await within(screen.getByRole('tabpanel', { name: 'Saved settings' })).findByRole('button', { name: 'Edit Gabriel' })).toBeVisible()
    })

    describe('navigation and root tools', () => {
        type Nav = NonNullable<ComponentProps<typeof NavigationContext.Provider>['value']>
        const navigation = () => ({ setPage: vi.fn(), replaceHash: vi.fn() })
        const renderWith = (nav: ReturnType<typeof navigation>) => render(
            <NavigationContext.Provider value={nav as unknown as Nav}><VoiceStudioPage /></NavigationContext.Provider>,
        )

        it('keeps the open tab in the URL and the header free of tab actions', async () => {
            const nav = navigation()
            renderWith(nav)
            await screen.findByText('Harbour master')
            // The saved list's own toolbar refreshes it; the header carries no consumer actions.
            expect(screen.getByRole('button', { name: 'Refresh saved settings' })).toBeVisible()
            expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument()
            expect(screen.queryByRole('button', { name: 'Manage catalog' })).not.toBeInTheDocument()
            expect(screen.queryByRole('button', { name: 'Create a voice' })).not.toBeInTheDocument()
            fireEvent.click(screen.getByRole('tab', { name: 'Explore voices' }))
            expect(nav.replaceHash).toHaveBeenLastCalledWith('#/voices')
            fireEvent.click(screen.getByRole('tab', { name: 'Saved settings' }))
            expect(nav.replaceHash).toHaveBeenLastCalledWith('#/voices?view=saved')
            // The tab shows how many saved settings there are, without changing its name.
            expect(within(screen.getByRole('tab', { name: 'Saved settings' })).getByText('2')).toBeInTheDocument()
        })

        it('offers root the console: the catalog, voice creation and one voice', async () => {
            window.history.replaceState(null, '', '/#/voices')
            mockUseAuth.mockReturnValue({ isAuthenticated: true, openLoginModal: vi.fn(), userHash: 'root-a', user: { user_type: 'root' } })
            const nav = navigation()
            renderWith(nav)
            fireEvent.click(await screen.findByRole('button', { name: 'Manage Eldrin in the voice console' }))
            expect(nav.setPage).toHaveBeenLastCalledWith('admin-voices', { hash: `#/admin/voices?module=catalog&voice=${VOICE_KEY_ELDRIN}` })
            fireEvent.click(screen.getByRole('button', { name: 'Manage catalog' }))
            expect(nav.setPage).toHaveBeenLastCalledWith('admin-voices', { hash: '#/admin/voices?module=catalog' })
            fireEvent.click(screen.getByRole('button', { name: 'Create a voice' }))
            expect(nav.setPage).toHaveBeenLastCalledWith('admin-voices', { hash: '#/admin/voices?module=create&provider=fish_audio' })
        })

        it('shows a consumer no console shortcut on catalog voices', async () => {
            window.history.replaceState(null, '', '/#/voices')
            renderWith(navigation())
            await screen.findByRole('button', { name: /^Listen to Eldrin/ })
            expect(screen.queryByRole('button', { name: /in the voice console/ })).not.toBeInTheDocument()
        })

        it('sends an account with no saved settings to the catalog', async () => {
            api.listVoicePresets.mockResolvedValue([])
            renderWith(navigation())
            fireEvent.click(await screen.findByRole('button', { name: 'Explore voices' }))
            expect(screen.getByRole('tab', { name: 'Explore voices' })).toHaveAttribute('aria-selected', 'true')
        })
    })

    it('keeps saved settings and ElevenLabs quality in their own section', async () => {
        render(<VoiceStudioPage />)
        expect(await screen.findByRole('heading', { name: 'My saved settings' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Shared settings' })).toBeInTheDocument()
        expect(screen.getByTestId('narration-tier-setting')).toBeInTheDocument()
        expect(screen.getByText('Fish Audio uses its own voice model; this setting applies to ElevenLabs.')).toBeVisible()
    })

    it('offers the actions of each row kind', async () => {
        render(<VoiceStudioPage />)
        await screen.findByText('Harbour master')

        const v2 = cardOf('Harbour master')
        expect(within(v2).getByRole('button', { name: HARBOUR_PREVIEW })).toBeInTheDocument()
        expect(within(v2).getByRole('button', { name: 'Edit Harbour master' })).toBeInTheDocument()
        expect(within(v2).getByRole('button', { name: 'Delete Harbour master' })).toBeInTheDocument()
        expect(within(v2).getByText('Stability 0.4')).toBeInTheDocument()
        expect(within(v2).getByText('Calm')).toBeInTheDocument()

        const globalV2 = cardOf('Fireside narrator')
        expect(within(globalV2).getByText('Voice defaults')).toBeInTheDocument()
        expect(within(globalV2).getByRole('button', { name: 'Duplicate Fireside narrator' })).toBeEnabled()
        expect(within(globalV2).queryByRole('button', { name: /Edit|Delete/ })).not.toBeInTheDocument()
    })

    it('opens the editor in the mode each action needs', async () => {
        render(<VoiceStudioPage />)
        await screen.findByText('Harbour master')
        fireEvent.click(within(cardOf('Harbour master')).getByRole('button', { name: 'Edit Harbour master' }))
        expect(await screen.findByRole('heading', { name: 'Edit “Harbour master”' })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Save settings' }))
        await waitFor(() => expect(api.updateVoicePreset).toHaveBeenCalledWith('user-v2', expect.objectContaining({ voice_key: VOICE_KEY_ELDRIN })))
        await waitFor(() => expect(screen.queryByRole('heading', { name: 'Edit “Harbour master”' })).not.toBeInTheDocument())
        fireEvent.click(within(cardOf('Fireside narrator')).getByRole('button', { name: 'Duplicate Fireside narrator' }))
        expect(await screen.findByRole('heading', { name: 'Duplicate “Fireside narrator”' })).toBeInTheDocument()
    })

    it('previews a V2 preset on the stored narration tier', async () => {
        render(<VoiceStudioPage />)
        await screen.findByText('Harbour master')
        fireEvent.click(within(cardOf('Harbour master')).getByRole('button', { name: HARBOUR_PREVIEW }))
        await waitFor(() => expect(api.previewVoice).toHaveBeenCalledTimes(1))
        expect(api.previewVoice.mock.calls[0][0]).toMatchObject({ voice_key: VOICE_KEY_ELDRIN, text_id: 'narration', tier: 'expressive' })
        expect(await within(cardOf('Harbour master')).findByText('Transcript')).toBeInTheDocument()
    })

    it('captions a catalog-sample answer as a free sample, never under the fixed line', async () => {
        api.previewVoice.mockResolvedValue({ cache_key: 'sha', url: '/voices/catalog/vk/sample.mp3', previews_left: 4, text: null, tier_used: 'expressive', source: 'sample' })
        render(<VoiceStudioPage />)
        await screen.findByText('Harbour master')
        fireEvent.click(within(cardOf('Harbour master')).getByRole('button', { name: HARBOUR_PREVIEW }))
        expect(await within(cardOf('Harbour master')).findByText('Free: voice sample')).toBeInTheDocument()
        expect(within(cardOf('Harbour master')).queryByText('Transcript')).not.toBeInTheDocument()
    })

    it('deletes a user preset through the confirm dialog', async () => {
        render(<VoiceStudioPage />)
        await screen.findByText('Harbour master')
        fireEvent.click(within(cardOf('Harbour master')).getByRole('button', { name: 'Delete Harbour master' }))
        fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete voice settings' })).getByRole('button', { name: 'Delete' }))
        await waitFor(() => expect(api.deleteVoicePreset).toHaveBeenCalledWith('user-v2'))
        await waitFor(() => expect(screen.getAllByTestId('preset-card-v2').some((card) => card.getAttribute('data-preset-id') === 'user-v2')).toBe(false))
    })

    describe('owner prompts and language badges (05 §5.5, §7.8)', () => {
        const SELA_PRESET = { ...PRESET_V2_USER, preset_id: 'sela-v2', name: 'Night ferry', voice_key: VOICE_KEY_SELA, voice_name: 'Sela' }

        it('"Switch to {replacement}" rewrites a leaving preset with its own recipe', async () => {
            api.listVoicePresets.mockResolvedValue([SELA_PRESET, PRESET_V2_GLOBAL])
            render(<VoiceStudioPage />)
            await screen.findByText('Night ferry')
            const card = cardOf('Night ferry')
            expect(await within(card).findByText(/^Leaving on /)).toBeInTheDocument()
            fireEvent.click(within(card).getByRole('button', { name: 'Switch to Maren' }))
            await waitFor(() => expect(api.updateVoicePreset).toHaveBeenCalledTimes(1))
            expect(api.updateVoicePreset).toHaveBeenCalledWith('sela-v2', expect.objectContaining({
                name: 'Night ferry',
                voice_key: VOICE_KEY_MAREN,
                emotion: 'calm',
                settings: expect.objectContaining({ stability: 0.4, similarity_boost: 0.8 }),
            }))
            await waitFor(() => expect(api.listVoicePresets).toHaveBeenCalledTimes(2))
            // A global preset is read-only: no owner prompt.
            expect(within(cardOf('Fireside narrator')).queryByTestId('voice-owner-prompts')).not.toBeInTheDocument()
        })

        it('"Choose a voice" opens the editor on the picker', async () => {
            api.getVoiceCatalogByKeys.mockResolvedValue([catalogVoice({ status: 'blocked' }), CATALOG_MAREN_HOUSE])
            render(<VoiceStudioPage />)
            await screen.findByText('Harbour master')
            fireEvent.click(await within(cardOf('Harbour master')).findByRole('button', { name: 'Choose a voice' }))
            expect(await screen.findByRole('heading', { name: 'Edit “Harbour master”' })).toBeInTheDocument()
            expect(await screen.findAllByTestId('catalog-voice-row')).not.toHaveLength(0)
        })

        it('badges a voice not tested in the preset language, else the preferred one', async () => {
            api.getUserPreferences.mockResolvedValue({ preferred_language: 'es', has_preference: true, narration_tier: 'expressive' })
            api.getVoiceCatalogByKeys.mockResolvedValue([CATALOG_ELDRIN, CATALOG_ORRIN_UNTESTED, CATALOG_MAREN_HOUSE])
            api.listVoicePresets.mockResolvedValue([
                { ...PRESET_V2_USER, preset_id: 'orrin-pref', name: 'Quiet scribe', voice_key: VOICE_KEY_ORRIN, voice_name: 'Orrin' },
                { ...PRESET_V2_USER, preset_id: 'orrin-en', name: 'Old scribe', voice_key: VOICE_KEY_ORRIN, voice_name: 'Orrin', language_code: 'en' },
                PRESET_V2_USER,
            ])
            render(<VoiceStudioPage />)
            await screen.findByText('Quiet scribe')
            expect(await within(cardOf('Quiet scribe')).findByText(/^Not tested in Spanish/)).toBeInTheDocument()
            expect(within(cardOf('Old scribe')).queryByText(/^Not tested in/)).not.toBeInTheDocument()
            expect(within(cardOf('Harbour master')).queryByText(/^Not tested in/)).not.toBeInTheDocument()
        })
    })

    describe('usage strip and credit previews (AC-S3, AC-P5)', () => {
        const usage = { narration_chars_used: 2_000, narration_chars_limit: 12_000, call_seconds_used: 330, call_seconds_limit: 1_800 }

        it('shows previews, narration characters and call minutes left today from the usage DTO', async () => {
            api.getUserProfile.mockResolvedValue({ membership: { plan_code: 'pro', previews_left: 12, limits: { voice_preview: { daily_limit: 20 } }, ...usage } })
            api.previewVoice.mockImplementation(paidPreviewResponse({ cache_key: 'k', previews_left: 11, free_previews_left: 0, tier_used: 'expressive', source: 'render' }, 12))
            render(<VoiceStudioPage />)
            const strip = await screen.findByRole('list', { name: 'Voice allowance today' })
            await waitFor(() => expect(strip).toHaveTextContent('Previews left today: 12'))
            expect(strip).toHaveTextContent('Narration left today: 10,000 characters')
            // 1,470 s left: whole minutes, rounded down.
            expect(strip).toHaveTextContent('Call time left today: 24 min')

            // A paid card preview: "1 credit", one confirmation, then the strip follows the answer.
            fireEvent.click(await within(cardOf('Harbour master')).findByRole('button', { name: HARBOUR_PAID }))
            const dialog = await screen.findByRole('dialog', { name: 'Preview with credits?' })
            expect(api.previewVoice.mock.calls.map(([body]) => body.max_credit_cost)).toEqual([0])
            fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }))
            await waitFor(() => expect(api.previewVoice).toHaveBeenCalledTimes(2))
            await waitFor(() => expect(strip).toHaveTextContent('Previews left today: 11'))
            // An untuned global preset plays the free catalog sample: no credit label.
            expect(within(cardOf('Fireside narrator')).getByRole('button', { name: FIRESIDE_PREVIEW })).toBeEnabled()
        })

        it('an untuned card whose voice has no sample renders: "1 credit" and the confirmation (AC-P5)', async () => {
            api.getUserProfile.mockResolvedValue({ membership: { plan_code: 'pro', previews_left: 12, limits: { voice_preview: { daily_limit: 20 } } } })
            api.previewVoice.mockImplementation(paidPreviewResponse({ cache_key: 'k', previews_left: 11 }, 12))
            // The BFF sends `sample_url: null` for a language without a sample, so it renders (metered).
            const silentMaren = { ...CATALOG_MAREN_HOUSE, languages: CATALOG_MAREN_HOUSE.languages.map((entry) => ({ ...entry, sample_url: null as unknown as string })) }
            api.getVoiceCatalogByKeys.mockResolvedValue([CATALOG_ELDRIN, silentMaren, CATALOG_SELA_LEAVING])
            render(<VoiceStudioPage />)
            await screen.findByText('Fireside narrator')
            const button = await within(cardOf('Fireside narrator')).findByRole('button', { name: FIRESIDE_PAID })
            // WCAG 2.5.3: the visible text is the start of the name.
            expect(button).toHaveTextContent(/^Preview · 1 credit$/)
            fireEvent.click(button)
            const dialog = await screen.findByRole('dialog', { name: 'Preview with credits?' })
            expect(api.previewVoice.mock.calls.map(([body]) => body.max_credit_cost)).toEqual([0])
            fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }))
            await waitFor(() => expect(api.previewVoice).toHaveBeenCalledTimes(2))
            expect(api.previewVoice.mock.calls[0][0]).toMatchObject({ voice_key: VOICE_KEY_MAREN, settings: null, emotion: null })
        })

        it('asks again when another account signs in to the same tab', async () => {
            api.getUserProfile.mockResolvedValue({ membership: { plan_code: 'pro', previews_left: 12, limits: { voice_preview: { daily_limit: 20 } } } })
            api.previewVoice.mockImplementation(paidPreviewResponse({ cache_key: 'k', previews_left: 11 }, 12))
            const { unmount } = render(<VoiceStudioPage />)
            await screen.findByText('Harbour master')
            fireEvent.click(await within(cardOf('Harbour master')).findByRole('button', { name: HARBOUR_PAID }))
            fireEvent.click(within(await screen.findByRole('dialog', { name: 'Preview with credits?' })).getByRole('button', { name: 'Continue' }))
            await waitFor(() => expect(api.previewVoice).toHaveBeenCalledTimes(2))
            unmount()

            // User A signs out and user B signs in, without a page reload.
            mockUseAuth.mockReturnValue({ isAuthenticated: true, openLoginModal: vi.fn(), userHash: 'user-b' })
            render(<VoiceStudioPage />)
            await screen.findByText('Harbour master')
            fireEvent.click(await within(cardOf('Harbour master')).findByRole('button', { name: HARBOUR_PAID }))
            expect(await screen.findByRole('dialog', { name: 'Preview with credits?' })).toBeInTheDocument()
            expect(api.previewVoice).toHaveBeenCalledTimes(3)
        })

        it('hides the strip when the server reports no usage', async () => {
            render(<VoiceStudioPage />)
            await screen.findByText('Harbour master')
            expect(screen.queryByTestId('voice-usage-strip')).not.toBeInTheDocument()
            expect(within(cardOf('Harbour master')).getByRole('button', { name: HARBOUR_PREVIEW })).toBeInTheDocument()
        })

        it('keeps card cache probes available at the hard limit', async () => {
            api.getUserProfile.mockResolvedValue({ membership: { plan_code: 'pro', previews_left: 0, limits: { voice_preview: { daily_limit: 20 } } } })
            render(<VoiceStudioPage />)
            await screen.findByText('Harbour master')
            await waitFor(() => expect(within(cardOf('Harbour master')).getByRole('button', { name: HARBOUR_PREVIEW })).toBeEnabled())
            expect(screen.getByText('Daily preview limit reached. Previews reset tomorrow.')).toBeInTheDocument()
        })

        it('marks a played card transcript with its language', async () => {
            render(<VoiceStudioPage />)
            await screen.findByText('Harbour master')
            fireEvent.click(within(cardOf('Harbour master')).getByRole('button', { name: HARBOUR_PREVIEW }))
            const transcript = await within(cardOf('Harbour master')).findByText('Transcript')
            expect(transcript.closest('figure')?.querySelector('blockquote')).toHaveAttribute('lang', 'en')
        })
    })

    describe('R1 round 3 gaps (AC-S1, AC-P2, 05 §6.4, §7.7)', () => {
        it('an untuned card whose preview is the free sample says so before it plays (AC-P2)', async () => {
            api.previewVoice.mockResolvedValue({ cache_key: 'sha', url: '/voices/catalog/vk/sample.mp3', previews_left: 4, text: null, tier_used: 'expressive', source: 'sample' })
            render(<VoiceStudioPage />)
            await screen.findByText('Fireside narrator')
            const hint = await within(cardOf('Fireside narrator')).findByTestId('preset-card-free-sample')
            expect(hint).toHaveTextContent('Free: voice sample')
            const button = within(cardOf('Fireside narrator')).getByRole('button', { name: FIRESIDE_PREVIEW })
            expect(button).toHaveAccessibleDescription('Free: voice sample')
            // A tuned recipe renders: no free helper.
            expect(within(cardOf('Harbour master')).queryByTestId('preset-card-free-sample')).not.toBeInTheDocument()
            expect(within(cardOf('Harbour master')).getByRole('button', { name: HARBOUR_PREVIEW })).not.toHaveAttribute('aria-describedby')

            fireEvent.click(button)
            await waitFor(() => expect(api.previewVoice).toHaveBeenCalledTimes(1))
            // Once played, the sample's player says it instead (once per card).
            await waitFor(() => expect(within(cardOf('Fireside narrator')).queryByTestId('preset-card-free-sample')).not.toBeInTheDocument())
            expect(within(cardOf('Fireside narrator')).getAllByText('Free: voice sample')).toHaveLength(1)
        })

        it('no helper until the catalog says the voice has a sample', async () => {
            const silentMaren = { ...CATALOG_MAREN_HOUSE, languages: CATALOG_MAREN_HOUSE.languages.map((entry) => ({ ...entry, sample_url: null as unknown as string })) }
            api.getVoiceCatalogByKeys.mockResolvedValue([CATALOG_ELDRIN, silentMaren, CATALOG_SELA_LEAVING])
            render(<VoiceStudioPage />)
            await screen.findByText('Fireside narrator')
            await waitFor(() => expect(api.getVoiceCatalogByKeys).toHaveBeenCalled())
            expect(within(cardOf('Fireside narrator')).queryByTestId('preset-card-free-sample')).not.toBeInTheDocument()
        })

        it('"Not enough credits" links to the membership page (05 §6.4)', async () => {
            api.previewVoice.mockRejectedValue(Object.assign(new Error('Payment Required'), { status: 402, code: 'membership_quota_exceeded' }))
            render(<VoiceStudioPage />)
            await screen.findByText('Harbour master')
            fireEvent.click(within(cardOf('Harbour master')).getByRole('button', { name: HARBOUR_PREVIEW }))
            const card = cardOf('Harbour master')
            expect(await within(card).findByRole('alert')).toHaveTextContent('Not enough credits for another preview.')
            const link = within(card).getByRole('link', { name: 'View membership' })
            expect(link).toHaveAttribute('href', '#/profile')
            // Nothing unsaved on the page: the same tab.
            expect(link).not.toHaveAttribute('target')
        })

        it('a 409 voice_unavailable offers "Pick another voice", which opens the editor on the picker (05 §6.4)', async () => {
            api.previewVoice.mockRejectedValue(Object.assign(new Error('Conflict'), { status: 409, code: 'voice_unavailable' }))
            render(<VoiceStudioPage />)
            await screen.findByText('Harbour master')
            fireEvent.click(within(cardOf('Harbour master')).getByRole('button', { name: HARBOUR_PREVIEW }))
            const card = cardOf('Harbour master')
            expect(await within(card).findByRole('alert')).toHaveTextContent('This voice is not available right now.')
            fireEvent.click(within(card).getByRole('button', { name: 'Pick another voice' }))
            expect(await screen.findByRole('heading', { name: 'Edit “Harbour master”' })).toBeInTheDocument()
            expect(await screen.findAllByTestId('catalog-voice-row')).not.toHaveLength(0)
        })

        it('a token-bucket 429 retries once after its Retry-After (05 §6.4)', async () => {
            api.previewVoice
                .mockRejectedValueOnce(Object.assign(new Error('Too Many Requests'), { status: 429, code: 'rate_limited', retryable: true, retryAfterSeconds: 0 }))
                .mockResolvedValueOnce({ cache_key: 'k', previews_left: 4, tier_used: 'expressive', source: 'render' })
            render(<VoiceStudioPage />)
            await screen.findByText('Harbour master')
            fireEvent.click(within(cardOf('Harbour master')).getByRole('button', { name: HARBOUR_PREVIEW }))
            await waitFor(() => expect(api.previewVoice).toHaveBeenCalledTimes(2))
            expect(await within(cardOf('Harbour master')).findByText('Transcript')).toBeInTheDocument()
            expect(within(cardOf('Harbour master')).queryByRole('alert')).not.toBeInTheDocument()
        })

        it('the usage strip shows the danger daily_limit badge when no narration is left (05 §7.7)', async () => {
            api.getUserProfile.mockResolvedValue({ membership: { plan_code: 'pro', previews_left: 3, narration_chars_used: 12_000, narration_chars_limit: 12_000, call_seconds_used: 0, call_seconds_limit: 1_800 } })
            render(<VoiceStudioPage />)
            const strip = await screen.findByRole('list', { name: 'Voice allowance today' })
            await waitFor(() => expect(strip).toHaveTextContent('Narration left today: 0 characters'))
            const badge = within(strip).getByText('Daily voice limit reached. Narration resumes tomorrow.').closest('[data-badge]')
            expect(badge).toHaveAttribute('data-badge', 'daily_limit')
            expect(badge?.className).toContain('text-blood-300')
            expect(strip).toHaveTextContent('Call time left today: 30 min')
        })

        it('no daily_limit badge while narration is left', async () => {
            api.getUserProfile.mockResolvedValue({ membership: { plan_code: 'pro', previews_left: 3, narration_chars_used: 11_999, narration_chars_limit: 12_000 } })
            render(<VoiceStudioPage />)
            const strip = await screen.findByRole('list', { name: 'Voice allowance today' })
            await waitFor(() => expect(strip).toHaveTextContent('Narration left today: 1 character'))
            expect(within(strip).queryByText(/Daily voice limit reached/)).not.toBeInTheDocument()
        })
    })

    describe('R1 round 4 fixes (AC-P2 at the hard limit, 05 §6.4 notices)', () => {
        const voiceUnavailable = () => Object.assign(new Error('Conflict'), { status: 409, code: 'voice_unavailable' })

        it('at the hard limit the free-sample card stays playable with its helper; a tuned card is disabled', async () => {
            api.getUserProfile.mockResolvedValue({ membership: { plan_code: 'pro', previews_left: 0, limits: { voice_preview: { daily_limit: 20 } } } })
            api.previewVoice.mockResolvedValue({ cache_key: 'sha', url: '/voices/catalog/vk/sample.mp3', previews_left: 0, text: null, tier_used: 'expressive', source: 'sample' })
            render(<VoiceStudioPage />)
            await screen.findByText('Fireside narrator')
            await waitFor(() => expect(within(cardOf('Harbour master')).getByRole('button', { name: HARBOUR_PREVIEW })).toBeDisabled())
            const sample = within(cardOf('Fireside narrator')).getByRole('button', { name: FIRESIDE_PREVIEW })
            await waitFor(() => expect(sample).toBeEnabled())
            expect(within(cardOf('Fireside narrator')).getByTestId('preset-card-free-sample')).toHaveTextContent('Free: voice sample')
            expect(screen.getByText('Daily preview limit reached. Previews reset tomorrow.')).toBeInTheDocument()

            fireEvent.click(sample)
            await waitFor(() => expect(api.previewVoice).toHaveBeenCalledTimes(1))
            expect(api.previewVoice.mock.calls[0][0]).toMatchObject({ voice_key: VOICE_KEY_MAREN, settings: null, emotion: null })
            await waitFor(() => expect(within(cardOf('Fireside narrator')).queryByTestId('preset-card-free-sample')).not.toBeInTheDocument())
            expect(within(cardOf('Harbour master')).getByRole('button', { name: HARBOUR_PREVIEW })).toBeDisabled()
        })

        it('saving the preset with another voice clears the 409 notice it offered', async () => {
            api.previewVoice.mockRejectedValue(voiceUnavailable())
            const updated = { ...PRESET_V2_USER, voice_key: VOICE_KEY_MAREN, voice_name: 'Maren' }
            api.updateVoicePreset.mockResolvedValue(updated)
            api.listVoiceCatalog.mockResolvedValue({ items: [CATALOG_ELDRIN, CATALOG_MAREN_HOUSE], next_cursor: null })
            render(<VoiceStudioPage />)
            await screen.findByText('Harbour master')
            fireEvent.click(within(cardOf('Harbour master')).getByRole('button', { name: HARBOUR_PREVIEW }))
            expect(await within(cardOf('Harbour master')).findByRole('alert')).toHaveTextContent('This voice is not available right now.')
            fireEvent.click(within(cardOf('Harbour master')).getByRole('button', { name: 'Pick another voice' }))
            await screen.findByRole('heading', { name: 'Edit “Harbour master”' })
            api.listVoicePresets.mockResolvedValue([updated, PRESET_V2_GLOBAL])
            const maren = (await screen.findAllByTestId('catalog-voice-row')).find((row) => within(row).queryByText('Maren')) as HTMLElement
            fireEvent.click(within(maren).getByRole('button', { name: 'Use' }))
            fireEvent.click(screen.getByRole('button', { name: 'Save settings' }))
            await waitFor(() => expect(screen.queryByRole('heading', { name: 'Edit “Harbour master”' })).not.toBeInTheDocument())
            await waitFor(() => expect(api.listVoicePresets).toHaveBeenCalledTimes(2))
            const card = cardOf('Harbour master')
            expect(within(card).queryByRole('alert')).not.toBeInTheDocument()
            expect(within(card).queryByText('This voice is not available right now.')).not.toBeInTheDocument()
            expect(within(card).queryByRole('button', { name: 'Pick another voice' })).not.toBeInTheDocument()
        })

        it('"Switch to {replacement}" clears the 409 notice too; another card keeps its own', async () => {
            const sela = { ...PRESET_V2_USER, preset_id: 'sela-v2', name: 'Night ferry', voice_key: VOICE_KEY_SELA, voice_name: 'Sela' }
            api.listVoicePresets.mockResolvedValue([sela, PRESET_V2_USER, PRESET_V2_GLOBAL])
            api.previewVoice.mockRejectedValue(voiceUnavailable())
            api.updateVoicePreset.mockResolvedValue({ ...sela, voice_key: VOICE_KEY_MAREN, voice_name: 'Maren' })
            render(<VoiceStudioPage />)
            await screen.findByText('Night ferry')
            fireEvent.click(within(cardOf('Night ferry')).getByRole('button', { name: NIGHT_FERRY_PREVIEW }))
            expect(await within(cardOf('Night ferry')).findByRole('alert')).toHaveTextContent('This voice is not available right now.')
            fireEvent.click(await within(cardOf('Night ferry')).findByRole('button', { name: 'Switch to Maren' }))
            await waitFor(() => expect(api.updateVoicePreset).toHaveBeenCalledTimes(1))
            await waitFor(() => expect(within(cardOf('Night ferry')).queryByRole('alert')).not.toBeInTheDocument())
            expect(within(cardOf('Night ferry')).queryByRole('button', { name: 'Pick another voice' })).not.toBeInTheDocument()

            // A save of another preset leaves the previewed card's notice alone.
            fireEvent.click(within(cardOf('Night ferry')).getByRole('button', { name: NIGHT_FERRY_PREVIEW }))
            expect(await within(cardOf('Night ferry')).findByRole('alert')).toHaveTextContent('This voice is not available right now.')
            fireEvent.click(within(cardOf('Harbour master')).getByRole('button', { name: 'Edit Harbour master' }))
            await screen.findByRole('heading', { name: 'Edit “Harbour master”' })
            fireEvent.click(screen.getByRole('button', { name: 'Save settings' }))
            await waitFor(() => expect(screen.queryByRole('heading', { name: 'Edit “Harbour master”' })).not.toBeInTheDocument())
            expect(within(cardOf('Night ferry')).getByRole('alert')).toHaveTextContent('This voice is not available right now.')
        })
    })
})

describe('Studio card Preview button (R1-FE-02, 05 §10 audio controls)', () => {
    beforeEach(() => {
        window.history.replaceState(null, '', '/#/voices?view=saved')
        vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:clip'), revokeObjectURL: vi.fn() })
        clearPreviewTextsCache()
        resetPreviewCreditConfirmation()
        localStorage.clear()
        mockUseAuth.mockReturnValue({ isAuthenticated: true, openLoginModal: vi.fn(), userHash: 'user-a' })
        api.getVoiceCapabilities.mockReset().mockResolvedValue(CAPABILITIES_EL_PRO)
        api.listVoicePresets.mockReset().mockResolvedValue([PRESET_V2_USER, PRESET_V2_GLOBAL])
        api.listVoiceCatalog.mockReset().mockResolvedValue({ items: [CATALOG_ELDRIN], next_cursor: null })
        api.getVoiceCatalogByKeys.mockReset().mockResolvedValue([CATALOG_ELDRIN, CATALOG_MAREN_HOUSE])
        api.previewVoice.mockReset().mockResolvedValue({ cache_key: 'k', previews_left: 4, tier_used: 'expressive' })
        api.getUserProfile.mockReset().mockResolvedValue({ membership: { plan_code: 'pro' } })
        api.getPreviewTexts.mockReset().mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }))
        api.fetchProtectedMediaBlob.mockReset().mockResolvedValue(new Blob(['mp3'], { type: 'audio/mpeg' }))
        clearPreferredLanguageCache()
        api.getUserPreferences.mockReset().mockResolvedValue({ preferred_language: 'en', has_preference: false, narration_tier: 'expressive' })
    })

    it('names the preset, its voice and language, keeps the visible text short and turns into a named Stop action while its preview runs', async () => {
        api.previewVoice.mockReturnValue(new Promise(() => undefined))
        render(<VoiceStudioPage />)
        await screen.findByText('Harbour master')
        const harbour = within(cardOf('Harbour master')).getByRole('button', { name: HARBOUR_PREVIEW })
        const fireside = within(cardOf('Fireside narrator')).getByRole('button', { name: FIRESIDE_PREVIEW })
        // Every card's button used to be plain "Preview": the names now tell them apart.
        expect(harbour).toHaveTextContent(/^Preview$/)
        // Not a toggle: its name changes with its state ("Stop", 05 §6.3), so aria-pressed would contradict it (APG).
        // The clip's own player button carries aria-pressed while the preview plays.
        expect(harbour).not.toHaveAttribute('aria-pressed')
        expect(fireside).not.toHaveAttribute('aria-pressed')

        fireEvent.click(harbour)
        const stop = await within(cardOf('Harbour master')).findByRole('button', { name: 'Stop the preview of Harbour master' })
        expect(stop).toBe(harbour)
        expect(stop).toHaveTextContent(/^Stop$/)
        expect(stop).not.toHaveAttribute('aria-pressed')
        expect(fireside).not.toHaveAttribute('aria-pressed')

        fireEvent.click(stop)
        await waitFor(() => expect(harbour).toHaveAccessibleName(HARBOUR_PREVIEW))
        expect(harbour).not.toHaveAttribute('aria-pressed')
    })

    it('names the language the preview request sends (a preset language the voice speaks)', async () => {
        api.listVoicePresets.mockResolvedValue([{ ...PRESET_V2_USER, preset_id: 'eldrin-es', name: 'Harbour master', language_code: 'es' }])
        render(<VoiceStudioPage />)
        await screen.findByText('Harbour master')
        await waitFor(() => expect(api.getVoiceCatalogByKeys).toHaveBeenCalled())
        fireEvent.click(await within(cardOf('Harbour master')).findByRole('button', { name: 'Preview Harbour master, Eldrin, Spanish' }))
        await waitFor(() => expect(api.previewVoice).toHaveBeenCalledTimes(1))
        expect(api.previewVoice.mock.calls[0][0]).toMatchObject({ voice_key: VOICE_KEY_ELDRIN, language: 'es' })
    })

    it('names it in the UI language', async () => {
        const { i18n } = await import('@/app/i18n')
        await i18n.changeLanguage('es')
        try {
            render(<VoiceStudioPage />)
            await screen.findByText('Harbour master')
            expect(await within(cardOf('Harbour master')).findByRole('button', { name: 'Escuchar Harbour master, Eldrin, inglés' })).toHaveTextContent(/^Escuchar$/)
        } finally {
            await i18n.changeLanguage('en')
        }
    })
})

describe('PresetCardV2 preview language (05 §10)', () => {
    const IDRIS = catalogVoice({ voice_key: VOICE_KEY_IDRIS, display_name: 'Idris' })
    const untuned = { ...PRESET_V2_GLOBAL, is_global: false, preset_id: 'idris', name: 'Lighthouse keeper', voice_key: VOICE_KEY_IDRIS, voice_name: 'Idris' }
    const card = (row: typeof untuned, item: ReturnType<typeof catalogVoice>, language: string | null = 'en') =>
        render(<PresetCardV2 row={row} catalogItem={item} language={language} onPreview={vi.fn()} />)
    const button = () => within(screen.getByTestId('preset-card-v2')).getByRole('button', { name: /^Preview/ })

    it('an untuned preset plays the voice sample: the name gives the sample’s language, not the text’s', () => {
        // Spanish preset text, but the voice has no Spanish sample: the server serves its English (primary) one.
        const item = { ...IDRIS, languages: IDRIS.languages.map((entry) => (entry.language === 'es' ? { ...entry, sample_url: null as unknown as string } : entry)) }
        card({ ...untuned, language_code: 'es' }, item)
        expect(button()).toHaveAccessibleName('Preview Lighthouse keeper, Idris, English')
    })

    it('a tuned preset renders: the name gives the text language', () => {
        const item = { ...IDRIS, languages: IDRIS.languages.map((entry) => (entry.language === 'es' ? { ...entry, sample_url: null as unknown as string } : entry)) }
        card({ ...untuned, language_code: 'es', settings: { stability: 0.4 } }, item)
        expect(button()).toHaveAccessibleName('Preview Lighthouse keeper, Idris, Spanish')
    })

    it('leaves the language out where the preview tier would change it (the card is not told the tier)', () => {
        // Its only Spanish sample is Expressive: Standard serves the English one, Expressive the Spanish one.
        const item = { ...IDRIS, languages: IDRIS.languages.map((entry) => (entry.language === 'es' ? { ...entry, sample_url: `/voices/catalog/${VOICE_KEY_IDRIS}/preview.mp3?language=es&tier=expressive` } : entry)) }
        card({ ...untuned, language_code: 'es' }, item)
        expect(button()).toHaveAccessibleName('Preview Lighthouse keeper, Idris')
    })

    it('leaves it out where the Studio would fall back to the preferred language (not told to the card)', () => {
        const item = catalogVoice({
            voice_key: VOICE_KEY_IDRIS,
            display_name: 'Idris',
            primary_language: 'fr',
            languages: [
                { language: 'fr', native: true, accent: null, accepted_models: ['standard'], sample_url: `/voices/catalog/${VOICE_KEY_IDRIS}/preview.mp3?language=fr` },
                { language: 'en', native: false, accent: null, accepted_models: ['standard'], sample_url: `/voices/catalog/${VOICE_KEY_IDRIS}/preview.mp3?language=en` },
            ],
        })
        card({ ...untuned, language_code: 'es', settings: { stability: 0.4 } }, item, 'es')
        expect(button()).toHaveAccessibleName('Preview Lighthouse keeper, Idris')
    })

    it('keeps "· 1 credit" in the name when the button shows it, the visible text first (WCAG 2.5.3)', () => {
        render(<PresetCardV2 row={PRESET_V2_USER} catalogItem={CATALOG_ELDRIN} language="en" previewCostsCredit onPreview={vi.fn()} />)
        const paid = within(screen.getByTestId('preset-card-v2')).getByRole('button', { name: HARBOUR_PAID })
        expect(paid).toHaveTextContent(/^Preview · 1 credit$/)
    })

    it('starts a paid name without a language with its visible text too', () => {
        const item = { ...IDRIS, languages: IDRIS.languages.map((entry) => (entry.language === 'es' ? { ...entry, sample_url: `/voices/catalog/${VOICE_KEY_IDRIS}/preview.mp3?language=es&tier=expressive` } : entry)) }
        render(<PresetCardV2 row={{ ...untuned, language_code: 'es' }} catalogItem={item} language="en" previewCostsCredit onPreview={vi.fn()} />)
        expect(button()).toHaveAccessibleName('Preview · 1 credit: Lighthouse keeper, Idris')
    })

    it('starts the paid name with its visible text in Spanish', async () => {
        const { i18n } = await import('@/app/i18n')
        await i18n.changeLanguage('es')
        try {
            render(<PresetCardV2 row={PRESET_V2_USER} catalogItem={CATALOG_ELDRIN} language="en" previewCostsCredit onPreview={vi.fn()} />)
            const paid = within(screen.getByTestId('preset-card-v2')).getByRole('button', { name: 'Escuchar · 1 crédito: Harbour master, Eldrin, inglés' })
            expect(paid).toHaveTextContent(/^Escuchar · 1 crédito$/)
        } finally {
            await i18n.changeLanguage('en')
        }
    })
})

