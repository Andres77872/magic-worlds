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
import type { StoryChapter } from '@/shared'
import { dateFromApiTimestamp } from '@/utils/time'
import type { NovelSaveState } from '../utils/novelUtils'

const AUTOSAVE_DELAY_MS = 1200

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
    saveNow: () => Promise<void>
    /** Cancel the timer, await any in-flight save, then save if still dirty. */
    flush: () => Promise<void>
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
    // Mirrors kept current via effect so flush()/save() (which run from
    // timers and event handlers) never read stale closures.
    const latestRef = useRef({ title: chapter?.title ?? '', body: chapter?.body ?? '', dirty: false })
    const chapterRef = useRef(chapter)
    const storyIdRef = useRef(storyId)
    useEffect(() => {
        chapterRef.current = chapter
        storyIdRef.current = storyId
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

    const save = useCallback(async () => {
        const target = chapterRef.current
        const targetStoryId = storyIdRef.current
        if (!target || !targetStoryId) return
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        const snapshot = { title: latestRef.current.title, body: latestRef.current.body }
        latestRef.current.dirty = false
        setSaveState('saving')
        const promise = updateStoryChapter(targetStoryId, target.id, {
            title: snapshot.title,
            body: snapshot.body,
            status: target.status,
        }).then(() => undefined)
        saveInFlightRef.current = promise
        try {
            await promise
            // Keystrokes that landed mid-save keep the draft dirty.
            setSaveState(latestRef.current.dirty ? 'dirty' : 'saved')
            setLastSavedAt(new Date())
        } catch (error) {
            console.error('Failed to save chapter:', error)
            latestRef.current.dirty = true
            setSaveState('error')
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

    const flush = useCallback(async () => {
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
        if (latestRef.current.dirty) await save()
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
