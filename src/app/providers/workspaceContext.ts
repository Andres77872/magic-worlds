import { createContext } from 'react'
import type { ApiService } from '@/infrastructure/api'
import type { Workspace } from '@/shared/types'

/**
 * Workspace R1 startup/selection state (document 08 "Startup handshake").
 *
 * - `idle`: signed out (or the session has not been restored yet). Nothing private runs.
 * - `loading`: the capabilities + list handshake is in flight. Private pages show the loading state.
 * - `ready`: a validated workspace is selected; private loaders may start.
 * - `unavailable`: the API is unreachable or is not the R1 API. Private pages block with retry;
 *   never fall back to account-wide reads, never show an empty library.
 * - `stale`: this build is older than the API (newer contract, or a `WORKSPACE_REQUIRED`
 *   response). Private writes are blocked and the reload dialog shows; never auto-reloads.
 */
export type WorkspaceStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'stale'

/** Why `status` is `unavailable` (`unreachable` = network/5xx, `unsupported` = predecessor API). */
export type WorkspaceUnavailableReason = 'unreachable' | 'unsupported'

/** Why `status` is `stale`. */
export type WorkspaceStaleReason = 'newer_contract' | 'workspace_required'

/**
 * The ownership a piece of async work captured when it started. Compare it with
 * `isCurrent` before touching active UI; server work itself keeps its captured
 * context after a switch (an aborted fetch never implies a cancelled operation).
 */
export interface WorkspaceScopeCapture {
    readonly accountKey: string
    readonly authEpoch: number
    readonly userHash: string | null
    readonly workspaceId: string
    readonly workspaceEpoch: number
}

export interface WorkspaceContextValue {
    status: WorkspaceStatus
    unavailableReason: WorkspaceUnavailableReason | null
    staleReason: WorkspaceStaleReason | null
    /** Every workspace of the account, archived included (default first, then created_at/id). */
    workspaces: readonly Workspace[]
    /** `workspaces` without archived ones. */
    activeWorkspaces: readonly Workspace[]
    defaultWorkspaceId: string | null
    /** The committed workspace of this tab; `null` until the handshake succeeds. */
    selectedWorkspaceId: string | null
    selectedWorkspace: Workspace | null
    /** Monotonic; bumps on every commit/reset, so captured work can detect a switch. */
    workspaceEpoch: number
    /**
     * The scoped client of the committed workspace (`apiService.withWorkspace`),
     * `null` while nothing is selected. Its identity changes on every commit.
     */
    api: ApiService | null
    /**
     * Commits a workspace in one React update (bumps `workspaceEpoch`, persists
     * it as last-used). Run navigation guards and revalidate
     * the destination BEFORE calling this. Pass a `Workspace` you just fetched
     * (e.g. an archived one from `resolve-content`) to add it to the known list.
     * Returns `false` (and changes nothing) when not `ready`, the ID is unknown,
     */
    commitWorkspace: (target: string | Workspace) => boolean
    /**
     * `ready`: re-lists workspaces (archived included) keeping the selection
     * when it still exists. `unavailable`/`loading`: re-runs the handshake.
     * Rejects with the request error so callers can surface it.
     */
    refreshWorkspaces: () => Promise<void>
    /** Snapshot of the current ownership, `null` until a workspace is selected. */
    capture: () => WorkspaceScopeCapture | null
    /** Whether a capture still matches the live auth owner and committed workspace. */
    isCurrent: (capture: WorkspaceScopeCapture | null | undefined) => boolean
}

export const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined)
