import { act, renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const updateStoryChapter = vi.fn()
const openLoginModal = vi.fn()
let authenticated = true

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: authenticated, openLoginModal }),
    useData: () => ({ updateStoryChapter }),
}))

import { ApiError, apiService, type ApiService } from '@/infrastructure/api'
import type { Story, StoryChapter } from '@/shared'
import {
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    WorkspaceTestProvider,
    createWorkspaceTestState,
    testWorkspace,
    type WorkspaceTestState,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { useChapterDraft } from './useChapterDraft'
import { useStoryWorkspace, type StoryWorkspace } from './useStoryWorkspace'

/** The open story stays in the committed workspace (the common case). */
const CURRENT: StoryWorkspace = { workspaceId: TEST_WORKSPACE_ID, isCurrent: () => true, detachedApi: () => null }

function chapter(overrides: Partial<StoryChapter> = {}): StoryChapter {
    return {
        id: 'ch1',
        storyId: 's1',
        title: 'Chapter 1',
        body: 'The gate held.',
        order: 0,
        status: 'draft',
        povCardId: null,
        locationCardId: null,
        activeCardRefs: [],
        generationHistory: [],
        ...overrides,
    }
}

describe('useChapterDraft', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        authenticated = true
        updateStoryChapter.mockResolvedValue(undefined)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('autosaves once, 1200ms after the last change, with title and body', async () => {
        const { result } = renderHook(() => useChapterDraft({ storyId: 's1', chapter: chapter(), workspace: CURRENT }))

        act(() => result.current.onBodyChange('The gate held. Then it broke.'))
        act(() => vi.advanceTimersByTime(800))
        act(() => result.current.onBodyChange('The gate held. Then it shattered.'))
        act(() => vi.advanceTimersByTime(800))
        expect(updateStoryChapter).not.toHaveBeenCalled()

        await act(async () => {
            vi.advanceTimersByTime(400)
            await Promise.resolve()
        })

        expect(updateStoryChapter).toHaveBeenCalledTimes(1)
        expect(updateStoryChapter).toHaveBeenCalledWith('s1', 'ch1', {
            title: 'Chapter 1',
            body: 'The gate held. Then it shattered.',
        })
        expect(result.current.saveState).toBe('saved')
    })

    it('trims the title and omits a blank one so the save is never rejected as non-stored', async () => {
        const { result } = renderHook(() => useChapterDraft({ storyId: 's1', chapter: chapter(), workspace: CURRENT }))

        act(() => result.current.setTitle('  Chapter One  '))
        await act(async () => {
            await result.current.saveNow()
        })
        expect(updateStoryChapter).toHaveBeenLastCalledWith('s1', 'ch1', {
            title: 'Chapter One',
            body: 'The gate held.',
        })

        act(() => result.current.setTitle('   '))
        await act(async () => {
            await result.current.saveNow()
        })
        expect(updateStoryChapter).toHaveBeenLastCalledWith('s1', 'ch1', {
            body: 'The gate held.',
        })
    })

    it('flush() saves immediately while dirty and resolves clean', async () => {
        const { result } = renderHook(() => useChapterDraft({ storyId: 's1', chapter: chapter(), workspace: CURRENT }))

        act(() => result.current.onBodyChange('New text.'))
        await act(async () => {
            await result.current.flush()
        })

        expect(updateStoryChapter).toHaveBeenCalledTimes(1)
        expect(result.current.saveState).toBe('saved')

        // A second flush with nothing dirty performs no extra save.
        await act(async () => {
            await result.current.flush()
        })
        expect(updateStoryChapter).toHaveBeenCalledTimes(1)
    })

    it('flush() during an in-flight save awaits it without a second PUT', async () => {
        let release: () => void = () => {}
        updateStoryChapter.mockImplementation(
            () =>
                new Promise<void>((resolve) => {
                    release = resolve
                }),
        )
        const { result } = renderHook(() => useChapterDraft({ storyId: 's1', chapter: chapter(), workspace: CURRENT }))

        act(() => result.current.onBodyChange('New text.'))
        let savePromise: Promise<boolean> = Promise.resolve(false)
        act(() => {
            savePromise = result.current.saveNow()
        })

        let flushed = false
        let flushPromise: Promise<void> = Promise.resolve()
        act(() => {
            flushPromise = result.current.flush().then(() => {
                flushed = true
            })
        })
        await act(async () => {
            await Promise.resolve()
        })
        expect(flushed).toBe(false)

        await act(async () => {
            release()
            await savePromise
            await flushPromise
        })
        expect(flushed).toBe(true)
        expect(updateStoryChapter).toHaveBeenCalledTimes(1)
    })

    it('marks the draft as error when the save fails and stays dirty for flush', async () => {
        updateStoryChapter.mockRejectedValueOnce(new Error('boom'))
        const { result } = renderHook(() => useChapterDraft({ storyId: 's1', chapter: chapter(), workspace: CURRENT }))

        act(() => result.current.onBodyChange('New text.'))
        await act(async () => {
            await result.current.saveNow()
        })

        expect(result.current.saveState).toBe('error')

        updateStoryChapter.mockResolvedValueOnce(undefined)
        await act(async () => {
            await result.current.flush()
        })
        expect(updateStoryChapter).toHaveBeenCalledTimes(2)
        expect(result.current.saveState).toBe('saved')
    })

    it('suspended pauses the autosave timer until released', async () => {
        const { result } = renderHook(() => useChapterDraft({ storyId: 's1', chapter: chapter(), workspace: CURRENT }))

        act(() => result.current.setSuspended(true))
        act(() => result.current.onBodyChange('Suggestion under review…'))
        await act(async () => {
            vi.advanceTimersByTime(5000)
            await Promise.resolve()
        })
        expect(updateStoryChapter).not.toHaveBeenCalled()

        act(() => result.current.setSuspended(false))
        await act(async () => {
            vi.advanceTimersByTime(1200)
            await Promise.resolve()
        })
        expect(updateStoryChapter).toHaveBeenCalledTimes(1)
    })

    it('auto-retries a failed save without further typing', async () => {
        updateStoryChapter.mockRejectedValueOnce(new Error('boom'))
        const { result } = renderHook(() => useChapterDraft({ storyId: 's1', chapter: chapter(), workspace: CURRENT }))

        act(() => result.current.onBodyChange('New text.'))
        await act(async () => {
            vi.advanceTimersByTime(1200)
            await Promise.resolve()
        })
        expect(result.current.saveState).toBe('error')
        expect(updateStoryChapter).toHaveBeenCalledTimes(1)

        await act(async () => {
            vi.advanceTimersByTime(5000)
            await Promise.resolve()
        })
        expect(updateStoryChapter).toHaveBeenCalledTimes(2)
        expect(updateStoryChapter).toHaveBeenLastCalledWith('s1', 'ch1', {
            title: 'Chapter 1',
            body: 'New text.',
        })
        expect(result.current.saveState).toBe('saved')
    })

    it('does not auto-retry a permanent 4xx rejection', async () => {
        updateStoryChapter.mockRejectedValueOnce(new ApiError(422, 'title must be stored'))
        const { result } = renderHook(() => useChapterDraft({ storyId: 's1', chapter: chapter(), workspace: CURRENT }))

        act(() => result.current.onBodyChange('New text.'))
        await act(async () => {
            vi.advanceTimersByTime(1200)
            await Promise.resolve()
        })
        expect(result.current.saveState).toBe('error')
        expect(updateStoryChapter).toHaveBeenCalledTimes(1)

        await act(async () => {
            vi.advanceTimersByTime(20000)
            await Promise.resolve()
        })
        expect(updateStoryChapter).toHaveBeenCalledTimes(1)
    })

    it('flush() reports failure so callers can guard destructive follow-ups', async () => {
        updateStoryChapter.mockRejectedValueOnce(new Error('boom'))
        updateStoryChapter.mockRejectedValueOnce(new Error('boom'))
        const { result } = renderHook(() => useChapterDraft({ storyId: 's1', chapter: chapter(), workspace: CURRENT }))

        act(() => result.current.onBodyChange('New text.'))
        let clean: boolean | null = null
        await act(async () => {
            clean = await result.current.flush()
        })
        expect(clean).toBe(false)
        expect(result.current.saveState).toBe('error')
    })

    it('flushes a dirty draft when the hook unmounts', () => {
        const { result, unmount } = renderHook(() => useChapterDraft({ storyId: 's1', chapter: chapter(), workspace: CURRENT }))

        act(() => result.current.onBodyChange('Tail of typing.'))
        expect(updateStoryChapter).not.toHaveBeenCalled()

        unmount()

        expect(updateStoryChapter).toHaveBeenCalledTimes(1)
        expect(updateStoryChapter).toHaveBeenCalledWith('s1', 'ch1', {
            title: 'Chapter 1',
            body: 'Tail of typing.',
        })
    })

    it('blocks tab unload only while unsaved work exists', async () => {
        const { result } = renderHook(() => useChapterDraft({ storyId: 's1', chapter: chapter(), workspace: CURRENT }))

        const cleanEvent = new Event('beforeunload', { cancelable: true })
        window.dispatchEvent(cleanEvent)
        expect(cleanEvent.defaultPrevented).toBe(false)

        act(() => result.current.onBodyChange('New text.'))
        const dirtyEvent = new Event('beforeunload', { cancelable: true })
        window.dispatchEvent(dirtyEvent)
        expect(dirtyEvent.defaultPrevented).toBe(true)

        await act(async () => {
            await result.current.flush()
        })
        const savedEvent = new Event('beforeunload', { cancelable: true })
        window.dispatchEvent(savedEvent)
        expect(savedEvent.defaultPrevented).toBe(false)
    })

    it('resets the draft when the chapter id changes but not on same-id refetches', () => {
        const first = chapter()
        const { result, rerender } = renderHook(({ ch }) => useChapterDraft({ storyId: 's1', chapter: ch, workspace: CURRENT }), {
            initialProps: { ch: first },
        })

        act(() => result.current.onBodyChange('Edited body.'))
        expect(result.current.body).toBe('Edited body.')

        // Same id, fresh object (story refetch) — draft must survive.
        rerender({ ch: chapter({ body: 'Server body.' }) })
        expect(result.current.body).toBe('Edited body.')

        // New chapter id — draft resets.
        rerender({ ch: chapter({ id: 'ch2', title: 'Chapter 2', body: 'Second chapter.' }) })
        expect(result.current.body).toBe('Second chapter.')
        expect(result.current.saveState).toBe('idle')
    })
})

