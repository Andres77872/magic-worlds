import { useFeatureFlags } from '@/shared/hooks/useFeatureFlags'
import { isTaskFeatureEnabled } from '@/shared/featureFlags'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { apiService } from '@/infrastructure/api'
import { TASK_REQUEST_STARTED, TASK_REQUEST_FINISHED, type TaskRequestEvent } from '@/infrastructure/api/resourceTaskEvents'
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
import { isPageFocused, usePageFocus } from '../hooks/usePageFocus'
import { useWorkspace } from '../hooks/useWorkspace'
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

/** The workspace a job was submitted in (Workspace R1: its durable origin). */
function taskWorkspaceId(task: BackgroundTaskPublic): string | null {
    return task.organization?.workspace_id ?? null
}

/** Stamps the workspace a task was read or submitted in when the server omitted its origin. */
function withOrigin(task: BackgroundTaskPublic, workspaceId: string | null | undefined): BackgroundTaskPublic {
    if (task.organization?.workspace_id || !workspaceId) return task
    return { ...task, organization: { workspace_id: workspaceId } }
}

interface TaskNotice {
    tone: ToastTone
    title: string
    message?: string
}

/**
 * Background media jobs (theme songs today). Workspace R1: the task lists are
 * workspace-scoped, so the drawer shows the selected workspace's tasks plus
 * still-running tasks of other workspaces (each polled in the workspace it was
 * submitted in, with an origin label). Those keep finishing after a switch;
 * their completion updates only this account-wide list, never the selected
 * workspace's library data.
 */
