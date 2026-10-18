import { useLayoutEffect, useMemo, useRef } from 'react'
import { useAuth } from '@/app/hooks'
import { API_BASE_URL } from '@/infrastructure/api/baseUrl'
import { STORY_PROGRESS_MAX_DAYS } from '@/infrastructure/api/storyProgressContract'
import { accountStorageKey, apiStorageOrigin } from '@/shared/workspaceStorage'
import type { StoryWritingProgress } from '@/shared/types/storyProgress.types'
import type { StoryWorkspace } from './useStoryWorkspace'

export interface WritingProgressSource {
    key: string
    /** A year of saved writing, so a streak can span it; days are grouped in `timeZone`. */
    load: (timeZone: string, signal: AbortSignal) => Promise<StoryWritingProgress>
    /** Device-local, per-account choice to show the streak. */
    streakKey: string
}

/** Progress reads only saved account data in the novel's own workspace. */
export function useWritingProgressSource(storyId: string | null, workspace: StoryWorkspace): WritingProgressSource | null {
    const { userHash } = useAuth()
    const key = !workspace.deviceOnly && storyId && userHash && workspace.workspaceId ? JSON.stringify([API_BASE_URL, userHash, workspace.workspaceId, storyId, 'progress']) : null
    const token = useMemo(() => ({ key, workspace }), [key, workspace]), live = useRef<object | null>(token)
    useLayoutEffect(() => { live.current = token; return () => { live.current = null } }, [token])
    return useMemo(() => {
        if (!key || !storyId || !userHash) return null
        const isCurrent = () => live.current === token && workspace.isCurrent()
        return {
            key,
            streakKey: accountStorageKey('magic-worlds:novel-progress-streak', { apiOrigin: apiStorageOrigin(API_BASE_URL), userHash }),
            load: async (timeZone, signal) => {
                const api = isCurrent() ? workspace.detachedApi() : null
                if (!api) throw new Error('Progress scope changed')
                const value = await api.getStoryWritingProgress(storyId, { timeZone, days: STORY_PROGRESS_MAX_DAYS }, { signal })
                if (!isCurrent()) throw new Error('Progress scope changed')
                return value
            },
        }
    }, [key, storyId, userHash, workspace, token])
}
