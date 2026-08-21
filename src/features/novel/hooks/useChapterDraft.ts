/**
 * useChapterDraft — per-chapter editable state (title + markdown body) with
 * dirty tracking, debounced autosave, and an awaitable flush() that the AI
 * flow uses to guarantee the backend sees the current body before generating.
 *
 * The draft resets only when the chapter id changes; story refetches (codex
 * ops, history refreshes) never clobber in-progress typing. `suspended`
 * pauses the autosave timer while an AI suggestion is alive in the editor so
 * suggestion text is never persisted.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth, useData } from '@/app/hooks'
import { ApiError } from '@/infrastructure/api'
import type { StoryChapter } from '@/shared'
import { dateFromApiTimestamp } from '@/utils/time'
import type { NovelSaveState } from '../utils/novelUtils'

const AUTOSAVE_DELAY_MS = 1200
const SAVE_RETRY_DELAY_MS = 5000

export interface ChapterDraftApi {
    title: string
    setTitle: (title: string) => void
    body: string
    onBodyChange: (markdown: string) => void
    saveState: NovelSaveState
    lastSavedAt: Date | null
    /** Pause autosave while an AI suggestion is alive in the editor. */
    suspended: boolean
    setSuspended: (value: boolean) => void
    saveNow: () => Promise<boolean>
    /**
     * Cancel the timer, await any in-flight save, then save if still dirty.
     * Resolves false when the draft could not be persisted — callers that are
     * about to discard the draft (chapter switch) or need the backend to see
     * the current body (AI generation) must not proceed on false.
     */
    flush: () => Promise<boolean>
}

export function useChapterDraft({ storyId, chapter }: { storyId: string | null; chapter: StoryChapter | null }): ChapterDraftApi {
    const { updateStoryChapter } = useData()
    const { isAuthenticated, openLoginModal } = useAuth()

    const [title, setTitleState] = useState(chapter?.title ?? '')
    const [body, setBody] = useState(chapter?.body ?? '')
    const [saveState, setSaveState] = useState<NovelSaveState>('idle')
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
    const [suspended, setSuspended] = useState(false)

    const timerRef = useRef<number | null>(null)
    const saveInFlightRef = useRef<Promise<void> | null>(null)
    // A 4xx (e.g. validation) will fail identically on every retry — only
    // network/server errors are worth re-attempting automatically.
    const retryableRef = useRef(true)
    // Mirrors kept current via effect so flush()/save() (which run from
    // timers and event handlers) never read stale closures.
    const latestRef = useRef({ title: chapter?.title ?? '', body: chapter?.body ?? '', dirty: false })
    const chapterRef = useRef(chapter)
    const storyIdRef = useRef(storyId)
    const isAuthenticatedRef = useRef(isAuthenticated)
    useEffect(() => {
        chapterRef.current = chapter
        storyIdRef.current = storyId
        isAuthenticatedRef.current = isAuthenticated
    })

    const chapterId = chapter?.id ?? null
    useEffect(() => {
        const next = chapterRef.current
        latestRef.current = { title: next?.title ?? '', body: next?.body ?? '', dirty: false }
        setTitleState(next?.title ?? '')
        setBody(next?.body ?? '')
        setSaveState('idle')
        setLastSavedAt(dateFromApiTimestamp(next?.updatedAt))
    }, [chapterId])

    const setTitle = useCallback((value: string) => {
        latestRef.current.title = value
        latestRef.current.dirty = true
        setTitleState(value)
        setSaveState('dirty')
    }, [])

    const onBodyChange = useCallback((markdown: string) => {
        latestRef.current.body = markdown
        latestRef.current.dirty = true
        setBody(markdown)
        setSaveState('dirty')
    }, [])

    const save = useCallback(async (): Promise<boolean> => {
        const target = chapterRef.current
        const targetStoryId = storyIdRef.current
        if (!target || !targetStoryId) return false
        if (!isAuthenticated) {
            openLoginModal()
            return false
        }
        const snapshot = { title: latestRef.current.title, body: latestRef.current.body }
        latestRef.current.dirty = false
        setSaveState('saving')
        // The backend rejects blank/untrimmed titles (stored-text rule); a
        // blank title must not 422 the whole save, so it is simply not updated.
        // `status` is deliberately not sent: the PUT only touches provided
        // fields, and echoing the loaded status could clobber a transition
        // made in another tab.
        const trimmedTitle = snapshot.title.trim()
        const promise = updateStoryChapter(targetStoryId, target.id, {
            ...(trimmedTitle ? { title: trimmedTitle } : {}),
            body: snapshot.body,
        }).then(() => undefined)
        saveInFlightRef.current = promise
        try {
            await promise
            // Keystrokes that landed mid-save keep the draft dirty.
            setSaveState(latestRef.current.dirty ? 'dirty' : 'saved')
            setLastSavedAt(new Date())
            return true
        } catch (error) {
            console.error('Failed to save chapter:', error)
            retryableRef.current = !(error instanceof ApiError) || error.status >= 500 || error.status === 408 || error.status === 429
            latestRef.current.dirty = true
            setSaveState('error')
            return false
        } finally {
            if (saveInFlightRef.current === promise) saveInFlightRef.current = null
        }
    }, [isAuthenticated, openLoginModal, updateStoryChapter])

    // Debounced autosave: re-arms on every keystroke (body/title deps).
    useEffect(() => {
        if (timerRef.current) window.clearTimeout(timerRef.current)
        if (saveState !== 'dirty' || suspended || !chapterId || !isAuthenticated) return
        timerRef.current = window.setTimeout(() => void save(), AUTOSAVE_DELAY_MS)
        return () => {
            if (timerRef.current) window.clearTimeout(timerRef.current)
        }
    }, [body, chapterId, isAuthenticated, save, saveState, suspended, title])

    // Failed saves retry on their own — without this, a network blip leaves the
    // draft dirty until the user happens to type again (or forever, if they
    // close the tab believing the last keystrokes were saved). Permanent
    // rejections (4xx) don't loop; the header's explicit Retry still works.
    useEffect(() => {
        if (saveState !== 'error' || suspended || !chapterId || !isAuthenticated || !retryableRef.current) return
        const timer = window.setTimeout(() => void save(), SAVE_RETRY_DELAY_MS)
        return () => window.clearTimeout(timer)
    }, [chapterId, isAuthenticated, save, saveState, suspended])

    // In-app navigation unmounts the editor mid-debounce; fire-and-forget the
    // tail of typing so it isn't silently dropped.
    const saveRef = useRef(save)
    useEffect(() => {
        saveRef.current = save
    })
    useEffect(
        () => () => {
            if (latestRef.current.dirty && isAuthenticatedRef.current) void saveRef.current()
        },
        [],
    )

    // Warn before tab close/reload while anything is unsaved (or unsaveable).
    useEffect(() => {
        if (saveState !== 'dirty' && saveState !== 'saving' && saveState !== 'error') return
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault()
            e.returnValue = ''
        }
        window.addEventListener('beforeunload', handler)
        return () => window.removeEventListener('beforeunload', handler)
    }, [saveState])

    const flush = useCallback(async (): Promise<boolean> => {
        if (timerRef.current) {
            window.clearTimeout(timerRef.current)
            timerRef.current = null
        }
        if (saveInFlightRef.current) {
            try {
                await saveInFlightRef.current
            } catch {
                // save() already recorded the error state.
            }
        }
        if (latestRef.current.dirty) return save()
        return true
    }, [save])

    return {
        title,
        setTitle,
        body,
        onBodyChange,
        saveState,
        lastSavedAt,
        suspended,
        setSuspended,
        saveNow: save,
        flush,
    }
}
