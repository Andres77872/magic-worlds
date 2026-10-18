import { setTestFeatureFlags, setAllTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { useContext, useLayoutEffect } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Workspace, WorkspaceList } from '@/shared/types'

const apiStatusState = vi.hoisted(() => ({ status: 'online' as 'checking' | 'online' | 'degraded' | 'offline' }))

vi.mock('../hooks/useApiStatus', () => ({ useApiStatus: () => ({ status: apiStatusState.status }) }))
vi.mock('@/app/hooks/usePageFocus', () => ({ usePageFocus: () => true, isPageFocused: () => true }))
// useAuth mirrors the real process-wide session coordinator, so ownership checks stay real.
vi.mock('../hooks/useAuth', async () => {
    const { useSyncExternalStore } = await import('react')
    const { authSession } = await import('@/infrastructure/api/authSession')
    let cached = authSession.getSnapshot()
    const read = () => {
        const next = authSession.getSnapshot()
        const changed = (['sessionPhase', 'authEpoch', 'accountKey', 'userHash', 'token'] as const)
            .some((key) => next[key] !== cached[key])
        if (changed) cached = next
        return cached
    }
    const subscribe = (onChange: () => void) => authSession.subscribe(onChange)
    return {
        useAuth: () => {
            const snapshot = useSyncExternalStore(subscribe, read)
            return {
                isAuthenticated: snapshot.sessionPhase === 'authenticated' && Boolean(snapshot.token),
                sessionPhase: snapshot.sessionPhase,
                authEpoch: snapshot.authEpoch,
                accountKey: snapshot.accountKey,
                userHash: snapshot.userHash,
            }
        },
    }
})

import { ApiError, apiService, areWorkspaceWritesBlocked, setWorkspaceWritesBlocked, WORKSPACE_REQUIRED_EVENT } from '@/infrastructure/api'
import { authSession } from '@/infrastructure/api/authSession'
import { API_BASE_URL } from '@/infrastructure/api/baseUrl'
import { APP_VERSION_CHECK_EVENT } from '@/app/hooks/useAppVersionCheck'
import {
    accountStorageKey,
    apiStorageOrigin,
    ASSISTANT_FOCUS_STORAGE_BASE,
    LAST_WORKSPACE_STORAGE_BASE,
    workspaceStorageKey,
} from '@/shared/workspaceStorage'
import { WorkspaceProvider } from './WorkspaceProvider'
import * as deviceWorkspaces from '@/features/novel/persistence/deviceWorkspaceStorage'
import { WorkspaceContext, type WorkspaceContextValue } from './workspaceContext'

const DEFAULT_ID = '0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b'
const SECOND_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'
const ARCHIVED_ID = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e'
const CAPABILITIES = { workspace_r1: true, contract_version: 1, schema_revision: '2026_10_workspace_r1' }
const ORIGIN = apiStorageOrigin(API_BASE_URL)

function workspace(id: string, overrides: Partial<Workspace> = {}): Workspace {
    return {
        id,
        name: id === DEFAULT_ID ? 'My workspace' : 'Side project',
        description: null,
        preferred_use: 'library',
        is_default: id === DEFAULT_ID,
        archived_at: null,
        row_version: 1,
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
        ...overrides,
    }
}

function list(...items: Workspace[]): WorkspaceList {
    return { items, default_workspace_id: DEFAULT_ID }
}

const probe: { latest: WorkspaceContextValue | null } = { latest: null }

function Probe() {
    const value = useContext(WorkspaceContext)!
    useLayoutEffect(() => {
        probe.latest = value
    })
    return (
        <div>
            <span data-testid="status">{value.status}</span>
            <span data-testid="selected">{value.selectedWorkspaceId ?? 'none'}</span>
            <span data-testid="epoch">{value.workspaceEpoch}</span>
            <span data-testid="reason">{value.unavailableReason ?? value.staleReason ?? 'none'}</span>
        </div>
    )
}

function renderProvider(retryIntervalMs = 60_000) {
    return render(<WorkspaceProvider retryIntervalMs={retryIntervalMs}><Probe /></WorkspaceProvider>)
}

const ctx = () => probe.latest!

