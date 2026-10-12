import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StoryChapter } from '@/shared'

const updateStoryChapter = vi.fn()
const openLoginModal = vi.fn()
let authenticated = true

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: authenticated, openLoginModal }),
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
const WORKSPACE = { isCurrent: () => workspaceCurrent }

function chapter(overrides: Partial<StoryChapter> = {}): StoryChapter {
    return {
        id: 'c1',
        storyId: 's1',
        title: 'Chapter 1',
        body: '',
        order: 0,
        status: 'draft',
        wordGoal: null,
        povCardId: null,
        locationCardId: null,
        activeCardRefs: [],
        generationHistory: [],
        ...overrides,
    }
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
        const { result } = renderHook(() => useWordGoal('s1', chapter({ wordGoal: 1500 }), WORKSPACE))

        expect(result.current.goal).toBe(1500)
        expect(updateStoryChapter).not.toHaveBeenCalled()
    })

    it('persists and clears through the stored chapter update', async () => {
        const { result } = renderHook(() => useWordGoal('s1', chapter(), WORKSPACE))

        await act(async () => expect(await result.current.setGoal(2000)).toBe(true))
        expect(result.current.goal).toBe(2000)
        expect(updateStoryChapter).toHaveBeenLastCalledWith('s1', 'c1', { wordGoal: 2000 })

        await act(async () => expect(await result.current.setGoal(null)).toBe(true))
        expect(result.current.goal).toBeNull()
        expect(updateStoryChapter).toHaveBeenLastCalledWith('s1', 'c1', { wordGoal: null })
    })

    it('migrates a legacy local goal and deletes the key only after server success', async () => {
        let release: (value: StoryChapter) => void = () => undefined
        updateStoryChapter.mockImplementationOnce(() => new Promise<StoryChapter>((resolve) => {
            release = resolve
        }))
        const key = 'magic_worlds:novel:wordGoal:s1:c1'
        window.localStorage.setItem(key, '1750')

        const { result } = renderHook(() => useWordGoal('s1', chapter(), WORKSPACE))

        await waitFor(() => expect(updateStoryChapter).toHaveBeenCalledWith('s1', 'c1', { wordGoal: 1750 }))
        expect(result.current.goal).toBe(1750)
        expect(window.localStorage.getItem(key)).toBe('1750')

        await act(async () => release(chapter({ wordGoal: 1750 })))
        await waitFor(() => expect(window.localStorage.getItem(key)).toBeNull())
        expect(result.current.goal).toBe(1750)
    })

    it('retains the legacy key when migration fails', async () => {
        updateStoryChapter.mockRejectedValueOnce(new Error('offline'))
        const key = 'magic_worlds:novel:wordGoal:s1:c1'
        window.localStorage.setItem(key, '1200')

        const { result } = renderHook(() => useWordGoal('s1', chapter(), WORKSPACE))

        await waitFor(() => expect(console.error).toHaveBeenCalled())
        expect(result.current.goal).toBe(1200)
        expect(window.localStorage.getItem(key)).toBe('1200')
    })

    it('rolls back an optimistic goal when the server save fails', async () => {
        updateStoryChapter.mockRejectedValueOnce(new Error('offline'))
        const { result } = renderHook(() => useWordGoal('s1', chapter({ wordGoal: 900 }), WORKSPACE))

        await act(async () => expect(await result.current.setGoal(1400)).toBe(false))

        expect(result.current.goal).toBe(900)
    })

    it('opens login instead of storing an unauthenticated goal locally', async () => {
        authenticated = false
        const { result } = renderHook(() => useWordGoal('s1', chapter(), WORKSPACE))

        await act(async () => expect(await result.current.setGoal(800)).toBe(false))

        expect(openLoginModal).toHaveBeenCalledTimes(1)
        expect(updateStoryChapter).not.toHaveBeenCalled()
        expect(window.localStorage.length).toBe(0)
    })

    it('rejects an out-of-range goal without clearing the server value', async () => {
        const { result } = renderHook(() => useWordGoal('s1', chapter({ wordGoal: 900 }), WORKSPACE))

        await act(async () => expect(await result.current.setGoal(2_147_483_648)).toBe(false))

        expect(result.current.goal).toBe(900)
        expect(updateStoryChapter).not.toHaveBeenCalled()
    })

    it('does not start an update or apply a late result once the story workspace is no longer current', async () => {
        const { result } = renderHook(() => useWordGoal('s1', chapter({ wordGoal: 900 }), WORKSPACE))

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
        expect(result.current.goal).toBe(1500)
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
        const { result } = renderHook(() => useWordGoal('s1', chapter(), ARCHIVED_STORY), { wrapper })

        expect(result.current.goal).toBe(1750)
        await act(async () => expect(await result.current.setGoal(2000)).toBe(false))

        expect(result.current.goal).toBe(1750)
        expect(updateStoryChapter).not.toHaveBeenCalled()
        expect(window.localStorage.getItem(key)).toBe('1750')
    })
})
