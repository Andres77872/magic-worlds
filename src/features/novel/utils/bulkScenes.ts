import type { StoryOutline } from '@/shared'
import { chaptersFor } from './novelUtils'

export type BulkSceneAction = 'status' | 'move' | 'archive' | 'trash'

/** Selected active scenes the action would change, in reading order; the rest are left alone. */
export function bulkSceneChanges(story: StoryOutline, selected: readonly string[], action: BulkSceneAction, value: string) {
    const chosen = new Set(selected)
    return chaptersFor(story).flatMap((chapter) => [...chapter.scenes].filter((scene) => !scene.trashedAt).sort((a, b) => a.order - b.order)
        .filter((scene) => chosen.has(scene.id)).map((scene) => ({ scene, chapterId: chapter.id })))
        .filter(({ scene, chapterId }) => action === 'status' ? scene.status !== value : action === 'move' ? chapterId !== value : action === 'archive' ? scene.status !== 'archived' : true)
        .map(({ scene }) => scene)
}
