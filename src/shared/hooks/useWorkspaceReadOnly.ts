/**
 * Workspace R1 (document 08, "Lifecycle and origin interactions"): an archived
 * workspace is read-only until it is restored. Viewing, search, navigation,
 * export/download and Copy to workspace keep working; every control that
 * would write to that workspace is disabled (the server would answer 409
 * WORKSPACE_ARCHIVED).
 *
 * Key it on the workspace the write targets: the record's own workspace when
 * it says so, else the selected one.
 *
 *     const readOnly = useWorkspaceReadOnly(organizationWorkspaceId(lorebook))
 *     <ReadOnlyFieldset disabled={readOnly}>…fields…</ReadOnlyFieldset>
 *     if (readOnly) return setError(t(ARCHIVED_WORKSPACE_MESSAGE_KEY))
 */
import { useContext } from 'react'
import { WorkspaceContext } from '@/app/providers/workspaceContext'
import type { Workspace } from '@/shared/types/workspace.types'

/** "This workspace is archived. Restore it to create or edit content." */
export const ARCHIVED_WORKSPACE_MESSAGE_KEY = 'workspaceContent.saveErrors.archived'

/** True when `workspaceId` names a known workspace that is archived. */
export function isWorkspaceArchived(workspaces: readonly Workspace[], workspaceId: string | null | undefined): boolean {
    if (!workspaceId) return false
    return Boolean(workspaces.find((workspace) => workspace.id === workspaceId)?.archived_at)
}

/**
 * Whether writes to `workspaceId` (default: the selected workspace) are blocked
 * because it is archived. False outside a WorkspaceProvider and before the
 * workspace list loads.
 */
export function useWorkspaceReadOnly(workspaceId?: string | null): boolean {
    const context = useContext(WorkspaceContext)
    if (!context) return false
    return isWorkspaceArchived(context.workspaces, workspaceId ?? context.selectedWorkspaceId)
}
