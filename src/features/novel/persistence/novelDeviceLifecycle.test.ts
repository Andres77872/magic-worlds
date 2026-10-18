import { expect, it } from 'vitest'
import { novel, storyChapter, storyScene } from '@/test/fixtures/story'
import { studioIndex } from '@/test/fixtures/storyStudio'
import { deviceSceneReadOnly, emptyNovelLifecycle, mergeNovelLifecycle, novelLifecycleObservation, validNovelLifecycle, type NovelDeviceLifecycle } from './novelDeviceLifecycle'

const workspaceId = 'desk', scene = storyScene(), chapter = storyChapter({ scenes: [scene] })
const source = studioIndex(novel({ organization: { workspace_id: workspaceId }, chapters: [chapter] }))
const observation = () => novelLifecycleObservation(source, workspaceId)!
const root = (revision: number, readOnly: boolean) => ({ ...emptyNovelLifecycle(), root: { revision, readOnly } })
it('orders root and unit metadata independently, preserving equal-head restrictions and accepting newer restores', () => {
    let state = mergeNovelLifecycle(observation(), root(9, true))
    state = mergeNovelLifecycle(state, { ...root(8, false), units: { [scene.id]: { revision: 4, readOnly: true } } })
    expect(state.root).toEqual({ revision: 9, readOnly: true })
    state = mergeNovelLifecycle(state, root(10, false))
    expect(deviceSceneReadOnly(state, scene.id)).toBe(true)
    state = mergeNovelLifecycle(state, { ...emptyNovelLifecycle(), units: { [scene.id]: { revision: 4, readOnly: false } } })
    expect(deviceSceneReadOnly(state, scene.id)).toBe(true)
    state = mergeNovelLifecycle(state, { ...emptyNovelLifecycle(), units: { [scene.id]: { revision: 5, readOnly: false } } })
    expect(deviceSceneReadOnly(state, scene.id)).toBe(false)
    expect(deviceSceneReadOnly(mergeNovelLifecycle(state, observation()), scene.id)).toBe(false)
})
it('follows current ancestor placement and removed scenes without changing previously retained unit metadata', () => {
    const base = observation(), other = 'active-chapter'
    let state = mergeNovelLifecycle(base, { ...emptyNovelLifecycle(), units: { [chapter.id]: { revision: 3, readOnly: true }, [other]: { revision: 1, readOnly: false } } })
    expect(deviceSceneReadOnly(state, scene.id)).toBe(true)
    state = mergeNovelLifecycle(state, { ...emptyNovelLifecycle(), structure: { revision: 2, parents: { [chapter.id]: null, [other]: null, [scene.id]: other }, scenes: [scene.id] } })
    expect(deviceSceneReadOnly(state, scene.id)).toBe(false)
    state = mergeNovelLifecycle(state, { ...emptyNovelLifecycle(), structure: { revision: 3, parents: { [chapter.id]: null, [other]: null }, scenes: [] } })
    expect(deviceSceneReadOnly(state, scene.id)).toBe(true)
    expect(state.units[scene.id]).toEqual(base.units[scene.id])
    expect(deviceSceneReadOnly(mergeNovelLifecycle(state, base), scene.id)).toBe(true)
})
it('keeps conflicting equal structure heads read-only until a strictly newer placement is known', () => {
    const base = observation()
    const contradictory = { ...base, structure: { ...base.structure!, scenes: [] } }
    const ambiguous = mergeNovelLifecycle(base, contradictory)
    expect(ambiguous.ambiguousStructure).toBe(1)
    expect(deviceSceneReadOnly(mergeNovelLifecycle(ambiguous, base), scene.id)).toBe(true)
    const restored = mergeNovelLifecycle(ambiguous, { ...base, structure: { ...base.structure!, revision: 2 } })
    expect(restored.ambiguousStructure).toBeNull(); expect(deviceSceneReadOnly(restored, scene.id)).toBe(false)
})
it('keeps confirmed erasure terminal against every later source and preserves existing metadata', () => {
    const base = observation(), erased = mergeNovelLifecycle(base, { ...emptyNovelLifecycle(), erased: true })
    const late = mergeNovelLifecycle(erased, { ...root(99, false), units: { [scene.id]: { revision: 99, readOnly: false } } })
    expect(late).toEqual(erased); expect(late.units).toEqual(base.units); expect(deviceSceneReadOnly(late, scene.id)).toBe(true)
})
it('projects only actual lifecycle authorities and excludes prose, titles and inherited workspace flags', () => {
    const state = observation()
    expect(deviceSceneReadOnly(state, scene.id)).toBe(false)
    const frozenInherited = { ...source, chapters: source.chapters.map((chapter) => ({ ...chapter, scenes: chapter.scenes.map((scene) => ({ ...scene, inheritance: { values: { includeInAI: true, includeInExport: true }, origins: {}, readOnly: true } })) })) }
    expect(deviceSceneReadOnly(novelLifecycleObservation(frozenInherited, workspaceId), scene.id)).toBe(false)
    expect(novelLifecycleObservation(source, 'other-workspace')).toBeNull()
    expect(novelLifecycleObservation({ ...source, metadataRevision: 0 }, workspaceId)).toBeNull()
    expect(novelLifecycleObservation(novel({ ...novel(), organization: { workspace_id: workspaceId }, summary: true, chapterCount: 1, sceneCount: 1, chapters: [] }), workspaceId)?.structure).toBeNull()
    expect(JSON.stringify(state)).not.toContain(source.title)
})
it('handles reserved object-property identities without prototype reads and rejects invalid lineage', () => {
    const units = Object.fromEntries(['constructor', '__proto__'].map((id) => [id, { revision: 1, readOnly: false }]))
    const state: NovelDeviceLifecycle = { ...root(1, false), units, structure: { revision: 1, parents: Object.fromEntries([['constructor', null], ['__proto__', 'constructor']]), scenes: ['__proto__'] } }
    expect(validNovelLifecycle(state)).toBe(true)
    expect(deviceSceneReadOnly(mergeNovelLifecycle(null, state), '__proto__')).toBe(false)
    expect(validNovelLifecycle({ ...state, structure: { ...state.structure, parents: { x: 'x' } } })).toBe(false)
    expect(validNovelLifecycle({ ...state, units: { x: { revision: 0, readOnly: true } } })).toBe(false)
})
