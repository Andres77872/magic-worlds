import { authSession } from './authSession'
import { makeRequestId } from '@/utils/uuid'

export const TASK_REQUEST_STARTED = 'tasks:request-started'
export const TASK_REQUEST_FINISHED = 'tasks:request-finished'

export interface TaskRequestEvent {
    id: string
    authEpoch: number
    accountKey: string
}

/** A persisted media job was submitted or finished through the chat socket. */
export function notifyTaskHistoryChanged(): void {
    const { authEpoch, accountKey } = authSession.getSnapshot()
    const detail: TaskRequestEvent = { id: makeRequestId('task-event'), authEpoch, accountKey }
    window.dispatchEvent(new CustomEvent(TASK_REQUEST_FINISHED, { detail }))
}

/** Keep Tasks polling while an owned resource request is executing on the server. */
export async function trackResourceTaskRequest<T>(request: () => Promise<T>): Promise<T> {
    const { authEpoch, accountKey } = authSession.getSnapshot()
    const detail: TaskRequestEvent = { id: makeRequestId('task-request'), authEpoch, accountKey }
    window.dispatchEvent(new CustomEvent(TASK_REQUEST_STARTED, { detail }))
    try {
        return await request()
    } finally {
        window.dispatchEvent(new CustomEvent(TASK_REQUEST_FINISHED, { detail }))
    }
}
