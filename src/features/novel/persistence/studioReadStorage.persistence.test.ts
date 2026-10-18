import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import type { StoryScene, StoryStudioIndex, StoryStudioScene } from '@/shared'
import { acknowledgedSceneCopy, mergeCachedRead, validCachedNovel } from './studioReadStorage'

const fixture = process.env.NOVEL_STUDIO_INDEX_PERSISTENCE
it.skipIf(!fixture)('retains the actual HTTP/MySQL outline and selected scene with their exact ownership and source packet', () => {
    const wire = JSON.parse(readFileSync(fixture!, 'utf8')) as { index: StoryStudioIndex; selected: StoryStudioScene; legacy: StoryScene }
    const scope = { apiOrigin: 'https://isolated-novel-wire.example', userHash: 'synthetic-author' }
    const workspace = { id: wire.index.organization!.workspace_id, name: 'Synthetic writing desk', isDefault: true, archived: false }
    const cached = mergeCachedRead(scope, workspace, wire.index, wire.selected, null)!
    expect(cached).not.toBeNull()
    expect(validCachedNovel(cached, scope)).toBe(true)
    const reopened = JSON.parse(JSON.stringify(cached))
    expect(validCachedNovel(reopened, scope)).toBe(true)
    expect(reopened.scenes[wire.selected.scene.id].read).toEqual(wire.selected)
    expect(reopened.index).toEqual(wire.index)
    expect(validCachedNovel(reopened, { ...scope, userHash: 'another-author' })).toBe(false)
    const acknowledged = acknowledgedSceneCopy(wire.legacy)
    expect(acknowledged).not.toBeNull()
    const acknowledgedCache = mergeCachedRead(scope, workspace, wire.index, acknowledged!, cached)!
    expect(validCachedNovel(acknowledgedCache, scope)).toBe(true)
    expect(acknowledgedCache.scenes[wire.legacy.id].read.scene.document).toEqual(wire.legacy.document)
})
