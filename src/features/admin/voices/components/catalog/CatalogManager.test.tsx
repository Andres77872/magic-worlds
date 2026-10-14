import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { ApiError } from '@/infrastructure/api'
import type { AdminCatalogVoice, AdminVoiceLimits } from '@/shared'
import { auditLimits, draftVoice, libraryVoice, readyVoice, replacementVoice } from '../../fixtures'
import { chooseOption, consoleApiMock, renderInConsole, type ConsoleApiMock } from '../../testUtils'
import { CatalogManager } from './CatalogManager'

const api = vi.hoisted(() => ({}) as Record<string, unknown>)
vi.mock('@/infrastructure/api', async (importOriginal) => ({ ...(await importOriginal<object>()), apiService: api }))
const mock = () => api as unknown as ConsoleApiMock

const impact = {
    voice_key: readyVoice.voice_key,
    reference_counts: { card: 30, preset: 4, template_cast: 8 },
    total_references: 42,
    distinct_owners: 17,
    examples: [{ ref_type: 'card', ref_id: '991', owner_user_id: 5, label: 'Captain Ilsa' }],
    collision_count: 3,
    replacement_voice_key: replacementVoice.voice_key,
}

/** Ysolde without the fixture's two-cycle back to Maren: a replacement the BFF accepts. */
const standaloneReplacement: AdminCatalogVoice = { ...replacementVoice, replacement_voice_key: null }

async function openVoice(name: string) {
    const table = await screen.findByRole('table', { name: 'Catalog voices' })
    fireEvent.click(within(table).getByRole('button', { name: `Manage ${name}` }))
    return screen.findByRole('dialog', { name: name })
}

