/**
 * useNovelStudio — studio-level orchestration: chapter selection and CRUD,
 * novel metadata edits, and panel toggles. Persistence of the chapter body
 * itself lives in useChapterDraft; the codex in useCodex.
 *
 * Workspace R1: `readOnly` is true while the story's own workspace is archived.
 * Reading and chapter navigation keep working; chapter and metadata writes
 * become no-ops (the server would answer 409 WORKSPACE_ARCHIVED).
 */

import { useCallback, useEffect, useState } from 'react'
import { useData, useNavigation } from '@/app/hooks'
import type { Story, StoryChapter } from '@/shared'
import { useWorkspaceReadOnly } from '@/shared/hooks/useWorkspaceReadOnly'
import { chaptersFor } from '../utils/novelUtils'
import { useStoryWorkspace, type StoryWorkspace } from './useStoryWorkspace'

const CODEX_OPEN_STORAGE_KEY = 'magic_worlds:novel:codexOpen'
const TYPEWRITER_STORAGE_KEY = 'magic_worlds:novel:typewriter'

export interface NovelStudioApi {
    story: Story | null
    /** The open story's workspace, captured when it was opened. */
    workspace: StoryWorkspace
    /** The story's workspace is archived: the studio is read-only until it is restored. */
    readOnly: boolean
    chapters: StoryChapter[]
    activeChapter: StoryChapter | null
    selectChapter: (id: string) => void
    addChapter: () => Promise<StoryChapter | null>
    deleteChapter: (id: string) => Promise<void>
    saveNovelMeta: (patch: { title?: string; description?: string }) => Promise<void>
    focusMode: boolean
    toggleFocusMode: () => void
    codexOpen: boolean
    setCodexOpen: (open: boolean) => void
    typewriter: boolean
    toggleTypewriter: () => void
    historyOpen: boolean
    setHistoryOpen: (open: boolean) => void
}

function readCodexOpen(): boolean {
    try {
        return window.localStorage.getItem(CODEX_OPEN_STORAGE_KEY) !== 'false'
    } catch {
        return true
    }
}

function readTypewriter(): boolean {
    try {
        return window.localStorage.getItem(TYPEWRITER_STORAGE_KEY) === 'true'
    } catch {
        return false
    }
}

export function useNovelStudio(): NovelStudioApi {
    const { activeStory, createStoryChapter, deleteStoryChapter, updateStory } = useData()
    const { setPage } = useNavigation()
    const workspace = useStoryWorkspace(activeStory)
    const readOnly = useWorkspaceReadOnly(workspace.workspaceId)

    const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null)
    const [focusMode, setFocusMode] = useState(false)
    const [codexOpen, setCodexOpenState] = useState(readCodexOpen)
    const [typewriter, setTypewriter] = useState(readTypewriter)
    const [historyOpen, setHistoryOpen] = useState(false)

    const chapters = chaptersFor(activeStory)
    const activeChapter = chapters.find((chapter) => chapter.id === selectedChapterId) ?? chapters[0] ?? null

    useEffect(() => {
        if (!activeStory) setPage('gallery-stories')
    }, [activeStory, setPage])

    // Keep the selection on a real chapter as the list changes.
    useEffect(() => {
        if (chapters.length === 0) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSelectedChapterId(null)
            return
        }
        if (!selectedChapterId || !chapters.some((chapter) => chapter.id === selectedChapterId)) {
            setSelectedChapterId(chapters[0].id)
        }
    }, [chapters, selectedChapterId])

    const addChapter = useCallback(async (): Promise<StoryChapter | null> => {
        if (!activeStory || readOnly) return null
        // No explicit `order`: the backend assigns MAX(order)+1. Sending
        // chapters.length collides after a mid-list delete, and duplicate
        // orders permanently break the generate endpoint for the story.
        const chapter = await createStoryChapter(activeStory.id, {
            title: `Chapter ${chapters.length + 1}`,
            body: '',
            status: 'draft',
        })
        if (workspace.isCurrent()) setSelectedChapterId(chapter.id)
        return chapter
    }, [activeStory, chapters.length, createStoryChapter, readOnly, workspace])

    const deleteChapter = useCallback(
        async (id: string) => {
            if (!activeStory || readOnly || chapters.length <= 1) return
            const index = chapters.findIndex((chapter) => chapter.id === id)
            const neighbor = chapters[index + 1] ?? chapters[index - 1] ?? null
            await deleteStoryChapter(activeStory.id, id)
            if (!workspace.isCurrent()) return
            setSelectedChapterId((current) => (current === id ? (neighbor?.id ?? null) : current))
        },
        [activeStory, chapters, deleteStoryChapter, readOnly, workspace],
    )

    const saveNovelMeta = useCallback(
        async (patch: { title?: string; description?: string }) => {
            if (!activeStory || readOnly) return
            await updateStory(activeStory.id, patch)
        },
        [activeStory, readOnly, updateStory],
    )

    const setCodexOpen = useCallback((open: boolean) => {
        setCodexOpenState(open)
        try {
            window.localStorage.setItem(CODEX_OPEN_STORAGE_KEY, String(open))
        } catch {
            // Storage unavailable — keep the in-memory state.
        }
    }, [])

    const toggleTypewriter = useCallback(() => {
        setTypewriter((value) => {
            const next = !value
            try {
                window.localStorage.setItem(TYPEWRITER_STORAGE_KEY, String(next))
            } catch {
                // Storage unavailable — keep the in-memory state.
            }
            return next
        })
    }, [])

    return {
        story: activeStory,
        workspace,
        readOnly,
        chapters,
        activeChapter,
        selectChapter: setSelectedChapterId,
        addChapter,
        deleteChapter,
        saveNovelMeta,
        focusMode,
        toggleFocusMode: () => setFocusMode((value) => !value),
        codexOpen,
        setCodexOpen,
        typewriter,
        toggleTypewriter,
        historyOpen,
        setHistoryOpen,
    }
}
