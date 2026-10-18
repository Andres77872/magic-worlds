import { describe, expect, it } from 'vitest'
import type { StoryGenerationChangeset, StoryGenerationChangesetWrite } from '@/shared'
import { manuscript, storyScene } from '@/test/fixtures/story'
import { verifyGenerationChangeset, verifyGenerationChangesetUndo } from './storyGenerationChangesetContract'

const write: StoryGenerationChangesetWrite = { requestId: 'together-1', items: [
    { generationId: 'gen-1', sceneId: 'scene-1', expectedRevision: 1, document: manuscript('The gate opened.', 'g1') },
    { generationId: 'gen-2', sceneId: 'scene-2', expectedRevision: 3, document: manuscript('The bell rang twice.', 'g2') },
] }
const changeset = (): StoryGenerationChangeset => ({ kind: 'generation_changeset', storyId: 'story-1', requestId: 'together-1', scenes: write.items.map((item) =>
    ({ ...storyScene({ id: item.sceneId, revision: item.expectedRevision + 1, document: item.document }), generationId: item.generationId, baseRevision: item.expectedRevision })) })

describe('generation changeset acknowledgements', () => {
    it('accepts a changeset that acknowledges every reviewed item in order', () => {
        expect(verifyGenerationChangeset(changeset(), 'story-1', write)).toBe(true)
    })
    it.each<[string, (value: StoryGenerationChangeset) => unknown]>([
        ['another request', (value) => ({ ...value, requestId: 'together-2' })],
        ['a missing scene', (value) => ({ ...value, scenes: value.scenes.slice(0, 1) })],
        ['scenes out of order', (value) => ({ ...value, scenes: [...value.scenes].reverse() })],
        ['another document', (value) => ({ ...value, scenes: [{ ...value.scenes[0], document: manuscript('The gate held.', 'g1') }, value.scenes[1]] })],
        ['a revision that skipped', (value) => ({ ...value, scenes: [{ ...value.scenes[0], revision: 3 }, value.scenes[1]] })],
        ['another suggestion', (value) => ({ ...value, scenes: [{ ...value.scenes[0], generationId: 'gen-9' }, value.scenes[1]] })],
        ['an extra field', (value) => ({ ...value, undo: true })],
    ])('refuses %s', (_name, change) => {
        expect(verifyGenerationChangeset(change(changeset()), 'story-1', write)).toBe(false)
    })
    it('accepts an undo that restores some scenes and accounts for every other one once', () => {
        const value = changeset(), restored = storyScene({ id: 'scene-1', revision: 3, document: manuscript('The gate held.', 'g1') })
        const undo = { kind: 'generation_changeset_undo', storyId: 'story-1', changesetId: 'together-1', scenes: [restored], kept: [{ sceneId: 'scene-2', reason: 'edited' }] }
        expect(verifyGenerationChangesetUndo(undo, value)).toBe(true)
        expect(verifyGenerationChangesetUndo({ ...undo, kept: [] }, value)).toBe(false)
        expect(verifyGenerationChangesetUndo({ ...undo, kept: [{ sceneId: 'scene-2', reason: 'other' }] }, value)).toBe(false)
        expect(verifyGenerationChangesetUndo({ ...undo, kept: [{ sceneId: 'scene-1', reason: 'edited' }] }, value)).toBe(false)
        expect(verifyGenerationChangesetUndo({ ...undo, scenes: [{ ...restored, revision: 2 }] }, value)).toBe(false)
        expect(verifyGenerationChangesetUndo({ ...undo, scenes: [], kept: [{ sceneId: 'scene-1', reason: 'edited' }, { sceneId: 'scene-2', reason: 'edited' }] }, value)).toBe(false)
    })
})
