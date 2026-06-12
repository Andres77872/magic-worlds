import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { apiService } from '@/infrastructure/api'
import type { BackgroundTaskOperation, BackgroundTaskPublic, ThemeSongJobPublic } from '@/shared'
import {
    BACKGROUND_TASK_ACTIVE_STATUSES,
    BACKGROUND_TASK_COMPLETED_STATUSES,
    BACKGROUND_TASK_FAILED_STATUSES,
    taskFromThemeSongJob,
} from '@/shared'
import { parseApiTimestamp } from '@/utils/time'
import { useAuth } from '../hooks/useAuth'
import { useData } from '../hooks/useData'
import { BackgroundTasksContext, type BackgroundTasksContextValue } from './backgroundTasksContext'

const ACTIVE_STATUS_SET = new Set<string>(BACKGROUND_TASK_ACTIVE_STATUSES)
const COMPLETED_STATUS_SET = new Set<string>(BACKGROUND_TASK_COMPLETED_STATUSES)
const FAILED_STATUS_SET = new Set<string>(BACKGROUND_TASK_FAILED_STATUSES)

function isActiveTask(task: BackgroundTaskPublic): boolean {
    return ACTIVE_STATUS_SET.has(task.status)
}

function taskTime(task: BackgroundTaskPublic): number {
    const stamp = parseApiTimestamp(task.updated_at || task.created_at)
    return Number.isNaN(stamp) ? 0 : stamp
}

function upsertTask(list: BackgroundTaskPublic[], task: BackgroundTaskPublic): BackgroundTaskPublic[] {
    const next = [task, ...list.filter((item) => item.task_id !== task.task_id || item.operation !== task.operation)]
    return next.sort((a, b) => taskTime(b) - taskTime(a))
}

function mergeTaskLists(lists: BackgroundTaskPublic[][]): BackgroundTaskPublic[] {
    const byKey = new Map<string, BackgroundTaskPublic>()
    for (const list of lists) {
        for (const task of list) {
            byKey.set(`${task.operation}:${task.task_id}`, task)
        }
    }
    return [...byKey.values()].sort((a, b) => taskTime(b) - taskTime(a))
}

function taskHasAnyStatus(task: BackgroundTaskPublic, statuses: Set<string>): boolean {
    return statuses.has(task.status)
}

export function BackgroundTasksProvider({ children }: { children: ReactNode }) {
    const { isAuthenticated } = useAuth()
    const { loadData } = useData()
    const [tasks, setTasks] = useState<BackgroundTaskPublic[]>([])
    const [drawerOpen, setDrawerOpen] = useState(false)
    const previousStatusesRef = useRef<Map<string, string>>(new Map())
    const refreshInFlightRef = useRef(false)

    const refreshTasks = useCallback(async () => {
        if (!isAuthenticated || refreshInFlightRef.current) return
        refreshInFlightRef.current = true
        try {
            const groups = [
                { statuses: BACKGROUND_TASK_ACTIVE_STATUSES, request: apiService.listTasks({ state: 'active', operation: 'theme_song', statuses: BACKGROUND_TASK_ACTIVE_STATUSES, limit: 20 }) },
                { statuses: BACKGROUND_TASK_COMPLETED_STATUSES, request: apiService.listTasks({ state: 'terminal', operation: 'theme_song', statuses: BACKGROUND_TASK_COMPLETED_STATUSES, limit: 20 }) },
                { statuses: BACKGROUND_TASK_FAILED_STATUSES, request: apiService.listTasks({ state: 'terminal', operation: 'theme_song', statuses: BACKGROUND_TASK_FAILED_STATUSES, limit: 20 }) },
            ]
            const results = await Promise.allSettled(groups.map((group) => group.request))
            const fulfilled = results.flatMap((result, index) => result.status === 'fulfilled' ? [{ response: result.value, statuses: groups[index].statuses }] : [])
            if (fulfilled.length === 0) return
            const refreshedStatuses = new Set(fulfilled.flatMap((item) => item.statuses))
            const nextTasks = mergeTaskLists(fulfilled.map((item) => item.response.items))
            const previous = previousStatusesRef.current
            let completedActiveTask = false
            for (const task of nextTasks) {
                const key = `${task.operation}:${task.task_id}`
                const before = previous.get(key)
                if (before && ACTIVE_STATUS_SET.has(before) && !isActiveTask(task)) {
                    completedActiveTask = true
                }
                previous.set(key, task.status)
            }
            setTasks((prev) => mergeTaskLists([nextTasks, prev.filter((task) => !taskHasAnyStatus(task, refreshedStatuses))]))
            if (completedActiveTask) {
                void loadData({ silent: true })
            }
        } catch {
            // Background task polling is non-critical; the next tick will retry.
        } finally {
            refreshInFlightRef.current = false
        }
    }, [isAuthenticated, loadData])

    const registerTask = useCallback((task: BackgroundTaskPublic) => {
        previousStatusesRef.current.set(`${task.operation}:${task.task_id}`, task.status)
        setTasks((prev) => upsertTask(prev, task))
    }, [])

    const registerThemeSongJob = useCallback(
        (job: ThemeSongJobPublic) => {
            registerTask(taskFromThemeSongJob(job))
        },
        [registerTask],
    )

    const cancelTask = useCallback(async (operation: BackgroundTaskOperation, taskId: string) => {
        const updated = await apiService.cancelTask(operation, taskId)
        registerTask(updated)
    }, [registerTask])

    useEffect(() => {
        if (!isAuthenticated) {
            previousStatusesRef.current = new Map()
            return
        }
        const timer = window.setTimeout(() => void refreshTasks(), 0)
        return () => window.clearTimeout(timer)
    }, [isAuthenticated, refreshTasks])

    const visibleTasks = useMemo(() => (isAuthenticated ? tasks : []), [isAuthenticated, tasks])
    const activeTasks = useMemo(() => visibleTasks.filter(isActiveTask), [visibleTasks])
    const taskBuckets = useMemo(
        () => ({
            active: activeTasks,
            completed: visibleTasks.filter((task) => COMPLETED_STATUS_SET.has(task.status)),
            failed: visibleTasks.filter((task) => FAILED_STATUS_SET.has(task.status)),
        }),
        [activeTasks, visibleTasks],
    )

    useEffect(() => {
        if (!isAuthenticated) return
        const interval = activeTasks.length > 0 || drawerOpen ? 4_000 : 30_000
        const id = window.setInterval(() => void refreshTasks(), interval)
        return () => window.clearInterval(id)
    }, [activeTasks.length, drawerOpen, isAuthenticated, refreshTasks])

    const value: BackgroundTasksContextValue = {
        tasks: visibleTasks,
        taskBuckets,
        activeTasks,
        activeCount: activeTasks.length,
        drawerOpen: isAuthenticated && drawerOpen,
        openDrawer: () => setDrawerOpen(true),
        closeDrawer: () => setDrawerOpen(false),
        refreshTasks,
        registerTask,
        registerThemeSongJob,
        cancelTask,
    }

    return <BackgroundTasksContext.Provider value={value}>{children}</BackgroundTasksContext.Provider>
}
