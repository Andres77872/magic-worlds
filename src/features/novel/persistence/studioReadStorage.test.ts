import { describe, expect, it, vi } from 'vitest'
import { manuscript, novel, storyChapter, storyScene } from '@/test/fixtures/story'
import { studioIndex, studioSceneRead } from '@/test/fixtures/storyStudio'
import { acknowledgedSceneCopy, deviceCacheKey, matchingCachedScene, mergeCachedRead, packCachedNovel, storedBytes, studioReadStorage, unpackCachedNovel, validCachedNovel } from './studioReadStorage'
import { applyStudioSceneAcknowledgement } from '@/shared/storyStudioState'

const scope = { apiOrigin: 'https://writing.example', userHash: 'author' }
const workspace = { id: 'desk', name: 'Writing desk', isDefault: true, archived: false }
const scene = storyScene({ document: manuscript('The letter waited.', 'letter') })
const index = studioIndex(novel({ organization: { workspace_id: workspace.id } as never, chapters: [storyChapter({ scenes: [scene] })] }))
const read = studioSceneRead(index, scene)
const first = () => mergeCachedRead(scope, workspace, index, read, null, 1)!

describe('confirmed device reads', () => {
    it('does not let a late active descriptor undo a newer archived workspace', () => {
        const archived = mergeCachedRead(scope, { ...workspace, archived: true, rowVersion: 9 }, index, read, null, 1)!
        const late = mergeCachedRead(scope, { ...workspace, rowVersion: 8 }, index, read, archived, 2)!
        expect(late.workspace).toMatchObject({ archived: true, rowVersion: 9 })
        const restored = mergeCachedRead(scope, { ...workspace, rowVersion: 10 }, index, read, late, 3)!
        expect(restored.workspace).toMatchObject({ archived: false, rowVersion: 10 })
        expect(restored.scenes[scene.id].read.scene.document).toEqual(scene.document)
    })
    it('retains latest acknowledged prose without inventing a checked context packet or saving generation collections', () => {
        const savedScene = storyScene({ ...scene, revision: 2, contentHash: 'c'.repeat(64), document: manuscript('The latest confirmed prose.', 'letter'), plainText: 'The latest confirmed prose.', body: 'The latest confirmed prose.' })
        const source = applyStudioSceneAcknowledgement(index, savedScene), copy = acknowledgedSceneCopy(savedScene)!
        expect(copy).not.toBeNull()
        expect(copy.projection).toBe('acknowledged_scene')
        expect(copy.scene).not.toHaveProperty('generationHistory')
        const cached = mergeCachedRead(scope, workspace, source, copy, first())!
        expect(validCachedNovel(cached, scope)).toBe(true)
        expect(cached.scenes[scene.id].read.scene.revision).toBe(2)
        const head = source.chapters[0].scenes[0]
        expect(matchingCachedScene(cached.scenes[scene.id], source, head)?.document).toEqual(savedScene.document)
        expect(matchingCachedScene(cached.scenes[scene.id], { ...source, contextRevision: 2 }, head)).toBeNull()
    })
    it('retains an independent canonical snapshot with exact source guards and no draft/request state', () => {
        const saved = first()
        expect(validCachedNovel(saved, scope)).toBe(true)
        expect(saved.scenes[scene.id].read.scene.document).toEqual(scene.document)
        expect(saved.index).not.toHaveProperty('document')
        expect(saved).not.toHaveProperty('pending')
        expect(saved.scenes[scene.id].read.scene).not.toHaveProperty('generationHistory')
        saved.scenes[scene.id].read.scene.document.content.content![0].content![0].text = 'Changed local clone'
        expect(read.scene.document).toEqual(scene.document)
        expect(mergeCachedRead(scope, workspace, index, { ...read, source: { ...read.source, revision: 9 } }, null)).toBeNull()
    })
    it('does not make another origin, author, workspace or novel readable through a matching scene id', () => {
        const saved = first()
        expect(validCachedNovel(saved, { ...scope, userHash: 'other' })).toBe(false)
        expect(validCachedNovel(saved, { ...scope, apiOrigin: 'https://other.example' })).toBe(false)
        expect(validCachedNovel({ ...saved, workspace: { ...workspace, id: 'other' } }, scope)).toBe(false)
        expect(validCachedNovel({ ...saved, key: deviceCacheKey(scope, workspace.id, 'other') }, scope)).toBe(false)
        expect(mergeCachedRead(scope, { ...workspace, id: 'other' }, index, read, null)).toBeNull()
    })
    it('keeps newer heads when older reads arrive late and retains removed scene copies separately', () => {
        const updatedScene = storyScene({ ...scene, revision: 2, contentHash: 'c'.repeat(64), document: manuscript('A newer saved letter.', 'letter'), plainText: 'A newer saved letter.', body: 'A newer saved letter.' })
        const updatedIndex = studioIndex(novel({ ...index, contextRevision: 2, chapters: [storyChapter({ scenes: [updatedScene] })] }))
        const updated = mergeCachedRead(scope, workspace, updatedIndex, studioSceneRead(updatedIndex, updatedScene), first(), 2)!
        expect(updated).not.toBeNull()
        const late = mergeCachedRead(scope, workspace, index, read, updated, 3)!
        expect(late.index.contextRevision).toBe(2)
        expect(late.scenes[scene.id].read.scene.revision).toBe(2)
        const removed = { ...updatedIndex, structureRevision: 2, chapters: [] }
        const retained = mergeCachedRead(scope, workspace, removed, undefined, late, 4)!
        expect(retained.index.chapters).toEqual([])
        expect(retained.scenes[scene.id].read.scene.document).toEqual(updatedScene.document)
        expect(validCachedNovel(retained, scope)).toBe(true)
    })
    it('rejects corrupted records without repairing or deleting their original content', () => {
        const saved = first(), changed = structuredClone(saved)
        changed.scenes[scene.id].read.scene.contentHash = 'd'.repeat(64)
        expect(validCachedNovel(changed, scope)).toBe(false)
        expect(mergeCachedRead(scope, workspace, index, read, changed)).toBeNull()
        expect(changed.scenes[scene.id].read.scene.contentHash).toBe('d'.repeat(64))
    })
    it('reports unavailable storage and retires an old owner without opening a database', async () => {
        const fake = { open: vi.fn(() => { throw new Error('Storage blocked') }) }
        vi.stubGlobal('indexedDB', fake)
        try {
            expect(await studioReadStorage.remember(scope, workspace, index, read, () => false)).toEqual({ status: 'retired' })
            expect(fake.open).not.toHaveBeenCalled()
            expect(await studioReadStorage.remember(scope, workspace, index, read)).toEqual({ status: 'unavailable' })
            expect(await studioReadStorage.list(scope)).toMatchObject({ unavailable: true, items: [] })
        } finally { vi.unstubAllGlobals() }
    })
})

