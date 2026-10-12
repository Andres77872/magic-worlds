/**
 * useChapterDraft — per-chapter editable state (title + markdown body) with
 * dirty tracking, debounced autosave, and an awaitable flush() that the AI
 * flow uses to guarantee the backend sees the current body before generating.
 *
 * The draft resets only when the chapter id changes; story refetches (codex
 * ops, history refreshes) never clobber in-progress typing. `suspended`
 * pauses the autosave timer while an AI suggestion is alive in the editor so
 * suggestion text is never persisted.
 *
 * Workspace R1: saves go through DataProvider (the committed workspace) while
 * the story's workspace is current. A save that runs after a switch — the
 * unmount tail, a pending retry, or a dirty draft whose story was closed by the
 * switch — goes straight to the story's own workspace and never touches UI
 * state; it is never sent to the newly committed workspace.
 *
 * While the story's workspace is archived the draft is read-only: edits are
 * ignored (nothing becomes dirty), no autosave or retry is scheduled, and no
 * save is ever sent — the server would answer 409 WORKSPACE_ARCHIVED.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth, useData } from '@/app/hooks'
import { ApiError } from '@/infrastructure/api'
import type { StoryChapter } from '@/shared'
import { useWorkspaceReadOnly } from '@/shared/hooks/useWorkspaceReadOnly'
import { dateFromApiTimestamp } from '@/utils/time'
import type { NovelSaveState } from '../utils/novelUtils'
import type { StoryWorkspace } from './useStoryWorkspace'

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
    /** Save now. Resolves false without a request while read-only. */
    saveNow: () => Promise<boolean>
    /**
     * Cancel the timer, await any in-flight save, then save if still dirty.
     * Resolves false when the draft could not be persisted — callers that are
     * about to discard the draft (chapter switch) or need the backend to see
     * the current body (AI generation) must not proceed on false. Read-only, it
     * never saves: it resolves true unless an edit made before the archive is
     * still unsaved.
     */
    flush: () => Promise<boolean>
}

interface ChapterDraftOptions {
    storyId: string | null
    chapter: StoryChapter | null
    /** The open story's workspace (captured when the story was opened). */
    workspace: StoryWorkspace
}

