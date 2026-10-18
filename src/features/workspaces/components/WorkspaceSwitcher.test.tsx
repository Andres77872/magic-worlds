import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    createWorkspaceTestState,
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    testWorkspace,
    WorkspaceTestProvider,
    type WorkspaceTestState,
} from '@/shared/hooks/testing/workspaceTestUtils'

const ARCHIVED_ID = '5e6f7a8b-9c0d-4e1f-8a2b-4c5d6e7f8a9b'

const mocks = vi.hoisted(() => ({
    navigate: vi.fn(async () => 'navigated'),
    refreshWorkspaces: vi.fn(async () => undefined),
    createWorkspace: vi.fn(),
    updateWorkspace: vi.fn(),
    archiveWorkspace: vi.fn(),
    restoreWorkspace: vi.fn(),
    listLibraryCards: vi.fn(),
    listCollections: vi.fn(),
}))

vi.mock('@/features/workspaces/useNavigationCoordinator', () => ({
    useNavigationCoordinator: () => ({
        navigate: mocks.navigate,
        switchingTo: null,
        switchFailure: null,
        dismissSwitchFailure: () => {},
        routeStatus: 'ready',
    }),
}))
vi.mock('@/infrastructure/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/infrastructure/api')>()),
    apiService: {
        createWorkspace: mocks.createWorkspace,
        updateWorkspace: mocks.updateWorkspace,
        archiveWorkspace: mocks.archiveWorkspace,
        restoreWorkspace: mocks.restoreWorkspace,
        listLibraryCards: mocks.listLibraryCards,
        listCollections: mocks.listCollections,
    },
}))

import { WorkspaceApiError } from '@/infrastructure/api'
import { NavigationProvider } from '@/app/providers/NavigationProvider'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'

const main = testWorkspace(TEST_WORKSPACE_ID, 'Main library')
const novel = testWorkspace(OTHER_WORKSPACE_ID, 'Novel A', { row_version: 4 })
const old = testWorkspace(ARCHIVED_ID, 'Old campaign', { archived_at: '2026-09-01T00:00:00Z', row_version: 2 })

let state: WorkspaceTestState

function renderSwitcher() {
    return render(
        <WorkspaceTestProvider state={state}>
            <NavigationProvider>
                <WorkspaceSwitcher />
            </NavigationProvider>
        </WorkspaceTestProvider>,
    )
}

function openMenu() {
    fireEvent.click(screen.getByRole('button', { name: 'Switch workspace, current: Main library' }))
    return screen.getByRole('menu', { name: 'Workspaces' })
}

async function openManage() {
    fireEvent.click(within(openMenu()).getByRole('menuitem', { name: 'Manage workspaces' }))
    return screen.findByRole('dialog', { name: 'Workspaces' })
}