describe('useChapterDraft after a workspace switch', () => {
    const scopedUpdate = vi.fn()
    let workspace: WorkspaceTestState

    function story(): Story {
        return {
            id: 's1',
            title: 'Glass War',
            description: null,
            source: { kind: 'blank', id: null, title: null },
            chapters: [chapter()],
            activeCardRefs: [],
            activeContext: {
                includeSelectedCards: true,
                includeLorebooks: true,
                includeRecentChapters: 2,
                tokenBudget: 6000,
                styleSource: 'whole_story',
                customStyleInstruction: null,
            },
            organization: { workspace_id: TEST_WORKSPACE_ID },
        }
    }

    function renderStudioDraft() {
        const wrapper = ({ children }: { children: ReactNode }) => createElement(WorkspaceTestProvider, { state: workspace, children })
        return renderHook(({ open }: { open: Story | null }) => {
            const storyWorkspace = useStoryWorkspace(open)
            return useChapterDraft({ storyId: open?.id ?? null, chapter: open?.chapters[0] ?? null, workspace: storyWorkspace })
        }, { wrapper, initialProps: { open: story() as Story | null } })
    }

    beforeEach(() => {
        vi.clearAllMocks()
        authenticated = true
        updateStoryChapter.mockResolvedValue(undefined)
        scopedUpdate.mockResolvedValue(undefined)
        workspace = createWorkspaceTestState()
        vi.spyOn(apiService, 'withWorkspace').mockImplementation(() => ({ updateStoryChapter: scopedUpdate }) as unknown as ApiService)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('sends the unmount tail save to the story workspace, never the new one', async () => {
        const { result, rerender, unmount } = renderStudioDraft()
        act(() => result.current.onBodyChange('Tail of typing.'))

        workspace.switchTo(OTHER_WORKSPACE_ID)
        rerender({ open: story() })
        unmount()
        await act(async () => {
            await Promise.resolve()
        })

        expect(updateStoryChapter).not.toHaveBeenCalled()
        expect(apiService.withWorkspace).toHaveBeenCalledWith(TEST_WORKSPACE_ID)
        expect(apiService.withWorkspace).not.toHaveBeenCalledWith(OTHER_WORKSPACE_ID)
        expect(scopedUpdate).toHaveBeenCalledWith('s1', 'ch1', { title: 'Chapter 1', body: 'Tail of typing.' })
    })

    it('saves a dirty draft whose story was closed by the switch into its own workspace', async () => {
        const { result, rerender } = renderStudioDraft()
        act(() => result.current.onBodyChange('Mid-sentence when the switch landed'))

        workspace.switchTo(OTHER_WORKSPACE_ID)
        rerender({ open: null })
        await act(async () => {
            await Promise.resolve()
        })

        expect(updateStoryChapter).not.toHaveBeenCalled()
        expect(apiService.withWorkspace).toHaveBeenCalledWith(TEST_WORKSPACE_ID)
        expect(scopedUpdate).toHaveBeenCalledTimes(1)
        expect(scopedUpdate).toHaveBeenCalledWith('s1', 'ch1', { title: 'Chapter 1', body: 'Mid-sentence when the switch landed' })
    })

    it('runs a pending retry against the story workspace without touching the UI', async () => {
        vi.useFakeTimers()
        try {
            updateStoryChapter.mockRejectedValueOnce(new Error('network'))
            const { result, rerender } = renderStudioDraft()
            act(() => result.current.onBodyChange('Unsaved text.'))
            await act(async () => {
                vi.advanceTimersByTime(1200)
                await Promise.resolve()
            })
            expect(result.current.saveState).toBe('error')

            workspace.switchTo(OTHER_WORKSPACE_ID)
            rerender({ open: story() })
            await act(async () => {
                vi.advanceTimersByTime(5000)
                await Promise.resolve()
            })

            expect(updateStoryChapter).toHaveBeenCalledTimes(1)
            expect(scopedUpdate).toHaveBeenCalledWith('s1', 'ch1', { title: 'Chapter 1', body: 'Unsaved text.' })
            expect(result.current.saveState).toBe('error')
        } finally {
            vi.useRealTimers()
        }
    })

    it('keeps saving through DataProvider while the story workspace is current', async () => {
        const { result } = renderStudioDraft()
        act(() => result.current.onBodyChange('Still here.'))
        await act(async () => {
            await result.current.flush()
        })

        expect(updateStoryChapter).toHaveBeenCalledWith('s1', 'ch1', { title: 'Chapter 1', body: 'Still here.' })
        expect(scopedUpdate).not.toHaveBeenCalled()
        expect(result.current.saveState).toBe('saved')
    })
})

describe('useChapterDraft in an archived workspace', () => {
    // The story lives in Novel A, archived; nothing it does may be sent.
    const ARCHIVED_STORY: StoryWorkspace = { workspaceId: OTHER_WORKSPACE_ID, isCurrent: () => true, detachedApi: () => null }

    function renderArchivedDraft(archived = true) {
        const state = createWorkspaceTestState({
            workspaces: [
                testWorkspace(TEST_WORKSPACE_ID, 'Main library'),
                testWorkspace(OTHER_WORKSPACE_ID, 'Novel A', archived ? { archived_at: '2026-10-10T00:00:00Z' } : {}),
            ],
        })
        const wrapper = ({ children }: { children: ReactNode }) => createElement(WorkspaceTestProvider, { state, children })
        return renderHook(() => useChapterDraft({ storyId: 's1', chapter: chapter(), workspace: ARCHIVED_STORY }), { wrapper })
    }

    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        authenticated = true
        updateStoryChapter.mockResolvedValue(undefined)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('ignores edits, schedules nothing and never saves', async () => {
        const { result, unmount } = renderArchivedDraft()

        act(() => {
            result.current.onBodyChange('The gate held. Then it broke.')
            result.current.setTitle('Renamed')
        })
        expect(result.current.body).toBe('The gate held.')
        expect(result.current.title).toBe('Chapter 1')
        expect(result.current.saveState).toBe('idle')

        await act(async () => {
            vi.advanceTimersByTime(10_000)
            await Promise.resolve()
        })
        let saved: boolean | null = null
        let clean: boolean | null = null
        await act(async () => {
            saved = await result.current.saveNow()
            clean = await result.current.flush()
        })
        unmount()

        // Ctrl/Cmd+S has nothing to send; leaving has nothing to wait for.
        expect(saved).toBe(false)
        expect(clean).toBe(true)
        expect(updateStoryChapter).not.toHaveBeenCalled()
    })

    it('autosaves as usual while the workspace is active', async () => {
        const { result } = renderArchivedDraft(false)

        act(() => result.current.onBodyChange('The gate held. Then it broke.'))
        await act(async () => {
            vi.advanceTimersByTime(1200)
            await Promise.resolve()
        })

        expect(updateStoryChapter).toHaveBeenCalledTimes(1)
    })
})
