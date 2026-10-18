import { storyChapter } from '@/test/fixtures/story'
import { act, renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StoryChapter } from '@/shared'

const updateStoryChapter = vi.fn()
const openLoginModal = vi.fn()
let authenticated = true

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: authenticated, openLoginModal,userHash:'goal-author' }),
    useData: () => ({ updateStoryChapter }),
}))

import {
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    WorkspaceTestProvider,
    createWorkspaceTestState,
    testWorkspace,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { useWordGoal } from './useWordGoal'

let workspaceCurrent = true
const WORKSPACE = { workspaceId:'goal-workspace',isCurrent: () => workspaceCurrent }

function chapter(overrides: Partial<StoryChapter> = {}): StoryChapter {
    return storyChapter({id:'c1',storyId:'s1',...overrides})
}

describe('useWordGoal', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        window.localStorage.clear()
        authenticated = true
        workspaceCurrent = true
        updateStoryChapter.mockImplementation(async (_storyId, _chapterId, patch) => chapter(patch))
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
    })

    it('hydrates from the stored chapter without reading a stale browser value', () => {
        window.localStorage.setItem('magic_worlds:novel:wordGoal:s1:c1', '900')
        const { result } = renderHook(() => useWordGoal('s1', chapter({ wordGoal: 1500 }), WORKSPACE, 'chapter'))

        expect(result.current.goal).toBe(1500)
        expect(updateStoryChapter).not.toHaveBeenCalled()
    })

    it('persists and clears through the stored chapter update', async () => {
        const { result } = renderHook(() => useWordGoal('s1', chapter(), WORKSPACE, 'chapter'))

        await act(async () => expect(await result.current.setGoal(2000)).toBe(true))
        expect(result.current.goal).toBe(2000)
        expect(updateStoryChapter).toHaveBeenLastCalledWith('s1', 'c1', { wordGoal: 2000, expectedMetadataRevision: 1, requestId: expect.any(String) })

        await act(async () => expect(await result.current.setGoal(null)).toBe(true))
        expect(result.current.goal).toBeNull()
        expect(updateStoryChapter).toHaveBeenLastCalledWith('s1', 'c1', { wordGoal: null, expectedMetadataRevision: 1, requestId: expect.any(String) })
    })

    it('discards the obsolete goal key without writing it to current metadata', () => {
        const key = 'magic_worlds:novel:wordGoal:s1:c1'
        window.localStorage.setItem(key, '1750')
        const { result } = renderHook(() => useWordGoal('s1', chapter(), WORKSPACE, 'chapter'))
        expect(result.current.goal).toBeNull()
        expect(updateStoryChapter).not.toHaveBeenCalled()
        expect(window.localStorage.getItem(key)).toBeNull()
    })

    it('rolls back an optimistic goal when the server save fails', async () => {
        updateStoryChapter.mockRejectedValueOnce(new Error('offline'))
        const { result } = renderHook(() => useWordGoal('s1', chapter({ wordGoal: 900 }), WORKSPACE, 'chapter'))

        await act(async () => expect(await result.current.setGoal(1400)).toBe(false))

        expect(result.current.goal).toBe(900)
    })

    it('recovers the original request after reload and refuses a different goal until it is acknowledged',async()=>{
        updateStoryChapter.mockRejectedValueOnce(new Error('Response lost'))
        const first=renderHook(()=>useWordGoal('s1',chapter({wordGoal:900}),WORKSPACE,'chapter'))
        await act(async()=>{await first.result.current.setGoal(1400)})
        const original=updateStoryChapter.mock.calls[0][2]
        await act(async()=>expect(await first.result.current.setGoal(2000)).toBe(false))
        expect(updateStoryChapter).toHaveBeenCalledTimes(1)
        first.unmount()
        const second=renderHook(()=>useWordGoal('s1',chapter({wordGoal:900}),WORKSPACE,'chapter'))
        expect(second.result.current.pending).toEqual(original)
        await act(async()=>expect(await second.result.current.retry()).toBe(true))
        expect(updateStoryChapter.mock.calls[1][2]).toEqual(original)
        expect(second.result.current.goal).toBe(1400)
        expect(second.result.current.pending).toBeNull()
        expect(Object.keys(localStorage).filter((key)=>key.includes('novel-goal:'))).toEqual([])
    })

    it('isolates a recovered goal from a newly selected unit and never retries an absent request',async()=>{
        updateStoryChapter.mockRejectedValueOnce(new Error('Offline'))
        const view=renderHook(({unit})=>useWordGoal('s1',unit,WORKSPACE,'chapter'),{initialProps:{unit:chapter()}})
        await act(async()=>{await view.result.current.setGoal(1400)})
        view.rerender({unit:chapter({id:'second',wordGoal:600})})
        expect(view.result.current.pending).toBeNull()
        expect(view.result.current.goal).toBe(600)
        await act(async()=>expect(await view.result.current.retry()).toBe(false))
        expect(updateStoryChapter).toHaveBeenCalledTimes(1)
        view.rerender({unit:chapter()})
        expect(view.result.current.pending?.wordGoal).toBe(1400)
    })

    it('opens login instead of storing an unauthenticated goal locally', async () => {
        authenticated = false
        const { result } = renderHook(() => useWordGoal('s1', chapter(), WORKSPACE, 'chapter'))

        await act(async () => expect(await result.current.setGoal(800)).toBe(false))

        expect(openLoginModal).toHaveBeenCalledTimes(1)
        expect(updateStoryChapter).not.toHaveBeenCalled()
        expect(window.localStorage.length).toBe(0)
    })

    it('rejects an out-of-range goal without clearing the server value', async () => {
        const { result } = renderHook(() => useWordGoal('s1', chapter({ wordGoal: 900 }), WORKSPACE, 'chapter'))

        await act(async () => expect(await result.current.setGoal(2_147_483_648)).toBe(false))

        expect(result.current.goal).toBe(900)
        expect(updateStoryChapter).not.toHaveBeenCalled()
    })

    it('does not start an update or apply a late result once the story workspace is no longer current', async () => {
        const { result } = renderHook(() => useWordGoal('s1', chapter({ wordGoal: 900 }), WORKSPACE, 'chapter'))

        workspaceCurrent = false
        let saved: boolean | null = null
        await act(async () => {
            saved = await result.current.setGoal(1200)
        })
        expect(saved).toBe(false)
        expect(updateStoryChapter).not.toHaveBeenCalled()
        expect(result.current.goal).toBe(900)

        workspaceCurrent = true
        let release!: () => void
        updateStoryChapter.mockImplementationOnce(() => new Promise((resolve) => {
            release = () => resolve(chapter({ wordGoal: 1600 }))
        }))
        let pending: Promise<boolean> = Promise.resolve(false)
        act(() => {
            pending = result.current.setGoal(1500)
        })
        workspaceCurrent = false
        await act(async () => {
            release()
            await pending
        })
        // The optimistic value stays; the late server copy is not applied.
        expect(updateStoryChapter).toHaveBeenCalledTimes(1)
        expect(result.current.goal).toBe(900)
    })
})

