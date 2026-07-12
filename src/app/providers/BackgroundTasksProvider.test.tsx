import { useContext } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BackgroundTaskPublic } from '@/shared'

vi.mock('../hooks/useAuth', () => ({
    useAuth: () => ({ isAuthenticated: true }),
}))

const loadData = vi.fn(async () => {})
vi.mock('../hooks/useData', () => ({
    useData: () => ({ loadData }),
}))

vi.mock('@/infrastructure/api', () => ({
    apiService: {
        listTasks: vi.fn(),
        cancelTask: vi.fn(),
        archiveTask: vi.fn(),
    },
}))

import { apiService } from '@/infrastructure/api'
import { BackgroundTasksProvider } from './BackgroundTasksProvider'
import { BackgroundTasksContext } from './backgroundTasksContext'

const baseTask = {
    task_id: 'task-1',
    operation: 'theme_song',
    status: 'in_progress',
    target: { type: 'character', id: 'c1' },
    created_at: '2026-06-01T00:00:00',
    updated_at: '2026-06-01T00:00:00',
} as unknown as BackgroundTaskPublic

const completedTask = {
    ...baseTask,
    status: 'completed',
    result: { lyrics: { song_title: 'Ballad of Embers' } },
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
            <span data-testid="drawer-open">{String(ctx?.drawerOpen ?? false)}</span>
            <button onClick={() => { void ctx?.clearTerminalTasks('completed').catch(() => undefined) }}>clear completed</button>
        </div>
    )
}

function renderProvider() {
    return render(
        <BackgroundTasksProvider>
            <Probe />
        </BackgroundTasksProvider>,
    )
}

describe('BackgroundTasksProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
        vi.useFakeTimers()
        phase = 1
        archived = false
        mockListTasks()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('toasts when an active task completes, with an action that opens the drawer', async () => {
        renderProvider()

        // First poll: task is active — no toast (and nothing has transitioned).
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0)
        })
        expect(screen.getByTestId('visible-count')).toHaveTextContent('1')
        expect(screen.queryByText('Theme song ready')).toBeNull()

        // Second poll: the task finished.
        phase = 2
        await act(async () => {
            await vi.advanceTimersByTimeAsync(4_000)
        })

        expect(screen.getByText('Theme song ready')).toBeInTheDocument()
        expect(screen.getByText('Ballad of Embers')).toBeInTheDocument()
        expect(loadData).toHaveBeenCalledWith({ silent: true })

        fireEvent.click(screen.getByRole('button', { name: 'Open tasks' }))
        expect(screen.getByTestId('drawer-open')).toHaveTextContent('true')
        expect(screen.queryByText('Theme song ready')).toBeNull()
    })

    it('does not toast for tasks that were already terminal on the first poll', async () => {
        phase = 2
        renderProvider()

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0)
        })

        expect(screen.getByTestId('completed-count')).toHaveTextContent('1')
        expect(screen.queryByText('Theme song ready')).toBeNull()
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
})
