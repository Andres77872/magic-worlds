import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Story, StoryChapter } from '@/shared'

const mocks = vi.hoisted(() => ({
    useNovelStudio: vi.fn(),
    useWordGoal: vi.fn(),
    setGoal: vi.fn(),
    setPage: vi.fn(),
    generate: vi.fn(),
    editor: { onGenerate: undefined as undefined | ((request: unknown, options?: { signal?: AbortSignal }) => Promise<unknown>) },
}))

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: true, openLoginModal: vi.fn() }),
    useNavigation: () => ({ setPage: mocks.setPage }),
    useData: () => ({
        generateStoryCandidate: mocks.generate,
        acceptStoryGeneration: vi.fn(),
        discardStoryGeneration: vi.fn(),
    }),
}))
vi.mock('@/features/codex', () => ({ CodexCardPickerDrawer: () => null }))
vi.mock('@/ui/primitives', () => ({
    Drawer: () => null,
    Icon: () => null,
    Toast: ({ open, title }: { open: boolean; title: string }) => open ? <div role="alert">{title}</div> : null,
    cx: (...values: unknown[]) => values.filter(Boolean).join(' '),
}))
vi.mock('../editor/NovelEditor', () => ({
    NovelEditor: ({ onGenerate }: { onGenerate: typeof mocks.editor.onGenerate }) => { mocks.editor.onGenerate = onGenerate; return null },
}))
vi.mock('../hooks/useNovelStudio', () => ({ useNovelStudio: mocks.useNovelStudio }))
vi.mock('../hooks/useWordGoal', () => ({ useWordGoal: mocks.useWordGoal }))
vi.mock('../hooks/useChapterDraft', () => ({
    useChapterDraft: () => ({
        title: 'Chapter 1',
        setTitle: vi.fn(),
        body: '',
        onBodyChange: vi.fn(),
        saveState: 'idle',
        lastSavedAt: null,
        suspended: false,
        setSuspended: vi.fn(),
        saveNow: vi.fn(),
        flush: vi.fn(async () => true),
    }),
}))
vi.mock('../hooks/useCodex', () => ({
    useCodex: () => ({
        mentionEntries: [],
        detectionNames: [],
        loreEntries: [],
        entries: [],
        busy: false,
        existingCardKeys: new Set(),
        addCards: vi.fn(),
    }),
}))
vi.mock('../hooks/useGenerationHistory', () => ({
    useGenerationHistory: () => ({ generations: [], patchStatus: vi.fn(), record: vi.fn() }),
}))
vi.mock('@/ui/components/ConfirmDialog', () => ({ ConfirmDialog: () => null }))
vi.mock('../hooks/useOpenCodexEntry', () => ({ useOpenCodexEntry: () => vi.fn() }))
vi.mock('./codex/CodexPanel', () => ({ CodexPanel: () => null }))
vi.mock('./NovelChapterRail', () => ({ NovelChapterRail: () => null }))
vi.mock('./StudioStatusStrip', () => ({
    StudioStatusStrip: ({ goal, onSetGoal }: { goal: number | null; onSetGoal: (goal: number | null) => void }) => (
        <button type="button" onClick={() => onSetGoal(2200)}>Goal {goal}</button>
    ),
}))
vi.mock('./NovelGenerationHistoryDrawer', () => ({ NovelGenerationHistoryDrawer: () => null }))
vi.mock('./NovelStudioHeader', () => ({ NovelStudioHeader: () => null }))

import { NovelStudio } from './NovelStudio'

function chapter(): StoryChapter {
    return {
        id: 'chapter-1',
        storyId: 'story-1',
        title: 'Chapter 1',
        body: '',
        order: 0,
        status: 'draft',
        wordGoal: 1800,
        povCardId: null,
        locationCardId: null,
        activeCardRefs: [],
        generationHistory: [],
    }
}

function story(activeChapter: StoryChapter): Story {
    return {
        id: 'story-1',
        title: 'Glass War',
        description: null,
        source: { kind: 'blank', id: null, title: null },
        chapters: [activeChapter],
        activeCardRefs: [],
        activeContext: {
            includeSelectedCards: true,
            includeLorebooks: true,
            includeRecentChapters: 2,
            tokenBudget: 6000,
            styleSource: 'whole_story',
            customStyleInstruction: null,
        },
    }
}