describe('useWordGoal in an archived workspace', () => {
    const ARCHIVED_STORY = { workspaceId: OTHER_WORKSPACE_ID, isCurrent: () => true }
    const state = createWorkspaceTestState({
        workspaces: [
            testWorkspace(TEST_WORKSPACE_ID, 'Main library'),
            testWorkspace(OTHER_WORKSPACE_ID, 'Novel A', { archived_at: '2026-10-10T00:00:00Z' }),
        ],
    })
    const wrapper = ({ children }: { children: ReactNode }) => createElement(WorkspaceTestProvider, { state, children })

    beforeEach(() => {
        vi.clearAllMocks()
        window.localStorage.clear()
        authenticated = true
    })

    it('shows the goal but neither sets nor migrates it', async () => {
        const key = 'magic_worlds:novel:wordGoal:s1:c1'
        window.localStorage.setItem(key, '1750')
        const { result } = renderHook(() => useWordGoal('s1', chapter({ wordGoal: 1750 }), ARCHIVED_STORY, 'chapter'), { wrapper })

        expect(result.current.goal).toBe(1750)
        await act(async () => expect(await result.current.setGoal(2000)).toBe(false))

        expect(result.current.goal).toBe(1750)
        expect(updateStoryChapter).not.toHaveBeenCalled()
        expect(window.localStorage.getItem(key)).toBeNull()
    })
})
