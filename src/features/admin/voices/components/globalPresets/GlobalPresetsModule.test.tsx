import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { ApiError } from '@/infrastructure/api'
import type { AdminGlobalPresetRow } from '@/shared'
import { auditGlobalPresets, draftVoice, readyVoice, replacementVoice } from '../../fixtures'
import { chooseOption, consoleApiMock, renderInConsole, type ConsoleApiMock } from '../../testUtils'
import { GlobalPresetsModule } from './GlobalPresetsModule'

const api = vi.hoisted(() => ({}) as Record<string, unknown>)
vi.mock('@/infrastructure/api', async (importOriginal) => ({ ...(await importOriginal<object>()), apiService: api }))
const mock = () => api as unknown as ConsoleApiMock

const [calm] = auditGlobalPresets.items

async function renderModule() {
    renderInConsole(<GlobalPresetsModule />, 'globalPresets')
    const table = await screen.findByRole('table', { name: 'Global presets' })
    // The catalog index (voice names, warnings) loads alongside.
    await waitFor(() => expect(within(table).getAllByText('Maren').length).toBeGreaterThan(0))
    return table
}

const rowOf = (table: HTMLElement, name: string) => within(table).getByRole('rowheader', { name: new RegExp(name) }).closest('tr') as HTMLElement

