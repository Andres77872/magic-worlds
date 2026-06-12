import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const updateStoryChapter = vi.fn()
const openLoginModal = vi.fn()
let authenticated = true

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: authenticated, openLoginModal }),
    useData: () => ({ updateStoryChapter }),
}))

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
        activeCardRefs: [],
        mentionRefs: [],
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
            status: 'draft',
        })
        expect(result.current.saveState).toBe('saved')
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
        let savePromise: Promise<void> = Promise.resolve()
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