describe('WorkspaceSwitcher and workspace management', () => {
    beforeEach(() => {

        vi.clearAllMocks()
        window.history.replaceState(null, '', `#/library?workspace=${TEST_WORKSPACE_ID}`)
        mocks.listLibraryCards.mockResolvedValue({ items: [], total: 12, limit: 1, offset: 0 })
        mocks.listCollections.mockResolvedValue({ items: [{ id: 'x' }, { id: 'y' }] })
        state = createWorkspaceTestState({
            workspaces: [main, novel, old],
            overrides: { refreshWorkspaces: mocks.refreshWorkspaces },
        })
    })

    afterEach(() => vi.unstubAllEnvs())

    it('lists active and archived workspaces and switches through the coordinator', () => {
        renderSwitcher()
        const menu = openMenu()
        const active = within(menu).getAllByRole('menuitemradio')
        expect(active.map((item) => item.textContent)).toEqual(['Main libraryDefault', 'Novel A', 'Old campaignRead-only'])
        expect(within(menu).getByRole('menuitemradio', { name: /Main library/ })).toHaveAttribute('aria-checked', 'true')

        fireEvent.click(within(menu).getByRole('menuitemradio', { name: /Novel A/ }))
        expect(mocks.navigate).toHaveBeenCalledWith({
            page: 'library',
            hash: `#/library?workspace=${OTHER_WORKSPACE_ID}`,
            workspace: novel,
        })
    })

    it('renders the workspace switcher without any temporary workspace permission', () => {
        state = createWorkspaceTestState({ workspaces: [main, novel] })
        renderSwitcher()
        expect(screen.getByRole('button', { name: /Switch workspace/ })).toBeInTheDocument()
    })

    it('explains why the default workspace cannot be archived', async () => {
        renderSwitcher()
        const dialog = await openManage()
        expect(within(dialog).getByRole('button', { name: 'Archive: Main library' })).toBeDisabled()
        expect(within(dialog).getByText('The default workspace can’t be archived. It keeps your library available.')).toBeInTheDocument()
        expect(within(dialog).getByRole('button', { name: 'Archive: Novel A' })).toBeEnabled()
        expect(within(dialog).getByRole('button', { name: 'Restore: Old campaign' })).toBeInTheDocument()
    })

    it('archives with the workspace version and reports an active call', async () => {
        mocks.archiveWorkspace.mockRejectedValueOnce(new WorkspaceApiError(409, 'call', { code: 'WORKSPACE_ACTIVE_CALL' }))
        renderSwitcher()
        let dialog = await openManage()
        fireEvent.click(within(dialog).getByRole('button', { name: 'Archive: Novel A' }))
        expect(await screen.findByText('It becomes read-only. You can still open, copy and export its content, and restore it anytime.')).toBeInTheDocument()
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
        })
        expect(mocks.archiveWorkspace).toHaveBeenCalledWith(OTHER_WORKSPACE_ID, 4)
        dialog = await screen.findByRole('dialog', { name: 'Workspaces' })
        expect(within(dialog).getByText('End the active call in this workspace before archiving it.')).toBeInTheDocument()
    })

    it('restores an archived workspace with its version', async () => {
        mocks.restoreWorkspace.mockResolvedValue({ ...old, archived_at: null, row_version: 3 })
        renderSwitcher()
        const dialog = await openManage()
        await act(async () => {
            fireEvent.click(within(dialog).getByRole('button', { name: 'Restore: Old campaign' }))
        })
        expect(mocks.restoreWorkspace).toHaveBeenCalledWith(ARCHIVED_ID, 2)
        expect(await within(dialog).findByText('Old campaign was restored.')).toBeInTheDocument()
        // Another workspace's DTO is refreshed from the list, never committed as the selection.
        expect(mocks.refreshWorkspaces).toHaveBeenCalled()
    })

    it('edits with If-Match, shows a content summary, and reloads on a version conflict', async () => {
        mocks.updateWorkspace.mockRejectedValueOnce(new WorkspaceApiError(412, 'changed', { code: 'WORKSPACE_VERSION_CONFLICT' }))
        renderSwitcher()
        const manage = await openManage()
        fireEvent.click(within(manage).getByRole('button', { name: 'Edit: Novel A' }))
        const form = await screen.findByRole('dialog', { name: 'Edit workspace' })
        await waitFor(() => expect(mocks.listLibraryCards).toHaveBeenCalledWith(OTHER_WORKSPACE_ID, { limit: 1 }))
        expect(await within(form).findByText(/12 cards/)).toBeInTheDocument()

        fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'Novel B' } })
        await act(async () => {
            fireEvent.click(within(form).getByRole('button', { name: 'Save' }))
        })
        expect(mocks.updateWorkspace).toHaveBeenCalledWith(OTHER_WORKSPACE_ID, 4, { name: 'Novel B', description: null, preferred_use: 'library' })
        expect(within(form).getByText('This workspace changed elsewhere. It was reloaded; review it and try again.')).toBeInTheDocument()
        expect(mocks.refreshWorkspaces).toHaveBeenCalled()
    })

    it('creates a workspace and opens it at its preferred landing page', async () => {
        const created = testWorkspace('6f7a8b9c-0d1e-4f2a-9b3c-5d6e7f8a9b0c', 'Novel C')
        mocks.createWorkspace.mockResolvedValue(created)
        renderSwitcher()
        fireEvent.click(within(openMenu()).getByRole('menuitem', { name: 'Create workspace' }))
        const form = await screen.findByRole('dialog', { name: 'Create workspace' })
        fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'Novel C' } })
        await act(async () => {
            fireEvent.click(within(form).getByRole('button', { name: 'Create workspace' }))
        })
        expect(mocks.createWorkspace).toHaveBeenCalledWith({ name: 'Novel C', description: null, preferred_use: 'library' })
        // The body never names an organization or workspace id.
        expect(mocks.createWorkspace.mock.calls[0][0]).not.toHaveProperty('workspace_id')
        await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ page: 'library', hash: undefined, workspace: created }))
    })
})