describe('stored form of confirmed device reads', () => {
    const scenes = Array.from({ length: 6 }, (_, n) => storyScene({ id: 'scene-' + n, order: n, document: manuscript('Harbor log ' + n + '. The tide was going out.', 'p' + n) }))
    const longIndex = studioIndex(novel({ organization: { workspace_id: workspace.id } as never, chapters: [storyChapter({ scenes })] }))
    // Each read arrives with its own copy of the same outline, as after reopening the novel between scene switches.
    const readAll = () => scenes.reduce<ReturnType<typeof mergeCachedRead>>((cache, item, n) => {
        const outline = structuredClone(longIndex)
        return mergeCachedRead(scope, workspace, outline, studioSceneRead(outline, item), cache, n + 1)
    }, null)!
    it('keeps one copy of an outline that several scene copies were read under, and reads back the same cache', () => {
        const cache = readAll(), packed = packCachedNovel(cache)
        expect(Object.keys(packed.sources)).toHaveLength(1)
        // Six scene copies and the novel's own index held seven copies of the outline; one is stored.
        expect(storedBytes(cache) - storedBytes(packed)).toBeGreaterThan(5 * storedBytes(longIndex))
        const reopened = unpackCachedNovel(structuredClone(packed))
        expect(validCachedNovel(reopened, scope)).toBe(true)
        expect(JSON.parse(JSON.stringify(reopened))).toEqual(JSON.parse(JSON.stringify(cache)))
        const entry = (reopened as typeof cache).scenes['scene-3']
        expect(matchingCachedScene(entry, longIndex, longIndex.chapters[0].scenes[3])?.document).toEqual(scenes[3].document)
    })
    it('keeps separate outlines separate when they differ', () => {
        const cache = readAll(), changed = { ...longIndex, contextRevision: 2 }
        const next = mergeCachedRead(scope, workspace, changed, studioSceneRead(changed, scenes[0]), cache, 9)!
        expect(Object.keys(packCachedNovel(next).sources)).toHaveLength(2)
        expect(validCachedNovel(unpackCachedNovel(structuredClone(packCachedNovel(next))), scope)).toBe(true)
    })
    it('still reads a record stored before outlines were shared', () => {
        const legacy = structuredClone(readAll())
        expect(legacy.schema).toBe(1)
        expect(unpackCachedNovel(legacy)).toBe(legacy)
        expect(validCachedNovel(unpackCachedNovel(legacy), scope)).toBe(true)
    })
    it('refuses a stored record that names a missing outline, keeps an unused one, or carries extra fields', () => {
        const packed = packCachedNovel(readAll()), [key] = Object.keys(packed.sources)
        const missing = structuredClone(packed); missing.scenes['scene-2'].sourceKey = 'unknown'
        expect(unpackCachedNovel(missing)).toBeNull()
        const unused = structuredClone(packed); unused.sources['spare'] = unused.sources[key]
        expect(unpackCachedNovel(unused)).toBeNull()
        expect(unpackCachedNovel({ ...structuredClone(packed), pending: true })).toBeNull()
        const corrupted = structuredClone(packed); corrupted.scenes['scene-1'].read.scene.contentHash = 'd'.repeat(64)
        expect(validCachedNovel(unpackCachedNovel(corrupted), scope)).toBe(false)
    })
    it('counts stored bytes as UTF-8 without encoding them', () => {
        for (const value of [{ text: 'Ñandú corazón' }, { text: '銀の鍵 🗝️ 한국어' }, ['plain', 1, null]]) {
            expect(storedBytes(value)).toBe(new TextEncoder().encode(JSON.stringify(value)).byteLength)
        }
    })
})