export function BackgroundTasksProvider({ children }: { children: ReactNode }) {
    const featureFlagGeneration = useFeatureFlags().generation
    const { t } = useTranslation()
    const pageFocused = usePageFocus()
    const { isAuthenticated, authEpoch = Number(isAuthenticated), accountKey = 'legacy' } = useAuth()
    const { status: workspaceStatus, selectedWorkspaceId, workspaceEpoch } = useWorkspace()
    const workspaceReady = workspaceStatus === 'ready' && selectedWorkspaceId !== null
    const { loadData } = useData()
    const [tasks, setTasks] = useState<BackgroundTaskPublic[]>([])
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [taskNotice, setTaskNotice] = useState<TaskNotice | null>(null)
    const [terminalPages, setTerminalPages] = useState<Record<'completed' | 'failed', number>>({ completed: 1, failed: 1 })
    const [terminalHasMore, setTerminalHasMore] = useState<Record<'completed' | 'failed', boolean>>({ completed: false, failed: false })
    const previousStatusesRef = useRef<Map<string, string>>(new Map())
    const refreshInFlightRef = useRef(false)
    const catchUpAfterFlightRef = useRef(false)
    const [catchUpTick, setCatchUpTick] = useState(0)
    const [resourceRequests, setResourceRequests] = useState<{ owner: string; ids: Set<string> }>({ owner: '', ids: new Set() })
    const resourceRequestOwner = `${authEpoch}/${accountKey}`
    const resourceRequestCount = resourceRequests.owner === resourceRequestOwner ? resourceRequests.ids.size : 0
    // Read inside refreshTasks (long-lived poll) without churning its identity.
    // `loadData` is a fresh closure on every DataProvider render; depending on it
    // directly made refreshTasks unstable, which restarted both poll effects (and
    // fired an extra immediate listTasks) on every unrelated data change.
    const loadDataRef = useRef(loadData)
    const drawerOpenRef = useRef(drawerOpen)
    const tasksRef = useRef(tasks)
    const authOwnerRef = useRef({ authEpoch, accountKey, workspaceId: selectedWorkspaceId, workspaceEpoch })
    authOwnerRef.current = { authEpoch, accountKey, workspaceId: selectedWorkspaceId, workspaceEpoch }
    useEffect(() => {
        loadDataRef.current = loadData
    }, [loadData])
    useEffect(() => {
        tasksRef.current = tasks
    }, [tasks])
    useEffect(() => {
        drawerOpenRef.current = drawerOpen
    }, [drawerOpen])

    const refreshTasks = useCallback(async (automatic = false) => {
        if (!isAuthenticated || !workspaceReady || !selectedWorkspaceId || (automatic && !isPageFocused()) || refreshInFlightRef.current) return
        refreshInFlightRef.current = true
        try {
            const owner = { authEpoch, accountKey, workspaceId: selectedWorkspaceId, workspaceEpoch }
            // The selected workspace's lists; other workspaces' running tasks are read below.
            const api = apiService.withWorkspace(owner.workspaceId)
            let focusLost = false
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
                    if (automatic && !isPageFocused()) {
                        focusLost = true
                        throw new Error('Background poll paused')
                    }
                    const response = await api.listTasks({
                        state,
                        operation: 'all',
                        statuses,
                        limit: TASK_PAGE_SIZE,
                        offset,
                    })
                    const fresh = response.items.map((task) => withOrigin(task, owner.workspaceId)).filter((task) => {
                        const key = taskKey(task)
                        if (seen.has(key)) return false
                        seen.add(key)
                        return true
                    })
                    items.push(...fresh)
                    page += 1
                    hasMore = response.next_offset != null
                    if (!hasMore || response.next_offset! <= offset) break
                    offset = response.next_offset!
                }
                return { items, hasMore }
            }
            const groups = [
                { bucket: 'active' as const, statuses: BACKGROUND_TASK_ACTIVE_STATUSES, request: fetchPages('active', BACKGROUND_TASK_ACTIVE_STATUSES) },
                { bucket: 'completed' as const, statuses: BACKGROUND_TASK_COMPLETED_STATUSES, request: fetchPages('terminal', BACKGROUND_TASK_COMPLETED_STATUSES, terminalPages.completed) },
                { bucket: 'failed' as const, statuses: BACKGROUND_TASK_FAILED_STATUSES, request: fetchPages('terminal', BACKGROUND_TASK_FAILED_STATUSES, terminalPages.failed) },
            ]
            // Running tasks of other workspaces keep finishing: poll each where it was submitted.
            const foreignActive = tasksRef.current.filter((task) => {
                const origin = taskWorkspaceId(task)
                return isTaskFeatureEnabled(task) && isActiveTask(task) && origin !== null && origin !== owner.workspaceId
            })
            const foreignRequest = Promise.allSettled(foreignActive.map(async (task) => {
                const origin = taskWorkspaceId(task)!
                return withOrigin(await apiService.withWorkspace(origin).getTask(task.operation, task.task_id), origin)
            }))
            const [results, foreignResults] = await Promise.all([
                Promise.allSettled(groups.map((group) => group.request)),
                foreignRequest,
            ])
            if (automatic && (focusLost || !isPageFocused())) return
            const live = authOwnerRef.current
            if (live.authEpoch !== owner.authEpoch || live.accountKey !== owner.accountKey) return
            // A switch while reading: these lists describe the previous selection; the
            // next poll reads the new workspace (and keeps tracking running tasks).
            if (live.workspaceEpoch !== owner.workspaceEpoch || live.workspaceId !== owner.workspaceId) return
            const fulfilled = results.flatMap((result, index) => result.status === 'fulfilled'
                ? [{ response: result.value, statuses: groups[index].statuses, bucket: groups[index].bucket }]
                : [])
            const foreignTasks = foreignResults.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
            if (fulfilled.length === 0 && foreignTasks.length === 0) return
            setTerminalHasMore((current) => {
                const next = { ...current }
                for (const result of fulfilled) {
                    if (result.bucket !== 'active') next[result.bucket] = result.response.hasMore
                }
                return next.completed === current.completed && next.failed === current.failed ? current : next
            })
            const refreshedStatuses = new Set(fulfilled.flatMap((item) => item.statuses))
            const nextTasks = mergeTaskLists([...fulfilled.map((item) => item.response.items), foreignTasks]).filter(isTaskFeatureEnabled)
            const replaced = new Set(nextTasks.map(taskKey))
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
                    // Only the selected workspace's library reloads for a finished job.
                    if (taskWorkspaceId(task) === owner.workspaceId) completedActiveTask = true
                    // A cancel is user-initiated — announcing it back is noise.
                    if (task.status !== 'canceled') transitioned.push(task)
                }
                previous.set(key, task.status)
            }
            setTasks((prev) => mergeTaskLists([nextTasks, prev.filter((task) => !replaced.has(taskKey(task))
                && !(taskWorkspaceId(task) === owner.workspaceId && taskHasAnyStatus(task, refreshedStatuses)))]))
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
            if (catchUpAfterFlightRef.current) {
                catchUpAfterFlightRef.current = false
                if (isPageFocused()) setCatchUpTick((tick) => tick + 1)
            }
        }
    }, [accountKey, authEpoch, isAuthenticated, selectedWorkspaceId, t, terminalPages, workspaceEpoch, workspaceReady, featureFlagGeneration])

    const loadMoreTerminalTasks = useCallback(async (bucket: 'completed' | 'failed') => {
        if (!terminalHasMore[bucket]) return
        setTerminalPages((current) => ({ ...current, [bucket]: current[bucket] + 1 }))
    }, [terminalHasMore])

    /**
     * Track a task. Its origin is the server's `organization`, else `workspaceId`
     * (the workspace the job was submitted in), else the selected workspace.
     */
    const registerTask = useCallback((task: BackgroundTaskPublic, workspaceId?: string | null) => {
        if (!isTaskFeatureEnabled(task)) return
        const tracked = withOrigin(task, workspaceId ?? authOwnerRef.current.workspaceId)
        previousStatusesRef.current.set(taskKey(tracked), tracked.status)
        setTasks((prev) => upsertTask(prev, tracked))
    }, [featureFlagGeneration])

    const registerThemeSongJob = useCallback(
        (job: ThemeSongJobPublic, workspaceId?: string | null) => {
            const task = taskFromThemeSongJob(job)
            registerTask(job.organization ? { ...task, organization: job.organization } : task, workspaceId)
        },
        [registerTask],
    )

    /** Read one task in its own workspace (e.g. from a notification) and show it in the list. */
    const trackTask = useCallback(async (operation: BackgroundTaskOperation, taskId: string, workspaceId: string) => {
        const owner = authOwnerRef.current
        const task = await apiService.withWorkspace(workspaceId).getTask(operation, taskId)
        if (authOwnerRef.current.authEpoch !== owner.authEpoch || authOwnerRef.current.accountKey !== owner.accountKey) return
        registerTask(task, workspaceId)
    }, [registerTask])

    const cancelTask = useCallback(async (operation: BackgroundTaskOperation, taskId: string) => {
        const task = tasksRef.current.find((item) => item.operation === operation && item.task_id === taskId)
        const origin = (task && taskWorkspaceId(task)) ?? authOwnerRef.current.workspaceId
        if (!origin) throw new Error('The task’s workspace is unavailable.')
        // Cancelling controls an admitted job, so it goes to the job's own workspace.
        const updated = await apiService.withWorkspace(origin).cancelTask(operation, taskId)
        registerTask(updated, origin)
    }, [registerTask])

    /**
     * Persistently archive the available server bucket of the selected workspace
     * (including pages not loaded in the drawer) plus the listed tasks of other
     * workspaces in that bucket, each in its own workspace.
     */
    const clearTerminalTasks = useCallback(async (bucket: 'completed' | 'failed') => {
        const statuses = bucket === 'completed' ? COMPLETED_STATUS_SET : FAILED_STATUS_SET
        const archived = new Set<string>()
        const attempted = new Set<string>()
        let failed = false
        const current = authOwnerRef.current.workspaceId
        if (!current) throw new Error('No workspace is selected.')
        const api = apiService.withWorkspace(current)
        const foreign = tasksRef.current.filter((task) => isTaskFeatureEnabled(task) && statuses.has(task.status) && taskWorkspaceId(task) !== null && taskWorkspaceId(task) !== current)
        const foreignResults = await Promise.allSettled(foreign.map((task) => apiService.withWorkspace(taskWorkspaceId(task)!).archiveTask(task.operation, task.task_id)))
        foreign.forEach((task, index) => {
            if (foreignResults[index].status === 'fulfilled') archived.add(taskKey(task))
            else failed = true
        })
        let offset = 0
        while (true) {
            const response = await api.listTasks({
                state: 'terminal',
                operation: 'all',
                statuses: [...statuses] as BackgroundTaskPublic['status'][],
                limit: TASK_PAGE_SIZE,
                offset,
            })
            const availableItems = response.items.filter(isTaskFeatureEnabled)
            if (availableItems.length === 0) {
                if (response.next_offset == null || response.next_offset <= offset) break
                offset = response.next_offset
                continue
            }
            const freshItems = availableItems.filter((task) => !attempted.has(taskKey(task)))
            if (freshItems.length === 0) {
                failed = true
                break
            }
            freshItems.forEach((task) => attempted.add(taskKey(task)))
            const results = await Promise.allSettled(freshItems.map((task) => api.archiveTask(task.operation, task.task_id)))
            freshItems.forEach((task, index) => {
                if (results[index].status === 'fulfilled') archived.add(taskKey(task))
                else failed = true
            })
            if (failed) break
            // Archiving changes raw offsets; restart while retaining hidden jobs.
            offset = 0
        }
        setTasks((current) => current.filter((task) => !archived.has(taskKey(task))))
        for (const key of archived) previousStatusesRef.current.delete(key)
        setTerminalPages((current) => ({ ...current, [bucket]: 1 }))
        setTerminalHasMore((current) => ({ ...current, [bucket]: false }))
        if (failed) throw new Error('One or more background tasks could not be archived.')
    }, [featureFlagGeneration])

    useEffect(() => {
        const receive = (event: Event) => {
            const detail = (event as CustomEvent<TaskRequestEvent>).detail
            const owner = authOwnerRef.current
            if (!detail || detail.authEpoch !== owner.authEpoch || detail.accountKey !== owner.accountKey) return
            setResourceRequests((current) => {
                const key = `${owner.authEpoch}/${owner.accountKey}`
                const next = new Set(current.owner === key ? current.ids : [])
                if (event.type === TASK_REQUEST_STARTED) next.add(detail.id)
                else next.delete(detail.id)
                return { owner: key, ids: next }
            })
            if (refreshInFlightRef.current) catchUpAfterFlightRef.current = true
            else void refreshTasks()
        }
        window.addEventListener(TASK_REQUEST_STARTED, receive)
        window.addEventListener(TASK_REQUEST_FINISHED, receive)
        return () => {
            window.removeEventListener(TASK_REQUEST_STARTED, receive)
            window.removeEventListener(TASK_REQUEST_FINISHED, receive)
        }
    }, [refreshTasks])

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

    // A committed switch: keep other workspaces' running tasks (they keep finishing
    // and stay labeled with their origin); the new workspace's lists load next.
    const [tasksEpoch, setTasksEpoch] = useState(workspaceEpoch)
    if (tasksEpoch !== workspaceEpoch) {
        setTasksEpoch(workspaceEpoch)
        setTasks((prev) => prev.filter(isActiveTask))
        setTerminalPages({ completed: 1, failed: 1 })
        setTerminalHasMore({ completed: false, failed: false })
    }

    useEffect(() => {
        if (!isAuthenticated || !pageFocused) return
        const timer = window.setTimeout(() => {
            if (!isPageFocused()) return
            if (refreshInFlightRef.current) catchUpAfterFlightRef.current = true
            else void refreshTasks(true)
        }, 0)
        return () => window.clearTimeout(timer)
    }, [catchUpTick, isAuthenticated, pageFocused, refreshTasks])

    const visibleTasks = useMemo(() => (isAuthenticated ? tasks.filter(isTaskFeatureEnabled) : []), [isAuthenticated, tasks, featureFlagGeneration])
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
        if (!isAuthenticated || !pageFocused || (activeTasks.length === 0 && resourceRequestCount === 0 && !drawerOpen)) return
        const id = window.setInterval(() => {
            if (isPageFocused()) void refreshTasks(true)
        }, 4_000)
        return () => window.clearInterval(id)
    }, [activeTasks.length, resourceRequestCount, drawerOpen, isAuthenticated, pageFocused, refreshTasks])

    const value: BackgroundTasksContextValue = {
        tasks: visibleTasks,
        taskBuckets,
        activeTasks,
        activeCount: activeTasks.length,
        drawerOpen: isAuthenticated && drawerOpen,
        openDrawer: () => {
            setDrawerOpen(true)
            if (pageFocused) void refreshTasks()
        },
        closeDrawer: () => setDrawerOpen(false),
        refreshTasks,
        registerTask,
        registerThemeSongJob,
        trackTask,
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
