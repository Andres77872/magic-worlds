import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { useContext, useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Workspace } from '@/shared/types'
import {
    createWorkspaceTestState,
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    testWorkspace,
} from '@/shared/hooks/testing/workspaceTestUtils'

const mocks = vi.hoisted(() => ({
    getWorkspace: vi.fn(),
    resolveContent: vi.fn(),
    hasActiveVoiceCall: vi.fn(() => false),
    endActiveVoiceCall: vi.fn(async () => undefined),
    commit: vi.fn(),
    order: [] as string[],
}))

vi.mock('@/infrastructure/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/infrastructure/api')>()),
    apiService: { getWorkspace: mocks.getWorkspace, resolveContent: mocks.resolveContent },
}))
vi.mock('@/features/call/activeVoiceCall', () => ({
    hasActiveVoiceCall: mocks.hasActiveVoiceCall,
    endActiveVoiceCall: mocks.endActiveVoiceCall,
}))

import { WorkspaceContext } from './workspaceContext'
import {
    NavigationCoordinatorContext,
    NavigationProvider,
    type NavigateOutcome,
    type NavigationCoordinatorValue,
} from './NavigationProvider'
import { useNavigation } from '../hooks/useNavigation'

const main = testWorkspace(TEST_WORKSPACE_ID, 'Main library')
const novel = testWorkspace(OTHER_WORKSPACE_ID, 'Novel A')
const MAIN_LIBRARY = `#/library?workspace=${TEST_WORKSPACE_ID}`
const NOVEL_LIBRARY = `#/library?workspace=${OTHER_WORKSPACE_ID}`

/** A workspace context whose commit really switches (like WorkspaceProvider). */
function WorkspaceHarness({ children }: { children: ReactNode }) {
    const [selected, setSelected] = useState(TEST_WORKSPACE_ID)
    const [epoch, setEpoch] = useState(1)
    const base = createWorkspaceTestState({ workspaces: [main, novel] }).value()
    const value = {
        ...base,
        selectedWorkspaceId: selected,
        selectedWorkspace: [main, novel].find((workspace) => workspace.id === selected) ?? null,
        workspaceEpoch: epoch,
        commitWorkspace: (target: string | Workspace) => {
            const id = typeof target === 'string' ? target : target.id
            mocks.order.push(`commit:${id}`)
            mocks.commit(id)
            setSelected(id)
            setEpoch((current) => current + 1)
            return true
        },
    }
    return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

let coordinator: NavigationCoordinatorValue | null = null
let navigation: ReturnType<typeof useNavigation> | null = null

function Probe({ guard }: { guard?: 'cancel' | 'hold' }) {
    const nav = useNavigation()
    const coord = useContext(NavigationCoordinatorContext)
    const workspace = useContext(WorkspaceContext)
    // Hand the live values to the test body after each commit.
    useLayoutEffect(() => {
        navigation = nav
        coordinator = coord
    })
    const { registerNavigationInterceptor } = nav
    useEffect(() => {
        if (!guard) return
        return registerNavigationInterceptor((_proceed, cancel) => {
            if (guard === 'cancel') queueMicrotask(() => cancel?.())
            return true
        })
    }, [guard, registerNavigationInterceptor])
    return (
        <div>
            <span data-testid="page">{nav.currentPage}</span>
            <span data-testid="hash">{nav.currentHash}</span>
            <span data-testid="workspace">{workspace?.selectedWorkspaceId}</span>
            <span data-testid="failure">{coord?.switchFailure?.reason ?? 'none'}</span>
            <span data-testid="route-status">{coord?.routeStatus}</span>
        </div>
    )
}

function renderCoordinator(guard?: 'cancel' | 'hold') {
    return render(
        <WorkspaceHarness>
            <NavigationProvider>
                <Probe guard={guard} />
            </NavigationProvider>
        </WorkspaceHarness>,
    )
}

function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((res) => {
        resolve = res
    })
    return { promise, resolve }
}

