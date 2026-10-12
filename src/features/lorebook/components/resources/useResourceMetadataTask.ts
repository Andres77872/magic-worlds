import { useContext } from 'react'
import { BackgroundTasksContext } from '@/app/providers/backgroundTasksContext'

export function useResourceMetadataTask(resourceId: string): boolean {
    const tasks = useContext(BackgroundTasksContext)
    return Boolean(tasks?.activeTasks.some((task) => task.operation === 'lorebook_extraction'
        && task.target.type === 'resource' && task.target.id === resourceId))
}
