import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { auditCatalogVoices, auditLegacyMapping, readyVoice, replacementVoice } from '../../fixtures'
import { consoleApiMock, renderInConsole, type ConsoleApiMock } from '../../testUtils'
import { LegacyMappingModule } from './LegacyMappingModule'

const api = vi.hoisted(() => ({}) as Record<string, unknown>)
vi.mock('@/infrastructure/api', async (importOriginal) => ({ ...(await importOriginal<object>()), apiService: api }))
const mock = () => api as unknown as ConsoleApiMock

function pick(scope: HTMLElement, combobox: string, option: RegExp) {
    fireEvent.click(within(scope).getByRole('combobox', { name: combobox }))
    fireEvent.click(screen.getByRole('option', { name: option }))
}

/** A Spanish-speaking target with an own sample in English and Spanish. */
const spanishTarget = {
    ...replacementVoice,
    voice_key: 'vk_000000000000000000000000000000es',
    display_name: 'Lucía',
    primary_language: 'es',
    languages: [
        { language: 'en', locale: 'en-US', accent: null, model_ids: ['eleven_flash_v2_5'], sample_url: '/admin/voices/samples/en.mp3' },
        { language: 'es', locale: 'es-ES', accent: null, model_ids: ['eleven_flash_v2_5'], sample_url: '/admin/voices/samples/es.mp3' },
    ],
}

const samplePaths = () => mock().fetchProtectedMediaBlob.mock.calls.map((call) => call[0])