describe('WorkspaceProvider startup handshake', () => {
    let capabilities: ReturnType<typeof vi.spyOn>
    let listWorkspaces: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        probe.latest = null
        localStorage.clear()
        setWorkspaceWritesBlocked(false)
        apiStatusState.status = 'online'

        act(() => {
            authSession.continueSignedOut()
            authSession.authenticate('user-a', 'token-a')
        })
        capabilities = vi.spyOn(apiService, 'getWorkspaceCapabilities').mockResolvedValue({ ...CAPABILITIES })
        listWorkspaces = vi.spyOn(apiService, 'listWorkspaces').mockResolvedValue(list(workspace(DEFAULT_ID)))
    })

    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllEnvs()
        setWorkspaceWritesBlocked(false)
    })

    it('keeps a newer archive when overlapping refreshes or an older link target arrive late', async () => {

        listWorkspaces.mockResolvedValue(list(workspace(DEFAULT_ID), workspace(SECOND_ID, { row_version: 2 })))
        renderProvider(); await waitFor(() => expect(ctx().status).toBe('ready'))
        act(() => { ctx().commitWorkspace(SECOND_ID) })
        let oldRead!: (value: WorkspaceList) => void, newRead!: (value: WorkspaceList) => void
        listWorkspaces.mockImplementationOnce(() => new Promise((resolve) => { oldRead = resolve }))
            .mockImplementationOnce(() => new Promise((resolve) => { newRead = resolve }))
        const older = ctx().refreshWorkspaces(), newer = ctx().refreshWorkspaces()
        const archived = workspace(SECOND_ID, { row_version: 3, archived_at: '2026-10-17T00:00:00Z' })
        await act(async () => { newRead(list(workspace(DEFAULT_ID), archived)); await newer })
        const epoch = ctx().workspaceEpoch
        await act(async () => { oldRead(list(workspace(DEFAULT_ID), workspace(SECOND_ID, { row_version: 2 }))); await older })
        expect(ctx().selectedWorkspace).toMatchObject({ row_version: 3, archived_at: archived.archived_at })
        act(() => { ctx().commitWorkspace(workspace(SECOND_ID, { row_version: 2 })) })
        expect(ctx().selectedWorkspace).toMatchObject({ row_version: 3, archived_at: archived.archived_at })
        expect(ctx().workspaceEpoch).toBe(epoch)
        act(() => { ctx().commitWorkspace(workspace(SECOND_ID, { row_version: 4 })) })
        expect(ctx().selectedWorkspace).toMatchObject({ row_version: 4, archived_at: null })
        const captured = workspace(SECOND_ID, { row_version: 5, archived_at: archived.archived_at })
        act(() => { ctx().commitWorkspace(captured) })
        captured.archived_at = null
        expect(ctx().selectedWorkspace).toMatchObject({ row_version: 5, archived_at: archived.archived_at })
    })

    it('retains checked workspace versions without a scene read and retires their publication on logout', async () => {
        setTestFeatureFlags({ novels: true })
        const retain = vi.spyOn(deviceWorkspaces, 'rememberDeviceWorkspaces').mockResolvedValue({ status: 'saved' })
        renderProvider(); await waitFor(() => expect(ctx().status).toBe('ready'))
        expect(retain).toHaveBeenCalledWith({ apiOrigin: ORIGIN, userHash: 'user-a' }, [expect.objectContaining({ id: DEFAULT_ID, rowVersion: 1, archived: false })], expect.any(Function))
        const current = retain.mock.calls[0][2]!
        expect(current()).toBe(true)
        act(() => { authSession.beginLogout() })
        expect(current()).toBe(false)
    })

    it('runs the handshake and scopes the protected default with every product flag disabled', async () => {
        setAllTestFeatureFlags(false)
        listWorkspaces.mockResolvedValue(list(workspace(DEFAULT_ID), workspace(SECOND_ID)))
        renderProvider()
        expect(screen.getByTestId('status')).toHaveTextContent('loading')
        await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'))

        expect(capabilities).toHaveBeenCalledOnce()
        expect(listWorkspaces).toHaveBeenCalledWith(expect.objectContaining({ includeArchived: true }))
        expect(capabilities.mock.invocationCallOrder[0]).toBeLessThan(listWorkspaces.mock.invocationCallOrder[0])
        expect(screen.getByTestId('selected')).toHaveTextContent(DEFAULT_ID)
        expect(screen.getByTestId('epoch')).toHaveTextContent('1')
        expect(ctx().api?.workspaceScope?.workspaceId).toBe(DEFAULT_ID)
        expect(apiService.workspaceScope).toBeNull()
    })

    it('does nothing while signed out', async () => {
        act(() => { authSession.continueSignedOut() })
        renderProvider()
        await act(async () => { await Promise.resolve() })
        expect(screen.getByTestId('status')).toHaveTextContent('idle')
        expect(capabilities).not.toHaveBeenCalled()
        expect(ctx().api).toBeNull()
    })

    it('restores a valid last-used workspace independently of temporary flags', async () => {
        localStorage.setItem(accountStorageKey(LAST_WORKSPACE_STORAGE_BASE, { apiOrigin: ORIGIN, userHash: 'user-a' }), SECOND_ID)
        listWorkspaces.mockResolvedValue(list(workspace(DEFAULT_ID), workspace(SECOND_ID)))

        const view = renderProvider()
        await waitFor(() => expect(screen.getByTestId('selected')).toHaveTextContent(SECOND_ID))
        view.unmount()

        renderProvider()
        await waitFor(() => expect(screen.getByTestId('selected')).toHaveTextContent(SECOND_ID))
    })

    it('falls back to the default when the last-used workspace is archived or unknown', async () => {

        localStorage.setItem(accountStorageKey(LAST_WORKSPACE_STORAGE_BASE, { apiOrigin: ORIGIN, userHash: 'user-a' }), ARCHIVED_ID)
        listWorkspaces.mockResolvedValue(list(workspace(DEFAULT_ID), workspace(ARCHIVED_ID, { archived_at: '2026-10-02T00:00:00Z' })))
        const view = renderProvider()
        await waitFor(() => expect(screen.getByTestId('selected')).toHaveTextContent(DEFAULT_ID))
        view.unmount()

        localStorage.setItem(accountStorageKey(LAST_WORKSPACE_STORAGE_BASE, { apiOrigin: ORIGIN, userHash: 'user-a' }), SECOND_ID)
        listWorkspaces.mockResolvedValue(list(workspace(DEFAULT_ID)))
        renderProvider()
        await waitFor(() => expect(screen.getByTestId('selected')).toHaveTextContent(DEFAULT_ID))
    })

    it('blocks private pages when the API is unreachable and recovers on retry', async () => {
        capabilities.mockRejectedValueOnce(new TypeError('Failed to fetch'))
        renderProvider()
        await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unavailable'))
        expect(screen.getByTestId('reason')).toHaveTextContent('unreachable')
        expect(listWorkspaces).not.toHaveBeenCalled()
        expect(ctx().api).toBeNull()

        await act(async () => { await ctx().refreshWorkspaces() })
        expect(screen.getByTestId('status')).toHaveTextContent('ready')
        expect(screen.getByTestId('selected')).toHaveTextContent(DEFAULT_ID)
    })

    it('retries a blocked handshake on the health-poll cadence', async () => {
        capabilities.mockRejectedValueOnce(new ApiError(503, 'Service Unavailable'))
        renderProvider(20)
        await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unavailable'))
        await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'))
        expect(capabilities).toHaveBeenCalledTimes(2)
    })

    it('treats a 404 or a predecessor capability body as an unsupported API, never falling back', async () => {
        capabilities.mockRejectedValueOnce(new ApiError(404, 'Not Found'))
        const view = renderProvider()
        await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unavailable'))
        expect(screen.getByTestId('reason')).toHaveTextContent('unsupported')
        view.unmount()

        capabilities.mockResolvedValueOnce({ workspace_r1: true, contract_version: 0, schema_revision: 'old' })
        renderProvider()
        await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unavailable'))
        expect(screen.getByTestId('reason')).toHaveTextContent('unsupported')
        expect(listWorkspaces).not.toHaveBeenCalled()
    })

    it('marks a newer contract stale: version check now, private writes blocked, no auto-reload', async () => {
        const versionCheck = vi.fn()
        window.addEventListener(APP_VERSION_CHECK_EVENT, versionCheck)
        capabilities.mockResolvedValueOnce({ ...CAPABILITIES, contract_version: 2 })
        renderProvider()
        await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('stale'))
        window.removeEventListener(APP_VERSION_CHECK_EVENT, versionCheck)

        expect(screen.getByTestId('reason')).toHaveTextContent('newer_contract')
        expect(versionCheck).toHaveBeenCalledOnce()
        expect(areWorkspaceWritesBlocked()).toBe(true)
        expect(listWorkspaces).not.toHaveBeenCalled()
        await expect(apiService.withWorkspace(DEFAULT_ID).deleteCharacter('c1')).rejects.toMatchObject({ code: 'workspace_client_stale' })
    })

    it('turns a WORKSPACE_REQUIRED response into the stale state while keeping the selection', async () => {
        renderProvider()
        await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'))
        act(() => { window.dispatchEvent(new CustomEvent(WORKSPACE_REQUIRED_EVENT)) })
        act(() => { window.dispatchEvent(new CustomEvent(WORKSPACE_REQUIRED_EVENT)) })
        expect(screen.getByTestId('status')).toHaveTextContent('stale')
        expect(screen.getByTestId('reason')).toHaveTextContent('workspace_required')
        expect(screen.getByTestId('selected')).toHaveTextContent(DEFAULT_ID)
        expect(areWorkspaceWritesBlocked()).toBe(true)
    })
})

