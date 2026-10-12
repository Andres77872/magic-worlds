/**
 * The workspace a chat/adventure session (or a call on it) belongs to
 * (Workspace R1, document 15 "Boundary and transport").
 *
 * A running session keeps its own workspace for every message, stream, edit,
 * regeneration, TTS/image poll, recovery read and call request: the session's
 * `organization.workspace_id` when the server sent it, else the workspace that
 * was committed when the session was opened — never a workspace selected later.
 *
 *     const session = useSessionWorkspace(chat.organization?.workspace_id)
 *     await session.api?.getCharacterChatMessages(id)   // always the session's workspace
 *     if (!session.active) return                       // switched away: stop live UI
 */
import { useMemo, useState } from 'react'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import { apiService, type ApiService } from '@/infrastructure/api'

export interface SessionWorkspace {
    /** The session's workspace; `null` only before any workspace is known. */
    workspaceId: string | null
    /** A client scoped to that workspace; `null` with no workspace. */
    api: ApiService | null
    /**
     * The session's workspace is the committed one. Live UI (sockets, polls,
     * hydration) runs only while this holds; a switch stops it without moving
     * the session.
     */
    active: boolean
}

export function useSessionWorkspace(organizationWorkspaceId?: string | null): SessionWorkspace {
    const { selectedWorkspaceId } = useWorkspace()
    // The workspace committed when the session opened, frozen for its lifetime.
    const [openedIn, setOpenedIn] = useState(selectedWorkspaceId)
    if (openedIn === null && selectedWorkspaceId !== null) setOpenedIn(selectedWorkspaceId)
    const workspaceId = organizationWorkspaceId || openedIn
    const api = useMemo(() => (workspaceId ? apiService.withWorkspace(workspaceId) : null), [workspaceId])
    return { workspaceId, api, active: workspaceId !== null && workspaceId === selectedWorkspaceId }
}
