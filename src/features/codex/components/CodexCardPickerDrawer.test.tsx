import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { apiService } from '@/infrastructure/api'
import type { Collection, LibraryPage, LibraryQuery } from '@/shared'
import {
    OTHER_WORKSPACE_ID,
    TEST_COLLECTION_ID,
    TEST_WORKSPACE_ID,
    WorkspaceTestProvider,
    createWorkspaceTestState,
    testWorkspace,
    type WorkspaceTestState,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { CodexCardPickerDrawer } from './CodexCardPickerDrawer'

function collection(id: string, name: string): Collection {
    return {
        id,
        workspace_id: OTHER_WORKSPACE_ID,
        name,
        description: null,
        position: 0,
        card_count: 1,
        row_version: 1,
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
    }
}

function page(cards: Array<{ id: string; name: string }>, total: number, offset = 0, cardType: 'character' | 'world' = 'character'): LibraryPage {
    return {
        items: cards.map((card) => ({
            card_type: cardType,
            card: { ...card, organization: { workspace_id: OTHER_WORKSPACE_ID, collection_ids: [] } },
        })),
        total,
        limit: 24,
        offset,
    }
}

type ScopedContext = { workspaceScope: { workspaceId: string } | null }

describe('CodexCardPickerDrawer', () => {
    let workspace: WorkspaceTestState
    let listLibraryCards: MockInstance<typeof apiService.listLibraryCards>
    let listCollections: MockInstance<typeof apiService.listCollections>

    function picker(props: Partial<Parameters<typeof CodexCardPickerDrawer>[0]> = {}): ReactElement {
        return (
            <WorkspaceTestProvider state={workspace}>
                <CodexCardPickerDrawer
                    open
                    workspaceId={OTHER_WORKSPACE_ID}
                    busy={false}
                    existingCardKeys={new Set()}
                    onClose={vi.fn()}
                    onAdd={vi.fn(async () => {})}
                    {...props}
                />
            </WorkspaceTestProvider>
        )
    }

    const lastQuery = (): LibraryQuery => listLibraryCards.mock.calls[listLibraryCards.mock.calls.length - 1]?.[1] ?? {}

    beforeEach(() => {
        workspace = createWorkspaceTestState({ api: apiService })
        listCollections = vi.spyOn(apiService, 'listCollections').mockResolvedValue({
            items: [collection(TEST_COLLECTION_ID, 'Act one')],
        })
        listLibraryCards = vi.spyOn(apiService, 'listLibraryCards').mockImplementation(async (_workspaceId, query = {}) => {
            if (query.collection_id) return page([{ id: 'c9', name: 'Wren' }], 1)
            if (query.card_type === 'world') return page([{ id: 'w1', name: 'Eldoria' }], 1, 0, 'world')
            if ((query.offset ?? 0) > 0) return page([{ id: 'c3', name: 'Dorn' }], 3, 2)
            return page([{ id: 'c1', name: 'Lyra' }, { id: 'c2', name: 'Mira' }], 3)
        })
    })

    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllEnvs()
    })

    it('browses cards without collection UI or requests when workspaces and adventures are off', async () => {
        vi.stubEnv('VITE_FEATURE_WORKSPACES_ENABLED', 'false')
        vi.stubEnv('VITE_FEATURE_ADVENTURES_ENABLED', 'false')
        render(picker({ workspaceId: undefined }))
        expect(await screen.findByText('Lyra')).toBeInTheDocument()
        expect(listCollections).not.toHaveBeenCalled()
        expect(screen.queryByText('Act one')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Adventures' })).not.toBeInTheDocument()
        fireEvent.click(screen.getByText('Lyra'))
        expect(screen.getByTestId('codex-add-cards-submit')).toBeEnabled()
    })

    it("browses the host's workspace with complete paging and adds only the explicit selection", async () => {
        const onAdd = vi.fn(async () => {})
        render(picker({ onAdd }))

        expect(await screen.findByText('Lyra')).toBeInTheDocument()
        expect(listLibraryCards).toHaveBeenCalledWith(OTHER_WORKSPACE_ID, {
            card_type: 'character', q: undefined, collection_id: undefined, limit: 24, offset: 0,
        })
        expect((listLibraryCards.mock.contexts[0] as ScopedContext).workspaceScope?.workspaceId).toBe(OTHER_WORKSPACE_ID)
        expect(listCollections).toHaveBeenCalledWith(OTHER_WORKSPACE_ID)
        expect(screen.getByText('Showing 2 of 3')).toBeInTheDocument()

        fireEvent.click(screen.getByTestId('codex-card-load-more'))
        expect(await screen.findByText('Dorn')).toBeInTheDocument()
        expect(lastQuery()).toMatchObject({ card_type: 'character', offset: 2 })
        expect(screen.queryByTestId('codex-card-load-more')).not.toBeInTheDocument()
        expect(screen.getAllByTestId('codex-card-option')).toHaveLength(3)

        fireEvent.click(screen.getByText('Lyra'))
        fireEvent.click(screen.getByText('Dorn'))
        expect(onAdd).not.toHaveBeenCalled()
        fireEvent.click(screen.getByTestId('codex-add-cards-submit'))

        await waitFor(() => expect(onAdd).toHaveBeenCalledWith([
            { kind: 'character', cardId: 'c1' },
            { kind: 'character', cardId: 'c3' },
        ]))
    })

    it('filters by a collection of that workspace and restarts at offset 0', async () => {
        render(picker())
        await screen.findByText('Lyra')
        fireEvent.click(screen.getByTestId('codex-card-load-more'))
        await screen.findByText('Dorn')

        fireEvent.click(screen.getByRole('combobox', { name: 'Collection' }))
        const listbox = screen.getByRole('listbox', { name: 'Collection' })
        expect(within(listbox).getByRole('option', { name: 'All cards' })).toHaveAttribute('aria-selected', 'true')
        fireEvent.click(within(listbox).getByRole('option', { name: 'Act one' }))

        expect(await screen.findByText('Wren')).toBeInTheDocument()
        expect(lastQuery()).toEqual({ card_type: 'character', q: undefined, collection_id: TEST_COLLECTION_ID, limit: 24, offset: 0 })
        expect(screen.queryByText('Lyra')).not.toBeInTheDocument()
        expect(screen.queryByTestId('codex-card-load-more')).not.toBeInTheDocument()
    })

    it('restarts at offset 0 for another kind and ignores a page of the previous kind', async () => {
        let releaseCharacters!: () => void
        listLibraryCards.mockImplementationOnce(() => new Promise((resolve) => {
            releaseCharacters = () => resolve(page([{ id: 'c-late', name: 'Late Lyra' }], 1))
        }))
        render(picker())
        await waitFor(() => expect(listLibraryCards).toHaveBeenCalledTimes(1))

        fireEvent.click(screen.getByRole('button', { name: 'Worlds' }))
        expect(await screen.findByText('Eldoria')).toBeInTheDocument()
        expect(lastQuery()).toMatchObject({ card_type: 'world', offset: 0 })

        releaseCharacters()
        await waitFor(() => expect(screen.getByText('Eldoria')).toBeInTheDocument())
        expect(screen.queryByText('Late Lyra')).not.toBeInTheDocument()
    })

    it('uses the committed workspace when the host gives none', async () => {
        render(picker({ workspaceId: undefined }))
        await screen.findByText('Lyra')
        expect(listLibraryCards.mock.calls[0][0]).toBe(TEST_WORKSPACE_ID)
        expect(listCollections).toHaveBeenCalledWith(TEST_WORKSPACE_ID)
    })

    it('browses an archived host workspace but adds nothing', async () => {
        workspace = createWorkspaceTestState({
            api: apiService,
            workspaces: [
                testWorkspace(TEST_WORKSPACE_ID, 'Main library'),
                testWorkspace(OTHER_WORKSPACE_ID, 'Novel A', { archived_at: '2026-10-10T00:00:00Z' }),
            ],
        })
        const onAdd = vi.fn(async () => {})
        render(picker({ onAdd }))

        // Browsing (and paging) still works.
        expect(await screen.findByText('Lyra')).toBeInTheDocument()
        expect(screen.getByTestId('codex-card-picker-archived')).toHaveTextContent(
            'This workspace is archived. Restore it to create or edit content.',
        )
        fireEvent.click(screen.getByTestId('codex-card-load-more'))
        expect(await screen.findByText('Dorn')).toBeInTheDocument()

        // Nothing can be picked or added.
        for (const option of screen.getAllByTestId('codex-card-option')) expect(option).toBeDisabled()
        fireEvent.click(screen.getByText('Lyra'))
        expect(screen.getByTestId('codex-add-cards-submit')).toBeDisabled()
        fireEvent.click(screen.getByTestId('codex-add-cards-submit'))
        expect(onAdd).not.toHaveBeenCalled()
    })

    it('is read-only when the host says so', async () => {
        const onAdd = vi.fn(async () => {})
        render(picker({ onAdd, readOnly: true }))

        expect(await screen.findByText('Lyra')).toBeInTheDocument()
        expect(screen.getByTestId('codex-card-picker-archived')).toBeInTheDocument()
        expect(screen.getAllByTestId('codex-card-option')[0]).toBeDisabled()
        expect(screen.getByTestId('codex-add-cards-submit')).toBeDisabled()
    })

    it('clears the selection and filters and closes on a committed workspace switch', async () => {
        const onClose = vi.fn()
        const onAdd = vi.fn(async () => {})
        const { rerender } = render(picker({ onClose, onAdd, workspaceId: undefined }))
        await screen.findByText('Lyra')
        fireEvent.click(screen.getByText('Lyra'))
        fireEvent.change(screen.getByTestId('codex-card-search'), { target: { value: 'ly' } })

        workspace.switchTo(OTHER_WORKSPACE_ID)
        rerender(picker({ onClose, onAdd, workspaceId: undefined }))

        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
        expect(screen.getByTestId('codex-card-search')).toHaveValue('')
        expect(screen.getByTestId('codex-add-cards-submit')).toBeDisabled()
    })
})
