/**
 * useGenerationHistory — flattened, newest-first view of every chapter's
 * generation history, with local status patching so accept/discard updates
 * show immediately without waiting for a story refetch.
 */

import { useEffect, useMemo, useState } from 'react'
import type { Story, StoryGeneration, StoryGenerationStatus } from '@/shared'
import { chaptersFor } from '../utils/novelUtils'

export interface HistoryGeneration extends StoryGeneration {
    chapterTitle: string
}

export interface GenerationHistoryApi {
    generations: HistoryGeneration[]
    patchStatus: (generationId: string, status: StoryGenerationStatus) => void
}

export function useGenerationHistory({ story }: { story: Story | null }): GenerationHistoryApi {
    const [patches, setPatches] = useState<Record<string, StoryGenerationStatus>>({})

    const storyId = story?.id ?? null
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPatches({})
    }, [storyId])

    const generations = useMemo(() => {
        const all: HistoryGeneration[] = []
        for (const chapter of chaptersFor(story)) {
            for (const generation of chapter.generationHistory ?? []) {
                all.push({
                    ...generation,
                    status: patches[generation.id] ?? generation.status,
                    chapterTitle: chapter.title,
                })
            }
        }
        return all.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    }, [patches, story])

    return {
        generations,
        patchStatus: (generationId, status) => setPatches((prev) => ({ ...prev, [generationId]: status })),
    }
}