describe('NavigationProvider workspace switch coordinator', () => {
    beforeEach(() => {

        window.history.replaceState(null, '', MAIN_LIBRARY)
        mocks.getWorkspace.mockReset()
        mocks.resolveContent.mockReset()
        mocks.hasActiveVoiceCall.mockReset().mockReturnValue(false)
        mocks.endActiveVoiceCall.mockReset().mockImplementation(async () => {
            mocks.order.push('end-call')
        })
        mocks.commit.mockReset()
        mocks.order.length = 0
        coordinator = null
        navigation = null
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('a cancelled guard keeps the source workspace and URL', async () => {
        renderCoordinator('cancel')
        let outcome: NavigateOutcome | undefined
        await act(async () => {
            outcome = await coordinator!.navigate({ page: 'library', workspace: novel })
        })
        expect(outcome).toBe('cancelled')
        expect(mocks.commit).not.toHaveBeenCalled()
        expect(mocks.getWorkspace).not.toHaveBeenCalled()
        expect(window.location.hash).toBe(MAIN_LIBRARY)
        expect(screen.getByTestId('workspace')).toHaveTextContent(TEST_WORKSPACE_ID)
        expect(screen.getByTestId('hash')).toHaveTextContent(MAIN_LIBRARY)
    })

    it('ends a live call, revalidates, then commits the workspace and route together', async () => {
        mocks.hasActiveVoiceCall.mockReturnValue(true)
        mocks.getWorkspace.mockImplementation(async (id: string) => {
            mocks.order.push(`revalidate:${id}`)
            return novel
        })
        renderCoordinator()
        act(() => navigation!.setPage('gallery-stories'))
        let outcome: NavigateOutcome | undefined
        await act(async () => {
            outcome = await coordinator!.navigate({ page: 'library', workspace: novel })
        })
        expect(outcome).toBe('navigated')
        expect(mocks.order).toEqual(['end-call', `revalidate:${OTHER_WORKSPACE_ID}`, `commit:${OTHER_WORKSPACE_ID}`])
        expect(window.location.hash).toBe(NOVEL_LIBRARY)
        expect(screen.getByTestId('page')).toHaveTextContent('library')
        expect(screen.getByTestId('workspace')).toHaveTextContent(OTHER_WORKSPACE_ID)
        // A switch clears the back stack: nothing of the source workspace is "back".
        expect(navigation!.previousPage).toBeUndefined()
    })

    it('keeps the source when the call does not end, and Try again reruns the switch', async () => {
        mocks.hasActiveVoiceCall.mockReturnValue(true)
        mocks.endActiveVoiceCall.mockRejectedValueOnce(new Error('end unconfirmed'))
        mocks.getWorkspace.mockResolvedValue(novel)
        renderCoordinator()
        let outcome: NavigateOutcome | undefined
        await act(async () => {
            outcome = await coordinator!.navigate({ page: 'library', workspace: novel })
        })
        expect(outcome).toBe('failed')
        expect(screen.getByTestId('failure')).toHaveTextContent('call')
        expect(mocks.commit).not.toHaveBeenCalled()
        expect(window.location.hash).toBe(MAIN_LIBRARY)

        await act(async () => {
            coordinator!.switchFailure!.retry()
        })
        await waitFor(() => expect(mocks.commit).toHaveBeenCalledWith(OTHER_WORKSPACE_ID))
        expect(window.location.hash).toBe(NOVEL_LIBRARY)
        expect(screen.getByTestId('failure')).toHaveTextContent('none')
    })

    it('does not enter a destination archived while the guards ran', async () => {
        mocks.getWorkspace.mockResolvedValue({ ...novel, archived_at: '2026-10-11T00:00:00Z' })
        renderCoordinator()
        let outcome: NavigateOutcome | undefined
        await act(async () => {
            outcome = await coordinator!.navigate({ page: 'library', workspace: novel })
        })
        expect(outcome).toBe('failed')
        expect(screen.getByTestId('failure')).toHaveTextContent('archived')
        expect(mocks.commit).not.toHaveBeenCalled()
        expect(window.location.hash).toBe(MAIN_LIBRARY)
    })

    it('ignores the late result of a superseded switch', async () => {
        const revalidation = deferred<Workspace>()
        mocks.getWorkspace.mockReturnValue(revalidation.promise)
        renderCoordinator()
        let first: Promise<NavigateOutcome> | undefined
        act(() => {
            first = coordinator!.navigate({ page: 'library', workspace: novel })
        })
        await waitFor(() => expect(mocks.getWorkspace).toHaveBeenCalledTimes(1))
        // A newer in-app navigation commits first.
        act(() => navigation!.setPage('gallery-media'))
        await act(async () => {
            revalidation.resolve(novel)
            await first
        })
        await expect(first).resolves.toBe('cancelled')
        expect(mocks.commit).not.toHaveBeenCalled()
        expect(screen.getByTestId('page')).toHaveTextContent('gallery-media')
        expect(screen.getByTestId('workspace')).toHaveTextContent(TEST_WORKSPACE_ID)
        expect(window.location.hash).toBe(`#/gallery/media?workspace=${TEST_WORKSPACE_ID}`)
    })

    it('restores the committed URL while a guarded external link waits, and keeps it on cancel', async () => {
        renderCoordinator('cancel')
        await act(async () => {
            window.history.replaceState(null, '', NOVEL_LIBRARY)
            window.dispatchEvent(new HashChangeEvent('hashchange'))
        })
        await waitFor(() => expect(window.location.hash).toBe(MAIN_LIBRARY))
        expect(mocks.commit).not.toHaveBeenCalled()
        expect(screen.getByTestId('workspace')).toHaveTextContent(TEST_WORKSPACE_ID)
        expect(screen.getByTestId('page')).toHaveTextContent('library')
    })

    it('opens an in-app link naming another workspace through the coordinator', async () => {
        mocks.getWorkspace.mockResolvedValue(novel)
        renderCoordinator()
        await act(async () => {
            navigation!.setPage('library', { hash: `${NOVEL_LIBRARY}&q=dragon` })
        })
        await waitFor(() => expect(mocks.commit).toHaveBeenCalledWith(OTHER_WORKSPACE_ID))
        expect(window.location.hash).toBe(`${NOVEL_LIBRARY}&q=dragon`)
    })

    it('maps a legacy type-gallery hash to the Library', () => {
        renderCoordinator()
        act(() => navigation!.setPage('gallery-worlds'))
        expect(screen.getByTestId('page')).toHaveTextContent('library')
        expect(window.location.hash).toBe(`#/library?workspace=${TEST_WORKSPACE_ID}&card_type=world`)
    })
})

describe('NavigationProvider with globally available workspaces', () => {
    beforeEach(() => {

        window.history.replaceState(null, '', '#/gallery/media')
        mocks.getWorkspace.mockReset()
        mocks.commit.mockReset()
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('opens a non-default workspace without any workspace permission', async () => {
        mocks.getWorkspace.mockResolvedValue(novel)
        renderCoordinator()
        let outcome: NavigateOutcome | undefined
        await act(async () => {
            outcome = await coordinator!.navigate({ page: 'gallery-media', workspace: novel })
        })
        expect(outcome).toBe('navigated')
        expect(mocks.commit).toHaveBeenCalledWith(OTHER_WORKSPACE_ID)
        expect(mocks.getWorkspace).toHaveBeenCalled()
    })

    it('normalizes a legacy gallery into the global Library', () => {
        renderCoordinator()
        act(() => navigation!.setPage('gallery-worlds'))
        expect(screen.getByTestId('page')).toHaveTextContent('library')
        expect(window.location.hash).toBe(`#/library?workspace=${TEST_WORKSPACE_ID}&card_type=world`)
    })
})
