import { useLayoutEffect, useMemo, useRef } from 'react'
import { useAuth } from '@/app/hooks'
import { API_BASE_URL } from '@/infrastructure/api/baseUrl'
import type { StoryPackageManifest, StoryPackageOptions } from '@/shared/types/storyPackage.types'
import type { StoryWorkspace } from './useStoryWorkspace'

export interface NovelPackageSource {
    key: string; storyId: string; isCurrent: () => boolean
    /** What a project package of the saved novel holds with these choices, and the size and SHA-256 of its file. */
    preview: (options: StoryPackageOptions, signal?: AbortSignal) => Promise<StoryPackageManifest>
    /** The package the summary describes; refused when the saved novel changed since (409). */
    download: (manifest: StoryPackageManifest) => Promise<Blob>
}

/** Backups read only saved account data in the novel's own workspace; nothing is flushed or changed. */
export function useNovelPackageSource(storyId: string | null, workspace: StoryWorkspace): NovelPackageSource | null {
    const { userHash } = useAuth()
    const key = !workspace.deviceOnly && storyId && userHash && workspace.workspaceId ? JSON.stringify([API_BASE_URL, userHash, workspace.workspaceId, storyId, 'package']) : null
    const token = useMemo(() => ({ key, workspace }), [key, workspace]), live = useRef<object | null>(token)
    useLayoutEffect(() => { live.current = token; return () => { live.current = null } }, [token])
    return useMemo(() => {
        if (!key || !storyId) return null
        const isCurrent = () => live.current === token && workspace.isCurrent()
        const api = () => {
            const value = isCurrent() ? workspace.detachedApi() : null
            if (!value) throw new Error('Backup scope changed')
            return value
        }
        return {
            key, storyId, isCurrent,
            preview: (options, signal) => api().previewStoryPackage(storyId, { ...options }, { signal }),
            download: (manifest) => api().downloadStoryPackage(manifest),
        }
    }, [key, storyId, workspace, token])
}
