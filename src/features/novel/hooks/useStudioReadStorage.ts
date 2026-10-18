import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAuth } from '@/app/hooks'
import { WorkspaceContext } from '@/app/providers/workspaceContext'
import type { StoryOutline, StoryStudioSource } from '@/shared'
import { isStudioSource } from '@/shared/storyStudioState'
import { acknowledgedSceneCopy, deviceCacheScope, studioReadStorage, type ConfirmedSceneCopy, type DeviceCacheStatus } from '../persistence/studioReadStorage'
import type { StoryWorkspace } from './useStoryWorkspace'
import type { SceneConfirmation } from './useStudioScene'
import { verifyStoryStudioScene } from '@/infrastructure/api/storyStudioContract'

/** Publication is captured to the real account/workspace, never to a cached selection. */
export function useStudioReadStorage(story: StoryOutline | null, workspace: StoryWorkspace, confirmation?: SceneConfirmation | null) {
    const auth = useAuth(), context = useContext(WorkspaceContext)
    const [status, setStatus] = useState<{ owner: string; value: DeviceCacheStatus } | null>(null)
    const owner = JSON.stringify([auth.userHash, auth.accountKey, workspace.workspaceId, story?.id])
    const live = useRef({ auth, context, workspace, story, owner })
    useLayoutEffect(() => { live.current = { auth, context, workspace, story, owner } })
    const remember = useCallback((source: StoryStudioSource, value?: ConfirmedSceneCopy) => {
        const captured = live.current, selected = captured.context?.workspaces.find((item) => item.id === captured.workspace.workspaceId)
        if (!captured.auth.userHash || !captured.auth.isAuthenticated || !captured.workspace.isCurrent() || captured.workspace.deviceOnly || !selected || source.id !== captured.story?.id) return
        const current = () => live.current.owner === captured.owner && live.current.auth.isAuthenticated && captured.workspace.isCurrent()
        void studioReadStorage.remember(deviceCacheScope(captured.auth.userHash), {
            id: selected.id, name: selected.name, isDefault: selected.is_default, archived: selected.archived_at !== null, rowVersion: selected.row_version,
        }, source, value, current).then((result) => { if (current()) setStatus({ owner: captured.owner, value: result.status }) })
    }, [])
    useEffect(() => {
        if (!story || !isStudioSource(story)) return
        const head = story.chapters.flatMap((chapter) => chapter.scenes).find((scene) => scene.id === confirmation?.scene.id)
        const read = confirmation?.read
        const copy = read && head && verifyStoryStudioScene(read, story, head) ? read
            : confirmation?.scene.storyId === story.id ? acknowledgedSceneCopy(confirmation.scene) ?? undefined : undefined
        remember(story, copy)
    }, [story, confirmation, remember, context?.workspaces])
    return { remember, status: status?.owner === owner ? status.value : null }
}