describe('NovelStudio word goal persistence', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        const activeChapter = chapter()
        mocks.useNovelStudio.mockReturnValue({
            story: story(activeChapter),
            chapters: [activeChapter],
            activeChapter,
            selectChapter: vi.fn(),
            addChapter: vi.fn(),
            deleteChapter: vi.fn(),
            saveNovelMeta: vi.fn(),
            focusMode: false,
            toggleFocusMode: vi.fn(),
            codexOpen: false,
            setCodexOpen: vi.fn(),
            typewriter: false,
            toggleTypewriter: vi.fn(),
            historyOpen: false,
            setHistoryOpen: vi.fn(),
        })
        mocks.useWordGoal.mockReturnValue({ goal: 1800, setGoal: mocks.setGoal })
        mocks.setGoal.mockResolvedValue(true)
    })

    it('binds the active stored chapter to the persisted word-goal hook', () => {
        render(<NovelStudio />)

        const activeChapter = mocks.useNovelStudio.mock.results[0].value.activeChapter
        expect(mocks.useWordGoal).toHaveBeenCalledWith('story-1', activeChapter)
        expect(screen.getByRole('button', { name: 'Goal 1800' })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Goal 1800' }))
        expect(mocks.setGoal).toHaveBeenCalledWith(2200)
    })

    it('surfaces a visible error when the stored word-goal save fails', async () => {
        mocks.setGoal.mockResolvedValue(false)
        render(<NovelStudio />)

        fireEvent.click(screen.getByRole('button', { name: 'Goal 1800' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('Word goal not saved')
    })
})

describe('NovelStudio generation requests', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        const activeChapter = chapter()
        mocks.useNovelStudio.mockReturnValue({ story: story(activeChapter), chapters: [activeChapter], activeChapter,
            focusMode: false, codexOpen: false, typewriter: false, historyOpen: false })
        mocks.useWordGoal.mockReturnValue({ goal: 1800, setGoal: mocks.setGoal })
    })

    it('asks again for the same command under its request ID until it finishes or is spent', async () => {
        render(<NovelStudio />)
        const request = { command: 'continue', instruction: 'More rain', prompt: 'More rain' }
        const generation = { id: 'generation-1', chapterId: 'chapter-1', output: 'Rain.' }
        const ids = () => mocks.generate.mock.calls.map((call) => (call[2] as { requestId: string }).requestId)
        mocks.generate.mockRejectedValueOnce(Object.assign(new Error('Dropped'), { code: 'LLM_EXECUTION_RECOVERY_REQUIRED' }))
            .mockResolvedValueOnce(generation)
            .mockRejectedValueOnce(Object.assign(new Error('Ended'), { code: 'LLM_EXECUTION_FINISHED' }))
            .mockResolvedValueOnce(generation)
        await expect(mocks.editor.onGenerate!(request)).rejects.toThrow('Dropped')
        await mocks.editor.onGenerate!(request)
        expect(ids()[1]).toBe(ids()[0])
        await expect(mocks.editor.onGenerate!(request)).rejects.toThrow('Ended')
        expect(ids()[2]).not.toBe(ids()[0])
        await mocks.editor.onGenerate!(request)
        expect(ids()[3]).not.toBe(ids()[2])
        expect(mocks.generate.mock.calls[0][1]).toEqual({ chapterId: 'chapter-1', command: 'continue', instruction: 'More rain', selection: undefined })
    })

    it('starts a new request for another command or after a deliberate stop', async () => {
        render(<NovelStudio />)
        const ids = () => mocks.generate.mock.calls.map((call) => (call[2] as { requestId: string }).requestId)
        mocks.generate.mockRejectedValue(Object.assign(new Error('Dropped'), { code: 'LLM_EXECUTION_RECOVERY_REQUIRED' }))
        await expect(mocks.editor.onGenerate!({ command: 'continue' })).rejects.toThrow()
        await expect(mocks.editor.onGenerate!({ command: 'rewrite' })).rejects.toThrow()
        const stopped = new AbortController(); stopped.abort()
        await expect(mocks.editor.onGenerate!({ command: 'rewrite' }, { signal: stopped.signal })).rejects.toThrow()
        await expect(mocks.editor.onGenerate!({ command: 'rewrite' })).rejects.toThrow()
        expect(ids()[1]).not.toBe(ids()[0])
        expect(ids()[2]).toBe(ids()[1])
        expect(ids()[3]).not.toBe(ids()[2])
    })
})