describe('WorkspaceProvider selection and ownership', () => {
    let listWorkspaces: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        probe.latest = null
        localStorage.clear()
        setWorkspaceWritesBlocked(false)

        act(() => {
            authSession.continueSignedOut()
            authSession.authenticate('user-a', 'token-a')
        })
        vi.spyOn(apiService, 'getWorkspaceCapabilities').mockResolvedValue({ ...CAPABILITIES })
        listWorkspaces = vi.spyOn(apiService, 'listWorkspaces').mockResolvedValue(list(workspace(DEFAULT_ID), workspace(SECOND_ID)))
    })

    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllEnvs()
    })

    it('commits a workspace in one update, invalidates captures and persists last-used', async () => {
        renderProvider()
        await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'))
        const before = ctx().capture()
        const clientBefore = ctx().api
        expect(ctx().isCurrent(before)).toBe(true)

        let committed = false
        act(() => { committed = ctx().commitWorkspace(SECOND_ID) })
        expect(committed).toBe(true)
        expect(screen.getByTestId('selected')).toHaveTextContent(SECOND_ID)
        expect(screen.getByTestId('epoch')).toHaveTextContent('2')
        expect(ctx().isCurrent(before)).toBe(false)
        expect(ctx().isCurrent(ctx().capture())).toBe(true)
        expect(ctx().api).not.toBe(clientBefore)
        expect(ctx().api?.workspaceScope?.workspaceId).toBe(SECOND_ID)
        expect(localStorage.getItem(accountStorageKey(LAST_WORKSPACE_STORAGE_BASE, { apiOrigin: ORIGIN, userHash: 'user-a' }))).toBe(SECOND_ID)

        expect(ctx().commitWorkspace('3c4d5e6f-7a8b-4c9d-8e0f-2a3b4c5d6e7f')).toBe(false)
        act(() => { expect(ctx().commitWorkspace(SECOND_ID)).toBe(true) })
        expect(screen.getByTestId('epoch')).toHaveTextContent('2')
    })

    it('accepts a validated workspace object (e.g. an archived link target) and adds it to the list', async () => {
        renderProvider()
        await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'))
        const archived = workspace(ARCHIVED_ID, { archived_at: '2026-10-02T00:00:00Z' })
        act(() => { expect(ctx().commitWorkspace(archived)).toBe(true) })
        expect(ctx().selectedWorkspace).toEqual(archived)
        expect(ctx().activeWorkspaces.map((item) => item.id)).not.toContain(ARCHIVED_ID)
        expect(ctx().commitWorkspace({ ...archived, id: 'not-a-uuid' })).toBe(false)
    })

    it('commits a known non-default workspace without a rollout permission', async () => {

        renderProvider()
        await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'))
        act(() => { expect(ctx().commitWorkspace(SECOND_ID)).toBe(true) })
        expect(screen.getByTestId('selected')).toHaveTextContent(SECOND_ID)
    })

    it('keeps an archived selection on refresh and falls back to the default when it disappears', async () => {
        renderProvider()
        await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'))
        act(() => { ctx().commitWorkspace(SECOND_ID) })

        listWorkspaces.mockResolvedValueOnce(list(workspace(DEFAULT_ID), workspace(SECOND_ID, { archived_at: '2026-10-03T00:00:00Z', row_version: 2 })))
        await act(async () => { await ctx().refreshWorkspaces() })
        expect(screen.getByTestId('selected')).toHaveTextContent(SECOND_ID)
        expect(ctx().selectedWorkspace?.archived_at).not.toBeNull()

        listWorkspaces.mockResolvedValueOnce(list(workspace(DEFAULT_ID)))
        await act(async () => { await ctx().refreshWorkspaces() })
        expect(screen.getByTestId('selected')).toHaveTextContent(DEFAULT_ID)
        expect(screen.getByTestId('epoch')).toHaveTextContent('3')
    })

    it('resets on sign-out and re-runs the handshake for another account', async () => {
        renderProvider()
        await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'))
        const captured = ctx().capture()

        act(() => { authSession.beginLogout() })
        expect(screen.getByTestId('status')).toHaveTextContent('idle')
        expect(screen.getByTestId('selected')).toHaveTextContent('none')
        expect(ctx().isCurrent(captured)).toBe(false)
        expect(ctx().api).toBeNull()

        act(() => {
            authSession.finishLogout()
            authSession.authenticate('user-b', 'token-b')
        })
        await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'))
        expect(ctx().capture()?.userHash).toBe('user-b')
    })

    it('drops a handshake that completes after the account changed', async () => {
        let release!: (value: WorkspaceList) => void
        listWorkspaces.mockImplementationOnce(() => new Promise<WorkspaceList>((resolve) => { release = resolve }))
        renderProvider()
        await waitFor(() => expect(listWorkspaces).toHaveBeenCalledOnce())

        listWorkspaces.mockResolvedValue(list(workspace(DEFAULT_ID)))
        act(() => { authSession.authenticate('user-b', 'token-b') })
        await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'))
        const owner = ctx().capture()
        await act(async () => { release(list(workspace(DEFAULT_ID), workspace(SECOND_ID))) })

        expect(ctx().capture()).toEqual(owner)
        expect(ctx().workspaces).toHaveLength(1)
    })

    it('keeps the workspace of an expired session for a same-account re-login', async () => {
        renderProvider()
        await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'))
        act(() => { ctx().commitWorkspace(SECOND_ID) })
        act(() => { authSession.expire() })
        expect(screen.getByTestId('selected')).toHaveTextContent(SECOND_ID)
        act(() => { authSession.authenticate('user-a', 'token-a2') })
        await act(async () => { await Promise.resolve() })
        expect(screen.getByTestId('selected')).toHaveTextContent(SECOND_ID)
        expect(screen.getByTestId('status')).toHaveTextContent('ready')
    })

    it('moves the pre-R1 assistant focus shelf into the protected default once', async () => {
        const legacyKey = 'magic-worlds-assistant-focus:user:user-a:0'
        localStorage.setItem(legacyKey, JSON.stringify([{ kind: 'character', id: 'c1' }]))
        localStorage.setItem('magic-worlds-assistant-focus:user:user-z:0', JSON.stringify([{ kind: 'world', id: 'w9' }]))
        renderProvider()
        await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'))

        const destination = workspaceStorageKey(ASSISTANT_FOCUS_STORAGE_BASE, { apiOrigin: ORIGIN, userHash: 'user-a', workspaceId: DEFAULT_ID })
        expect(JSON.parse(localStorage.getItem(destination)!)).toEqual([{ kind: 'character', id: 'c1' }])
        expect(localStorage.getItem(legacyKey)).toBeNull()
        // Another user's shelf is never assigned to this account.
        expect(localStorage.getItem('magic-worlds-assistant-focus:user:user-z:0')).not.toBeNull()
        const second = workspaceStorageKey(ASSISTANT_FOCUS_STORAGE_BASE, { apiOrigin: ORIGIN, userHash: 'user-a', workspaceId: SECOND_ID })
        expect(localStorage.getItem(second)).toBeNull()
    })
})
