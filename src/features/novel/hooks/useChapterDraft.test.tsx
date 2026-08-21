import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const updateStoryChapter = vi.fn()
const openLoginModal = vi.fn()
let authenticated = true

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: authenticated, openLoginModal }),
    useData: () => ({ updateStoryChapter }),
}))

import { ApiError } from '@/infrastructure/api'
import type { StoryChapter } from '@/shared'
import { useChapterDraft } from './useChapterDraft'

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
        const { result } = renderHook(() => useChapterDraft({ storyId: 's1', chapter: chapter() }))

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
        const { result } = renderHook(() => useChapterDraft({ storyId: 's1', chapter: chapter() }))

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
        const { result } = renderHook(() => useChapterDraft({ storyId: 's1', chapter: chapter() }))

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
        const { result } = renderHook(() => useChapterDraft({ storyId: 's1', chapter: chapter() }))

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
        const { result } = renderHook(() => useChapterDraft({ storyId: 's1', chapter: chapter() }))

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
        const { result } = renderHook(() => useChapterDraft({ storyId: 's1', chapter: chapter() }))

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
        const { result } = renderHook(() => useChapterDraft({ storyId: 's1', chapter: chapter() }))

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
        const { result } = renderHook(() => useChapterDraft({ storyId: 's1', chapter: chapter() }))

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
        const { result } = renderHook(() => useChapterDraft({ storyId: 's1', chapter: chapter() }))

        act(() => result.current.onBodyChange('New text.'))
        let clean: boolean | null = null
        await act(async () => {
            clean = await result.current.flush()
        })
        expect(clean).toBe(false)
        expect(result.current.saveState).toBe('error')
    })

    it('flushes a dirty draft when the hook unmounts', () => {
        const { result, unmount } = renderHook(() => useChapterDraft({ storyId: 's1', chapter: chapter() }))

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
        const { result } = renderHook(() => useChapterDraft({ storyId: 's1', chapter: chapter() }))

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
        const { result, rerender } = renderHook(({ ch }) => useChapterDraft({ storyId: 's1', chapter: ch }), {
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
