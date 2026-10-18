import { useEffect, useState } from 'react'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import { useScopedApi } from '@/shared/hooks/useScopedApi'

export interface CodexLibraryNotices {
    /** The newest saved library version of each card copy whose library card changed since it was copied. */
    versions: ReadonlyMap<string, number>
    /** Template and lorebook entry copies whose library details changed since they were copied or last reviewed. */
    changed: ReadonlySet<string>
}
const NONE: CodexLibraryNotices = { versions: new Map(), changed: new Set() }

/**
 * Which Codex copies have library changes to review, read from the story's own workspace when the Codex opens and
 * after each Codex change. It is a notice only: a failed read shows no notices and changes nothing.
 */
export function useCodexLibraryVersions(storyId: string | null, contextRevision: number | undefined, workspaceId?: string | null): CodexLibraryNotices {
    const api = useScopedApi(workspaceId)
    const { capture, isCurrent } = useWorkspace()
    const [state, setState] = useState<{ storyId: string | null; notices: CodexLibraryNotices }>({ storyId: null, notices: NONE })
    useEffect(() => {
        if (!storyId || !api) return
        let live = true
        const scope = capture()
        api.getStoryCodexLibraryVersions(storyId)
            .then((value) => {
                if (live && isCurrent(scope)) setState({ storyId, notices: { versions: new Map(value.versions.map((row) => [row.refId, row.latestVersionNumber])),
                    changed: new Set(value.changed.map((row) => row.refId)) } })
            })
            .catch(() => { if (live && isCurrent(scope)) setState({ storyId, notices: NONE }) })
        return () => { live = false }
    }, [api, storyId, contextRevision, capture, isCurrent])
    return state.storyId === storyId ? state.notices : NONE
}