describe('CatalogManager (AC-R2)', () => {
    beforeEach(() => {
        for (const key of Object.keys(api)) delete api[key]
        Object.assign(api, consoleApiMock())
    })

    it('lists voices with provider-name drift, acceptance ticks and reference counts', async () => {
        renderInConsole(<CatalogManager />)
        const table = await screen.findByRole('table', { name: 'Catalog voices' })
        const row = within(table).getByRole('row', { name: /Maren/ })
        expect(within(row).getByText('Provider name: Maren (designed)')).toBeInTheDocument()
        expect(within(row).getByText('English: Flash, v4')).toBeInTheDocument()
        expect(within(row).getByText('42')).toBeInTheDocument()
        expect(screen.getByText('4 voices')).toBeInTheDocument()
    })

    it('sends server filters when a filter changes', async () => {
        renderInConsole(<CatalogManager />)
        await screen.findByRole('table', { name: 'Catalog voices' })
        chooseOption('Status', 'Hidden')
        await waitFor(() => expect(mock().listAdminCatalog).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'hidden', limit: 50 }), expect.any(AbortSignal)))
    })

    it('keeps Publish disabled until every checklist item passes', async () => {
        renderInConsole(<CatalogManager />)
        const drawer = await openVoice('Eldrin')
        const publish = within(drawer).getByRole('button', { name: 'Publish' })
        expect(publish).toBeDisabled()
        expect(within(drawer).getByText(/Accepted on Flash for at least one language/)).toHaveTextContent('Not met')
    })

    it('publishes a ready hidden voice through the PATCH route', async () => {
        const hidden: AdminCatalogVoice = { ...readyVoice, status: 'hidden' }
        mock().listAdminCatalog.mockResolvedValue({ items: [hidden, standaloneReplacement], next_cursor: null, summary: null })
        mock().updateAdminCatalogVoice.mockResolvedValue({ ...readyVoice })
        renderInConsole(<CatalogManager />)
        const drawer = await openVoice('Maren')
        const republish = within(drawer).getByRole('button', { name: 'Re-publish' })
        await waitFor(() => expect(republish).toBeEnabled())
        fireEvent.click(republish)
        await waitFor(() => expect(mock().updateAdminCatalogVoice).toHaveBeenCalledWith(readyVoice.voice_key, { status: 'active', visibility: 'public' }))
        expect(await screen.findByText('Voice published')).toBeInTheDocument()
    })

    it('lists the server publish refusals, language-suffixed codes included, in the checklist section', async () => {
        const hidden: AdminCatalogVoice = { ...readyVoice, status: 'hidden' }
        mock().listAdminCatalog.mockResolvedValue({ items: [hidden, standaloneReplacement], next_cursor: null, summary: null })
        mock().updateAdminCatalogVoice.mockRejectedValue(
            new ApiError(422, 'The voice does not meet the publish rules.', {
                code: 'publish_precondition_failed',
                details: {
                    code: 'publish_precondition_failed',
                    message: 'The voice does not meet the publish rules.',
                    failed: ['expressive_not_passed:es', 'call_consistency_low:es', 'no_expressive_sample:en', 'ivc_publish_blocked', 'source_not_allowed', 'replacement_not_call_eligible', 'brand_new_rule'],
                },
            }),
        )
        renderInConsole(<CatalogManager />)
        const drawer = await openVoice('Maren')
        const republish = within(drawer).getByRole('button', { name: 'Re-publish' })
        await waitFor(() => expect(republish).toBeEnabled())
        fireEvent.click(republish)

        const refusal = await within(drawer).findByTestId('server-refusal-publishing')
        expect(refusal).toHaveTextContent('The server refused the change:')
        const items = within(refusal).getAllByRole('listitem').map((item) => item.textContent)
        expect(items).toEqual([
            'Expressive (v4) has no pass in Spanish.',
            'Consistency with v4 is below 4 on the Flash review in Spanish.',
            'No own Expressive showcase sample in English.',
            'Instant clones are not published until P-15 is answered.',
            'This source kind cannot be published.',
            'The replacement voice is not call eligible.',
            'Not met: brand_new_rule',
        ])
        expect(await screen.findByText(/^The voice does not meet the publish rules\. Expressive \(v4\) has no pass in Spanish\./)).toBeInTheDocument()
    })

    it('keeps Publish disabled while the stored replacement no longer qualifies, and says why', async () => {
        const hidden: AdminCatalogVoice = { ...readyVoice, status: 'hidden' }
        mock().listAdminCatalog.mockResolvedValue({ items: [hidden, { ...standaloneReplacement, status: 'hidden' }], next_cursor: null, summary: null })
        renderInConsole(<CatalogManager />)
        const drawer = await openVoice('Maren')
        const row = within(drawer).getByText(/A replacement voice is set/)
        expect(row).toHaveTextContent('Not met')
        expect(row).toHaveTextContent('The replacement voice is not active.')
        expect(within(drawer).getByRole('button', { name: 'Re-publish' })).toBeDisabled()
    })

    it('names the dependent voices when a retire is refused with voice_is_replacement', async () => {
        const dependent = { ...readyVoice, voice_key: 'vk_dependent', display_name: 'Odette', replacement_voice_key: readyVoice.voice_key }
        mock().listAdminCatalog.mockResolvedValue({ items: [readyVoice, standaloneReplacement, dependent], next_cursor: null, summary: null })
        mock().getAdminCatalogImpact.mockResolvedValue(impact)
        mock().updateAdminCatalogVoice.mockRejectedValue(
            new ApiError(409, 'Other voices use this voice as their replacement.', {
                code: 'voice_is_replacement',
                details: {
                    code: 'voice_is_replacement',
                    dependent_voice_keys: ['vk_dependent', 'vk_unloaded'],
                    reasons: { vk_dependent: 'replacement_not_active', vk_unloaded: 'replacement_not_active' },
                },
            }),
        )
        renderInConsole(<CatalogManager />)
        const drawer = await openVoice('Maren')
        fireEvent.click(within(drawer).getByRole('button', { name: 'Retire' }))
        const dialog = await screen.findByRole('dialog', { name: 'Retire Maren' })
        const confirm = within(dialog).getByRole('button', { name: 'Retire voice' })
        await waitFor(() => expect(confirm).toBeEnabled())
        fireEvent.click(confirm)

        const refusal = await within(drawer).findByTestId('server-refusal-publishing')
        expect(refusal).toHaveTextContent('This voice is the replacement of another voice. Change that replacement first.')
        expect(refusal).toHaveTextContent('Used as the replacement by: Odette, Unknown voice (vk_unloaded).')
    })

    describe('re-pointing dependent voices (I-34)', () => {
        const odette: AdminCatalogVoice = { ...readyVoice, voice_key: 'vk_dependent', display_name: 'Odette', replacement_voice_key: readyVoice.voice_key, sort_rank: 20 }
        const brisa: AdminCatalogVoice = { ...standaloneReplacement, voice_key: 'vk_brisa', display_name: 'Brisa', gender: 'male' }
        const refused = () =>
            new ApiError(409, 'Other voices use this voice as their replacement.', {
                code: 'voice_is_replacement',
                details: {
                    code: 'voice_is_replacement',
                    dependent_voice_keys: ['vk_dependent'],
                    reasons: { vk_dependent: 'replacement_not_active' },
                },
            })

        async function retireMaren() {
            mock().listAdminCatalog.mockResolvedValue({ items: [readyVoice, standaloneReplacement, odette, brisa], next_cursor: null, summary: null })
            mock().getAdminCatalogImpact.mockResolvedValue(impact)
            renderInConsole(<CatalogManager />)
            const drawer = await openVoice('Maren')
            fireEvent.click(within(drawer).getByRole('button', { name: 'Retire' }))
            const impactView = await screen.findByRole('dialog', { name: 'Retire Maren' })
            const confirm = within(impactView).getByRole('button', { name: 'Retire voice' })
            await waitFor(() => expect(confirm).toBeEnabled())
            fireEvent.click(confirm)
            return screen.findByRole('dialog', { name: 'Re-point the voices that depend on Maren' })
        }

        it('lists the dependents and retries the retire with repoint_dependents_to', async () => {
            mock().updateAdminCatalogVoice.mockRejectedValueOnce(refused()).mockResolvedValueOnce({ ...readyVoice, status: 'hidden' })
            const dialog = await retireMaren()
            // The impact view hands over to the re-point dialog.
            expect(screen.queryByRole('dialog', { name: 'Retire Maren' })).not.toBeInTheDocument()

            const dependents = within(dialog).getByRole('region', { name: 'Dependent voices' })
            expect(within(dependents).getByRole('listitem')).toHaveTextContent('OdetteThe replacement voice is not active.')
            const confirm = within(dialog).getByRole('button', { name: 'Re-point and save' })
            expect(confirm).toBeDisabled()

            fireEvent.click(within(dialog).getByRole('combobox', { name: 'New replacement' }))
            // Maren is the voice being retired, Odette is a dependent, Brisa does not match the gender.
            for (const name of [/Maren/, /Odette/, /Brisa/]) expect(screen.queryByRole('option', { name })).not.toBeInTheDocument()
            fireEvent.click(screen.getByRole('option', { name: /Ysolde/ }))
            fireEvent.click(confirm)

            await waitFor(() =>
                expect(mock().updateAdminCatalogVoice).toHaveBeenLastCalledWith(readyVoice.voice_key, { status: 'hidden' }, { repointDependentsTo: standaloneReplacement.voice_key }),
            )
            expect(await screen.findByText('Voice retired. 1 voice now uses Ysolde as its replacement.')).toBeInTheDocument()
            await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Re-point the voices that depend on Maren' })).not.toBeInTheDocument())
        })

        it('re-points from a metadata save and refetches the catalog afterwards', async () => {
            mock().listAdminCatalog.mockResolvedValue({ items: [readyVoice, standaloneReplacement, odette, brisa], next_cursor: null, summary: null })
            mock().updateAdminCatalogVoice.mockRejectedValueOnce(refused()).mockResolvedValueOnce({ ...readyVoice })
            renderInConsole(<CatalogManager />)
            const drawer = await openVoice('Maren')
            fireEvent.click(within(drawer).getByRole('button', { name: 'Save metadata' }))

            const dialog = await screen.findByRole('dialog', { name: 'Re-point the voices that depend on Maren' })
            const firstCall = mock().updateAdminCatalogVoice.mock.calls[0]
            expect(firstCall).toHaveLength(2)
            const body = firstCall[1]
            expect(body).toEqual(expect.objectContaining({ display_name: 'Maren', gender: 'female' }))

            chooseOption('New replacement', /Ysolde/)
            const listsBefore = mock().listAdminCatalog.mock.calls.length
            fireEvent.click(within(dialog).getByRole('button', { name: 'Re-point and save' }))

            await waitFor(() =>
                expect(mock().updateAdminCatalogVoice).toHaveBeenLastCalledWith(readyVoice.voice_key, body, { repointDependentsTo: standaloneReplacement.voice_key }),
            )
            expect(await screen.findByText('Changes saved. 1 voice now uses Ysolde as its replacement.')).toBeInTheDocument()
            // The server moves the dependents it finds at retry time: the page and the index refetch.
            await waitFor(() => expect(mock().listAdminCatalog.mock.calls.length).toBeGreaterThanOrEqual(listsBefore + 2))
        })

        it('keeps the dialog open and names the dependent on 422 repoint_target_invalid', async () => {
            mock().updateAdminCatalogVoice.mockRejectedValueOnce(refused()).mockRejectedValueOnce(
                new ApiError(422, 'The new replacement is not valid for every dependent voice.', {
                    code: 'repoint_target_invalid',
                    details: { code: 'repoint_target_invalid', voice_key: 'vk_dependent', reason: 'replacement_mismatch' },
                }),
            )
            const dialog = await retireMaren()
            chooseOption('New replacement', /Ysolde/)
            fireEvent.click(within(dialog).getByRole('button', { name: 'Re-point and save' }))

            expect(await within(dialog).findByTestId('repoint-error')).toHaveTextContent(
                'Ysolde cannot replace Odette: The replacement must match the language, gender and age bucket.',
            )
            expect(screen.getByRole('dialog', { name: 'Re-point the voices that depend on Maren' })).toBeInTheDocument()
            expect(mock().updateAdminCatalogVoice).toHaveBeenCalledTimes(2)
        })

        it('says when no loaded voice fits every dependent', async () => {
            mock().updateAdminCatalogVoice.mockRejectedValueOnce(refused())
            mock().listAdminCatalog.mockResolvedValue({ items: [readyVoice, odette, brisa], next_cursor: null, summary: null })
            mock().getAdminCatalogImpact.mockResolvedValue(impact)
            renderInConsole(<CatalogManager />)
            const drawer = await openVoice('Maren')
            fireEvent.click(within(drawer).getByRole('button', { name: 'Retire' }))
            const impactView = await screen.findByRole('dialog', { name: 'Retire Maren' })
            const retire = within(impactView).getByRole('button', { name: 'Retire voice' })
            await waitFor(() => expect(retire).toBeEnabled())
            fireEvent.click(retire)

            const dialog = await screen.findByRole('dialog', { name: 'Re-point the voices that depend on Maren' })
            expect(within(dialog).getByText(/No voice qualifies as the replacement of every dependent voice/)).toBeInTheDocument()
            expect(within(dialog).getByRole('button', { name: 'Re-point and save' })).toBeDisabled()
            fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
            await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Re-point the voices that depend on Maren' })).not.toBeInTheDocument())
            expect(mock().updateAdminCatalogVoice).toHaveBeenCalledTimes(1)
        })
    })

    it('warns about replacement orphans reported by a sync answer', async () => {
        mock().syncAdminCatalog.mockResolvedValue({ job: 'B', run_id: 'run-2', status: 'completed', detail: 'removed=1 present=0 errors=0 skipped=0 replacement_orphans=2' })
        renderInConsole(<CatalogManager />)
        chooseOption('Sync job', 'Job B: refresh voice details')
        fireEvent.click(screen.getByRole('button', { name: 'Sync now' }))
        expect(await screen.findByTestId('sync-replacement-orphans')).toHaveTextContent(
            'The removal left 2 voices without a valid replacement. Open each one and pick a new replacement.',
        )
    })

    it('shows no orphan warning when the sync answer reports none', async () => {
        mock().syncAdminCatalog.mockResolvedValue({ job: 'B', run_id: 'run-3', status: 'completed', detail: 'removed=1 present=0 errors=0 skipped=0 replacement_orphans=0' })
        renderInConsole(<CatalogManager />)
        chooseOption('Sync job', 'Job B: refresh voice details')
        fireEvent.click(screen.getByRole('button', { name: 'Sync now' }))
        expect(await screen.findByText('Sync job B queued')).toBeInTheDocument()
        expect(screen.queryByTestId('sync-replacement-orphans')).not.toBeInTheDocument()
    })

    describe('mass-removal override (D19 item 7, I-29/I-34)', () => {
        const aborted: AdminVoiceLimits = {
            ...auditLimits,
            sync_runs: [{ job: 'B', status: 'aborted', started_at: null, finished_at: '2026-10-12T06:05:40Z', mass_miss_abort: true, detail: 'mass_removal' }],
        }

        async function openOverride() {
            mock().getVoiceLimits.mockResolvedValue(aborted)
            renderInConsole(<CatalogManager />)
            const banner = await screen.findByTestId('sync-mass-removal')
            fireEvent.click(within(banner).getByRole('button', { name: 'Review removals' }))
            return screen.findByRole('dialog', { name: 'Confirm voice removals' })
        }

        it('is offered only after a Job B mass-removal abort', async () => {
            renderInConsole(<CatalogManager />)
            await screen.findByRole('table', { name: 'Catalog voices' })
            // The audit fixture's B abort has no mass_removal reason.
            expect(screen.queryByTestId('sync-mass-removal')).not.toBeInTheDocument()
        })

        it('sends confirm_removal for the selected voices behind the impact warning, then reports orphans', async () => {
            mock().syncAdminCatalog.mockResolvedValue({ job: 'B', run_id: 'run-9', status: 'completed', detail: 'removed=1 present=0 errors=0 skipped=0 replacement_orphans=2' })
            const dialog = await openOverride()
            expect(screen.getByTestId('sync-mass-removal')).toHaveTextContent('Job B stopped on mass removal')
            expect(within(dialog).getByText(/This cannot be undone from the console/)).toBeInTheDocument()
            expect(within(dialog).getByRole('button', { name: 'Confirm removal of 0 voices' })).toBeDisabled()

            fireEvent.change(within(dialog).getByRole('searchbox', { name: 'Filter voices' }), { target: { value: 'mar' } })
            expect(within(dialog).queryByRole('checkbox', { name: 'Ysolde' })).not.toBeInTheDocument()
            fireEvent.click(await within(dialog).findByRole('checkbox', { name: 'Maren' }))
            expect(within(dialog).getByText('1 of 100 selected')).toBeInTheDocument()
            expect(within(dialog).getByTestId('mass-removal-dependents')).toHaveTextContent(
                '2 voices use a selected voice as their replacement and would be left without one: Ysolde, Harbor watch.',
            )
            const confirm = within(dialog).getByRole('button', { name: 'Confirm removal of 1 voice' })
            expect(confirm).toBeDisabled()
            fireEvent.click(within(dialog).getByRole('checkbox', { name: 'I checked the provider account: these voices are gone there.' }))
            expect(confirm).toBeEnabled()
            fireEvent.click(confirm)

            await waitFor(() => expect(mock().syncAdminCatalog).toHaveBeenCalledWith({ job: 'B', voice_keys: [readyVoice.voice_key], confirm_removal: true }))
            expect(await screen.findByText('Removal check finished: 1 removed, 0 still present, 0 errors, 0 skipped.')).toBeInTheDocument()
            expect(screen.getByTestId('sync-replacement-orphans')).toHaveTextContent('The removal left 2 voices without a valid replacement.')
            await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Confirm voice removals' })).not.toBeInTheDocument())
            await waitFor(() => expect(mock().getVoiceLimits.mock.calls.length).toBeGreaterThanOrEqual(2))
        })

        it('keeps the dialog open when another sync holds the lease', async () => {
            mock().syncAdminCatalog.mockResolvedValue({ job: 'B', run_id: 'run-10', status: 'running', detail: 'lease_held' })
            const dialog = await openOverride()
            fireEvent.click(await within(dialog).findByRole('checkbox', { name: 'Eldrin' }))
            fireEvent.click(within(dialog).getByRole('checkbox', { name: 'I checked the provider account: these voices are gone there.' }))
            fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm removal of 1 voice' }))
            expect(await within(dialog).findByTestId('mass-removal-error')).toHaveTextContent('Another sync is running. Try again in a moment.')
            expect(mock().syncAdminCatalog).toHaveBeenCalledWith({ job: 'B', voice_keys: [draftVoice.voice_key], confirm_removal: true })
        })

        it('explains a 409 when this server has no mass-removal stop, without promising that a refresh helps', async () => {
            mock().syncAdminCatalog.mockRejectedValue(new ApiError(409, 'Removal can be confirmed only after Job B aborted on mass removal.', { code: 'no_mass_removal_abort' }))
            const dialog = await openOverride()
            fireEvent.click(await within(dialog).findByRole('checkbox', { name: 'Eldrin' }))
            fireEvent.click(within(dialog).getByRole('checkbox', { name: 'I checked the provider account: these voices are gone there.' }))
            fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm removal of 1 voice' }))
            const error = await within(dialog).findByTestId('mass-removal-error')
            expect(error).toHaveTextContent('There is no recent Job B mass-removal stop to override: the last Job B run did not stop, or the stop is more than 24 hours old. Run Job B again, or wait for its next run.')
            expect(error).not.toHaveTextContent(/refresh/i)
        })
    })

    it('shows "Blocked until L-2" for Library voices and never offers a provider delete', async () => {
        renderInConsole(<CatalogManager />)
        const drawer = await openVoice('Harbor watch')
        expect(within(drawer).getByRole('button', { name: 'Blocked until L-2' })).toBeDisabled()
        expect(within(drawer).queryByRole('button', { name: 'Delete from provider' })).not.toBeInTheDocument()
        expect(within(drawer).getByText('Library copies are never deleted from the provider.')).toBeInTheDocument()
    })

    it('retires only after the impact view shows counts, owners, examples and collisions', async () => {
        let resolveImpact: (value: typeof impact) => void = () => {}
        mock().getAdminCatalogImpact.mockReturnValue(new Promise((resolve) => (resolveImpact = resolve)))
        mock().updateAdminCatalogVoice.mockResolvedValue({ ...readyVoice, status: 'hidden' })
        renderInConsole(<CatalogManager />)
        const drawer = await openVoice('Maren')
        fireEvent.click(within(drawer).getByRole('button', { name: 'Retire' }))
        const dialog = await screen.findByRole('dialog', { name: 'Retire Maren' })
        const confirm = within(dialog).getByRole('button', { name: 'Retire voice' })
        expect(confirm).toBeDisabled()
        resolveImpact(impact)
        const counts = await within(dialog).findByRole('table', { name: 'References per document type' })
        expect(within(counts).getByRole('row', { name: 'Cards 30' })).toBeInTheDocument()
        expect(within(counts).getByRole('row', { name: 'Adventure template casts 8' })).toBeInTheDocument()
        expect(within(dialog).getByText('Distinct owners').nextSibling).toHaveTextContent('17')
        expect(within(dialog).getByText('Distinct-voice collisions').nextSibling).toHaveTextContent('3')
        expect(within(dialog).getByText('Captain Ilsa')).toBeInTheDocument()
        expect(mock().updateAdminCatalogVoice).not.toHaveBeenCalled()
        fireEvent.click(confirm)
        await waitFor(() => expect(mock().updateAdminCatalogVoice).toHaveBeenCalledWith(readyVoice.voice_key, { status: 'hidden' }))
    })

    it('sets a replacement from the candidates the BFF accepts, behind the impact view', async () => {
        mock().getAdminCatalogImpact.mockResolvedValue(impact)
        mock().updateAdminCatalogVoice.mockResolvedValue({ ...readyVoice })
        const other = { ...replacementVoice, voice_key: 'vk_other', display_name: 'Odette', replacement_voice_key: null, visibility: 'admin' as const }
        const notEligible = { ...other, voice_key: 'vk_not_eligible', display_name: 'Brisa', call_eligible: false }
        const clone = { ...other, voice_key: 'vk_clone', display_name: 'Cyra', source_kind: 'ivc' as const }
        mock().listAdminCatalog.mockResolvedValue({
            items: [{ ...readyVoice, replacement_voice_key: null }, replacementVoice, other, notEligible, clone, draftVoice],
            next_cursor: null,
            summary: null,
        })
        renderInConsole(<CatalogManager />)
        const drawer = await openVoice('Maren')
        fireEvent.click(within(drawer).getByRole('combobox', { name: 'Replacement voice' }))
        // Draft, not call eligible, an instant clone, and Ysolde (already replaced by Maren: a two-cycle) are refused by the BFF.
        for (const name of [/Eldrin/, /Brisa/, /Cyra/, /Ysolde/]) expect(screen.queryByRole('option', { name })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('option', { name: /Odette/ }))
        fireEvent.click(within(drawer).getByRole('button', { name: 'Set replacement' }))
        const dialog = await screen.findByRole('dialog', { name: 'Set replacement for Maren' })
        fireEvent.click(await within(dialog).findByRole('button', { name: 'Save replacement' }))
        await waitFor(() => expect(mock().updateAdminCatalogVoice).toHaveBeenCalledWith(readyVoice.voice_key, { replacement_voice_key: 'vk_other' }))
    })

    it('requires 0 references and a double confirmation for a provider delete', async () => {
        mock().deleteAdminCatalogVoice
            .mockResolvedValueOnce({ status: 'confirmation_required', confirm_token: 'tok', expires_at: null })
            .mockResolvedValueOnce({ status: 'deleted', voice: { ...draftVoice, status: 'removed' } })
        renderInConsole(<CatalogManager />)
        const referenced = await openVoice('Maren')
        expect(within(referenced).getByRole('button', { name: 'Delete from provider' })).toBeDisabled()
        expect(within(referenced).getByText('Still used by 42 references.')).toBeInTheDocument()
        fireEvent.click(within(referenced).getByRole('button', { name: 'Close' }))

        const drawer = await openVoice('Eldrin')
        fireEvent.click(within(drawer).getByRole('button', { name: 'Delete from provider' }))
        const dialog = await screen.findByRole('dialog', { name: 'Delete Eldrin from the provider' })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }))
        expect(await within(dialog).findByText(/Second confirmation/)).toBeInTheDocument()
        expect(mock().deleteAdminCatalogVoice).toHaveBeenCalledWith(draftVoice.voice_key, undefined)
        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete permanently' }))
        await waitFor(() => expect(mock().deleteAdminCatalogVoice).toHaveBeenLastCalledWith(draftVoice.voice_key, 'tok'))
        expect(await screen.findByText('Voice deleted from the provider')).toBeInTheDocument()
    })

    it('queues a sync job', async () => {
        renderInConsole(<CatalogManager />)
        chooseOption('Sync job', 'Job C: subscription limits')
        fireEvent.click(screen.getByRole('button', { name: 'Sync now' }))
        await waitFor(() => expect(mock().syncAdminCatalog).toHaveBeenCalledWith({ job: 'C' }))
        expect(await screen.findByText('Sync job C queued')).toBeInTheDocument()
    })

    it('loads more pages with the cursor', async () => {
        mock().listAdminCatalog
            .mockResolvedValueOnce({ items: [readyVoice], next_cursor: 'c2', summary: null })
            .mockResolvedValueOnce({ items: [readyVoice, replacementVoice, draftVoice, libraryVoice], next_cursor: null, summary: null })
            .mockResolvedValueOnce({ items: [draftVoice], next_cursor: null, summary: null })
        renderInConsole(<CatalogManager />)
        fireEvent.click(await screen.findByRole('button', { name: 'Load more' }))
        await waitFor(() => expect(mock().listAdminCatalog).toHaveBeenCalledWith(expect.objectContaining({ after: 'c2' })))
        expect(await screen.findByRole('button', { name: 'Manage Eldrin' })).toBeInTheDocument()
    })
})
