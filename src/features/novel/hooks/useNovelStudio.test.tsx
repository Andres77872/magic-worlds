import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Story, StoryPart } from '@/shared'
import { novel, storyChapter, storyScene } from '@/test/fixtures/story'

const mocks = vi.hoisted(() => ({ perform: vi.fn(), setPage: vi.fn(), userHash: 'studio-author', workspaceId: 'studio-workspace' }))
let openedStory: Story
vi.mock('@/app/hooks', () => ({
    useData: () => ({ activeStory: openedStory }),
    useAuth: () => ({ userHash: mocks.userHash }),
    useNavigation: () => ({ setPage: mocks.setPage }),
}))
vi.mock('./useStoryWorkspace', () => ({
    useStoryWorkspace: () => ({ workspaceId: mocks.workspaceId, isCurrent: () => true, detachedApi: () => null }),
}))
vi.mock('./useStoryStructure', () => ({ useStoryStructure: () => ({ perform: mocks.perform }) }))

import { useNovelStudio } from './useNovelStudio'

beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    openedStory = novel()
    mocks.userHash = 'studio-author'
    mocks.workspaceId = 'studio-workspace'
    mocks.perform.mockResolvedValue(null)
})

describe('Studio container selection', () => {
    it('reopens the last scene and panel choices without carrying them into another account or changing writing', async () => {
        openedStory = novel({ chapters: [storyChapter({ scenes: [storyScene(), storyScene({ id: 'second-scene', order: 1, body: 'Retained second scene' })] })] })
        const before = JSON.stringify(openedStory)
        const view = renderHook(() => useNovelStudio())
        await act(async () => {
            await view.result.current.selectScene('second-scene')
            view.result.current.toggleFocusMode()
            view.result.current.toggleTypewriter()
            view.result.current.setCodexOpen(false)
            view.result.current.setCodexScope('scene')
        })
        const old = view.result.current
        mocks.userHash = 'different-author'
        view.rerender()
        expect(view.result.current.activeScene?.id).toBe('scene-1')
        expect(view.result.current).toMatchObject({ focusMode: false, codexOpen: true, typewriter: false, codexScope: 'novel' })
        await act(async () => {await old.selectScene('second-scene')})
        expect(view.result.current.activeScene?.id).toBe('scene-1')
        view.unmount()
        mocks.userHash = 'studio-author'
        const reopened = renderHook(() => useNovelStudio())
        expect(reopened.result.current.activeScene?.id).toBe('second-scene')
        expect(reopened.result.current).toMatchObject({ focusMode: true, codexOpen: false, typewriter: true, codexScope: 'scene' })
        expect(JSON.stringify(openedStory)).toBe(before)
        expect(mocks.perform).not.toHaveBeenCalled()
    })
    it.each([false, true])('keeps an empty copied chapter selected instead of editing source prose (trashed child: %s)', async (hasTrashedChild) => {
        const copy = storyChapter({
            id: 'chapter-copy', title: 'An alternative', copiedFrom: 'chapter-1', order: 1,
            scenes: hasTrashedChild ? [storyScene({ chapterId: 'chapter-copy', trashedAt: '2026-10-16T00:00:00Z' })] : [],
        })
        openedStory = novel({ chapters: [storyChapter(), copy] })
        const view = renderHook(() => useNovelStudio())
        expect(view.result.current.activeScene?.chapterId).toBe('chapter-1')

        await act(async () => { await view.result.current.selectChapter(copy.id) })
        expect(view.result.current.activeChapter?.id).toBe(copy.id)
        expect(view.result.current.activeScene).toBeNull()
        await act(async () => { await view.result.current.addScene() })
        expect(mocks.perform).toHaveBeenCalledWith(expect.objectContaining({ op: 'create', kind: 'scene', parentId: copy.id }))

        view.unmount()
        const reopened = renderHook(() => useNovelStudio())
        expect(reopened.result.current.activeChapter?.id).toBe(copy.id)
        expect(reopened.result.current.activeScene).toBeNull()
    })

    it('keeps an empty part selected and creates its first chapter inside that part', async () => {
        const part: StoryPart = {
            id: 'part-empty', storyId: openedStory.id, title: 'Act II', metadataRevision: 1, order: 0,
            status: null, wordGoal: null, povCardId: null, locationCardId: null, details: {}, trashedAt: null, copiedFrom: null,
        }
        openedStory = novel({ parts: [part] })
        const { result } = renderHook(() => useNovelStudio())
        await act(async () => { await result.current.selectChapter(part.id) })
        expect(result.current.activeScene).toBeNull()
        expect(result.current.activeChapter).toBeNull()
        await act(async () => { await result.current.addScene() })
        expect(mocks.perform).toHaveBeenCalledWith(expect.objectContaining({ op: 'create', kind: 'chapter', parentId: part.id }))
    })

    it('falls back to available prose when a stored selection no longer exists', async () => {
        const { result } = renderHook(() => useNovelStudio())
        await act(async () => { await result.current.selectScene('removed-scene') })
        expect(result.current.activeScene?.id).toBe(openedStory.chapters[0].scenes[0].id)
        expect(result.current.activeChapter?.id).toBe(openedStory.chapters[0].id)
    })
})
