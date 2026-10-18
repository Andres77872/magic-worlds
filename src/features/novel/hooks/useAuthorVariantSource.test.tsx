import { renderHook } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { authorVariantFixture } from '@/test/fixtures/authorVariants'
import type { ApiService } from '@/infrastructure/api'
import { authorVariantTargetReadOnly,useAuthorVariantSource, variantSnapshotIntent } from './useAuthorVariantSource'
const auth = vi.hoisted(() => ({ userHash: 'author' as string | null, accountKey: 'one' }))
vi.mock('@/app/hooks', () => ({ useAuth: () => auth }))
beforeEach(() => { auth.userHash = 'author'; auth.accountKey = 'one' })
function setup() {
    const f = authorVariantFixture(), api = { getStoryGenerationHistoryDetail: vi.fn(async () => f.detail), getStoryRefinementParent: vi.fn(async () => f.snapshot.parent),
        getStorySceneDocument: vi.fn(async () => ({ ...f.scene, projection: 'scene_document', latestGenerationTrace: null })),
        getStoryStudioIndex: vi.fn(async () => f.index), getStoryVariant: vi.fn(async () => f.record), previewStoryVariant: vi.fn(async () => f.snapshot) }
    const workspace = { workspaceId: 'desk', isCurrent: () => true, detachedApi: () => api as unknown as ApiService }
    return { ...f, api, ...renderHook(() => useAuthorVariantSource(f.snapshot.storyId, workspace)) }
}
it('loads a fresh owned original and current same-base scene without any model or manuscript write', async () => {
    const test = setup(), source = test.result.current!
    expect(await source.context(test.generation.id, new AbortController().signal)).toEqual(test.context)
    expect(test.api.getStoryGenerationHistoryDetail).toHaveBeenCalledWith(source.storyId, test.generation.id, expect.any(Object))
    expect(test.api.getStorySceneDocument).toHaveBeenCalledOnce()
})
it('checks current saved status, source preview and stable index around an exact authored handoff', async () => {
    const test = setup(), source = test.result.current!
    const checked = await source.review(test.record, new AbortController().signal)
    expect(checked.variant).toEqual(test.snapshot)
    expect(test.api.previewStoryVariant).toHaveBeenCalledWith(source.storyId, variantSnapshotIntent(test.snapshot), expect.any(Object))
    expect(test.api.getStoryStudioIndex).toHaveBeenCalledTimes(2)
})
it.each(['base', 'original', 'status', 'changed_index', 'preview'])('blocks %s drift before manuscript staging', async kind => {
    const test = setup(), source = test.result.current!
    if (kind === 'base') test.api.getStorySceneDocument.mockResolvedValueOnce({ ...test.scene, revision: 99, projection: 'scene_document', latestGenerationTrace: null })
    if (kind === 'original') test.detail.generation.output = 'Different original'
    if (kind === 'status') test.record.status = 'accepted'
    if (kind === 'changed_index') test.api.getStoryStudioIndex.mockResolvedValueOnce(test.index).mockResolvedValueOnce({ ...test.index, sourceVersion: 'c'.repeat(64) })
    if (kind === 'preview') test.api.previewStoryVariant.mockResolvedValueOnce({ ...test.snapshot, variantHash: 'c'.repeat(64) })
    await expect(kind === 'base' || kind === 'original' ? source.context(test.generation.id, new AbortController().signal)
        : source.review(test.record, new AbortController().signal)).rejects.toBeDefined()
})
it('permanently retires an old source across logout/relogin, including when the textual key is reused', async () => {
    const test = setup(), original = test.result.current!
    auth.userHash = null; test.rerender(); auth.userHash = 'author'; test.rerender()
    expect(original.isCurrent()).toBe(false)
    await expect(original.context(test.generation.id, new AbortController().signal)).rejects.toThrow('scope changed')
    expect(test.api.getStoryGenerationHistoryDetail).not.toHaveBeenCalled()
    expect(test.result.current!.isCurrent()).toBe(true)
})
it.each(['scene_archived','scene_trash','scene_merged','scene_permission','novel_archived','novel_trash','workspace','missing'])(
    'keeps the original %s target read-only even when the currently open manuscript scene is writable',kind=>{
        const f=authorVariantFixture(),story=structuredClone(f.index),scene=story.chapters[0].scenes[0]
        if(kind==='scene_archived')scene.status='archived'
        if(kind==='scene_trash')scene.trashedAt='2026-10-17T00:00:00Z'
        if(kind==='scene_merged')scene.mergedInto='another-scene'
        if(kind==='scene_permission')scene.inheritance={...scene.inheritance!,readOnly:true}
        if(kind==='novel_archived')story.status='archived'
        if(kind==='novel_trash')story.trashedAt='2026-10-17T00:00:00Z'
        expect(authorVariantTargetReadOnly(story,kind==='missing'?'unknown':scene.id,kind==='workspace')).toBe(true)
        expect(authorVariantTargetReadOnly(f.index,f.scene.id,false)).toBe(false)
    })