export function useChapterDraft({ storyId, chapter, workspace }: ChapterDraftOptions): ChapterDraftApi {
    const { updateStoryChapter } = useData()
    const { isAuthenticated, openLoginModal } = useAuth()
    const readOnly = useWorkspaceReadOnly(workspace.workspaceId)

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
    const workspaceRef = useRef(workspace)
    const readOnlyRef = useRef(readOnly)
    useEffect(() => {
        chapterRef.current = chapter
        storyIdRef.current = storyId
        isAuthenticatedRef.current = isAuthenticated
        workspaceRef.current = workspace
        readOnlyRef.current = readOnly
    })
    // The chapter the draft text belongs to — set when the draft is seeded, so
    // a save never sends one chapter's text to another (or nowhere, after the
    // story went away under it).
    const draftTargetRef = useRef<{ storyId: string; chapterId: string } | null>(
        storyId && chapter ? { storyId, chapterId: chapter.id } : null,
    )

    /**
     * Persist the draft into the story's own workspace after a switch. No UI
     * or cache state: the studio that showed it belongs to another workspace.
     */
    const saveDetached = useCallback(async (): Promise<boolean> => {
        const target = draftTargetRef.current
        const api = workspaceRef.current.detachedApi()
        if (!target || !api || !isAuthenticatedRef.current || readOnlyRef.current) return false
        const trimmedTitle = latestRef.current.title.trim()
        latestRef.current.dirty = false
        try {
            await api.updateStoryChapter(target.storyId, target.chapterId, {
                ...(trimmedTitle ? { title: trimmedTitle } : {}),
                body: latestRef.current.body,
            })
            return true
        } catch (error) {
            console.error('Failed to save chapter:', error)
            latestRef.current.dirty = true
            return false
        }
    }, [])

    const chapterId = chapter?.id ?? null
    useEffect(() => {
        const next = chapterRef.current
        // A workspace switch closed the story under a dirty draft: keep the
        // writer's text by saving it where it came from before reseeding.
        if (!next && latestRef.current.dirty && !workspaceRef.current.isCurrent()) void saveDetached()
        const nextStoryId = storyIdRef.current
        draftTargetRef.current = next && nextStoryId ? { storyId: nextStoryId, chapterId: next.id } : null
        latestRef.current = { title: next?.title ?? '', body: next?.body ?? '', dirty: false }
        setTitleState(next?.title ?? '')
        setBody(next?.body ?? '')
        setSaveState('idle')
        setLastSavedAt(dateFromApiTimestamp(next?.updatedAt))
    }, [chapterId, saveDetached])

    const setTitle = useCallback((value: string) => {
        if (readOnlyRef.current) return
        latestRef.current.title = value
        latestRef.current.dirty = true
        setTitleState(value)
        setSaveState('dirty')
    }, [])

    const onBodyChange = useCallback((markdown: string) => {
        if (readOnlyRef.current) return
        latestRef.current.body = markdown
        latestRef.current.dirty = true
        setBody(markdown)
        setSaveState('dirty')
    }, [])

    const save = useCallback(async (): Promise<boolean> => {
        const target = draftTargetRef.current
        // An archived workspace rejects every write: never send one.
        if (!target || readOnlyRef.current) return false
        // Never send the draft to a workspace committed after the story was opened.
        if (!workspaceRef.current.isCurrent()) return saveDetached()
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
        const promise = updateStoryChapter(target.storyId, target.chapterId, {
            ...(trimmedTitle ? { title: trimmedTitle } : {}),
            body: snapshot.body,
        }).then(() => undefined)
        saveInFlightRef.current = promise
        try {
            await promise
            // A switch landed mid-save: the request kept its workspace; the UI is gone.
            if (!workspaceRef.current.isCurrent()) return true
            // Keystrokes that landed mid-save keep the draft dirty.
            setSaveState(latestRef.current.dirty ? 'dirty' : 'saved')
            setLastSavedAt(new Date())
            return true
        } catch (error) {
            console.error('Failed to save chapter:', error)
            latestRef.current.dirty = true
            if (!workspaceRef.current.isCurrent()) return false
            retryableRef.current = !(error instanceof ApiError) || error.status >= 500 || error.status === 408 || error.status === 429
            setSaveState('error')
            return false
        } finally {
            if (saveInFlightRef.current === promise) saveInFlightRef.current = null
        }
    }, [isAuthenticated, openLoginModal, saveDetached, updateStoryChapter])

    // Debounced autosave: re-arms on every keystroke (body/title deps).
    useEffect(() => {
        if (timerRef.current) window.clearTimeout(timerRef.current)
        if (saveState !== 'dirty' || suspended || readOnly || !chapterId || !isAuthenticated) return
        timerRef.current = window.setTimeout(() => void save(), AUTOSAVE_DELAY_MS)
        return () => {
            if (timerRef.current) window.clearTimeout(timerRef.current)
        }
    }, [body, chapterId, isAuthenticated, readOnly, save, saveState, suspended, title])

    // Failed saves retry on their own — without this, a network blip leaves the
    // draft dirty until the user happens to type again (or forever, if they
    // close the tab believing the last keystrokes were saved). Permanent
    // rejections (4xx) don't loop; the header's explicit Retry still works.
    useEffect(() => {
        if (saveState !== 'error' || suspended || readOnly || !chapterId || !isAuthenticated || !retryableRef.current) return
        const timer = window.setTimeout(() => void save(), SAVE_RETRY_DELAY_MS)
        return () => window.clearTimeout(timer)
    }, [chapterId, isAuthenticated, readOnly, save, saveState, suspended])

    // In-app navigation unmounts the editor mid-debounce; fire-and-forget the
    // tail of typing so it isn't silently dropped.
    const saveRef = useRef(save)
    useEffect(() => {
        saveRef.current = save
    })
    useEffect(
        () => () => {
            if (latestRef.current.dirty && isAuthenticatedRef.current && !readOnlyRef.current) void saveRef.current()
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
        // Read-only, nothing can become dirty, so leaving is never held. Only an
        // edit that was still unsaved when the archive landed reports false
        // (and gets the usual discard confirmation instead of a silent drop).
        if (readOnlyRef.current) return !latestRef.current.dirty
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
