/**
 * useNovelStudio — studio-level orchestration: chapter selection and CRUD,
 * novel metadata edits, and panel toggles. Persistence of the chapter body
 * itself lives in useChapterDraft; the codex in useCodex.
 */

import { useCallback, useEffect, useState } from 'react'
import { useData, useNavigation } from '@/app/hooks'
import type { Story, StoryChapter } from '@/shared'
import { chaptersFor } from '../utils/novelUtils'

const CODEX_OPEN_STORAGE_KEY = 'magic_worlds:novel:codexOpen'
const TYPEWRITER_STORAGE_KEY = 'magic_worlds:novel:typewriter'

export interface NovelStudioApi {
    story: Story | null
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
        if (!activeStory) return null
        const chapter = await createStoryChapter(activeStory.id, {
            title: `Chapter ${chapters.length + 1}`,
            body: '',
            order: chapters.length,
            status: 'draft',
        })
        setSelectedChapterId(chapter.id)
        return chapter
    }, [activeStory, chapters.length, createStoryChapter])

    const deleteChapter = useCallback(
        async (id: string) => {
            if (!activeStory || chapters.length <= 1) return
            const index = chapters.findIndex((chapter) => chapter.id === id)
            const neighbor = chapters[index + 1] ?? chapters[index - 1] ?? null
            await deleteStoryChapter(activeStory.id, id)
            setSelectedChapterId((current) => (current === id ? (neighbor?.id ?? null) : current))
        },
        [activeStory, chapters, deleteStoryChapter],
    )

    const saveNovelMeta = useCallback(
        async (patch: { title?: string; description?: string }) => {
            if (!activeStory) return
            await updateStory(activeStory.id, patch)
        },
        [activeStory, updateStory],
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
