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
    registerTask: (task: BackgroundTaskPublic) => void
    registerThemeSongJob: (job: ThemeSongJobPublic) => void
    cancelTask: (operation: BackgroundTaskOperation, taskId: string) => Promise<void>
}

export const BackgroundTasksContext = createContext<BackgroundTasksContextValue | undefined>(undefined)
