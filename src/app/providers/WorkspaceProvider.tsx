/**
 * Workspace R1 coordinator: the startup handshake, the committed workspace of
 * this tab, and the stale/unavailable rollout states (document 08 "Release
 * compatibility and rollout UI", document 15 transport).
 *
 * There is no mutable "active workspace" in the API layer: consumers take the
 * scoped client (`api`, i.e. `apiService.withWorkspace(id)`) or `capture()` the
 * workspace when their work starts, and compare with `isCurrent` before they
 * touch active UI.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { usePageFocus } from '@/app/hooks/usePageFocus'
import { requestAppVersionCheck } from '@/app/hooks/useAppVersionCheck'
import {
    ApiError,
    apiService,
    isWorkspaceApiError,
    setWorkspaceWritesBlocked,
    WORKSPACE_REQUIRED_EVENT,
} from '@/infrastructure/api'
import { authSession } from '@/infrastructure/api/authSession'
import { API_BASE_URL } from '@/infrastructure/api/baseUrl'
import { classifyWorkspaceCapabilities, isWorkspaceUuid, verifyWorkspace } from '@/infrastructure/api/workspaceContract'
import { isNovelsFeatureEnabled } from '@/shared/featureFlags'
import { preferWorkspaceState } from '@/shared/workspaceLifecycle'
import { rememberDeviceWorkspaces } from '@/features/novel/persistence/deviceWorkspaceStorage'
import type { Workspace, WorkspaceList } from '@/shared/types'
import {
    accountStorageKey,
    apiStorageOrigin,
    LAST_WORKSPACE_STORAGE_BASE,
    migratePreR1WorkspaceStorage,
} from '@/shared/workspaceStorage'
import { useApiStatus } from '../hooks/useApiStatus'
import { useAuth } from '../hooks/useAuth'
import { API_STATUS_POLL_INTERVAL_MS } from './ApiStatusProvider'
import {
    WorkspaceContext,
    type WorkspaceContextValue,
    type WorkspaceScopeCapture,
    type WorkspaceStaleReason,
    type WorkspaceStatus,
    type WorkspaceUnavailableReason,
} from './workspaceContext'

interface WorkspaceState {
    /** The accountKey this state belongs to; `null` while idle. */
    ownerAccountKey: string | null
    status: WorkspaceStatus
    unavailableReason: WorkspaceUnavailableReason | null
    staleReason: WorkspaceStaleReason | null
    workspaces: readonly Workspace[]
    defaultWorkspaceId: string | null
    selectedWorkspaceId: string | null
    workspaceEpoch: number
}

const EMPTY_WORKSPACES: readonly Workspace[] = Object.freeze([])

function newestWorkspace(previous: Workspace | undefined, incoming: Workspace): Workspace {
    return !previous || preferWorkspaceState({ rowVersion: previous.row_version, archived: previous.archived_at !== null },
        { rowVersion: incoming.row_version, archived: incoming.archived_at !== null }) ? Object.freeze({ ...incoming }) : previous
}
function newestWorkspaceList(previous: readonly Workspace[], incoming: readonly Workspace[]): readonly Workspace[] {
    const known = new Map(previous.map((item) => [item.id, item]))
    const next = incoming.map((item) => newestWorkspace(known.get(item.id), item))
    return next.length === previous.length && next.every((item, index) => item === previous[index]) ? previous : Object.freeze(next)
}

const INITIAL_STATE: WorkspaceState = {
    ownerAccountKey: null,
    status: 'idle',
    unavailableReason: null,
    staleReason: null,
    workspaces: EMPTY_WORKSPACES,
    defaultWorkspaceId: null,
    selectedWorkspaceId: null,
    workspaceEpoch: 0,
}

interface HandshakeOwner {
    accountKey: string
    authEpoch: number
    userHash: string | null
}

function storageOrigin(): string {
    return apiStorageOrigin(API_BASE_URL)
}

