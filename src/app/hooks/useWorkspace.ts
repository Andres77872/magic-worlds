/**
 * Workspace R1 hooks. See `WorkspaceProvider` for the lifecycle.
 *
 *     const { status, api, capture, isCurrent } = useWorkspace()
 *     if (status !== 'ready' || !api) return            // private work waits for the handshake
 *     const scope = capture()                            // { accountKey, authEpoch, workspaceId, workspaceEpoch }
 *     const cards = await api.getCharacters(0, 50)       // carries X-Workspace-Id of `scope`
 *     if (isCurrent(scope)) setCards(cards)              // ignore results after a switch/sign-out
 */
import { useContext, useMemo } from 'react'
import type { ApiService } from '@/infrastructure/api'
import { API_BASE_URL } from '@/infrastructure/api/baseUrl'
import { apiStorageOrigin, type WorkspaceStorageScope } from '@/shared/workspaceStorage'
import { WorkspaceContext, type WorkspaceContextValue } from '../providers/workspaceContext'
import { useAuth } from './useAuth'

export type {
    WorkspaceContextValue,
    WorkspaceScopeCapture,
    WorkspaceStaleReason,
    WorkspaceStatus,
    WorkspaceUnavailableReason,
} from '../providers/workspaceContext'

export function useWorkspace(): WorkspaceContextValue {
    const context = useContext(WorkspaceContext)
    if (context === undefined) {
        throw new Error('useWorkspace must be used within a WorkspaceProvider')
    }
    return context
}

/**
 * The scoped client of the committed workspace, or `null` until the handshake
 * selected one. Its identity changes on every commit, so it can key effects.
 */
export function useWorkspaceApi(): ApiService | null {
    return useWorkspace().api
}

/**
 * The stable key scope for per-workspace browser storage (API origin + userHash
 * + workspaceId), or `null` while signed out / before the handshake. Pass it to
 * `workspaceStorageKey(base, scope)`; never key durable state by accountKey.
 */
export function useWorkspaceStorageScope(): WorkspaceStorageScope | null {
    const { selectedWorkspaceId } = useWorkspace()
    const { userHash } = useAuth()
    return useMemo(
        () => (selectedWorkspaceId && userHash
            ? { apiOrigin: apiStorageOrigin(API_BASE_URL), userHash, workspaceId: selectedWorkspaceId }
            : null),
        [selectedWorkspaceId, userHash],
    )
}
