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
const TASK_PAGE_SIZE = 20

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

interface TaskNotice {
    tone: ToastTone
    title: string
    message?: string
}

export function BackgroundTasksProvider({ children }: { children: ReactNode }) {
    const { t } = useTranslation()
    const { isAuthenticated, authEpoch = Number(isAuthenticated), accountKey = 'legacy' } = useAuth()
    const { loadData } = useData()
    const [tasks, setTasks] = useState<BackgroundTaskPublic[]>([])
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [taskNotice, setTaskNotice] = useState<TaskNotice | null>(null)
    const [terminalPages, setTerminalPages] = useState<Record<'completed' | 'failed', number>>({ completed: 1, failed: 1 })
    const [terminalHasMore, setTerminalHasMore] = useState<Record<'completed' | 'failed', boolean>>({ completed: false, failed: false })
    const previousStatusesRef = useRef<Map<string, string>>(new Map())
    const refreshInFlightRef = useRef(false)
    // Read inside refreshTasks (long-lived poll) without churning its identity.
    // `loadData` is a fresh closure on every DataProvider render; depending on it
    // directly made refreshTasks unstable, which restarted both poll effects (and
    // fired an extra immediate listTasks) on every unrelated data change.
    const loadDataRef = useRef(loadData)
    const drawerOpenRef = useRef(drawerOpen)
    const authOwnerRef = useRef({ authEpoch, accountKey })
    authOwnerRef.current = { authEpoch, accountKey }
    useEffect(() => {
        loadDataRef.current = loadData
    }, [loadData])
    useEffect(() => {
        drawerOpenRef.current = drawerOpen
    }, [drawerOpen])

    const refreshTasks = useCallback(async () => {
        if (!isAuthenticated || refreshInFlightRef.current) return
        refreshInFlightRef.current = true
        try {
            const owner = { authEpoch, accountKey }
            const fetchPages = async (
                state: 'active' | 'terminal',
                statuses: BackgroundTaskPublic['status'][],
                pages?: number,
            ) => {
                const items: BackgroundTaskPublic[] = []
                const seen = new Set<string>()
                let offset = 0
                let page = 0
                let hasMore = false
                while (pages === undefined || page < pages) {
                    const response = await apiService.listTasks({
                        state,
                        operation: 'theme_song',
                        statuses,
                        limit: TASK_PAGE_SIZE,
                        offset,
                    })
                    const fresh = response.items.filter((task) => {
                        const key = taskKey(task)
                        if (seen.has(key)) return false
                        seen.add(key)
                        return true
                    })
                    items.push(...fresh)
                    page += 1
                    hasMore = response.next_offset != null
                    if (!hasMore || response.items.length === 0 || fresh.length === 0) break
                    offset = response.next_offset!
                }
                return { items, hasMore }
            }
            const groups = [
                { bucket: 'active' as const, statuses: BACKGROUND_TASK_ACTIVE_STATUSES, request: fetchPages('active', BACKGROUND_TASK_ACTIVE_STATUSES) },
                { bucket: 'completed' as const, statuses: BACKGROUND_TASK_COMPLETED_STATUSES, request: fetchPages('terminal', BACKGROUND_TASK_COMPLETED_STATUSES, terminalPages.completed) },
                { bucket: 'failed' as const, statuses: BACKGROUND_TASK_FAILED_STATUSES, request: fetchPages('terminal', BACKGROUND_TASK_FAILED_STATUSES, terminalPages.failed) },
            ]
            const results = await Promise.allSettled(groups.map((group) => group.request))
            if (authOwnerRef.current.authEpoch !== owner.authEpoch || authOwnerRef.current.accountKey !== owner.accountKey) return
            const fulfilled = results.flatMap((result, index) => result.status === 'fulfilled'
                ? [{ response: result.value, statuses: groups[index].statuses, bucket: groups[index].bucket }]
                : [])
            if (fulfilled.length === 0) return
            setTerminalHasMore((current) => {
                const next = { ...current }
                for (const result of fulfilled) {
                    if (result.bucket !== 'active') next[result.bucket] = result.response.hasMore
                }
                return next
            })
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
                void loadDataRef.current({ silent: true })
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
                        message: task.title || task.target.display_name || t('tasksDrawer.fallback.themeSong'),
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
    }, [accountKey, authEpoch, isAuthenticated, t, terminalPages])

    const loadMoreTerminalTasks = useCallback(async (bucket: 'completed' | 'failed') => {
        if (!terminalHasMore[bucket]) return
        setTerminalPages((current) => ({ ...current, [bucket]: current[bucket] + 1 }))
    }, [terminalHasMore])

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

    /** Persistently archive the entire server bucket, including pages not loaded in the drawer. */
    const clearTerminalTasks = useCallback(async (bucket: 'completed' | 'failed') => {
        const statuses = bucket === 'completed' ? COMPLETED_STATUS_SET : FAILED_STATUS_SET
        const archived = new Set<string>()
        const attempted = new Set<string>()
        let failed = false
        while (true) {
            const response = await apiService.listTasks({
                state: 'terminal',
                operation: 'theme_song',
                statuses: [...statuses] as BackgroundTaskPublic['status'][],
                limit: TASK_PAGE_SIZE,
                offset: 0,
            })
            if (response.items.length === 0) break
            const freshItems = response.items.filter((task) => !attempted.has(taskKey(task)))
            if (freshItems.length === 0) {
                failed = true
                break
            }
            freshItems.forEach((task) => attempted.add(taskKey(task)))
            const results = await Promise.allSettled(freshItems.map((task) => apiService.archiveTask(task.operation, task.task_id)))
            freshItems.forEach((task, index) => {
                if (results[index].status === 'fulfilled') archived.add(taskKey(task))
                else failed = true
            })
            if (failed) break
        }
        setTasks((current) => current.filter((task) => !archived.has(taskKey(task))))
        for (const key of archived) previousStatusesRef.current.delete(key)
        setTerminalPages((current) => ({ ...current, [bucket]: 1 }))
        setTerminalHasMore((current) => ({ ...current, [bucket]: false }))
        if (failed) throw new Error('One or more background tasks could not be archived.')
    }, [])

    // Reset on logout. Keyed on auth alone so these writes cannot feed back into
    // refreshTasks' identity and re-arm this effect (terminalPages is a dep of
    // refreshTasks, which the poll effect below depends on).
    useEffect(() => {
        if (isAuthenticated) return
        previousStatusesRef.current = new Map()
        setTasks([])
        setTerminalPages({ completed: 1, failed: 1 })
        setTerminalHasMore({ completed: false, failed: false })
    }, [isAuthenticated])

    useEffect(() => {
        if (!isAuthenticated) return
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
        clearTerminalTasks,
        terminalHasMore,
        loadMoreTerminalTasks,
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
