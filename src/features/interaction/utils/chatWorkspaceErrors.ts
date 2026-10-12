/**
 * Workspace R1 chat failures that no retry can fix from this view: the session
 * is missing or belongs to another workspace (`CHAT_SESSION_NOT_FOUND`, the
 * socket's 4404 handshake close), its workspace was archived or removed, or
 * this build predates the workspace contract (`WORKSPACE_REQUIRED`).
 */
import type { TFunction } from 'i18next'

const CHAT_WORKSPACE_ERROR_KEYS: Record<string, string> = {
    CHAT_SESSION_NOT_FOUND: 'workspaceActivity.chat.sessionUnavailable',
    WORKSPACE_ARCHIVED: 'workspaceActivity.chat.workspaceArchived',
    WORKSPACE_NOT_FOUND: 'workspaceActivity.chat.workspaceUnavailable',
    WORKSPACE_REQUIRED: 'workspaceActivity.chat.stale',
}

/** Localized copy for a terminal workspace/session chat error, or null for any other code. */
export function chatWorkspaceErrorMessage(code: string | undefined, t: TFunction): string | null {
    const key = code ? CHAT_WORKSPACE_ERROR_KEYS[code] : undefined
    return key ? t(key) : null
}
