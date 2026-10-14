/**
 * The workspace client a session's voice refresh rides (D36 + D39 items 1 and
 * 6), read without throwing outside the providers (stories, isolated tests):
 *
 * - `workspaceId`: the session's own workspace when the record says so, else
 *   the one committed when the session opened (frozen, as `useSessionWorkspace`);
 * - `active`: that workspace is the committed one. The library list in
 *   DataProvider belongs to the committed workspace, so a card's current voice
 *   is read from it only while this holds (the source resolves in the session's
 *   workspace only);
 * - `readOnly`: that workspace is archived. Refresh actions are hidden (09 §4.11).
 */
import { useContext, useMemo, useState } from 'react'
import { WorkspaceContext } from '@/app/providers/workspaceContext'
import { apiService, type ApiService } from '@/infrastructure/api'
import { isWorkspaceArchived } from '@/shared/hooks/useWorkspaceReadOnly'

export interface SessionClient {
    workspaceId: string | null
    api: ApiService | null
    active: boolean
    readOnly: boolean
}

export function useSessionClient(recordWorkspaceId?: string | null): SessionClient {
    const context = useContext(WorkspaceContext)
    const selected = context?.selectedWorkspaceId ?? null
    const [openedIn, setOpenedIn] = useState(selected)
    if (openedIn === null && selected !== null) setOpenedIn(selected)
    const workspaceId = recordWorkspaceId || openedIn
    const api = useMemo(() => {
        if (!workspaceId) return null
        try {
            return apiService.withWorkspace(workspaceId)
        } catch {
            return null
        }
    }, [workspaceId])
    return {
        workspaceId,
        api,
        active: workspaceId !== null && workspaceId === selected,
        readOnly: context ? isWorkspaceArchived(context.workspaces, workspaceId) : false,
    }
}
