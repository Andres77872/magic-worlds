import { authSession } from './authSession'
import { makeRequestId } from '@/utils/uuid'

export const TASK_REQUEST_STARTED = 'tasks:request-started'
export const TASK_REQUEST_FINISHED = 'tasks:request-finished'

export interface TaskRequestEvent {
    id: string
    authEpoch: number
    accountKey: string
    /**
     * Workspace R1: the workspace the request ran in (its scoped client's), so a
     * listener showing another workspace ignores it. `null` when unknown.
     */
    workspaceId: string | null
}

/** A persisted media job was submitted or finished through the chat socket (of `workspaceId`). */
export function notifyTaskHistoryChanged(workspaceId: string | null = null): void {
    const { authEpoch, accountKey } = authSession.getSnapshot()
    const detail: TaskRequestEvent = { id: makeRequestId('task-event'), authEpoch, accountKey, workspaceId }
    window.dispatchEvent(new CustomEvent(TASK_REQUEST_FINISHED, { detail }))
}

/**
 * Keep Tasks polling while an owned resource request is executing on the server.
 * `workspaceId` is the workspace the request was sent to (the scoped client's).
 */
export async function trackResourceTaskRequest<T>(request: () => Promise<T>, workspaceId: string | null = null): Promise<T> {
    const { authEpoch, accountKey } = authSession.getSnapshot()
    const detail: TaskRequestEvent = { id: makeRequestId('task-request'), authEpoch, accountKey, workspaceId }
    window.dispatchEvent(new CustomEvent(TASK_REQUEST_STARTED, { detail }))
    try {
        return await request()
    } finally {
        window.dispatchEvent(new CustomEvent(TASK_REQUEST_FINISHED, { detail }))
    }
}
