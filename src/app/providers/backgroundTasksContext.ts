import { createContext } from 'react'
import type { BackgroundTaskBuckets, BackgroundTaskOperation, BackgroundTaskPublic, ThemeSongJobPublic } from '@/shared'

export interface BackgroundTasksContextValue {
    tasks: BackgroundTaskPublic[]
    taskBuckets: BackgroundTaskBuckets
    activeTasks: BackgroundTaskPublic[]
    activeCount: number
    drawerOpen: boolean
    openDrawer: () => void
    closeDrawer: () => void
    refreshTasks: () => Promise<void>
    /**
     * Track a submitted job. Workspace R1: pass the workspace it was submitted in
     * when the response carries no `organization` (defaults to the selected one).
     */
    registerTask: (task: BackgroundTaskPublic, workspaceId?: string | null) => void
    registerThemeSongJob: (job: ThemeSongJobPublic, workspaceId?: string | null) => void
    /** Read a task in its own workspace and list it (notifications' View status). */
    trackTask?: (operation: BackgroundTaskOperation, taskId: string, workspaceId: string) => Promise<void>
    /** Cancels in the task's own workspace. */
    cancelTask: (operation: BackgroundTaskOperation, taskId: string) => Promise<void>
    /** Archive all tasks currently in a terminal bucket on the server. */
    clearTerminalTasks: (bucket: 'completed' | 'failed') => Promise<void>
    terminalHasMore: Record<'completed' | 'failed', boolean>
    loadMoreTerminalTasks: (bucket: 'completed' | 'failed') => Promise<void>
}

export const BackgroundTasksContext = createContext<BackgroundTasksContextValue | undefined>(undefined)
