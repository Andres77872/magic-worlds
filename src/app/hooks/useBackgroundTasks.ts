import { useContext } from 'react'
import { BackgroundTasksContext } from '../providers/backgroundTasksContext'

export function useBackgroundTasks() {
    const context = useContext(BackgroundTasksContext)
    if (context === undefined) {
        throw new Error('useBackgroundTasks must be used within a BackgroundTasksProvider')
    }
    return context
}
