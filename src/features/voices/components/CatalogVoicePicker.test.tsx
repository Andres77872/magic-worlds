import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import { CATALOG_ELDRIN, CATALOG_MAREN_HOUSE, CATALOG_ORRIN_UNTESTED, CATALOG_SELA_LEAVING, CATALOG_TOBIAS_LOCKED, VOICE_KEY_SELA } from '../fixtures'
import { clearPreferredLanguageCache } from '../hooks/usePreferredLanguage'
import { CatalogVoicePicker } from './CatalogVoicePicker'
import { CAPABILITIES_FISH, CATALOG_FISH } from '../fishFixtures'

const listVoiceCatalog = vi.fn()
const fetchProtectedMediaBlob = vi.fn()
const getUserPreferences = vi.fn()

vi.mock('@/app/hooks/usePlaylist', () => ({ usePlaylist: () => ({}) }))
vi.mock('@/infrastructure/api', () => ({
    apiService: {
        listVoiceCatalog: (...args: unknown[]) => listVoiceCatalog(...args),
        fetchProtectedMediaBlob: (...args: unknown[]) => fetchProtectedMediaBlob(...args),
        getUserPreferences: (...args: unknown[]) => getUserPreferences(...args),
    },
    isProtectedMediaUrl: () => false,
}))

const firstQuery = () => listVoiceCatalog.mock.calls[0]?.[0] as Record<string, unknown>

const withSignal = expect.objectContaining({ signal: expect.any(AbortSignal) })

const es = i18n.getFixedT('es')

function rowOf(name: string): HTMLElement {
    return screen.getAllByTestId('catalog-voice-row').find((row) => within(row).queryByText(name)) as HTMLElement
}