describe('GlobalPresetsModule (R1-FE-06, 05 §8.12)', () => {
    beforeEach(() => {
        for (const key of Object.keys(api)) delete api[key]
        Object.assign(api, consoleApiMock())
    })

    it('lists the presets with their voice, language and seed key', async () => {
        const table = await renderModule()
        expect(within(table).getAllByRole('rowheader')).toHaveLength(2)
        const calmRow = rowOf(table, 'Calm narrator')
        expect(within(calmRow).getByText('English')).toBeInTheDocument()
        expect(within(calmRow).getByText('en:narrator')).toBeInTheDocument()
        expect(within(calmRow).getByRole('button', { name: 'Edit Calm narrator' })).toBeInTheDocument()
        expect(within(calmRow).getByRole('button', { name: 'Delete Calm narrator' })).toBeInTheDocument()
    })

    it('flags a preset whose voice is not public or not active', async () => {
        const table = await renderModule()
        const draftRow = rowOf(table, 'Draft archetype')
        expect(within(draftRow).getByText('Not public')).toBeInTheDocument()
        expect(within(draftRow).getByText('Draft')).toBeInTheDocument()
        expect(within(rowOf(table, 'Calm narrator')).queryByText('Not public')).toBeNull()
    })

    it('creates a preset after the rules pass', async () => {
        const created = { ...calm, preset_id: 'gp-9', name: 'Bright guide', voice_key: replacementVoice.voice_key, voice_name: 'Ysolde', seed_key: null } as AdminGlobalPresetRow
        mock().createAdminGlobalPreset.mockResolvedValue(created)
        await renderModule()
        fireEvent.click(screen.getByRole('button', { name: 'New global preset' }))
        const drawer = await screen.findByRole('dialog', { name: 'New global preset' })

        fireEvent.click(within(drawer).getByRole('button', { name: 'Create preset' }))
        expect(await within(drawer).findByText('Enter a name.')).toBeInTheDocument()
        expect(within(drawer).getByText('Pick a voice.')).toBeInTheDocument()
        expect(mock().createAdminGlobalPreset).not.toHaveBeenCalled()

        fireEvent.change(within(drawer).getByLabelText('Name'), { target: { value: '  Bright guide ' } })
        chooseOption('Voice', /Ysolde/)
        chooseOption('Language', /English/)
        chooseOption('Emotion', 'Happy')
        fireEvent.click(within(drawer).getByRole('button', { name: 'Create preset' }))
        await waitFor(() =>
            expect(mock().createAdminGlobalPreset).toHaveBeenCalledWith({
                name: 'Bright guide',
                description: null,
                voice_key: replacementVoice.voice_key,
                settings: replacementVoice.default_settings,
                emotion: 'happy',
                language_code: 'en',
            }),
        )
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New global preset' })).toBeNull())
        expect(screen.getByRole('rowheader', { name: /Bright guide/ })).toBeInTheDocument()
        expect(await screen.findByText('Global preset created')).toBeInTheDocument()
    })

    it('warns when users could not apply the preset', async () => {
        await renderModule()
        fireEvent.click(screen.getByRole('button', { name: 'New global preset' }))
        const drawer = await screen.findByRole('dialog', { name: 'New global preset' })
        chooseOption('Voice', /Eldrin/)
        const warnings = within(drawer).getByTestId('global-preset-warnings')
        expect(warnings).toHaveTextContent('This voice is not public')
        expect(warnings).toHaveTextContent('This voice is not active in the catalog')
        chooseOption('Voice', /Maren/)
        expect(within(drawer).queryByTestId('global-preset-warnings')).toBeNull()
    })

    it('edits a preset with the full body and shows a 422 refusal with the console copy', async () => {
        mock().updateAdminGlobalPreset.mockRejectedValueOnce(
            new ApiError(422, 'Voice is not eligible.', { code: 'voice_not_eligible', details: { code: 'voice_not_eligible', path: 'voice' } }),
        )
        const table = await renderModule()
        fireEvent.click(within(rowOf(table, 'Calm narrator')).getByRole('button', { name: 'Edit Calm narrator' }))
        const drawer = await screen.findByRole('dialog', { name: 'Edit Calm narrator' })
        fireEvent.change(within(drawer).getByLabelText('Name'), { target: { value: 'Calm narrator II' } })
        fireEvent.click(within(drawer).getByRole('button', { name: 'Save preset' }))
        expect(await within(drawer).findByRole('alert')).toHaveTextContent('This voice cannot back a global preset')
        expect(mock().updateAdminGlobalPreset).toHaveBeenCalledWith('gp-1', {
            name: 'Calm narrator II',
            description: 'Unhurried English narration.',
            voice_key: readyVoice.voice_key,
            settings: { stability: 0.55, similarity_boost: 0.75, speed: 1 },
            emotion: 'calm',
            language_code: 'en',
        })

        mock().updateAdminGlobalPreset.mockResolvedValueOnce({ ...calm, name: 'Calm narrator II' })
        fireEvent.click(within(drawer).getByRole('button', { name: 'Save preset' }))
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit Calm narrator' })).toBeNull())
        expect(screen.getByRole('rowheader', { name: /Calm narrator II/ })).toBeInTheDocument()
    })

    it('offers only the languages the chosen voice lists', async () => {
        mock().updateAdminGlobalPreset.mockResolvedValue({ ...auditGlobalPresets.items[1], voice_key: readyVoice.voice_key, language_code: 'en' })
        const table = await renderModule()
        fireEvent.click(within(rowOf(table, 'Draft archetype')).getByRole('button', { name: 'Edit Draft archetype' }))
        const drawer = await screen.findByRole('dialog', { name: 'Edit Draft archetype' })
        chooseOption('Voice', /Maren/)
        fireEvent.click(within(drawer).getByRole('combobox', { name: 'Language' }))
        expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Any language', 'English (en)'])
        fireEvent.click(screen.getByRole('option', { name: 'English (en)' }))
        fireEvent.click(within(drawer).getByRole('button', { name: 'Save preset' }))
        await waitFor(() =>
            expect(mock().updateAdminGlobalPreset).toHaveBeenCalledWith('gp-2', expect.objectContaining({ voice_key: readyVoice.voice_key, language_code: 'en', settings: null })),
        )
        expect(draftVoice.voice_key).not.toBe(readyVoice.voice_key)
    })

    it('deletes after the confirm, and keeps the row when the delete fails', async () => {
        mock().deleteAdminGlobalPreset.mockRejectedValueOnce(new ApiError(403, 'Forbidden'))
        const table = await renderModule()
        fireEvent.click(within(rowOf(table, 'Calm narrator')).getByRole('button', { name: 'Delete Calm narrator' }))
        const confirm = await screen.findByRole('dialog', { name: 'Delete this global preset?' })
        expect(confirm).toHaveTextContent('“Calm narrator” is removed for every user.')
        fireEvent.click(within(confirm).getByRole('button', { name: 'Delete preset' }))
        expect(await within(confirm).findByRole('alert')).toHaveTextContent('This action requires root access.')
        expect(screen.getByRole('rowheader', { name: /Calm narrator/ })).toBeInTheDocument()

        fireEvent.click(within(confirm).getByRole('button', { name: 'Delete preset' }))
        await waitFor(() => expect(screen.queryByRole('rowheader', { name: /Calm narrator/ })).toBeNull())
        expect(mock().deleteAdminGlobalPreset).toHaveBeenLastCalledWith('gp-1')
    })

    it('offers a retry when the list fails to load', async () => {
        mock().listAdminGlobalPresets.mockRejectedValueOnce(new ApiError(500, 'boom'))
        renderInConsole(<GlobalPresetsModule />, 'globalPresets')
        fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
        expect(await screen.findByRole('table', { name: 'Global presets' })).toBeInTheDocument()
    })
})
