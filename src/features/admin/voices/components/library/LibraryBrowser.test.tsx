import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { auditLibraryPage, auditLimits, libraryVoice } from '../../fixtures'
import { consoleApiMock, renderInConsole, type ConsoleApiMock } from '../../testUtils'
import { LibraryBrowser } from './LibraryBrowser'

const api = vi.hoisted(() => ({}) as Record<string, unknown>)
vi.mock('@/infrastructure/api', async (importOriginal) => ({ ...(await importOriginal<object>()), apiService: api }))
const mock = () => api as unknown as ConsoleApiMock

const listing = auditLibraryPage.items[0]

async function openAddDialog() {
    renderInConsole(<LibraryBrowser />, 'library')
    fireEvent.click(await screen.findByRole('button', { name: 'Add to catalog' }))
    return screen.findByRole('dialog', { name: 'Add Old harbour master to the catalog' })
}

describe('LibraryBrowser (AC-R6)', () => {
    beforeEach(() => {
        for (const key of Object.keys(api)) delete api[key]
        Object.assign(api, consoleApiMock())
    })

    it('lists Library voices with their terms and sends the chosen filters', async () => {
        renderInConsole(<LibraryBrowser />, 'library')
        expect(await screen.findByRole('heading', { name: 'Old harbour master' })).toBeInTheDocument()
        expect(screen.getByText('Notice period: 4015 days')).toBeInTheDocument()
        expect(screen.getByText(/Always applied: notice period of at least 365 days/)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Play Upstream preview of Old harbour master' })).toBeInTheDocument()
        const filters = screen.getByRole('search', { name: 'Library filters' })
        fireEvent.change(within(filters).getByLabelText('Search'), { target: { value: 'harbour' } })
        fireEvent.click(within(filters).getByRole('button', { name: 'Search' }))
        await waitFor(() => expect(mock().listAdminLibrary).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'harbour', page: 0 }), expect.any(AbortSignal)))
    })

    it('offers no control that loosens the enforced filters, and loads every page through the enforced read (R1-FE-06 audit)', async () => {
        mock().listAdminLibrary.mockResolvedValueOnce({ ...auditLibraryPage, has_more: true })
        mock().listAdminLibrary.mockResolvedValueOnce({ ...auditLibraryPage, page: 1, has_more: false, items: [] })
        renderInConsole(<LibraryBrowser />, 'library')
        const filters = await screen.findByRole('search', { name: 'Library filters' })
        // Notice period, custom rates and live moderation are fixed by the API layer, never offered here.
        for (const control of [...within(filters).queryAllByRole('textbox'), ...within(filters).queryAllByRole('combobox'), ...within(filters).queryAllByRole('checkbox')]) {
            expect(control.getAttribute('aria-label') ?? control.id).not.toMatch(/notice|custom|moderat/i)
        }
        expect(within(filters).queryByText(/notice|custom rate|moderat/i)).toBeNull()
        for (const [query] of mock().listAdminLibrary.mock.calls) {
            expect(Object.keys(query)).not.toEqual(expect.arrayContaining(['min_notice_period_days']))
        }
        fireEvent.click(await screen.findByRole('button', { name: 'Load more' }))
        await waitFor(() => expect(mock().listAdminLibrary).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, sort: 'trending' })))
    })

    it('requires the terms checklist and both attestations before adding', async () => {
        mock().addAdminLibraryVoice.mockResolvedValue({ ...libraryVoice, voice_key: 'vk_new', display_name: 'Harbour master' })
        const dialog = await openAddDialog()
        const add = within(dialog).getByRole('button', { name: 'Add to catalog' })
        expect(within(dialog).getByText('Notice period of at least 365 days')).toHaveTextContent('Passed')
        expect(add).toBeDisabled()
        fireEvent.click(within(dialog).getByRole('checkbox', { name: 'This voice does not sound child-like.' }))
        expect(add).toBeDisabled()
        fireEvent.click(within(dialog).getByRole('checkbox', { name: 'The name and description do not refer to a public figure.' }))
        fireEvent.change(within(dialog).getByLabelText('Catalog name'), { target: { value: ' Harbour master ' } })
        await waitFor(() => expect(add).toBeEnabled())
        fireEvent.click(add)
        await waitFor(() =>
            expect(mock().addAdminLibraryVoice).toHaveBeenCalledWith({
                public_owner_id: listing.public_owner_id,
                library_voice_id: listing.library_voice_id,
                new_name: 'Harbour master',
                attest_not_child_like: true,
                attest_no_public_figure: true,
            }),
        )
        expect(await screen.findByText('In catalog')).toBeInTheDocument()
    })

    it('refuses a voice whose terms fail the checklist', async () => {
        mock().listAdminLibrary.mockResolvedValue({ ...auditLibraryPage, items: [{ ...listing, live_moderation_enabled: true, fiat_rate: 0.3 }] })
        const dialog = await openAddDialog()
        fireEvent.click(within(dialog).getByRole('checkbox', { name: 'This voice does not sound child-like.' }))
        fireEvent.click(within(dialog).getByRole('checkbox', { name: 'The name and description do not refer to a public figure.' }))
        expect(within(dialog).getByText('No live moderation')).toHaveTextContent('Not met')
        expect(within(dialog).getByText('Standard rate and no custom price')).toHaveTextContent('Not met')
        expect(within(dialog).getByRole('button', { name: 'Add to catalog' })).toBeDisabled()
    })

    it('refuses adding when fewer than 5 voice operations remain', async () => {
        mock().getVoiceLimits.mockResolvedValue({
            ...auditLimits,
            subscription: { ...auditLimits.subscription!, voice_add_edit_counter: 1036, max_voice_add_edits: 1040 },
        })
        const dialog = await openAddDialog()
        expect(await within(dialog).findByText(/Fewer than 5 voice operations remain/)).toBeInTheDocument()
        fireEvent.click(within(dialog).getByRole('checkbox', { name: 'This voice does not sound child-like.' }))
        fireEvent.click(within(dialog).getByRole('checkbox', { name: 'The name and description do not refer to a public figure.' }))
        expect(within(dialog).getByRole('button', { name: 'Add to catalog' })).toBeDisabled()
        expect(mock().addAdminLibraryVoice).not.toHaveBeenCalled()
    })
})
