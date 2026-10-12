import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Story, StoryChapter } from '@/shared'

const mocks = vi.hoisted(() => ({
    useNovelStudio: vi.fn(),
    useWordGoal: vi.fn(),
    setGoal: vi.fn(),
    setPage: vi.fn(),
    generate: vi.fn(),
    flush: vi.fn(async () => true),
    interceptors: new Set<(proceed: () => void) => boolean>(),
    pickerWorkspaceId: undefined as string | null | undefined,
    editor: {
        onGenerate: undefined as undefined | ((request: unknown, options?: { signal?: AbortSignal }) => Promise<unknown>),
        props: {} as Record<string, unknown>,
    },
    acceptGeneration: vi.fn(),
    discardGeneration: vi.fn(),
}))

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: true, openLoginModal: vi.fn() }),
    useNavigation: () => ({
        setPage: mocks.setPage,
        registerNavigationInterceptor: (interceptor: (proceed: () => void) => boolean) => {
            mocks.interceptors.add(interceptor)
            return () => mocks.interceptors.delete(interceptor)
        },
    }),
    useData: () => ({
        generateStoryCandidate: mocks.generate,
        acceptStoryGeneration: mocks.acceptGeneration,
        discardStoryGeneration: mocks.discardGeneration,
    }),
}))
vi.mock('@/features/codex', () => ({
    CodexCardPickerDrawer: ({ workspaceId }: { workspaceId?: string | null }) => {
        mocks.pickerWorkspaceId = workspaceId
        return null
    },
}))
vi.mock('@/ui/primitives', () => ({
    Callout: ({ children }: { children: ReactNode }) => <div role="status">{children}</div>,
    Drawer: () => null,
    Icon: () => null,
    Toast: ({ open, title }: { open: boolean; title: string }) => open ? <div role="alert">{title}</div> : null,
    cx: (...values: unknown[]) => values.filter(Boolean).join(' '),
}))
vi.mock('../editor/NovelEditor', () => ({
    NovelEditor: (props: { onGenerate: typeof mocks.editor.onGenerate }) => {
        mocks.editor.onGenerate = props.onGenerate
        mocks.editor.props = props
        return null
    },
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
        flush: mocks.flush,
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
vi.mock('@/ui/components/ConfirmDialog', () => ({
    ConfirmDialog: ({ visible, title, onConfirm, onCancel }: { visible: boolean; title: string; onConfirm: () => void; onCancel: () => void }) => (
        visible ? (
            <div role="dialog" aria-label={title}>
                <button type="button" onClick={onConfirm}>Discard</button>
                <button type="button" onClick={onCancel}>Cancel</button>
            </div>
        ) : null
    ),
}))
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

const STORY_WORKSPACE = { workspaceId: '0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b', isCurrent: () => true, detachedApi: () => null }

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
            workspace: STORY_WORKSPACE,
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
        expect(mocks.useWordGoal).toHaveBeenCalledWith('story-1', activeChapter, STORY_WORKSPACE)
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
        mocks.useNovelStudio.mockReturnValue({ story: story(activeChapter), workspace: STORY_WORKSPACE, chapters: [activeChapter], activeChapter,
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

describe('NovelStudio workspace and navigation guard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.interceptors.clear()
        mocks.flush.mockResolvedValue(true)
        const activeChapter = chapter()
        mocks.useNovelStudio.mockReturnValue({ story: story(activeChapter), workspace: STORY_WORKSPACE, chapters: [activeChapter], activeChapter,
            focusMode: false, codexOpen: false, typewriter: false, historyOpen: false })
        mocks.useWordGoal.mockReturnValue({ goal: 1800, setGoal: mocks.setGoal })
    })

    it("browses the story's workspace in the card picker", () => {
        render(<NovelStudio />)
        expect(mocks.pickerWorkspaceId).toBe(STORY_WORKSPACE.workspaceId)
    })

    it('holds an app navigation until the draft is flushed, then lets it through once', async () => {
        render(<NovelStudio />)
        expect(mocks.interceptors.size).toBe(1)
        const [interceptor] = mocks.interceptors
        const proceed = vi.fn(() => {
            // The navigation it lets through consults the interceptors again.
            for (const guard of mocks.interceptors) expect(guard(vi.fn())).toBe(false)
        })

        expect(interceptor(proceed)).toBe(true)
        expect(proceed).not.toHaveBeenCalled()
        await act(async () => {})

        expect(mocks.flush).toHaveBeenCalledTimes(1)
        expect(proceed).toHaveBeenCalledTimes(1)
    })

    it('keeps the writer in the studio with the discard dialog when the save fails', async () => {
        mocks.flush.mockResolvedValue(false)
        render(<NovelStudio />)
        const [interceptor] = mocks.interceptors
        const proceed = vi.fn()

        expect(interceptor(proceed)).toBe(true)
        await act(async () => {})

        expect(proceed).not.toHaveBeenCalled()
        const dialog = screen.getByRole('dialog', { name: 'Unsaved changes' })
        fireEvent.click(dialog.querySelector('button')!)
        expect(proceed).toHaveBeenCalledTimes(1)
    })

    it('cancels the held navigation when the writer stays after a failed save', async () => {
        mocks.flush.mockResolvedValue(false)
        render(<NovelStudio />)
        const [interceptor] = mocks.interceptors as Set<(proceed: () => void, cancel?: () => void) => boolean>
        const proceed = vi.fn()
        const cancel = vi.fn()

        expect(interceptor(proceed, cancel)).toBe(true)
        await act(async () => {})
        const dialog = screen.getByRole('dialog', { name: 'Unsaved changes' })
        fireEvent.click(within(dialog).getByRole('button', { name: /cancel/i }))

        expect(proceed).not.toHaveBeenCalled()
        expect(cancel).toHaveBeenCalledTimes(1)
    })

    it('stops guarding once no story is open', () => {
        const { rerender } = render(<NovelStudio />)
        expect(mocks.interceptors.size).toBe(1)

        mocks.useNovelStudio.mockReturnValue({ story: null, workspace: STORY_WORKSPACE, chapters: [], activeChapter: null,
            focusMode: false, codexOpen: false, typewriter: false, historyOpen: false })
        rerender(<NovelStudio />)
        expect(mocks.interceptors.size).toBe(0)
    })
})

describe('NovelStudio while the story workspace is archived', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        const activeChapter = chapter()
        mocks.useNovelStudio.mockReturnValue({ story: story(activeChapter), workspace: STORY_WORKSPACE, readOnly: true, chapters: [activeChapter], activeChapter,
            focusMode: false, codexOpen: false, typewriter: false, historyOpen: false })
        mocks.useWordGoal.mockReturnValue({ goal: 1800, setGoal: mocks.setGoal })
    })

    it('renders the manuscript read-only and refuses generation, accept and discard without a request', async () => {
        render(<NovelStudio />)
        expect(mocks.editor.props.readOnly).toBe(true)
        expect(mocks.editor.props.onAddToCodex).toBeUndefined()

        await expect(mocks.editor.onGenerate!({ command: 'continue' })).rejects.toThrow('This workspace is archived. Restore it to create or edit content.')
        await (mocks.editor.props.onAcceptGeneration as (id: string) => Promise<void>)('generation-1')
        await (mocks.editor.props.onDiscardGeneration as (id: string) => Promise<void>)('generation-1')

        expect(mocks.generate).not.toHaveBeenCalled()
        expect(mocks.acceptGeneration).not.toHaveBeenCalled()
        expect(mocks.discardGeneration).not.toHaveBeenCalled()
    })

    it('answers Ctrl/Cmd+S and a goal change with the archived message instead of a save', async () => {
        render(<NovelStudio />)

        fireEvent.keyDown(window, { key: 's', ctrlKey: true })
        expect(await screen.findByRole('alert')).toHaveTextContent('This workspace is archived. Restore it to create or edit content.')

        fireEvent.click(screen.getByRole('button', { name: 'Goal 1800' }))
        expect(mocks.setGoal).not.toHaveBeenCalled()
    })
})
