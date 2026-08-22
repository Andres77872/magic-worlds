/**
 * useGenerationHistory — flattened, newest-first view of every chapter's
 * generation history, with local status patching so accept/discard updates
 * show immediately without waiting for a story refetch.
 *
 * The story payload only refreshes on accept — generations that were rejected
 * (or critiques dismissed) inline would be invisible until an unrelated
 * refetch, so record() keeps a local copy of every generation produced this
 * session and the merge dedupes by id once the server copy arrives.
 *
 * record() also keeps the writer's own prompt, which the server copy does not
 * carry: once a beat is accepted the prose is in the chapter and the
 * instruction that produced it exists nowhere else. The merge below preserves
 * it rather than letting the authoritative copy overwrite it away.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Story, StoryGeneration, StoryGenerationStatus } from '@/shared'
import { chaptersFor } from '../utils/novelUtils'

export interface HistoryGeneration extends StoryGeneration {
    chapterTitle: string
    /** What the writer asked for, in their own words. */
    prompt?: string
}

export interface GenerationHistoryApi {
    generations: HistoryGeneration[]
    patchStatus: (generationId: string, status: StoryGenerationStatus) => void
    /** Track a generation created this session before any story refetch. */
    record: (generation: StoryGeneration, chapterTitle: string, prompt?: string) => void
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

    const record = useCallback((generation: StoryGeneration, chapterTitle: string, prompt?: string) => {
        setLocal((prev) => [
            { ...generation, chapterTitle, prompt: prompt?.trim() || undefined },
            ...prev.filter((item) => item.id !== generation.id),
        ])
    }, [])

    const generations = useMemo(() => {
        const byId = new Map<string, HistoryGeneration>()
        for (const generation of local) byId.set(generation.id, generation)
        for (const chapter of chaptersFor(story)) {
            for (const generation of chapter.generationHistory) {
                // The server copy wins on content and status — but it has no
                // record of what the writer typed, so the local prompt survives.
                const prompt = byId.get(generation.id)?.prompt
                byId.set(generation.id, { ...generation, chapterTitle: chapter.title, prompt })
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
