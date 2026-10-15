import { useContext } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BackgroundTaskPublic } from '@/shared'

const authMock = vi.hoisted(() => ({ isAuthenticated: true, authEpoch: 1, accountKey: 'account-a' }))
vi.mock('../hooks/useAuth', () => ({
    useAuth: () => authMock,
}))

const loadData = vi.fn(async () => {})
vi.mock('../hooks/useData', () => ({
    useData: () => ({ loadData }),
}))

vi.mock('@/infrastructure/api', () => ({
    apiService: {
        listTasks: vi.fn(),
        getTask: vi.fn(),
        cancelTask: vi.fn(),
        archiveTask: vi.fn(),
        // Scoped clients share the mocked methods; the scope is asserted through this spy.
        withWorkspace: vi.fn(),
    },
}))

import { apiService } from '@/infrastructure/api'
import {
    createWorkspaceTestState,
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    WorkspaceTestProvider,
    type WorkspaceTestState,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { BackgroundTasksProvider } from './BackgroundTasksProvider'
import { BackgroundTasksContext } from './backgroundTasksContext'
import { TASK_REQUEST_STARTED, TASK_REQUEST_FINISHED } from '@/infrastructure/api/resourceTaskEvents'

const baseTask = {
    task_id: 'task-1',
    operation: 'theme_song',
    status: 'in_progress',
    target: { type: 'character', id: 'c1', display_name: 'Ballad of Embers' },
    title: 'Ballad of Embers',
    created_at: '2026-06-01T00:00:00',
    updated_at: '2026-06-01T00:00:00',
} as unknown as BackgroundTaskPublic

const completedTask = {
    ...baseTask,
    status: 'completed',
    result: { lyrics: { source: 'writer', lyrics_sha256: 'a'.repeat(64), lyrics_length_chars: 80 } },
    updated_at: '2026-06-01T00:01:00',
} as unknown as BackgroundTaskPublic

/** Phase 1: the task is active. Phase 2+: it has completed. */
let phase = 1
let archived = false
function mockListTasks() {
    vi.mocked(apiService.listTasks).mockImplementation(async (opts) => {
        const statuses = new Set<string>(opts?.statuses ?? [])
        if (phase === 1) {
            return { items: statuses.has('in_progress') ? [baseTask] : [] } as Awaited<ReturnType<typeof apiService.listTasks>>
        }
        return { items: statuses.has('completed') && !archived ? [completedTask] : [] } as Awaited<ReturnType<typeof apiService.listTasks>>
    })
    vi.mocked(apiService.archiveTask).mockImplementation(async () => {
        archived = true
        return completedTask
    })
}

function Probe() {
    const ctx = useContext(BackgroundTasksContext)
    return (
        <div>
            <span data-testid="visible-count">{ctx?.tasks.length ?? 0}</span>
            <span data-testid="completed-count">{ctx?.taskBuckets.completed.length ?? 0}</span>
            <span data-testid="completed-has-more">{String(ctx?.terminalHasMore.completed ?? false)}</span>
            <span data-testid="drawer-open">{String(ctx?.drawerOpen ?? false)}</span>
            <button onClick={() => { void ctx?.clearTerminalTasks('completed').catch(() => undefined) }}>clear completed</button>
            <button onClick={() => { void ctx?.loadMoreTerminalTasks('completed') }}>load completed</button>
            <button onClick={() => ctx?.openDrawer()}>open drawer</button>
            <button onClick={() => { void ctx?.cancelTask('theme_song', 'task-1').catch(() => undefined) }}>cancel task</button>
            <span data-testid="task-origins">{ctx?.tasks.map((task) => `${task.task_id}@${task.organization?.workspace_id}:${task.status}`).join(',')}</span>
        </div>
    )
}

let workspace: WorkspaceTestState

function tree() {
    return (
        <WorkspaceTestProvider state={workspace}>
            <BackgroundTasksProvider>
                <Probe />
            </BackgroundTasksProvider>
        </WorkspaceTestProvider>
    )
}

function renderProvider() {
    return render(tree())
}

describe('BackgroundTasksProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
        vi.useFakeTimers()
        phase = 1
        archived = false
        authMock.isAuthenticated = true
        authMock.authEpoch = 1
        authMock.accountKey = 'account-a'
        workspace = createWorkspaceTestState({ api: apiService })
        vi.mocked(apiService.withWorkspace).mockImplementation(() => apiService)
        mockListTasks()
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
        vi.unstubAllEnvs()
    })

    it('fetches all task operations and keeps polling while a resource request is running', async () => {
        vi.spyOn(document,'hasFocus').mockReturnValue(true)
        vi.mocked(apiService.listTasks).mockResolvedValue({items:[],limit:20,offset:0,next_offset:null})
        renderProvider()
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        expect(apiService.listTasks).toHaveBeenCalledWith(expect.objectContaining({operation:'all'}))
        const detail={id:'pdf-request',authEpoch:authMock.authEpoch,accountKey:authMock.accountKey}
        await act(async () => { window.dispatchEvent(new CustomEvent(TASK_REQUEST_STARTED,{detail})); await vi.advanceTimersByTimeAsync(0) })
        const before=vi.mocked(apiService.listTasks).mock.calls.length
        await act(async () => { await vi.advanceTimersByTimeAsync(4_000) })
        expect(vi.mocked(apiService.listTasks).mock.calls.length).toBeGreaterThan(before)
        await act(async () => { window.dispatchEvent(new CustomEvent(TASK_REQUEST_FINISHED,{detail})); await vi.advanceTimersByTimeAsync(0) })
        const finished=vi.mocked(apiService.listTasks).mock.calls.length
        await act(async () => { await vi.advanceTimersByTimeAsync(8_000) })
        expect(vi.mocked(apiService.listTasks).mock.calls.length).toBe(finished)
    })

    // Regression: the logged-out reset effect once fed its own dependencies
    // (terminalPages → refreshTasks → effect) and looped forever. If this test
    // hangs instead of passing, that loop is back.
    it('settles without polling while logged out', async () => {
        authMock.isAuthenticated = false
        renderProvider()

        await act(async () => {
            await vi.advanceTimersByTimeAsync(60_000)
        })

        expect(screen.getByTestId('visible-count')).toHaveTextContent('0')
        expect(apiService.listTasks).not.toHaveBeenCalled()
    })

    it('pauses active task polling when unfocused and refreshes on focus', async () => {
        const focusSpy = vi.spyOn(document, 'hasFocus').mockReturnValue(true)
        renderProvider()
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        expect(apiService.listTasks).toHaveBeenCalledTimes(3)

        focusSpy.mockReturnValue(false)
        act(() => window.dispatchEvent(new Event('blur')))
        await act(async () => { await vi.advanceTimersByTimeAsync(12_000) })
        expect(apiService.listTasks).toHaveBeenCalledTimes(3)

        focusSpy.mockReturnValue(true)
        act(() => window.dispatchEvent(new Event('focus')))
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        expect(apiService.listTasks).toHaveBeenCalledTimes(6)
    })

    it('retries the focus catch-up after an older request finishes', async () => {
        const focusSpy = vi.spyOn(document, 'hasFocus').mockReturnValue(true)
        let releaseFirst!: () => void
        const firstBatch = new Promise<void>((resolve) => { releaseFirst = resolve })
        vi.mocked(apiService.listTasks).mockImplementation(async (opts) => {
            if (vi.mocked(apiService.listTasks).mock.calls.length <= 3) await firstBatch
            const statuses = new Set<string>(opts?.statuses ?? [])
            return { items: statuses.has('in_progress') ? [baseTask] : [] } as Awaited<ReturnType<typeof apiService.listTasks>>
        })

        renderProvider()
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        expect(apiService.listTasks).toHaveBeenCalledTimes(3)

        focusSpy.mockReturnValue(false)
        act(() => window.dispatchEvent(new Event('blur')))
        focusSpy.mockReturnValue(true)
        act(() => window.dispatchEvent(new Event('focus')))
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        expect(apiService.listTasks).toHaveBeenCalledTimes(3)

        await act(async () => {
            releaseFirst()
            await Promise.resolve()
        })
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        expect(apiService.listTasks).toHaveBeenCalledTimes(6)
    })

    it('loads a new account after an old account request completes', async () => {
        let releaseFirst!: () => void
        const firstBatch = new Promise<void>((resolve) => { releaseFirst = resolve })
        vi.mocked(apiService.listTasks).mockImplementation(async (opts) => {
            if (vi.mocked(apiService.listTasks).mock.calls.length <= 3) await firstBatch
            const statuses = new Set<string>(opts?.statuses ?? [])
            return { items: statuses.has('in_progress') ? [baseTask] : [] } as Awaited<ReturnType<typeof apiService.listTasks>>
        })

        const view = renderProvider()
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        expect(apiService.listTasks).toHaveBeenCalledTimes(3)

        authMock.authEpoch = 2
        authMock.accountKey = 'account-b'
        view.rerender(tree())
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        expect(apiService.listTasks).toHaveBeenCalledTimes(3)

        await act(async () => {
            releaseFirst()
            await Promise.resolve()
        })
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        expect(apiService.listTasks).toHaveBeenCalledTimes(6)
    })

    it('stops idle polling and refreshes when the drawer opens', async () => {
        phase = 2
        renderProvider()
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        expect(apiService.listTasks).toHaveBeenCalledTimes(3)

        await act(async () => { await vi.advanceTimersByTimeAsync(120_000) })
        expect(apiService.listTasks).toHaveBeenCalledTimes(3)

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'open drawer' })) })
        expect(apiService.listTasks).toHaveBeenCalledTimes(6)
    })

    it('toasts when an active task completes, with an action that opens the drawer', async () => {
        renderProvider()

        // First poll: task is active — no toast (and nothing has transitioned).
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0)
        })
        expect(screen.getByTestId('visible-count')).toHaveTextContent('1')
        expect(screen.queryByText('Task completed')).toBeNull()

        // Second poll: the task finished.
        phase = 2
        await act(async () => {
            await vi.advanceTimersByTimeAsync(4_000)
        })

        expect(screen.getByText('Task completed')).toBeInTheDocument()
        expect(screen.getByText('Ballad of Embers')).toBeInTheDocument()
        expect(loadData).toHaveBeenCalledWith({ silent: true })

        fireEvent.click(screen.getByRole('button', { name: 'Open tasks' }))
        expect(screen.getByTestId('drawer-open')).toHaveTextContent('true')
        expect(screen.queryByText('Task completed')).toBeNull()
    })

    it('does not toast for tasks that were already terminal on the first poll', async () => {
        phase = 2
        renderProvider()

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0)
        })

        expect(screen.getByTestId('completed-count')).toHaveTextContent('1')
        expect(screen.queryByText('Task completed')).toBeNull()
    })

    it('clear completed archives the bucket on the server and survives the next poll', async () => {
        phase = 2
        renderProvider()
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0)
        })
        expect(screen.getByTestId('completed-count')).toHaveTextContent('1')

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'clear completed' }))
        })
        expect(apiService.archiveTask).toHaveBeenCalledWith('theme_song', 'task-1')
        expect(screen.getByTestId('completed-count')).toHaveTextContent('0')
        expect(localStorage.getItem('magic-worlds-tasks-dismissed')).toBeNull()

        // The next poll returns the same terminal task — it stays hidden.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(30_000)
        })
        expect(screen.getByTestId('completed-count')).toHaveTextContent('0')
    })

    it('loads and clears visible completed tasks after a page of hidden voice jobs', async () => {
        vi.stubEnv('VITE_FEATURE_VOICES_ENABLED', 'false')
        vi.stubEnv('VITE_FEATURE_CALLS_ENABLED', 'true')
        vi.mocked(apiService.listTasks).mockImplementation(async (opts) => {
            const offset = opts?.offset ?? 0
            if (!opts?.statuses?.includes('completed')) return { items: [], limit: 20, offset, next_offset: null }
            // The API filters voice jobs but keeps their server pagination cursor.
            return offset === 0
                ? { items: [], limit: 20, offset, next_offset: archived ? null : 20 }
                : { items: archived ? [] : [completedTask], limit: 20, offset, next_offset: null }
        })
        renderProvider()
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        expect(screen.getByTestId('completed-count')).toHaveTextContent('0')
        expect(screen.getByTestId('completed-has-more')).toHaveTextContent('true')

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'load completed' }))
            await vi.advanceTimersByTimeAsync(0)
        })
        expect(screen.getByTestId('completed-count')).toHaveTextContent('1')
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'clear completed' })) })

        expect(apiService.archiveTask).toHaveBeenCalledExactlyOnceWith('theme_song', 'task-1')
        expect(screen.getByTestId('completed-count')).toHaveTextContent('0')
    })

    it('removes successful archives but retains tasks whose archive request failed', async () => {
        phase = 2
        const secondTask = { ...completedTask, task_id: 'task-2' }
        vi.mocked(apiService.listTasks).mockImplementation(async (opts) => ({
            items: new Set<string>(opts?.statuses ?? []).has('completed') ? [completedTask, secondTask] : [],
        } as Awaited<ReturnType<typeof apiService.listTasks>>))
        vi.mocked(apiService.archiveTask).mockImplementation(async (_operation, taskId) => {
            if (taskId === 'task-2') throw new Error('archive unavailable')
            return completedTask
        })
        renderProvider()
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0)
        })

        expect(screen.getByTestId('completed-count')).toHaveTextContent('2')
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'clear completed' }))
        })

        expect(apiService.archiveTask).toHaveBeenCalledTimes(2)
        expect(screen.getByTestId('completed-count')).toHaveTextContent('1')
    })

    it('does not fetch later task pages after focus is lost', async () => {
        const focusSpy = vi.spyOn(document, 'hasFocus').mockReturnValue(true)
        let releaseFirst!: () => void
        const firstPage = new Promise<void>((resolve) => { releaseFirst = resolve })
        vi.mocked(apiService.listTasks).mockImplementation(async (opts) => {
            const statuses = new Set<string>(opts?.statuses ?? [])
            if (!statuses.has('in_progress')) return { items: [], limit: 20, offset: opts?.offset ?? 0, next_offset: null } as Awaited<ReturnType<typeof apiService.listTasks>>
            if ((opts?.offset ?? 0) === 0) {
                await firstPage
                return { items: Array.from({ length: 20 }, (_, index) => ({ ...baseTask, task_id: `task-${index}` })), limit: 20, offset: 0, next_offset: 20 } as Awaited<ReturnType<typeof apiService.listTasks>>
            }
            return { items: [baseTask], limit: 20, offset: 20, next_offset: null } as Awaited<ReturnType<typeof apiService.listTasks>>
        })

        renderProvider()
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        focusSpy.mockReturnValue(false)
        act(() => window.dispatchEvent(new Event('blur')))
        await act(async () => { releaseFirst(); await Promise.resolve() })

        expect(apiService.listTasks).not.toHaveBeenCalledWith(expect.objectContaining({ offset: 20 }))
    })

    it('consumes every active page with duplicate protection', async () => {
        const active = Array.from({ length: 21 }, (_, index) => ({
            ...baseTask,
            task_id: `active-${index + 1}`,
        }))
        vi.mocked(apiService.listTasks).mockImplementation(async (opts) => {
            const statuses = new Set<string>(opts?.statuses ?? [])
            if (!statuses.has('in_progress')) return { items: [], limit: 20, offset: opts?.offset ?? 0, next_offset: null }
            if ((opts?.offset ?? 0) === 0) {
                return { items: active.slice(0, 20), limit: 20, offset: 0, next_offset: 20 }
            }
            return { items: [active[19], active[20]], limit: 20, offset: 20, next_offset: null }
        })

        renderProvider()
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0)
        })

        expect(screen.getByTestId('visible-count')).toHaveTextContent('21')
        expect(apiService.listTasks).toHaveBeenCalledWith(expect.objectContaining({ offset: 20 }))
    })

    it('loads another terminal page and refetches all loaded pages', async () => {
        phase = 2
        const completed = Array.from({ length: 21 }, (_, index) => ({
            ...completedTask,
            task_id: `completed-${index + 1}`,
        }))
        vi.mocked(apiService.listTasks).mockImplementation(async (opts) => {
            const statuses = new Set<string>(opts?.statuses ?? [])
            if (!statuses.has('completed')) return { items: [], limit: 20, offset: opts?.offset ?? 0, next_offset: null }
            return (opts?.offset ?? 0) === 0
                ? { items: completed.slice(0, 20), limit: 20, offset: 0, next_offset: 20 }
                : { items: completed.slice(20), limit: 20, offset: 20, next_offset: null }
        })

        renderProvider()
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0)
        })
        expect(screen.getByTestId('completed-count')).toHaveTextContent('20')
        expect(screen.getByTestId('completed-has-more')).toHaveTextContent('true')

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'load completed' }))
            await vi.advanceTimersByTimeAsync(0)
        })
        expect(screen.getByTestId('completed-count')).toHaveTextContent('21')
        expect(screen.getByTestId('completed-has-more')).toHaveTextContent('false')
        expect(apiService.listTasks).toHaveBeenCalledWith(expect.objectContaining({ offset: 20 }))
    })

    it('clears every server terminal page, including pages not loaded in the drawer', async () => {
        phase = 2
        const remaining = Array.from({ length: 25 }, (_, index) => ({
            ...completedTask,
            task_id: `completed-${index + 1}`,
        }))
        vi.mocked(apiService.listTasks).mockImplementation(async (opts) => {
            const statuses = new Set<string>(opts?.statuses ?? [])
            if (!statuses.has('completed')) return { items: [], limit: 20, offset: opts?.offset ?? 0, next_offset: null }
            const offset = opts?.offset ?? 0
            const items = remaining.slice(offset, offset + 20)
            return { items, limit: 20, offset, next_offset: offset + items.length < remaining.length ? offset + 20 : null }
        })
        vi.mocked(apiService.archiveTask).mockImplementation(async (_operation, taskId) => {
            const index = remaining.findIndex((task) => task.task_id === taskId)
            const [task] = remaining.splice(index, 1)
            return task
        })

        renderProvider()
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0)
        })
        expect(screen.getByTestId('completed-count')).toHaveTextContent('20')

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'clear completed' }))
        })

        expect(apiService.archiveTask).toHaveBeenCalledTimes(25)
        expect(remaining).toHaveLength(0)
        expect(screen.getByTestId('completed-count')).toHaveTextContent('0')
    })

    describe('Workspace R1', () => {
        it('reads the selected workspace lists and stamps each task with its origin', async () => {
            renderProvider()
            await act(async () => { await vi.advanceTimersByTimeAsync(0) })

            expect(apiService.withWorkspace).toHaveBeenCalledWith(TEST_WORKSPACE_ID)
            expect(screen.getByTestId('task-origins')).toHaveTextContent(`task-1@${TEST_WORKSPACE_ID}:in_progress`)
        })

        it('keeps polling a running task in its own workspace after a switch without reloading the new library', async () => {
            const view = renderProvider()
            await act(async () => { await vi.advanceTimersByTimeAsync(0) })
            expect(screen.getByTestId('task-origins')).toHaveTextContent(`task-1@${TEST_WORKSPACE_ID}:in_progress`)

            // The new workspace has no tasks of its own; the old one finishes meanwhile.
            vi.mocked(apiService.listTasks).mockResolvedValue({ items: [] } as unknown as Awaited<ReturnType<typeof apiService.listTasks>>)
            vi.mocked(apiService.getTask).mockResolvedValue(completedTask)
            workspace.switchTo(OTHER_WORKSPACE_ID)
            view.rerender(tree())
            vi.mocked(apiService.withWorkspace).mockClear()
            loadData.mockClear()

            await act(async () => { await vi.advanceTimersByTimeAsync(4_000) })

            expect(apiService.withWorkspace).toHaveBeenCalledWith(OTHER_WORKSPACE_ID)
            expect(apiService.withWorkspace).toHaveBeenCalledWith(TEST_WORKSPACE_ID)
            expect(apiService.getTask).toHaveBeenCalledWith('theme_song', 'task-1')
            expect(screen.getByTestId('task-origins')).toHaveTextContent(`task-1@${TEST_WORKSPACE_ID}:completed`)
            // The account-wide list updates; the selected workspace's library does not reload.
            expect(loadData).not.toHaveBeenCalled()
        })

        it('drops finished tasks of the previous selection on a switch and keeps running ones', async () => {
            phase = 2
            const view = renderProvider()
            await act(async () => { await vi.advanceTimersByTimeAsync(0) })
            expect(screen.getByTestId('completed-count')).toHaveTextContent('1')

            vi.mocked(apiService.listTasks).mockResolvedValue({ items: [] } as unknown as Awaited<ReturnType<typeof apiService.listTasks>>)
            workspace.switchTo(OTHER_WORKSPACE_ID)
            view.rerender(tree())
            expect(screen.getByTestId('completed-count')).toHaveTextContent('0')
        })

        it('cancels a task in the workspace it was submitted in', async () => {
            vi.mocked(apiService.cancelTask).mockResolvedValue({ ...baseTask, status: 'canceled' } as BackgroundTaskPublic)
            const view = renderProvider()
            await act(async () => { await vi.advanceTimersByTimeAsync(0) })
            vi.mocked(apiService.listTasks).mockResolvedValue({ items: [] } as unknown as Awaited<ReturnType<typeof apiService.listTasks>>)
            vi.mocked(apiService.getTask).mockResolvedValue(baseTask)
            workspace.switchTo(OTHER_WORKSPACE_ID)
            view.rerender(tree())
            vi.mocked(apiService.withWorkspace).mockClear()

            await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'cancel task' })) })

            expect(apiService.withWorkspace).toHaveBeenCalledWith(TEST_WORKSPACE_ID)
            expect(apiService.withWorkspace).not.toHaveBeenCalledWith(OTHER_WORKSPACE_ID)
            expect(apiService.cancelTask).toHaveBeenCalledWith('theme_song', 'task-1')
        })

        it('lists resource tasks per workspace and reloads them on a committed switch', async () => {
            const resourceTarget = { type: 'resource', id: 'resource-1', display_name: 'court.pdf' }
            const pdfImport = { ...completedTask, task_id: 'pdf-1', operation: 'pdf_import', target: resourceTarget } as unknown as BackgroundTaskPublic
            const metadata = { ...baseTask, task_id: 'meta-1', operation: 'lorebook_extraction', target: resourceTarget } as unknown as BackgroundTaskPublic
            const listed: string[] = []
            const read: string[] = []
            // One client per workspace, so every request records the workspace it carried.
            vi.mocked(apiService.withWorkspace).mockImplementation((workspaceId: string) => ({
                ...apiService,
                listTasks: async (opts: Parameters<typeof apiService.listTasks>[0] = {}) => {
                    listed.push(`${workspaceId}:${opts.operation}`)
                    const statuses = new Set<string>(opts.statuses ?? [])
                    const items = workspaceId !== TEST_WORKSPACE_ID ? [] : [pdfImport, metadata].filter((task) => statuses.has(task.status))
                    return { items, limit: 20, offset: 0, next_offset: null }
                },
                getTask: async (operation: string, taskId: string) => {
                    read.push(`${workspaceId}:${operation}:${taskId}`)
                    return { ...metadata, status: 'completed', updated_at: '2026-06-01T00:02:00' }
                },
            }) as unknown as typeof apiService)
            const view = renderProvider()
            await act(async () => { await vi.advanceTimersByTimeAsync(0) })
            expect(listed.every((entry) => entry === `${TEST_WORKSPACE_ID}:all`)).toBe(true)
            expect(screen.getByTestId('task-origins')).toHaveTextContent(`pdf-1@${TEST_WORKSPACE_ID}:completed`)
            expect(screen.getByTestId('task-origins')).toHaveTextContent(`meta-1@${TEST_WORKSPACE_ID}:in_progress`)

            listed.length = 0
            workspace.switchTo(OTHER_WORKSPACE_ID)
            view.rerender(tree())
            // The previous workspace's finished import leaves the drawer at once.
            expect(screen.getByTestId('task-origins')).not.toHaveTextContent('pdf-1@')

            await act(async () => { await vi.advanceTimersByTimeAsync(4_000) })
            expect(listed.length).toBeGreaterThan(0)
            expect(listed.every((entry) => entry === `${OTHER_WORKSPACE_ID}:all`)).toBe(true)
            // The running metadata task is still read where it was submitted, never in the new workspace.
            expect(read).toContain(`${TEST_WORKSPACE_ID}:lorebook_extraction:meta-1`)
            expect(read.some((entry) => entry.startsWith(OTHER_WORKSPACE_ID))).toBe(false)
            expect(screen.getByTestId('task-origins')).toHaveTextContent(`meta-1@${TEST_WORKSPACE_ID}:completed`)
            expect(screen.getByTestId('task-origins')).not.toHaveTextContent('pdf-1@')
        })

        it('discards a list read for a workspace that is no longer selected', async () => {
            let release!: () => void
            const gate = new Promise<void>((resolve) => { release = resolve })
            vi.mocked(apiService.listTasks).mockImplementation(async (opts) => {
                await gate
                const statuses = new Set<string>(opts?.statuses ?? [])
                return { items: statuses.has('in_progress') ? [baseTask] : [] } as Awaited<ReturnType<typeof apiService.listTasks>>
            })
            const view = renderProvider()
            await act(async () => { await vi.advanceTimersByTimeAsync(0) })
            workspace.switchTo(OTHER_WORKSPACE_ID)
            view.rerender(tree())

            await act(async () => {
                release()
                await Promise.resolve()
            })
            await act(async () => { await vi.advanceTimersByTimeAsync(0) })
            expect(screen.getByTestId('task-origins')).not.toHaveTextContent(`task-1@${TEST_WORKSPACE_ID}`)
        })
    })
})
