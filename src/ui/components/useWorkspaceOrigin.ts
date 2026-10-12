/**
 * Whether an item belongs to a workspace other than the selected one, and that
 * workspace's name (Workspace R1, document 08 "Lifecycle and origin
 * interactions"). Reads the context directly so account-wide surfaces also
 * render outside a WorkspaceProvider (stories, public shells), where nothing is
 * ever foreign.
 */
import { useContext } from 'react'
import { WorkspaceContext } from '@/app/providers/workspaceContext'

export interface WorkspaceOrigin {
    /** The item belongs to a workspace other than the selected one. */
    foreign: boolean
    /** That workspace's name, when the account lists it. */
    name: string | null
}

export function useWorkspaceOrigin(workspaceId: string | null | undefined): WorkspaceOrigin {
    const workspace = useContext(WorkspaceContext)
    if (!workspace || !workspaceId || !workspace.selectedWorkspaceId || workspaceId === workspace.selectedWorkspaceId) {
        return { foreign: false, name: null }
    }
    return { foreign: true, name: workspace.workspaces.find((candidate) => candidate.id === workspaceId)?.name ?? null }
}