function readLastUsedWorkspace(userHash: string): string | null {
    try {
        const value = window.localStorage.getItem(accountStorageKey(LAST_WORKSPACE_STORAGE_BASE, { apiOrigin: storageOrigin(), userHash }))
        return value && isWorkspaceUuid(value) ? value : null
    } catch {
        return null
    }
}

function writeLastUsedWorkspace(userHash: string, workspaceId: string): void {
    try {
        window.localStorage.setItem(accountStorageKey(LAST_WORKSPACE_STORAGE_BASE, { apiOrigin: storageOrigin(), userHash }), workspaceId)
    } catch {
        // Blocked storage: the next visit simply starts in the default workspace.
    }
}

/** Restore a valid last-used workspace, otherwise use the protected default. */
function initialSelection(list: WorkspaceList, userHash: string | null): string {
    if (!userHash) return list.default_workspace_id
    const lastUsed = readLastUsedWorkspace(userHash)
    const candidate = lastUsed ? list.items.find((workspace) => workspace.id === lastUsed) : undefined
    return candidate && candidate.archived_at === null ? candidate.id : list.default_workspace_id
}

function isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === 'AbortError'
}

/** Maps a handshake failure to its blocking reason; `null` = leave it to the auth layer. */
function unavailableReasonFor(error: unknown): WorkspaceUnavailableReason | null {
    if (error instanceof ApiError) {
        if (error.status === 401) {
            return authSession.getSnapshot().sessionPhase === 'authenticated' ? 'unreachable' : null
        }
        if (error.status === 404 || isWorkspaceApiError(error, 'WORKSPACE_CAPABILITY_UNAVAILABLE')
            || error.code === 'workspace_contract') return 'unsupported'
    }
    return 'unreachable'
}

interface WorkspaceProviderProps {
    children: ReactNode
    /** How often a blocked handshake retries while the tab is focused (the health-poll cadence). */
    retryIntervalMs?: number
}

