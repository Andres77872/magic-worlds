/**
 * Workspace R1 (document 08): a story whose workspace is archived opens as a
 * reader. Real studio tree — hooks, rail, header, status strip, codex panel and
 * the TipTap editor — over a mocked DataProvider, so every write it could send
 * is a spy that must stay untouched.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { EditorView } from '@tiptap/pm/view'

const data = vi.hoisted(() => ({
    activeStory: null as unknown,
    createStoryChapter: vi.fn(),
    deleteStoryChapter: vi.fn(),
    updateStory: vi.fn(),
    updateStoryChapter: vi.fn(),
    addStoryCardRefs: vi.fn(),
    updateStoryCardRef: vi.fn(),
    deleteStoryCardRef: vi.fn(),
    generateStoryCandidate: vi.fn(),
    acceptStoryGeneration: vi.fn(),
    discardStoryGeneration: vi.fn(),
}))
const navigation = vi.hoisted(() => ({ setPage: vi.fn(), interceptors: new Set<(proceed: () => void) => boolean>() }))

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: true, openLoginModal: vi.fn() }),
    useNavigation: () => ({
        setPage: navigation.setPage,
        registerNavigationInterceptor: (interceptor: (proceed: () => void) => boolean) => {
            navigation.interceptors.add(interceptor)
            return () => navigation.interceptors.delete(interceptor)
        },
    }),
    useData: () => data,
    useFloatingWindows: () => ({ openWindow: vi.fn(), closeWindow: vi.fn(), closeAll: vi.fn(), focusWindow: vi.fn(), windows: [] }),
}))
// The model picker resolves profiles over the network; only its disabled flag matters here.
vi.mock('@/features/llmProfiles/LlmFeatureControl', () => ({
    LlmFeatureControl: ({ disabled }: { disabled?: boolean }) => <div data-testid="llm-feature-control" data-disabled={String(Boolean(disabled))} />,
}))

import type { ReactElement } from 'react'
import type { Story, StoryChapter } from '@/shared'
import {
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    WorkspaceTestProvider,
    createWorkspaceTestState,
    testWorkspace,
    type WorkspaceTestState,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { NovelStudio } from './NovelStudio'

const ARCHIVED = 'This workspace is archived. Restore it to create or edit content.'
const ARCHIVED_AT = '2026-10-10T00:00:00Z'

function chapter(id: string, title: string, body: string, order: number): StoryChapter {
    return {
        id,
        storyId: 'story-1',
        title,
        body,
        order,
        status: 'draft',
        wordGoal: null,
        povCardId: null,
        locationCardId: null,
        activeCardRefs: [],
        generationHistory: [],
    }
}

function story(workspaceId: string): Story {
    return {
        id: 'story-1',
        title: 'Glass War',
        description: null,
        source: { kind: 'blank', id: null, title: null },
        chapters: [chapter('ch-1', 'The Gate', 'The gate held.', 0), chapter('ch-2', 'The Wall', 'The wall fell.', 1)],
        activeCardRefs: [{
            id: 'ref-1',
            storyId: 'story-1',
            chapterId: null,
            kind: 'character',
            cardId: 'card-1',
            source: 'manual',
            enabled: true,
            precedence: 0,
            snapshot: { id: 'card-1', name: 'Aria', description: 'A ranger.', story_card_kind: 'character' },
        }],
        activeContext: {
            includeSelectedCards: true,
            includeLorebooks: true,
            includeRecentChapters: 2,
            tokenBudget: 6000,
            styleSource: 'whole_story',
            customStyleInstruction: null,
        },
        organization: { workspace_id: workspaceId },
    }
}

const WRITES = [
    'createStoryChapter',
    'deleteStoryChapter',
    'updateStory',
    'updateStoryChapter',
    'addStoryCardRefs',
    'updateStoryCardRef',
    'deleteStoryCardRef',
    'generateStoryCandidate',
    'acceptStoryGeneration',
    'discardStoryGeneration',
] as const

function expectNoWrites() {
    for (const name of WRITES) expect(data[name], name).not.toHaveBeenCalled()
}

let workspace: WorkspaceTestState

function inWorkspace(ui: ReactElement) {
    return <WorkspaceTestProvider state={workspace}>{ui}</WorkspaceTestProvider>
}

/** Novel A is archived; the main library stays active. */
function workspaces(archived: boolean) {
    return [
        testWorkspace(TEST_WORKSPACE_ID, 'Main library'),
        testWorkspace(OTHER_WORKSPACE_ID, 'Novel A', archived ? { archived_at: ARCHIVED_AT } : {}),
    ]
}

const originalElementFromPoint = document.elementFromPoint

