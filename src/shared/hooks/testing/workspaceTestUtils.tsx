/**
 * Test-only Workspace R1 context for components that read `useWorkspace()`.
 *
 *     const workspace = createWorkspaceTestState({ api: apiService })   // the mocked singleton
 *     render(<WorkspaceTestProvider state={workspace}><Page /></WorkspaceTestProvider>)
 *     workspace.switchTo(OTHER_WORKSPACE_ID)                           // a committed switch
 *     rerender(<WorkspaceTestProvider state={workspace}><Page /></WorkspaceTestProvider>)
 *
 * Like the real provider, `capture`/`isCurrent` read live state, so work
 * captured before `switchTo` is no longer current afterwards.
 */
import type { ReactNode } from 'react'
import type { ApiService } from '@/infrastructure/api'
import type { Workspace } from '@/shared/types'
import { WorkspaceContext, type WorkspaceContextValue, type WorkspaceScopeCapture } from '@/app/providers/workspaceContext'

export const TEST_WORKSPACE_ID = '0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b'
export const OTHER_WORKSPACE_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'
export const TEST_COLLECTION_ID = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e'

export function testWorkspace(id: string, name: string, overrides: Partial<Workspace> = {}): Workspace {
    return {
        id,
        name,
        description: null,
        preferred_use: 'library',
        is_default: id === TEST_WORKSPACE_ID,
        archived_at: null,
        row_version: 1,
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
        ...overrides,
    }
}

export interface WorkspaceTestState {
    readonly live: { selectedWorkspaceId: string | null; workspaceEpoch: number }
    value: () => WorkspaceContextValue
    /** Commits another workspace: bumps the epoch so earlier captures stop being current. */
    switchTo: (workspaceId: string) => void
}

export function createWorkspaceTestState(options: {
    api?: unknown
    selectedWorkspaceId?: string | null
    workspaces?: Workspace[]
    featureEnabled?: boolean
    overrides?: Partial<WorkspaceContextValue>
} = {}): WorkspaceTestState {
    const live = {
        selectedWorkspaceId: options.selectedWorkspaceId === undefined ? TEST_WORKSPACE_ID : options.selectedWorkspaceId,
        workspaceEpoch: 1,
    }
    const workspaces = options.workspaces ?? [
        testWorkspace(TEST_WORKSPACE_ID, 'Main library'),
        testWorkspace(OTHER_WORKSPACE_ID, 'Novel A'),
    ]
    const capture = (): WorkspaceScopeCapture | null => (live.selectedWorkspaceId
        ? { accountKey: 'test-account', authEpoch: 1, userHash: 'test-user', workspaceId: live.selectedWorkspaceId, workspaceEpoch: live.workspaceEpoch }
        : null)
    const isCurrent = (captured: WorkspaceScopeCapture | null | undefined) => Boolean(captured
        && captured.workspaceId === live.selectedWorkspaceId && captured.workspaceEpoch === live.workspaceEpoch)
    const value = (): WorkspaceContextValue => ({
        status: live.selectedWorkspaceId ? 'ready' : 'loading',
        unavailableReason: null,
        staleReason: null,
        featureEnabled: options.featureEnabled ?? true,
        workspaces,
        activeWorkspaces: workspaces.filter((workspace) => workspace.archived_at === null),
        defaultWorkspaceId: TEST_WORKSPACE_ID,
        selectedWorkspaceId: live.selectedWorkspaceId,
        selectedWorkspace: workspaces.find((workspace) => workspace.id === live.selectedWorkspaceId) ?? null,
        workspaceEpoch: live.workspaceEpoch,
        hasHiddenWorkspaces: false,
        api: live.selectedWorkspaceId ? (options.api as ApiService | undefined) ?? null : null,
        commitWorkspace: () => false,
        refreshWorkspaces: async () => {},
        capture,
        isCurrent,
        ...options.overrides,
    })
    return {
        live,
        value,
        switchTo: (workspaceId) => {
            live.selectedWorkspaceId = workspaceId
            live.workspaceEpoch += 1
        },
    }
}

export function WorkspaceTestProvider({ state, children }: { state: WorkspaceTestState; children: ReactNode }) {
    return <WorkspaceContext.Provider value={state.value()}>{children}</WorkspaceContext.Provider>
}