describe('LegacyMappingModule (AC-R5)', () => {
    beforeEach(() => {
        for (const key of Object.keys(api)) delete api[key]
        Object.assign(api, consoleApiMock())
    })

    it('reports forward coverage of the referenced legacy voices against the 100% gate', async () => {
        renderInConsole(<LegacyMappingModule />, 'mapping')
        const coverage = await screen.findByRole('region', { name: 'Coverage' })
        expect(within(coverage).getByText('Referenced legacy voices mapped').nextSibling).toHaveTextContent('1 of 2 (50%)')
        expect(within(coverage).getAllByText('Below 100%: unmapped voices play the default voice')).toHaveLength(1)
        expect(within(coverage).getByText('Spanish_Calm_Woman')).toBeInTheDocument()
        // The picker and reverse rows are gone with the legacy route (I-68).
        expect(within(coverage).queryByText(/picker/i)).not.toBeInTheDocument()
        expect(within(coverage).queryByText(/reverse/i)).not.toBeInTheDocument()
    })

    it('reads only the forward mapping and its coverage: no provider inventory, no reverse mapping (I-68)', async () => {
        renderInConsole(<LegacyMappingModule />, 'mapping')
        await screen.findByRole('table', { name: 'Legacy voice mappings' })
        expect(mock().listLegacyMapping).toHaveBeenCalledTimes(1)
        expect(mock().getLegacyMappingCoverage).toHaveBeenCalledTimes(1)
        expect(screen.queryByRole('table', { name: 'Reverse mapping of published voices' })).not.toBeInTheDocument()
        expect(screen.queryByRole('region', { name: 'Custom legacy voices' })).not.toBeInTheDocument()
        expect(screen.queryByRole('columnheader', { name: 'In picker' })).not.toBeInTheDocument()
    })

    it('shows legacy voices per target and flags a target that needs alternates', async () => {
        mock().getLegacyMappingCoverage.mockResolvedValue({
            referenced: { total: 1, mapped: 1 },
            unmapped_ids: [],
            legacy_ids_per_target: [{ voice_key: readyVoice.voice_key, legacy_ids: 4, co_occurring_ids: 3, alternates: 1 }],
            generated_at: null,
        })
        renderInConsole(<LegacyMappingModule />, 'mapping')
        const table = await screen.findByRole('table', { name: 'Legacy voices mapped to each catalog voice' })
        const row = within(table).getByRole('row', { name: /Maren/ })
        expect(within(row).getByText('Needs alternates')).toBeInTheDocument()
        expect(within(row).getByText('4')).toBeInTheDocument()
        expect(screen.getByText('Every referenced legacy voice is mapped.')).toBeInTheDocument()
    })

    it('filters the mapping table to unmapped legacy voices and searches by legacy id', async () => {
        renderInConsole(<LegacyMappingModule />, 'mapping')
        const table = await screen.findByRole('table', { name: 'Legacy voice mappings' })
        expect(within(table).getAllByRole('row')).toHaveLength(3)
        fireEvent.click(screen.getByRole('checkbox', { name: 'Unmapped only' }))
        expect(within(table).getAllByRole('row')).toHaveLength(2)
        expect(within(table).getByRole('rowheader', { name: 'Spanish_Calm_Woman' })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('checkbox', { name: 'Unmapped only' }))
        fireEvent.change(screen.getByRole('searchbox', { name: 'Search legacy voices' }), { target: { value: 'warm' } })
        expect(within(table).getAllByRole('row')).toHaveLength(2)
        expect(within(table).getByRole('rowheader', { name: 'English_Warm_Narrator' })).toBeInTheDocument()
    })

    it('edits a mapping with a target and ordered alternates, titled by the legacy id', async () => {
        const saved = { ...auditLegacyMapping.items[1], voice_key: replacementVoice.voice_key, alternate_voice_keys: [readyVoice.voice_key], status: 'approved' as const }
        mock().putLegacyMapping.mockResolvedValue(saved)
        renderInConsole(<LegacyMappingModule />, 'mapping')
        fireEvent.click(await screen.findByRole('button', { name: 'Edit mapping for Spanish_Calm_Woman' }))
        const drawer = await screen.findByRole('dialog', { name: 'Spanish_Calm_Woman' })
        // No legacy-voice render: the provider is gone (I-68).
        expect(within(drawer).queryByRole('button', { name: /legacy voice/i })).not.toBeInTheDocument()

        pick(drawer, 'Target voice', /Ysolde/)
        pick(drawer, 'Add an alternate', /Maren/)
        fireEvent.click(within(drawer).getByRole('button', { name: 'Add' }))
        pick(drawer, 'Status', /Approved/)
        fireEvent.click(within(drawer).getByRole('button', { name: 'Save mapping' }))
        await waitFor(() =>
            expect(mock().putLegacyMapping).toHaveBeenCalledWith('Spanish_Calm_Woman', {
                voice_key: replacementVoice.voice_key,
                alternate_voice_keys: [readyVoice.voice_key],
                settings_override: null,
                legacy_language: 'es',
                status: 'approved',
                notes: null,
            }),
        )
        expect(await screen.findByText('Mapping saved')).toBeInTheDocument()
        expect(mock().getLegacyMappingCoverage).toHaveBeenCalledTimes(2)
    })

    it('plays the target sample in the row language, then the target language, then English', async () => {
        mock().listAdminCatalog.mockResolvedValue({ items: [...auditCatalogVoices, spanishTarget], next_cursor: null, summary: null })
        mock().listLegacyMapping.mockResolvedValue({ items: [{ ...auditLegacyMapping.items[1], legacy_language: 'en', voice_key: spanishTarget.voice_key }] })
        renderInConsole(<LegacyMappingModule />, 'mapping')
        fireEvent.click(await screen.findByRole('button', { name: 'Edit mapping for Spanish_Calm_Woman' }))
        const drawer = await screen.findByRole('dialog', { name: 'Spanish_Calm_Woman' })
        const sample = within(drawer).getByRole('region', { name: 'Target sample' })

        // The row language (English) has a sample.
        await waitFor(() => expect(samplePaths()).toContain('/admin/voices/samples/en.mp3'))
        expect(within(sample).getByText(/^English · /)).toBeInTheDocument()

        // A row language without a sample falls through to the target's primary language.
        fireEvent.change(within(drawer).getByLabelText('Legacy language'), { target: { value: 'ja' } })
        await waitFor(() => expect(samplePaths()).toContain('/admin/voices/samples/es.mp3'))
        expect(within(sample).getByText(/^Spanish · /)).toBeInTheDocument()
    })

    it('falls back to the English sample when neither the row nor the target language has one', async () => {
        const englishOnly = { ...spanishTarget, primary_language: 'pt', languages: [spanishTarget.languages[0]] }
        mock().listAdminCatalog.mockResolvedValue({ items: [...auditCatalogVoices, englishOnly], next_cursor: null, summary: null })
        mock().listLegacyMapping.mockResolvedValue({ items: [{ ...auditLegacyMapping.items[1], legacy_language: null, voice_key: englishOnly.voice_key }] })
        renderInConsole(<LegacyMappingModule />, 'mapping')
        fireEvent.click(await screen.findByRole('button', { name: 'Edit mapping for Spanish_Calm_Woman' }))
        const drawer = await screen.findByRole('dialog', { name: 'Spanish_Calm_Woman' })
        await waitFor(() => expect(samplePaths()).toEqual(['/admin/voices/samples/en.mp3']))
        expect(within(drawer).getByText(/^English · /)).toBeInTheDocument()
    })

    it('says so when the target has no own sample, and offers the lab', async () => {
        const silent = { ...spanishTarget, languages: spanishTarget.languages.map((entry) => ({ ...entry, sample_url: null })) }
        mock().listAdminCatalog.mockResolvedValue({ items: [...auditCatalogVoices, silent], next_cursor: null, summary: null })
        mock().listLegacyMapping.mockResolvedValue({ items: [{ ...auditLegacyMapping.items[1], voice_key: silent.voice_key }] })
        renderInConsole(<LegacyMappingModule />, 'mapping')
        fireEvent.click(await screen.findByRole('button', { name: 'Edit mapping for Spanish_Calm_Woman' }))
        const drawer = await screen.findByRole('dialog', { name: 'Spanish_Calm_Woman' })
        expect(within(drawer).getByText('The target has no own sample to play yet.')).toBeInTheDocument()
        expect(within(drawer).getByRole('button', { name: 'Send to lab' })).toBeInTheDocument()
        expect(mock().fetchProtectedMediaBlob).not.toHaveBeenCalled()
    })

    it('shows — when the BFF omits the reference count', async () => {
        const [first, second] = auditLegacyMapping.items
        const bare = { ...first }
        delete bare.reference_count
        mock().listLegacyMapping.mockResolvedValue({ items: [bare, second] })
        renderInConsole(<LegacyMappingModule />, 'mapping')
        const table = await screen.findByRole('table', { name: 'Legacy voice mappings' })
        const omitted = within(table).getByRole('row', { name: /English_Warm_Narrator/ })
        expect(within(omitted).getAllByRole('cell')[1]).toHaveTextContent('—') // references
        const known = within(table).getByRole('row', { name: /Spanish_Calm_Woman/ })
        expect(within(known).getAllByRole('cell')[1]).toHaveTextContent('17')
    })
})