describe('NovelStudio in an archived workspace', () => {
    beforeAll(() => {
        document.elementFromPoint = vi.fn(() => document.body)
        vi.spyOn(EditorView.prototype, 'coordsAtPos').mockReturnValue({ left: 40, right: 42, top: 80, bottom: 98 })
    })

    afterAll(() => {
        document.elementFromPoint = originalElementFromPoint
        vi.restoreAllMocks()
    })

    beforeEach(() => {
        vi.clearAllMocks()
        window.localStorage.clear()
        navigation.interceptors.clear()
        for (const name of WRITES) data[name].mockResolvedValue(undefined)
    })

    it('opens the story as a reader: nothing edits, nothing generates, nothing is sent', async () => {
        workspace = createWorkspaceTestState({ selectedWorkspaceId: OTHER_WORKSPACE_ID, workspaces: workspaces(true) })
        data.activeStory = story(OTHER_WORKSPACE_ID)
        // A browser-only word goal waiting to migrate must stay where it is.
        window.localStorage.setItem('magic_worlds:novel:wordGoal:story-1:ch-1', '1800')
        render(inWorkspace(<NovelStudio />))

        // The manuscript is not editable.
        const prose = await screen.findByLabelText('Chapter body')
        expect(prose).toHaveAttribute('contenteditable', 'false')
        expect(screen.getByTestId('novel-chapter-title')).toHaveAttribute('readonly')
        expect(screen.getByTestId('novel-title')).toBeDisabled()

        // Chapters: no add, no delete.
        expect(screen.getByTestId('novel-chapter-add')).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Delete The Gate' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Delete The Wall' })).toBeDisabled()

        // Generation: the beat shortcut opens nothing and the model picker is off.
        fireEvent.keyDown(screen.getByTestId('novel-editor'), { key: 'Enter', ctrlKey: true })
        expect(screen.queryByTestId('beat-composer')).not.toBeInTheDocument()
        expect(screen.getByTestId('llm-feature-control')).toHaveAttribute('data-disabled', 'true')

        // Codex: entries stay readable, nothing adds, removes or toggles.
        const codex = screen.getByTestId('codex-panel')
        expect(within(codex).getByText('Aria')).toBeInTheDocument()
        expect(within(codex).getByTestId('codex-add')).toBeDisabled()
        expect(within(codex).getByRole('button', { name: 'Remove Aria' })).toBeDisabled()
        expect(within(codex).getByRole('switch', { name: 'Disable Aria' })).toBeDisabled()

        // The word goal is a readout only.
        expect(screen.getByTestId('novel-word-goal')).toBeDisabled()

        // Ctrl/Cmd+S says why instead of saving.
        fireEvent.keyDown(window, { key: 's', ctrlKey: true })
        expect(await screen.findByText(ARCHIVED)).toBeInTheDocument()

        await act(async () => {})
        expectNoWrites()
        expect(window.localStorage.getItem('magic_worlds:novel:wordGoal:story-1:ch-1')).toBe('1800')
    })

    it('still navigates chapters and leaves without holding the navigation', async () => {
        workspace = createWorkspaceTestState({ selectedWorkspaceId: OTHER_WORKSPACE_ID, workspaces: workspaces(true) })
        data.activeStory = story(OTHER_WORKSPACE_ID)
        render(inWorkspace(<NovelStudio />))
        await screen.findByLabelText('Chapter body')

        fireEvent.click(screen.getAllByTestId('novel-chapter-row')[1])

        await waitFor(() => expect(screen.getByTestId('novel-header-chapter')).toHaveTextContent('The Wall'))
        expect(screen.getByLabelText('Chapter body')).toHaveTextContent('The wall fell.')
        expect(screen.getByLabelText('Chapter body')).toHaveAttribute('contenteditable', 'false')

        // An app navigation is let straight through: there is nothing to save.
        const [interceptor] = navigation.interceptors
        const proceed = vi.fn()
        expect(interceptor(proceed)).toBe(true)
        await waitFor(() => expect(proceed).toHaveBeenCalledTimes(1))
        expect(screen.queryByRole('dialog', { name: 'Unsaved changes' })).not.toBeInTheDocument()
        expectNoWrites()
    })

    it('keeps Find and disables Replace', async () => {
        workspace = createWorkspaceTestState({ selectedWorkspaceId: OTHER_WORKSPACE_ID, workspaces: workspaces(true) })
        data.activeStory = story(OTHER_WORKSPACE_ID)
        render(inWorkspace(<NovelStudio />))
        await screen.findByLabelText('Chapter body')

        fireEvent.click(screen.getByTestId('novel-header-more'))
        fireEvent.click(screen.getByRole('menuitem', { name: /Find/ }))

        fireEvent.change(await screen.findByTestId('find-input'), { target: { value: 'gate' } })
        await waitFor(() => expect(screen.getByTestId('find-count')).toHaveTextContent('1'))
        expect(screen.getByTestId('replace-input')).toBeDisabled()
        expect(screen.getByTestId('replace-all')).toBeDisabled()
        expect(screen.getByTestId('find-archived')).toHaveTextContent(ARCHIVED)
        expectNoWrites()
    })

    it("says so in the studio when the story's archived workspace is not the open one", async () => {
        workspace = createWorkspaceTestState({ selectedWorkspaceId: TEST_WORKSPACE_ID, workspaces: workspaces(true) })
        data.activeStory = story(OTHER_WORKSPACE_ID)
        render(inWorkspace(<NovelStudio />))

        expect(await screen.findByTestId('novel-archived-notice')).toHaveTextContent(ARCHIVED)
        expect(screen.getByLabelText('Chapter body')).toHaveAttribute('contenteditable', 'false')
    })

    it('stays a writing room while the workspace is active', async () => {
        workspace = createWorkspaceTestState({ selectedWorkspaceId: OTHER_WORKSPACE_ID, workspaces: workspaces(false) })
        data.activeStory = story(OTHER_WORKSPACE_ID)
        render(inWorkspace(<NovelStudio />))

        expect(await screen.findByLabelText('Chapter body')).toHaveAttribute('contenteditable', 'true')
        expect(screen.getByTestId('novel-chapter-add')).toBeEnabled()
        expect(screen.getByTestId('codex-add')).toBeEnabled()
        expect(screen.queryByTestId('novel-archived-notice')).not.toBeInTheDocument()

        data.createStoryChapter.mockResolvedValue(chapter('ch-3', 'Chapter 3', '', 2))
        fireEvent.click(screen.getByTestId('novel-chapter-add'))
        await waitFor(() => expect(data.createStoryChapter).toHaveBeenCalledTimes(1))
    })
})