export function WorkspaceProvider({ children, retryIntervalMs = API_STATUS_POLL_INTERVAL_MS }: WorkspaceProviderProps) {
    const { isAuthenticated, sessionPhase, authEpoch, accountKey } = useAuth()
    const { status: apiStatus } = useApiStatus()
    const pageFocused = usePageFocus()
    const signedIn = isAuthenticated && sessionPhase === 'authenticated'

    // `liveRef` is the source of truth (read synchronously by capture/isCurrent
    // and async completions); React state mirrors it for rendering.
    const liveRef = useRef<WorkspaceState>(INITIAL_STATE)
    const [state, setState] = useState<WorkspaceState>(INITIAL_STATE)
    const apply = useCallback((next: WorkspaceState) => {
        liveRef.current = next
        setState(next)
        const snapshot = authSession.getSnapshot()
        if (isNovelsFeatureEnabled() && next.status === 'ready' && snapshot.sessionPhase === 'authenticated'
            && snapshot.userHash && next.ownerAccountKey === snapshot.accountKey) {
            const owner = { accountKey: snapshot.accountKey, authEpoch: snapshot.authEpoch, userHash: snapshot.userHash }
            void rememberDeviceWorkspaces({ apiOrigin: storageOrigin(), userHash: snapshot.userHash }, next.workspaces.map((workspace) => ({
                id: workspace.id, name: workspace.name, isDefault: workspace.is_default, archived: workspace.archived_at !== null, rowVersion: workspace.row_version,
            })), () => authSession.isCurrent(owner) && authSession.getSnapshot().sessionPhase === 'authenticated'
                && liveRef.current.ownerAccountKey === owner.accountKey)
        }
    }, [])

    const handshakeRef = useRef<{ generation: number; owner: HandshakeOwner | null; controller: AbortController | null }>({
        generation: 0,
        owner: null,
        controller: null,
    })

    const cancelHandshake = useCallback(() => {
        const handshake = handshakeRef.current
        handshake.generation += 1
        handshake.owner = null
        handshake.controller?.abort()
        handshake.controller = null
    }, [])

    const markStale = useCallback((reason: WorkspaceStaleReason) => {
        const current = liveRef.current
        // Sticky and non-stacking: repeated failures never add dialogs or retries.
        if (current.status === 'stale') return
        setWorkspaceWritesBlocked(true)
        cancelHandshake()
        apply({ ...current, status: 'stale', staleReason: reason, unavailableReason: null })
        requestAppVersionCheck()
    }, [apply, cancelHandshake])

    const runHandshake = useCallback(async (): Promise<void> => {
        if (liveRef.current.status === 'stale') return
        const snapshot = authSession.getSnapshot()
        if (snapshot.sessionPhase !== 'authenticated' || !snapshot.token) return
        const owner: HandshakeOwner = { accountKey: snapshot.accountKey, authEpoch: snapshot.authEpoch, userHash: snapshot.userHash }
        cancelHandshake()
        const handshake = handshakeRef.current
        const generation = handshake.generation
        const controller = new AbortController()
        handshake.owner = owner
        handshake.controller = controller
        const isCurrentRun = () => handshakeRef.current.generation === generation && authSession.isCurrent(owner)
            && liveRef.current.status !== 'stale'

        const before = liveRef.current
        if (before.ownerAccountKey !== owner.accountKey || before.status === 'idle') {
            apply({
                ...INITIAL_STATE,
                ownerAccountKey: owner.accountKey,
                status: 'loading',
                workspaceEpoch: before.workspaceEpoch + (before.selectedWorkspaceId === null ? 0 : 1),
            })
        }

        const fail = (error: unknown) => {
            if (!isCurrentRun() || isAbortError(error)) return
            const reason = unavailableReasonFor(error)
            if (reason === null) return
            const current = liveRef.current
            // A ready tab that fails a background refresh keeps working.
            if (current.status === 'ready') return
            apply({ ...current, status: 'unavailable', unavailableReason: reason })
        }

        try {
            const capabilities = await apiService.getWorkspaceCapabilities({ signal: controller.signal })
            if (!isCurrentRun()) return
            const verdict = classifyWorkspaceCapabilities(capabilities)
            if (verdict === 'newer') {
                markStale('newer_contract')
                return
            }
            if (verdict === 'predecessor') {
                const current = liveRef.current
                if (current.status !== 'ready') apply({ ...current, status: 'unavailable', unavailableReason: 'unsupported' })
                return
            }
            const list = await apiService.listWorkspaces({ includeArchived: true, signal: controller.signal })
            if (!isCurrentRun()) return

            if (owner.userHash) {
                // Before `ready`, so no private consumer reads the old keys first.
                migratePreR1WorkspaceStorage({
                    apiOrigin: storageOrigin(),
                    userHash: owner.userHash,
                    defaultWorkspaceId: list.default_workspace_id,
                    currentAccountKey: owner.accountKey,
                })
            }
            const current = liveRef.current
            const keep = current.ownerAccountKey === owner.accountKey && current.selectedWorkspaceId
                && list.items.some((workspace) => workspace.id === current.selectedWorkspaceId)
            const selectedWorkspaceId = keep ? current.selectedWorkspaceId! : initialSelection(list, owner.userHash)
            apply({
                ownerAccountKey: owner.accountKey,
                status: 'ready',
                unavailableReason: null,
                staleReason: null,
                workspaces: newestWorkspaceList(current.ownerAccountKey === owner.accountKey ? current.workspaces : [], list.items),
                defaultWorkspaceId: list.default_workspace_id,
                selectedWorkspaceId,
                workspaceEpoch: current.workspaceEpoch + (selectedWorkspaceId === current.selectedWorkspaceId ? 0 : 1),
            })
        } catch (error) {
            fail(error)
        } finally {
            if (handshakeRef.current.generation === generation) {
                handshakeRef.current.owner = null
                handshakeRef.current.controller = null
            }
        }
    }, [apply, cancelHandshake, markStale])

    // Sign-out or another account: drop everything of the previous owner. An
    // expired session of the same account keeps its workspace (same-user
    // re-login preserves mounted editors, as accountKey does).
    useEffect(() => {
        const current = liveRef.current
        const ownerChanged = current.ownerAccountKey !== null && current.ownerAccountKey !== accountKey
        const signedOut = sessionPhase === 'signed_out' || sessionPhase === 'logging_out'
        if (!ownerChanged && !(signedOut && current.ownerAccountKey !== null)) return
        cancelHandshake()
        apply({
            ...INITIAL_STATE,
            status: current.status === 'stale' ? 'stale' : 'idle',
            staleReason: current.staleReason,
            workspaceEpoch: current.workspaceEpoch + (current.selectedWorkspaceId === null ? 0 : 1),
        })
    }, [accountKey, apply, cancelHandshake, sessionPhase])

    // Startup handshake for a signed-in owner, before any private request.
    useEffect(() => {
        if (!signedIn) return
        const current = liveRef.current
        if (current.status === 'stale') return
        const owned = current.ownerAccountKey === accountKey
        const inFlight = handshakeRef.current.owner
        const runningForThisOwner = inFlight !== null && inFlight.accountKey === accountKey && inFlight.authEpoch === authEpoch
        if (owned && current.status !== 'idle' && (current.status !== 'loading' || runningForThisOwner)) return
        void runHandshake()
    }, [accountKey, authEpoch, runHandshake, signedIn])

    // A blocked handshake retries on the health-poll cadence while focused, and
    // as soon as the health poll reports the API back. Never reloads the page.
    const blocked = signedIn && state.status === 'unavailable' && state.ownerAccountKey === accountKey
    useEffect(() => {
        if (!blocked || !pageFocused) return
        const intervalId = window.setInterval(() => void runHandshake(), retryIntervalMs)
        return () => window.clearInterval(intervalId)
    }, [blocked, pageFocused, retryIntervalMs, runHandshake])

    const previousApiStatusRef = useRef(apiStatus)
    useEffect(() => {
        const previous = previousApiStatusRef.current
        previousApiStatusRef.current = apiStatus
        if (blocked && previous !== apiStatus && (apiStatus === 'online' || apiStatus === 'degraded')) void runHandshake()
    }, [apiStatus, blocked, runHandshake])

    // Any `WORKSPACE_REQUIRED` response means this tab runs an outdated build.
    useEffect(() => {
        const onWorkspaceRequired = () => markStale('workspace_required')
        window.addEventListener(WORKSPACE_REQUIRED_EVENT, onWorkspaceRequired)
        return () => window.removeEventListener(WORKSPACE_REQUIRED_EVENT, onWorkspaceRequired)
    }, [markStale])

    useEffect(() => () => cancelHandshake(), [cancelHandshake])

    const commitWorkspace = useCallback((target: string | Workspace): boolean => {
        const current = liveRef.current
        if (current.status !== 'ready') return false
        const snapshot = authSession.getSnapshot()
        if (current.ownerAccountKey !== snapshot.accountKey) return false
        let workspaces = current.workspaces
        let id: string
        if (typeof target === 'string') {
            id = target
            if (!workspaces.some((workspace) => workspace.id === id)) return false
        } else {
            if (!verifyWorkspace(target)) return false
            id = target.id
            const index = workspaces.findIndex((workspace) => workspace.id === id)
            const retained = newestWorkspace(index === -1 ? undefined : workspaces[index], target)
            if (index === -1) workspaces = Object.freeze([...workspaces, retained])
            else if (retained !== workspaces[index]) workspaces = Object.freeze(workspaces.map((workspace, position) => position === index ? retained : workspace))
        }
        if (!isWorkspaceUuid(id)) return false
        if (id === current.selectedWorkspaceId && workspaces === current.workspaces) return true
        apply({
            ...current,
            workspaces,
            selectedWorkspaceId: id,
            workspaceEpoch: current.workspaceEpoch + (id === current.selectedWorkspaceId ? 0 : 1),
        })
        if (snapshot.userHash) writeLastUsedWorkspace(snapshot.userHash, id)
        return true
    }, [apply])

    const refreshWorkspaces = useCallback(async (): Promise<void> => {
        const current = liveRef.current
        if (current.status === 'stale') return
        if (current.status !== 'ready') {
            await runHandshake()
            return
        }
        const snapshot = authSession.getSnapshot()
        if (snapshot.sessionPhase !== 'authenticated' || current.ownerAccountKey !== snapshot.accountKey) return
        const owner = { accountKey: snapshot.accountKey, authEpoch: snapshot.authEpoch, userHash: snapshot.userHash }
        const list = await apiService.listWorkspaces({ includeArchived: true })
        const latest = liveRef.current
        if (!authSession.isCurrent(owner) || latest.status !== 'ready' || latest.ownerAccountKey !== owner.accountKey) return
        // Another tab may have archived the selection: keep it (read-only) while it exists.
        const stillListed = latest.selectedWorkspaceId !== null
            && list.items.some((workspace) => workspace.id === latest.selectedWorkspaceId)
        const selectedWorkspaceId = stillListed
            ? latest.selectedWorkspaceId!
            : list.default_workspace_id
        apply({
            ...latest,
            workspaces: newestWorkspaceList(latest.workspaces, list.items),
            defaultWorkspaceId: list.default_workspace_id,
            selectedWorkspaceId,
            workspaceEpoch: latest.workspaceEpoch + (selectedWorkspaceId === latest.selectedWorkspaceId ? 0 : 1),
        })
    }, [apply, runHandshake])

    const capture = useCallback((): WorkspaceScopeCapture | null => {
        const current = liveRef.current
        const snapshot = authSession.getSnapshot()
        if (!current.selectedWorkspaceId || current.ownerAccountKey !== snapshot.accountKey) return null
        return Object.freeze({
            accountKey: snapshot.accountKey,
            authEpoch: snapshot.authEpoch,
            userHash: snapshot.userHash,
            workspaceId: current.selectedWorkspaceId,
            workspaceEpoch: current.workspaceEpoch,
        })
    }, [])

    const isCurrent = useCallback((captured: WorkspaceScopeCapture | null | undefined): boolean => {
        if (!captured) return false
        const current = liveRef.current
        return authSession.isCurrent(captured)
            && current.ownerAccountKey === captured.accountKey
            && current.selectedWorkspaceId === captured.workspaceId
            && current.workspaceEpoch === captured.workspaceEpoch
    }, [])

    // A render between an account change and the reset effect must not expose
    // the previous owner's workspace.
    const owned = state.ownerAccountKey === accountKey
    const status: WorkspaceStatus = owned || state.status === 'stale' ? state.status : 'idle'
    const workspaces = owned ? state.workspaces : EMPTY_WORKSPACES
    const selectedWorkspaceId = owned ? state.selectedWorkspaceId : null
    const defaultWorkspaceId = owned ? state.defaultWorkspaceId : null
    const workspaceEpoch = state.workspaceEpoch

    const api = useMemo(
        () => (selectedWorkspaceId ? apiService.withWorkspace(selectedWorkspaceId) : null),
        // The epoch is a deliberate dependency: every commit yields a new client identity.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [selectedWorkspaceId, workspaceEpoch],
    )

    const value = useMemo<WorkspaceContextValue>(() => {
        const activeWorkspaces = workspaces.filter((workspace) => workspace.archived_at === null)
        return {
            status,
            unavailableReason: status === 'unavailable' ? state.unavailableReason : null,
            staleReason: status === 'stale' ? state.staleReason : null,
            workspaces,
            activeWorkspaces,
            defaultWorkspaceId,
            selectedWorkspaceId,
            selectedWorkspace: workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null,
            workspaceEpoch,
            api,
            commitWorkspace,
            refreshWorkspaces,
            capture,
            isCurrent,
        }
    }, [api, capture, commitWorkspace, defaultWorkspaceId, isCurrent, refreshWorkspaces, selectedWorkspaceId,
        state.staleReason, state.unavailableReason, status, workspaceEpoch, workspaces])

    return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}
