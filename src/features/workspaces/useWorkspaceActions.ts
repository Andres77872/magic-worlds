/**
 * Workspace management commands (document 15 "Workspace lifecycle"): create,
 * rename/describe/preferred use, archive and restore. Updates send the
 * workspace's `row_version` as `If-Match`; a version conflict (or a missing
 * version, 428) reloads the list so the next attempt uses the fresh version.
 * Results update the known list in place without switching workspace.
 */
import { useCallback } from 'react'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import { apiService, isWorkspaceApiError } from '@/infrastructure/api'
import type { Workspace, WorkspaceCreate, WorkspaceUpdate } from '@/shared/types'

/** Keys under `workspaceUi.errors`. */
export type WorkspaceActionError = 'activeCall' | 'versionConflict' | 'defaultProtected' | 'archived' | 'notFound' | 'generic'

export type WorkspaceActionResult = { ok: true; workspace: Workspace } | { ok: false; error: WorkspaceActionError }

export function workspaceActionError(error: unknown): WorkspaceActionError {
    if (isWorkspaceApiError(error, 'WORKSPACE_ACTIVE_CALL')) return 'activeCall'
    if (isWorkspaceApiError(error, 'WORKSPACE_VERSION_CONFLICT') || isWorkspaceApiError(error, 'WORKSPACE_VERSION_REQUIRED')) return 'versionConflict'
    if (isWorkspaceApiError(error, 'WORKSPACE_DEFAULT_PROTECTED')) return 'defaultProtected'
    if (isWorkspaceApiError(error, 'WORKSPACE_ARCHIVED')) return 'archived'
    if (isWorkspaceApiError(error, 'WORKSPACE_NOT_FOUND')) return 'notFound'
    return 'generic'
}

export interface WorkspaceActions {
    create: (body: WorkspaceCreate) => Promise<WorkspaceActionResult>
    update: (workspace: Workspace, patch: WorkspaceUpdate) => Promise<WorkspaceActionResult>
    archive: (workspace: Workspace) => Promise<WorkspaceActionResult>
    restore: (workspace: Workspace) => Promise<WorkspaceActionResult>
}

export function useWorkspaceActions(): WorkspaceActions {
    const { selectedWorkspaceId, commitWorkspace, refreshWorkspaces } = useWorkspace()

    const refresh = useCallback(async () => {
        try {
            await refreshWorkspaces()
        } catch {
            // The list keeps its last known state; the next action reports its own error.
        }
    }, [refreshWorkspaces])

    // The selected workspace's DTO is committed in place (no epoch bump); others re-list.
    const store = useCallback(async (workspace: Workspace) => {
        if (workspace.id === selectedWorkspaceId && commitWorkspace(workspace)) return
        await refresh()
    }, [commitWorkspace, refresh, selectedWorkspaceId])

    const run = useCallback(async (command: () => Promise<Workspace>): Promise<WorkspaceActionResult> => {
        try {
            const workspace = await command()
            await store(workspace)
            return { ok: true, workspace }
        } catch (error) {
            const key = workspaceActionError(error)
            if (key === 'versionConflict' || key === 'notFound' || key === 'archived') await refresh()
            return { ok: false, error: key }
        }
    }, [refresh, store])

    const create = useCallback((body: WorkspaceCreate) => run(() => apiService.createWorkspace(body)), [run])
    const update = useCallback((workspace: Workspace, patch: WorkspaceUpdate) =>
        run(() => apiService.updateWorkspace(workspace.id, workspace.row_version, patch)), [run])
    const archive = useCallback((workspace: Workspace) =>
        run(() => apiService.archiveWorkspace(workspace.id, workspace.row_version)), [run])
    const restore = useCallback((workspace: Workspace) =>
        run(() => apiService.restoreWorkspace(workspace.id, workspace.row_version)), [run])

    return { create, update, archive, restore }
}
