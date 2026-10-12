/**
 * useStoryWorkspace — the workspace the open story belongs to (Workspace R1),
 * captured once per opened story id: the story's own organization, else the
 * workspace that was committed when it was opened.
 *
 * Story writes go through DataProvider, which targets the committed workspace —
 * correct while `isCurrent()`. Work that outlives a workspace switch (the
 * draft's unmount tail save, a pending retry) uses `detachedApi()` instead, so
 * it still lands in the story's own workspace and never in the new one.
 */

import { useCallback, useMemo, useState } from 'react'
import { useWorkspace, type WorkspaceScopeCapture } from '@/app/hooks/useWorkspace'
import { apiService, type ApiService } from '@/infrastructure/api'
import type { Story } from '@/shared'
import { organizationWorkspaceId } from '@/shared/hooks/useScopedApi'

export interface StoryWorkspace {
    /** The open story's workspace; `null` before a story was opened. */
    workspaceId: string | null
    /**
     * Whether the committed workspace is still the one the story was opened in.
     * A same-account re-login keeps it current (the studio deliberately stays
     * mounted through a session expiry); a switch or another account does not.
     */
    isCurrent: () => boolean
    /**
     * The story workspace's own client for a write that outlived a switch, or
     * `null` when the account changed (or nothing was opened). Such a write must
     * not touch UI or cache state.
     */
    detachedApi: () => ApiService | null
}

interface OpenedStory {
    storyId: string
    workspaceId: string | null
    scope: WorkspaceScopeCapture | null
}

export function useStoryWorkspace(story: Story | null): StoryWorkspace {
    const { selectedWorkspaceId, capture } = useWorkspace()
    const storyId = story?.id ?? null
    const [opened, setOpened] = useState<OpenedStory | null>(null)

    // Captured once per opened story id. A story that goes away (a committed
    // switch resets it) keeps the last capture, so late writes still know where
    // they belong.
    let current = opened
    if (storyId && opened?.storyId !== storyId) {
        current = { storyId, workspaceId: organizationWorkspaceId(story) ?? selectedWorkspaceId, scope: capture() }
        setOpened(current)
    }
    const workspaceId = current?.workspaceId ?? null
    const scope = current?.scope ?? null

    const isCurrent = useCallback(() => {
        const live = capture()
        return Boolean(live && scope
            && live.accountKey === scope.accountKey
            && live.workspaceId === scope.workspaceId
            && live.workspaceEpoch === scope.workspaceEpoch)
    }, [capture, scope])

    const detachedApi = useCallback((): ApiService | null => {
        if (!workspaceId || !scope) return null
        return capture()?.accountKey === scope.accountKey ? apiService.withWorkspace(workspaceId) : null
    }, [capture, scope, workspaceId])

    return useMemo(() => ({ workspaceId, isCurrent, detachedApi }), [detachedApi, isCurrent, workspaceId])
}
