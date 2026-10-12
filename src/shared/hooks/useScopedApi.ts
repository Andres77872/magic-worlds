/**
 * Workspace R1 client selection for private content (document 15 "Boundary and
 * transport"). Every private REST/SSE call goes through a scoped client:
 *
 * - work in the committed workspace uses `useWorkspace().api`;
 * - work captured earlier (a creation origin, a card's own workspace, a running
 *   generation, an assistant conversation, a story or resource opened before)
 *   uses `apiService.withWorkspace(<captured id>)`, so retries and streams keep
 *   their original destination even after a switch.
 *
 *     const api = useScopedApi(card.organization?.workspace_id)  // card's own, else committed
 *     if (!api) return                                            // no workspace before the handshake
 */
import { useMemo } from 'react'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import { apiService, type ApiService } from '@/infrastructure/api'

/** A client scoped to `workspaceId` (no initial collections), or `null` without one. */
export function scopedApi(workspaceId: string | null | undefined): ApiService | null {
    return workspaceId ? apiService.withWorkspace(workspaceId) : null
}

/**
 * The client of `workspaceId` when given (captured work), else the committed
 * workspace's client; `null` before the workspace handshake selected one.
 */
export function useScopedApi(workspaceId?: string | null): ApiService | null {
    const { api } = useWorkspace()
    // A captured workspace keeps one client identity across commits of the active one.
    const captured = useMemo(() => (workspaceId ? apiService.withWorkspace(workspaceId) : null), [workspaceId])
    return captured ?? api
}

/** The workspace a private root (card, story, lorebook, resource, job) belongs to, when it says so. */
export function organizationWorkspaceId(record: { organization?: { workspace_id?: unknown } | null } | null | undefined): string | null {
    const id = record?.organization?.workspace_id
    return typeof id === 'string' && id ? id : null
}