describe('CatalogVoicePicker (R1-FE-01)', () => {
    beforeEach(() => {
        vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:sample'), revokeObjectURL: vi.fn() })
        listVoiceCatalog.mockReset().mockResolvedValue({
            items: [CATALOG_ELDRIN, CATALOG_MAREN_HOUSE, CATALOG_TOBIAS_LOCKED, CATALOG_SELA_LEAVING, CATALOG_ORRIN_UNTESTED],
            next_cursor: 'c2',
        })
        fetchProtectedMediaBlob.mockReset().mockResolvedValue(new Blob(['mp3'], { type: 'audio/mpeg' }))
        // No saved preference: no language filter unless a test sets one.
        clearPreferredLanguageCache()
        getUserPreferences.mockReset().mockResolvedValue({ preferred_language: 'en', has_preference: false, narration_tier: 'standard' })
    })

    it('can show both languages initially without hiding Spanish voices behind the account preference', async () => {
        getUserPreferences.mockResolvedValue({ preferred_language: 'en', has_preference: true, narration_tier: 'standard' })
        render(<CatalogVoicePicker allLanguagesInitially onPick={vi.fn()} />)
        await screen.findByText('Eldrin')
        expect(firstQuery()).not.toHaveProperty('language')
        expect(getUserPreferences).not.toHaveBeenCalled()
        expect(within(screen.getByRole('group', { name: 'Language' })).getByRole('button', { name: 'Any' })).toHaveAttribute('aria-pressed', 'true')
        fireEvent.click(within(screen.getByRole('group', { name: 'Language' })).getByRole('button', { name: 'Spanish' }))
        await waitFor(() => expect(listVoiceCatalog.mock.lastCall?.[0]).toMatchObject({ language: 'es' }))
        expect(within(rowOf('Orrin')).getByText(/^Not tested in Spanish/)).toBeInTheDocument()
    })

    it('starts the language filter on the preferred language, not the interface one, and "Any" clears it (05 §7.3)', async () => {
        getUserPreferences.mockResolvedValue({ preferred_language: 'es', has_preference: true, narration_tier: 'standard' })
        render(<CatalogVoicePicker onPick={vi.fn()} />)
        await screen.findByText('Eldrin')
        expect(listVoiceCatalog).toHaveBeenCalledTimes(1)
        expect(firstQuery()).toMatchObject({ language: 'es' })
        const group = screen.getByRole('group', { name: 'Language' })
        expect(within(group).getByRole('button', { name: 'Spanish' })).toHaveAttribute('aria-pressed', 'true')
        expect(within(group).getByRole('button', { name: 'Any' })).toHaveAttribute('aria-pressed', 'false')
        // Badges follow the same language: Orrin speaks English only.
        expect(within(rowOf('Orrin')).getByText(/^Not tested in /)).toBeInTheDocument()

        fireEvent.click(within(group).getByRole('button', { name: 'Any' }))
        await waitFor(() => expect(listVoiceCatalog).toHaveBeenCalledTimes(2))
        expect(listVoiceCatalog.mock.lastCall?.[0]).not.toHaveProperty('language')
        expect(within(group).getByRole('button', { name: 'Any' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('starts on the card language when the caller knows one, without reading the preference', async () => {
        render(<CatalogVoicePicker language="es-MX" onPick={vi.fn()} />)
        await screen.findByText('Eldrin')
        expect(firstQuery()).toMatchObject({ language: 'es' })
        expect(getUserPreferences).not.toHaveBeenCalled()
    })

    it('"Show locked voices" sends include_locked=false when off (05 §7.3)', async () => {
        render(<CatalogVoicePicker onPick={vi.fn()} />)
        await screen.findByText('Eldrin')
        expect(firstQuery()).not.toHaveProperty('include_locked')
        fireEvent.click(screen.getByRole('button', { name: 'More filters' }))
        const toggle = screen.getByRole('switch', { name: 'Show locked voices' })
        expect(toggle).toHaveAttribute('aria-checked', 'true')
        fireEvent.click(toggle)
        await waitFor(() => expect(listVoiceCatalog).toHaveBeenLastCalledWith(expect.objectContaining({ include_locked: false }), null, withSignal))
        await screen.findByText('Eldrin')
        fireEvent.click(screen.getByRole('switch', { name: 'Show locked voices' }))
        await waitFor(() => expect(listVoiceCatalog.mock.lastCall?.[0]).not.toHaveProperty('include_locked'))
    })

    it('keeps provider and language visible and expands optional filters on demand', async () => {
        render(<CatalogVoicePicker onPick={vi.fn()} />)
        await screen.findByText('Eldrin')
        expect(screen.getByRole('group', { name: 'Provider' })).toBeVisible()
        expect(screen.getByRole('group', { name: 'Language' })).toBeVisible()
        expect(screen.queryByRole('group', { name: 'Gender' })).not.toBeInTheDocument()
        const toggle = screen.getByRole('button', { name: 'More filters' })
        expect(toggle).toHaveAttribute('aria-expanded', 'false')
        fireEvent.click(toggle)
        expect(screen.getByRole('group', { name: 'Gender' })).toBeVisible()
        fireEvent.click(screen.getByRole('button', { name: 'Fewer filters' }))
        expect(screen.queryByRole('group', { name: 'Gender' })).not.toBeInTheDocument()
    })

    it('identifies both providers on their rows and filters Fish voices on the server', async () => {
        const onPick = vi.fn()
        listVoiceCatalog.mockResolvedValue({ items: [CATALOG_ELDRIN, CATALOG_FISH], next_cursor: null })
        render(<CatalogVoicePicker onPick={onPick} capabilities={CAPABILITIES_FISH} />)
        await screen.findByText('Lantern')
        expect(within(rowOf('Eldrin')).getByTitle('Voice provider: ElevenLabs')).toHaveAttribute('data-voice-provider', 'elevenlabs')
        expect(within(rowOf('Lantern')).getByTitle('Voice provider: Fish Audio')).toHaveAttribute('data-voice-provider', 'fish_audio')

        fireEvent.click(within(screen.getByRole('group', { name: 'Provider' })).getByRole('button', { name: 'Fish Audio' }))
        await waitFor(() => expect(listVoiceCatalog).toHaveBeenLastCalledWith(expect.objectContaining({ provider: 'fish_audio' }), null, withSignal))
        await screen.findByText('Lantern')
        fireEvent.click(within(rowOf('Lantern')).getByRole('button', { name: 'Use' }))
        expect(onPick).toHaveBeenCalledWith(CATALOG_FISH)
        expect(es('voices.catalog.providerTag', { provider: 'Fish Audio' })).toBe('Proveedor de voz: Fish Audio')
    })

    it('shows each language with its tiers, and the plan on a lock (05 §7.4, 03 §5.12)', async () => {
        render(<CatalogVoicePicker onPick={vi.fn()} />)
        await screen.findByText('Eldrin')
        const languages = within(rowOf('Eldrin')).getByRole('list', { name: 'Languages' })
        const items = within(languages).getAllByRole('listitem')
        expect(items.map((item) => [item.getAttribute('data-language'), item.getAttribute('data-tiers')])).toEqual([['en', 'standard,expressive'], ['es', 'standard']])
        expect(within(items[0]).getByText('English: Standard, Expressive')).toHaveClass('sr-only')
        // Provider model ids never show.
        expect(languages.textContent).not.toMatch(/eleven|flash|v3|v4/i)
        const lock = within(rowOf('Tobias')).getByText('Plus').closest('[data-badge="locked"]')
        expect(lock).toHaveAttribute('title', 'Upgrade to pick this voice')
    })

    it('lists the catalog with derived badges, a result count and "Load more"', async () => {
        render(<CatalogVoicePicker language="es" currentVoiceKey={VOICE_KEY_SELA} onPick={vi.fn()} />)
        await screen.findByText('Eldrin')
        expect(screen.getAllByTestId('catalog-voice-row')).toHaveLength(5)
        expect(within(rowOf('Maren')).getByText('House voice')).toBeInTheDocument()
        expect(within(rowOf('Orrin')).getByText(/^Not tested in /)).toBeInTheDocument()
        // Gender and age chips with their catalog labels (05 §7.2); no accent chip (taxonomy open).
        const traits = (name: string) => within(within(rowOf(name)).getByTestId('catalog-voice-traits')).getAllByText(/./).map((chip) => chip.textContent)
        expect(traits('Eldrin')).toEqual(['Male', 'Middle-aged'])
        expect(traits('Maren')).toEqual(['Female', 'Young'])
        // Leaving shows only on the voice in use.
        expect(within(rowOf('Sela')).getByText(/^Leaving on /)).toBeInTheDocument()
        expect(screen.getByText('5 voices shown')).toBeInTheDocument()
        expect(screen.getByText(/tuned for English and Spanish/)).toBeInTheDocument()

        listVoiceCatalog.mockResolvedValueOnce({ items: [], next_cursor: null })
        fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
        await waitFor(() => expect(listVoiceCatalog).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 24 }), 'c2', withSignal))
    })

    it('emits the picked item; a locked voice cannot be picked and says why', async () => {
        const onPick = vi.fn()
        render(<CatalogVoicePicker onPick={onPick} />)
        await screen.findByText('Tobias')
        const lockedUse = within(rowOf('Tobias')).getByRole('button', { name: 'Use' })
        expect(lockedUse).toHaveAttribute('aria-disabled', 'true')
        expect(lockedUse).toHaveAccessibleDescription('Upgrade to pick this voice')
        fireEvent.click(lockedUse)
        expect(onPick).not.toHaveBeenCalled()

        fireEvent.click(within(rowOf('Eldrin')).getByRole('button', { name: 'Use' }))
        expect(onPick).toHaveBeenCalledWith(CATALOG_ELDRIN)
    })

    it('plays the free sample in the card language as an authed blob; the button names the language and offers a named Stop action (05 §10)', async () => {
        render(<CatalogVoicePicker language="es" onPick={vi.fn()} />)
        await screen.findByText('Eldrin')
        const play = screen.getByRole('button', { name: 'Listen to Eldrin, Spanish' })
        expect(play).toHaveAccessibleName('Listen to Eldrin, Spanish')
        // A voice without a sample in the card language plays (and names) its primary one.
        expect(within(rowOf('Maren')).getByRole('button', { name: 'Listen to Maren, English' })).toBeInTheDocument()
        fireEvent.click(play)
        await waitFor(() => expect(fetchProtectedMediaBlob).toHaveBeenCalledWith(CATALOG_ELDRIN.languages[1].sample_url, 'audio/mpeg'))
        await waitFor(() => expect(play).toHaveAccessibleName('Stop the sample of Eldrin'))
        fireEvent.click(play)
        await waitFor(() => expect(play).toHaveAccessibleName('Listen to Eldrin, Spanish'))
        expect(es('voices.catalog.playSampleIn', { name: 'Eldrin', language: 'español' })).toBe('Reproducir muestra de Eldrin, español')
    })

    it('sends the filters to the server and offers no accent or works-in-calls control', async () => {
        render(<CatalogVoicePicker onPick={vi.fn()} />)
        await screen.findByText('Eldrin')
        fireEvent.click(within(screen.getByRole('group', { name: 'Language' })).getByRole('button', { name: 'Spanish' }))
        await waitFor(() => expect(listVoiceCatalog).toHaveBeenLastCalledWith(expect.objectContaining({ language: 'es' }), null, withSignal))
        await screen.findByText('Eldrin')
        fireEvent.click(screen.getByRole('button', { name: 'More filters' }))
        fireEvent.click(within(screen.getByRole('group', { name: 'Tags' })).getByRole('button', { name: 'calm' }))
        await waitFor(() => expect(listVoiceCatalog).toHaveBeenLastCalledWith(expect.objectContaining({ tags: ['calm'] }), null, withSignal))
        await screen.findByText('Eldrin')
        fireEvent.click(within(screen.getByRole('group', { name: 'Gender' })).getByRole('button', { name: 'Female' }))
        await waitFor(() => expect(listVoiceCatalog).toHaveBeenLastCalledWith(expect.objectContaining({ gender: 'female' }), null, withSignal))
        await screen.findByText('Eldrin')
        fireEvent.click(within(screen.getByRole('group', { name: 'Age' })).getByRole('button', { name: 'Middle-aged' }))
        await waitFor(() => expect(listVoiceCatalog).toHaveBeenLastCalledWith(expect.objectContaining({ gender: 'female', age: 'middle_aged' }), null, withSignal))
        // The chosen value toggles off.
        await screen.findByText('Eldrin')
        fireEvent.click(within(screen.getByRole('group', { name: 'Gender' })).getByRole('button', { name: 'Female' }))
        await waitFor(() => expect((listVoiceCatalog.mock.lastCall?.[0] as Record<string, unknown>).gender).toBeUndefined())
        expect(screen.queryByRole('group', { name: 'Use case' })).not.toBeInTheDocument()
        expect(screen.queryByText(/accent/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/works in calls/i)).not.toBeInTheDocument()
        expect(screen.queryByText('Recommended for this character')).not.toBeInTheDocument()
    })

    it('offers the fixed gender and age enums with labels, not the slugs of the loaded page (05 §7.3, §9.3)', async () => {
        // The page carries only male/female and young/middle_aged voices.
        render(<CatalogVoicePicker onPick={vi.fn()} />)
        await screen.findByText('Eldrin')
        fireEvent.click(screen.getByRole('button', { name: 'More filters' }))
        const chips = (name: string) => within(screen.getByRole('group', { name })).getAllByRole('button')
        expect(chips('Gender').map((chip) => [chip.getAttribute('data-value'), chip.textContent])).toEqual([
            ['male', 'Male'],
            ['female', 'Female'],
            ['neutral', 'Neutral'],
        ])
        expect(chips('Age').map((chip) => [chip.getAttribute('data-value'), chip.textContent])).toEqual([
            ['young', 'Young'],
            ['middle_aged', 'Middle-aged'],
            ['old', 'Old'],
        ])
        // A value no loaded voice carries is still a filter.
        fireEvent.click(within(screen.getByRole('group', { name: 'Age' })).getByRole('button', { name: 'Old' }))
        await waitFor(() => expect(listVoiceCatalog).toHaveBeenLastCalledWith(expect.objectContaining({ age: 'old' }), null, withSignal))
        expect(within(screen.getByRole('group', { name: 'Age' })).getByRole('button', { name: 'Old' })).toHaveAttribute('aria-pressed', 'true')

        expect(['male', 'female', 'neutral'].map((value) => es(`voices.catalog.gender.${value}`))).toEqual(['Masculina', 'Femenina', 'Neutra'])
        expect(['young', 'middle_aged', 'old'].map((value) => es(`voices.catalog.age.${value}`))).toEqual(['Joven', 'Mediana edad', 'Mayor'])
        expect([es('voices.catalog.filters.gender'), es('voices.catalog.filters.age')]).toEqual(['Género', 'Edad'])
    })

    it('offers "Recommended for this character" only for a saved card', async () => {
        render(<CatalogVoicePicker recommendedFor={{ cardId: 'card-1', workspaceId: null }} onPick={vi.fn()} />)
        expect(await screen.findByText('Recommended for this character')).toBeInTheDocument()
    })

    it('shows a 404 as unavailable, without a retry, and retries a failure', async () => {
        listVoiceCatalog.mockRejectedValueOnce(Object.assign(new Error('Not Found'), { status: 404 }))
        const { unmount } = render(<CatalogVoicePicker onPick={vi.fn()} />)
        expect(await screen.findByText('The voice catalog is unavailable right now.')).toHaveAttribute('role', 'status')
        expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
        unmount()

        listVoiceCatalog.mockRejectedValueOnce(new Error('down'))
        render(<CatalogVoicePicker onPick={vi.fn()} />)
        fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
        expect(await screen.findByText('Eldrin')).toBeInTheDocument()
    })

    it('counts the folded filters on "More filters" and clears every filter but the language', async () => {
        render(<CatalogVoicePicker onPick={vi.fn()} />)
        await screen.findByText('Eldrin')
        expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()
        fireEvent.click(within(screen.getByRole('group', { name: 'Language' })).getByRole('button', { name: 'Spanish' }))
        fireEvent.click(within(screen.getByRole('group', { name: 'Provider' })).getByRole('button', { name: 'ElevenLabs' }))
        fireEvent.click(screen.getByRole('button', { name: 'More filters' }))
        fireEvent.click(within(screen.getByRole('group', { name: 'Gender' })).getByRole('button', { name: 'Female' }))
        fireEvent.click(screen.getByRole('button', { name: 'Fewer filters (1 active)' }))
        expect(screen.getByRole('button', { name: 'More filters (1 active)' })).toHaveAttribute('aria-expanded', 'false')
        await waitFor(() => expect(listVoiceCatalog).toHaveBeenLastCalledWith(
            expect.objectContaining({ language: 'es', provider: 'elevenlabs', gender: 'female' }), null, withSignal))

        fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
        await waitFor(() => expect(listVoiceCatalog.mock.lastCall?.[0]).not.toHaveProperty('gender', 'female'))
        const query = listVoiceCatalog.mock.lastCall?.[0] as Record<string, unknown>
        expect(query.provider).toBeUndefined()
        expect(query.language).toBe('es')
        expect(screen.getByRole('button', { name: 'More filters' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()
    })

    it('shows the result count above the list and a failed sample on its own row', async () => {
        fetchProtectedMediaBlob.mockRejectedValueOnce(Object.assign(new Error('busy'), { status: 429 }))
        render(<CatalogVoicePicker onPick={vi.fn()} />)
        await screen.findByText('Eldrin')
        expect(screen.getByRole('status')).toHaveTextContent('5 voices shown')
        fireEvent.click(within(rowOf('Maren')).getByRole('button', { name: /^Listen to Maren/ }))
        expect(await within(rowOf('Maren')).findByRole('alert')).toBeInTheDocument()
        expect(within(rowOf('Eldrin')).queryByRole('alert')).not.toBeInTheDocument()
    })

    it('links a locked voice to the plans page in a new tab', async () => {
        render(<CatalogVoicePicker onPick={vi.fn()} />)
        await screen.findByText('Tobias')
        const plans = within(rowOf('Tobias')).getByRole('link', { name: 'See plans (opens in a new tab)' })
        expect(plans).toHaveAttribute('href', '#/billing')
        expect(plans).toHaveAttribute('target', '_blank')
        expect(within(rowOf('Eldrin')).queryByRole('link', { name: /See plans/ })).not.toBeInTheDocument()
    })

    it('shows the empty state', async () => {
        listVoiceCatalog.mockResolvedValue({ items: [], next_cursor: null })
        render(<CatalogVoicePicker onPick={vi.fn()} />)
        expect(await screen.findByText('No voices match these filters.')).toBeInTheDocument()
    })
})
