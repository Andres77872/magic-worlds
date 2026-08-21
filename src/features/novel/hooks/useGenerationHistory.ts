/**
 * useGenerationHistory — flattened, newest-first view of every chapter's
 * generation history, with local status patching so accept/discard updates
 * show immediately without waiting for a story refetch.
 *
 * The story payload only refreshes on accept — generations that were rejected
 * (or critiques dismissed) inline would be invisible until an unrelated
 * refetch, so record() keeps a local copy of every generation produced this
 * session and the merge dedupes by id once the server copy arrives.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Story, StoryGeneration, StoryGenerationStatus } from '@/shared'
import { chaptersFor } from '../utils/novelUtils'

export interface HistoryGeneration extends StoryGeneration {
    chapterTitle: string
}

export interface GenerationHistoryApi {
    generations: HistoryGeneration[]
    patchStatus: (generationId: string, status: StoryGenerationStatus) => void
    /** Track a generation created this session before any story refetch. */
    record: (generation: StoryGeneration, chapterTitle: string) => void
}

export function useGenerationHistory({ story }: { story: Story | null }): GenerationHistoryApi {
    const [patches, setPatches] = useState<Record<string, StoryGenerationStatus>>({})
    const [local, setLocal] = useState<HistoryGeneration[]>([])

    const storyId = story?.id ?? null
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPatches({})
        setLocal([])
    }, [storyId])

    const record = useCallback((generation: StoryGeneration, chapterTitle: string) => {
        setLocal((prev) => [{ ...generation, chapterTitle }, ...prev.filter((item) => item.id !== generation.id)])
    }, [])

    const generations = useMemo(() => {
        const byId = new Map<string, HistoryGeneration>()
        for (const generation of local) byId.set(generation.id, generation)
        for (const chapter of chaptersFor(story)) {
            for (const generation of chapter.generationHistory) {
                // The server copy wins: same content, authoritative status.
                byId.set(generation.id, { ...generation, chapterTitle: chapter.title })
            }
        }
        return [...byId.values()]
            .map((generation) => ({ ...generation, status: patches[generation.id] ?? generation.status }))
            .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    }, [local, patches, story])

    return {
        generations,
        patchStatus: (generationId, status) => setPatches((prev) => ({ ...prev, [generationId]: status })),
        record,
    }
}
