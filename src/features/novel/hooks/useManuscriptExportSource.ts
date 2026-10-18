import { useLayoutEffect, useMemo, useRef } from 'react'
import { useAuth } from '@/app/hooks'
import { API_BASE_URL } from '@/infrastructure/api/baseUrl'
import type { StoryExportGlossaryCandidate, StoryExportJob, StoryExportManifest, StoryExportOptions } from '@/shared/types/storyExport.types'
import { makeRequestId } from '@/utils/uuid'
import type { StoryWorkspace } from './useStoryWorkspace'

export interface ManuscriptExportSource {
    key: string; storyId: string; isCurrent: () => boolean
    /** Reads the saved outline's current source version, then the export summary at that version. */
    preview: (options: StoryExportOptions, signal?: AbortSignal) => Promise<StoryExportManifest>
    /** The file the summary describes; refused when the saved manuscript changed since (409). */
    download: (manifest: StoryExportManifest) => Promise<Blob>
    /** Enabled Codex entries of the saved novel that can go in a glossary, alphabetically. */
    glossaryCandidates: (signal?: AbortSignal) => Promise<StoryExportGlossaryCandidate[]>
    /** Files built in the background from a reviewed summary; they keep building, and stay ready, after the dialog closes. */
    jobs: {
        list: (signal?: AbortSignal) => Promise<StoryExportJob[]>
        /** Builds exactly the file the summary describes, at its source version. */
        start: (manifest: StoryExportManifest) => Promise<StoryExportJob>
        cancel: (job: StoryExportJob) => Promise<StoryExportJob>
        retry: (job: StoryExportJob) => Promise<StoryExportJob>
        /** The job's file, checked against its size and SHA-256. */
        download: (job: StoryExportJob) => Promise<Blob>
    }
}

/** The first paragraph of a description on one line, as the export writes it (the file is cut at about 1,000 characters). */
function firstParagraph(text: string): string {
    return (text.split(/\n\s*\n/).find((part) => part.trim()) ?? '').replace(/\s+/g, ' ').trim()
}

/** Exports read only saved account text in the novel's own workspace; writing is never flushed or changed. */
export function useManuscriptExportSource(storyId: string | null, workspace: StoryWorkspace): ManuscriptExportSource | null {
    const { userHash } = useAuth()
    const key = !workspace.deviceOnly && storyId && userHash && workspace.workspaceId ? JSON.stringify([API_BASE_URL, userHash, workspace.workspaceId, storyId, 'export']) : null
    const token = useMemo(() => ({ key, workspace }), [key, workspace]), live = useRef<object | null>(token)
    useLayoutEffect(() => { live.current = token; return () => { live.current = null } }, [token])
    return useMemo(() => {
        if (!key || !storyId) return null
        const isCurrent = () => live.current === token && workspace.isCurrent()
        const api = () => {
            const value = isCurrent() ? workspace.detachedApi() : null
            if (!value) throw new Error('Export scope changed')
            return value
        }
        return {
            key, storyId, isCurrent,
            preview: async (options, signal) => {
                const index = await api().getStoryStudioIndex(storyId, { signal })
                if (!isCurrent() || signal?.aborted) throw new Error('Export scope changed')
                return api().previewStoryExport(storyId, { ...structuredClone(options), sourceVersion: index.sourceVersion }, { signal })
            },
            download: (manifest) => api().downloadStoryExport(manifest),
            glossaryCandidates: async (signal) => {
                const index = await api().getStoryStudioIndex(storyId, { signal })
                if (!isCurrent() || signal?.aborted) throw new Error('Export scope changed')
                return index.activeCardRefs.filter((ref) => ref.enabled && !ref.removedAt).map((ref) => ({ refId: ref.id, kind: ref.kind,
                    term: (ref.snapshot.name || ref.snapshot.alias || '').trim(), definition: firstParagraph(ref.snapshot.description) }))
                    .sort((a, b) => a.term.localeCompare(b.term, undefined, { sensitivity: 'base' }) || (a.refId < b.refId ? -1 : 1))
            },
            jobs: {
                list: (signal) => api().listStoryExportJobs(storyId, { signal }),
                start: (manifest) => api().createStoryExportJob(storyId, manifest.request, makeRequestId('export')),
                cancel: (job) => api().cancelStoryExportJob(storyId, job.id),
                retry: (job) => api().retryStoryExportJob(job, makeRequestId('export-retry')),
                download: (job) => api().downloadStoryExportJob(job),
            },
        }
    }, [key, storyId, workspace, token])
}
