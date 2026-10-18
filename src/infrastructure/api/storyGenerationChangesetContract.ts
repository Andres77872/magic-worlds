/** Acknowledgements of several suggestions accepted as one manuscript changeset, and of its undo (R14, prose half). */
import type { StoryGenerationChangeset, StoryGenerationChangesetUndo, StoryGenerationChangesetWrite } from '@/shared'
import { isRecord } from '@/shared/novelMutationJournal'
import { matchesStoryWrite, verifyStoryScene } from './storyContract'

export const MIN_CHANGESET_SCENES = 2, MAX_CHANGESET_SCENES = 12
const KEPT_REASONS = ['edited', 'pendingSuggestion', 'unavailable']

/** A changeset acknowledgement must name this write's request and acknowledge every item: its scene, suggestion, revision and document. */
export function verifyGenerationChangeset(value: unknown, storyId: string, write: StoryGenerationChangesetWrite): value is StoryGenerationChangeset {
    if (!isRecord(value) || Object.keys(value).length !== 4 || value.kind !== 'generation_changeset' || value.storyId !== storyId
        || value.requestId !== write.requestId || !Array.isArray(value.scenes) || value.scenes.length !== write.items.length) return false
    const scenes = value.scenes as unknown[]
    return write.items.every((item, index) => {
        const scene = scenes[index]
        return verifyStoryScene(scene, storyId, item.sceneId) && matchesStoryWrite(scene, { expectedRevision: item.expectedRevision, document: item.document })
            && (scene as unknown as Record<string, unknown>).generationId === item.generationId
            && (scene as unknown as Record<string, unknown>).baseRevision === item.expectedRevision
    })
}

/** An undo restores at least one of the changeset's scenes and accounts for every other one, each once. */
export function verifyGenerationChangesetUndo(value: unknown, changeset: StoryGenerationChangeset): value is StoryGenerationChangesetUndo {
    if (!isRecord(value) || Object.keys(value).length !== 5 || value.kind !== 'generation_changeset_undo' || value.storyId !== changeset.storyId
        || value.changesetId !== changeset.requestId || !Array.isArray(value.scenes) || !Array.isArray(value.kept) || value.scenes.length === 0) return false
    const accepted = new Map(changeset.scenes.map((scene) => [scene.id, scene]))
    const restored = (value.scenes as unknown[]).every((scene) => {
        const written = isRecord(scene) && typeof scene.id === 'string' ? accepted.get(scene.id) : undefined
        return written !== undefined && verifyStoryScene(scene, changeset.storyId, written.id) && scene.revision > written.revision
    })
    const kept = (value.kept as unknown[]).every((row) => isRecord(row) && Object.keys(row).length === 2 && typeof row.sceneId === 'string'
        && accepted.has(row.sceneId) && KEPT_REASONS.includes(String(row.reason)))
    const named = [...(value.scenes as { id: string }[]).map((scene) => scene.id), ...(value.kept as { sceneId: string }[]).map((row) => row.sceneId)]
    return restored && kept && named.length === accepted.size && new Set(named).size === named.length
}
