import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { apiService } from '@/infrastructure/api'
import type { BackgroundTaskOperation, BackgroundTaskPublic, ThemeSongJobPublic } from '@/shared'
import {
    BACKGROUND_TASK_ACTIVE_STATUSES,
    BACKGROUND_TASK_COMPLETED_STATUSES,
    BACKGROUND_TASK_FAILED_STATUSES,
    taskFromThemeSongJob,
} from '@/shared'
import { Toast, type ToastTone } from '@/ui/primitives'
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

function taskKey(task: BackgroundTaskPublic): string {
    return `${task.operation}:${task.task_id}`
}

// "Clear completed" is client-side only — the backend has no task delete/archive
// endpoint (DELETE cancels). Dismissed keys persist so cleared tasks stay hidden
// after the next poll returns them.
const DISMISSED_TASKS_STORAGE_KEY = 'magic-worlds-tasks-dismissed'
const DISMISSED_TASKS_CAP = 200

function readDismissedKeys(): Set<string> {
    try {
        const raw = localStorage.getItem(DISMISSED_TASKS_STORAGE_KEY)
        if (!raw) return new Set()
        const parsed: unknown = JSON.parse(raw)
        return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [])
    } catch {
        return new Set()
    }
}

function persistDismissedKeys(keys: Set<string>) {
    try {
        localStorage.setItem(DISMISSED_TASKS_STORAGE_KEY, JSON.stringify([...keys].slice(-DISMISSED_TASKS_CAP)))
    } catch {
        // Storage unavailable — the tasks stay hidden for this session only.
    }
}

interface TaskNotice {
    tone: ToastTone
    title: string
    message?: string
}

export function BackgroundTasksProvider({ children }: { children: ReactNode }) {
    const { t } = useTranslation()
    const { isAuthenticated } = useAuth()
    const { loadData } = useData()
    const [tasks, setTasks] = useState<BackgroundTaskPublic[]>([])
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(readDismissedKeys)
    const [taskNotice, setTaskNotice] = useState<TaskNotice | null>(null)
    const previousStatusesRef = useRef<Map<string, string>>(new Map())
    const refreshInFlightRef = useRef(false)
    // Read inside refreshTasks (long-lived poll) without churning its identity.
    const drawerOpenRef = useRef(drawerOpen)
    useEffect(() => {
        drawerOpenRef.current = drawerOpen
    }, [drawerOpen])

    useEffect(() => {
        persistDismissedKeys(dismissedKeys)
    }, [dismissedKeys])

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
            // Tasks that finished (success or failure) since the previous poll.
            // A missing `before` means this is the first poll after login — those
            // are old news and must not toast.
            const transitioned: BackgroundTaskPublic[] = []
            for (const task of nextTasks) {
                const key = taskKey(task)
                const before = previous.get(key)
                if (before && ACTIVE_STATUS_SET.has(before) && !isActiveTask(task)) {
                    completedActiveTask = true
                    // A cancel is user-initiated — announcing it back is noise.
                    if (task.status !== 'canceled') transitioned.push(task)
                }
                previous.set(key, task.status)
            }
            setTasks((prev) => mergeTaskLists([nextTasks, prev.filter((task) => !taskHasAnyStatus(task, refreshedStatuses))]))
            if (completedActiveTask) {
                void loadData({ silent: true })
            }
            // Announce finished work unless the user is already watching the drawer.
            if (transitioned.length > 0 && !drawerOpenRef.current) {
                const failedCount = transitioned.filter((task) => FAILED_STATUS_SET.has(task.status)).length
                if (transitioned.length === 1) {
                    const task = transitioned[0]
                    const failed = FAILED_STATUS_SET.has(task.status)
                    setTaskNotice({
                        tone: failed ? 'error' : 'success',
                        title: failed ? t('tasksDrawer.toast.failedTitle') : t('tasksDrawer.toast.completedTitle'),
                        message: task.result?.lyrics?.song_title || t('tasksDrawer.fallback.themeSong'),
                    })
                } else {
                    setTaskNotice({
                        tone: failedCount > 0 ? 'error' : 'success',
                        title: t('tasksDrawer.toast.multiple', { count: transitioned.length }),
                    })
                }
            }
        } catch {
            // Background task polling is non-critical; the next tick will retry.
        } finally {
            refreshInFlightRef.current = false
        }
    }, [isAuthenticated, loadData, t])

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

    /** Hide every task currently in the given terminal bucket. */
    const clearTerminalTasks = useCallback((bucket: 'completed' | 'failed') => {
        const statuses = bucket === 'completed' ? COMPLETED_STATUS_SET : FAILED_STATUS_SET
        setDismissedKeys((prev) => {
            const next = new Set(prev)
            for (const task of tasks) {
                if (statuses.has(task.status)) next.add(taskKey(task))
            }
            return next
        })
    }, [tasks])

    useEffect(() => {
        if (!isAuthenticated) {
            previousStatusesRef.current = new Map()
            return
        }
        const timer = window.setTimeout(() => void refreshTasks(), 0)
        return () => window.clearTimeout(timer)
    }, [isAuthenticated, refreshTasks])

    // Hide tasks the user cleared from the panel (client-side dismiss).
    const visibleTasks = useMemo(
        () => (isAuthenticated ? tasks.filter((task) => !dismissedKeys.has(taskKey(task))) : []),
        [dismissedKeys, isAuthenticated, tasks],
    )
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
        clearTerminalTasks,
    }

    return (
        <BackgroundTasksContext.Provider value={value}>
            {children}
            <Toast
                open={taskNotice !== null}
                tone={taskNotice?.tone ?? 'success'}
                title={taskNotice?.title ?? ''}
                message={taskNotice?.message}
                onClose={() => setTaskNotice(null)}
                autoCloseMs={6000}
                action={{
                    label: t('tasksDrawer.toast.open'),
                    onClick: () => {
                        setTaskNotice(null)
                        setDrawerOpen(true)
                    },
                }}
            />
        </BackgroundTasksContext.Provider>
    )
}
