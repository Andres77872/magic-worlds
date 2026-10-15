import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const addStoryCardRefs = vi.fn().mockResolvedValue(undefined)
const updateStoryCardRef = vi.fn().mockResolvedValue(undefined)
const deleteStoryCardRef = vi.fn().mockResolvedValue(undefined)

vi.mock('@/app/hooks', () => ({
    useData: () => ({ addStoryCardRefs, updateStoryCardRef, deleteStoryCardRef }),
    useFloatingWindows: () => ({ openWindow: vi.fn(), closeWindow: vi.fn(), closeAll: vi.fn(), focusWindow: vi.fn(), windows: [] }),
}))

vi.mock('@/infrastructure/api', () => {
    const apiService: Record<string, unknown> = {
        getLorebooks: vi.fn(),
        getCharacters: vi.fn().mockResolvedValue([]),
        getWorlds: vi.fn().mockResolvedValue([]),
        getItems: vi.fn().mockResolvedValue([]),
        getAdventureTemplates: vi.fn().mockResolvedValue([]),
    }
    apiService.withWorkspace = vi.fn(() => apiService)
    return { apiService, resolveMediaUrl: (url?: string | null) => url ?? undefined }
})

import type { Story, StoryCardRef, StoryCardSnapshot, StoryContextTrace } from '@/shared'
import { apiService } from '@/infrastructure/api'
import {
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    WorkspaceTestProvider,
    createWorkspaceTestState,
    testWorkspace,
    type WorkspaceTestState,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { useCodex } from '../../hooks/useCodex'
import { CodexPanel } from './CodexPanel'

const workspace = createWorkspaceTestState({ api: apiService })
const STORY_WORKSPACE = { workspaceId: TEST_WORKSPACE_ID, isCurrent: () => true, detachedApi: () => null }

function snapshot(overrides: Partial<StoryCardSnapshot> = {}): StoryCardSnapshot {
    return {
        id: 'card-x',
        name: 'Aria',
        description: 'A card.',
        story_card_kind: 'character',
        ...overrides,
    }
}

function ref(overrides: Partial<StoryCardRef>): StoryCardRef {
    return {
        id: 'ref-x',
        storyId: 's1',
        chapterId: null,
        kind: 'character',
        cardId: 'card-x',
        source: 'manual',
        enabled: true,
        precedence: 0,
        snapshot: snapshot(),
        ...overrides,
    }
}

function story(refs: StoryCardRef[]): Story {
    return {
        id: 's1',
        title: 'Glass War',
        description: null,
        source: { kind: 'blank', id: null, title: null },
        chapters: [],
        activeCardRefs: refs,
        activeContext: {
            includeSelectedCards: true,
            includeLorebooks: true,
            includeRecentChapters: 2,
            tokenBudget: 6000,
            styleSource: 'current_chapter',
            customStyleInstruction: null,
        },
    }
}

function Panel({ refs, trace, storyWorkspace = STORY_WORKSPACE }: { refs: StoryCardRef[]; trace?: StoryContextTrace | null; storyWorkspace?: typeof STORY_WORKSPACE }) {
    const codex = useCodex({ story: story(refs), workspace: storyWorkspace })
    return (
        <CodexPanel
            codex={codex}
            workspaceId={storyWorkspace.workspaceId}
            requireAuth={() => true}
            onOpenCardPicker={() => {}}
            contextTrace={trace}
        />
    )
}

function Harness(props: { refs: StoryCardRef[]; trace?: StoryContextTrace | null }) {
    return (
        <WorkspaceTestProvider state={workspace}>
            <Panel {...props} />
        </WorkspaceTestProvider>
    )
}

/** Opens the single "Add" disclosure so its two destinations are reachable. */
function openAddMenu() {
    fireEvent.click(screen.getAllByTestId('codex-add')[0])
}

const WORLD_REF = ref({
    id: 'b',
    kind: 'world',
    cardId: 'w1',
    precedence: 1,
    snapshot: snapshot({ id: 'w1', name: 'Eldoria', story_card_kind: 'world', description: 'A drowned kingdom.' }),
})

const RAW_LOREBOOK = {
    id: 'lb-1',
    name: 'Twin Courts',
    description: 'Court lore',
    entries: [
        { entry_id: 'entry-1', title: 'The Glass Pact', entry_type: 'rule', content: 'An oath sworn on shattered mirrors.', keys: ['pact'], enabled: true },
        { entry_id: 'entry-2', title: 'The Mirror Court', entry_type: 'place', content: 'A palace of halls.', keys: ['court'], enabled: true },
    ],
}

afterEach(() => vi.unstubAllEnvs())

describe('CodexPanel', () => {
    it('hides stored disabled references and restores them unchanged in an enabled build', () => {
        const stored = [
            ref({ id: 'visible' }),
            ref({ id: 'hidden-adventure', kind: 'adventure_template', snapshot: snapshot({ name: 'Hidden quest', story_card_kind: 'adventure_template' }) }),
            ref({ id: 'hidden-lore', kind: 'lorebook_entry', snapshot: snapshot({ name: 'Hidden pact', story_card_kind: 'lorebook_entry' }) }),
        ]
        const original = structuredClone(stored)
        vi.stubEnv('VITE_FEATURE_NOVELS_ENABLED', 'true')
        vi.stubEnv('VITE_FEATURE_ADVENTURES_ENABLED', 'false')
        vi.stubEnv('VITE_FEATURE_LOREBOOKS_ENABLED', 'false')
        const disabled = render(<Harness refs={stored} />)
        expect(screen.getByText('Aria')).toBeInTheDocument()
        expect(screen.queryByText('Hidden quest')).not.toBeInTheDocument()
        expect(screen.queryByText('Hidden pact')).not.toBeInTheDocument()
        expect(screen.getByTestId('codex-context-meter')).toHaveTextContent('1/1')
        expect(updateStoryCardRef).not.toHaveBeenCalled()
        expect(deleteStoryCardRef).not.toHaveBeenCalled()
        expect(stored).toEqual(original)

        disabled.unmount()
        vi.stubEnv('VITE_FEATURE_ADVENTURES_ENABLED', 'true')
        vi.stubEnv('VITE_FEATURE_LOREBOOKS_ENABLED', 'true')
        render(<Harness refs={stored} />)
        expect(screen.getByText('Hidden quest')).toBeInTheDocument()
        expect(screen.getByText('Hidden pact')).toBeInTheDocument()
        expect(screen.getByTestId('codex-context-meter')).toHaveTextContent('3/3')
        expect(stored).toEqual(original)
    })
    it('keeps card selection but hides lorebooks when only novels are enabled', () => {
        vi.stubEnv('VITE_FEATURE_NOVELS_ENABLED', 'true')
        vi.stubEnv('VITE_FEATURE_LOREBOOKS_ENABLED', 'false')
        render(<Harness refs={[]} />)
        openAddMenu()
        expect(screen.queryByRole('menuitem', { name: /lorebook/i })).not.toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: /cards/i })).toBeInTheDocument()
        expect(apiService.getLorebooks).not.toHaveBeenCalled()
    })
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(apiService.getLorebooks).mockResolvedValue([RAW_LOREBOOK])
    })

    it('renders grouped entries with counts and an empty state otherwise', () => {
        const { rerender } = render(<Harness refs={[]} />)
        expect(screen.getByText('Your codex is empty')).toBeInTheDocument()
        // The empty state offers the same single Add control as the header.
        expect(screen.getAllByTestId('codex-add')).toHaveLength(2)
        expect(screen.queryByTestId('codex-filter')).not.toBeInTheDocument()

        rerender(<Harness refs={[ref({ id: 'a' }), WORLD_REF]} />)
        expect(screen.getByText('Characters')).toBeInTheDocument()
        expect(screen.getByText('Worlds')).toBeInTheDocument()
        expect(screen.getByText('Aria')).toBeInTheDocument()
        expect(screen.getByText('Eldoria')).toBeInTheDocument()
    })

    it('shows the context meter with a hint until a trace exists, then the trace numbers', () => {
        const { rerender } = render(<Harness refs={[ref({ id: 'a' }), ref({ id: 'b', enabled: false })]} />)

        const meter = screen.getByTestId('codex-context-meter')
        expect(within(meter).getByText('1/2')).toBeInTheDocument()
        expect(within(meter).getByText('Disabled entries are never sent.')).toBeInTheDocument()
        expect(meter.textContent).not.toMatch(/NaN|null/)
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')

        const trace: StoryContextTrace = {
            cards: [],
            loreEntries: [],
            chapters: [
                { chapterId: 'c1', title: 'One', included: true, reason: 'current', estimatedTokens: 120 },
                { chapterId: 'c2', title: 'Two', included: true, reason: 'recent', estimatedTokens: 80 },
            ],
            totalEstimatedTokens: 1420,
        }
        rerender(<Harness refs={[ref({ id: 'a' }), ref({ id: 'b', enabled: false })]} trace={trace} />)

        expect(within(screen.getByTestId('codex-context-meter')).getByText('~1420 tokens · 2 chapters')).toBeInTheDocument()
    })

    it('filters entries by label and description, then reports no matches', () => {
        render(<Harness refs={[ref({ id: 'a' }), WORLD_REF]} />)

        fireEvent.change(screen.getByTestId('codex-filter'), { target: { value: 'drowned' } })
        expect(screen.getByText('Eldoria')).toBeInTheDocument()
        expect(screen.queryByText('Aria')).not.toBeInTheDocument()

        fireEvent.change(screen.getByTestId('codex-filter'), { target: { value: 'zzz' } })
        expect(screen.getByTestId('codex-no-matches')).toHaveTextContent('No matching entries')
        // A filtered-out codex is not an empty codex.
        expect(screen.queryByText('Your codex is empty')).not.toBeInTheDocument()
    })

    it('closes the add menu on Escape and on an outside click', () => {
        render(<Harness refs={[]} />)
        const trigger = screen.getAllByTestId('codex-add')[0]

        fireEvent.click(trigger)
        expect(screen.getByRole('menu')).toBeInTheDocument()
        expect(trigger).toHaveAttribute('aria-expanded', 'true')

        fireEvent.keyDown(document, { key: 'Escape' })
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
        expect(trigger).toHaveFocus()

        fireEvent.click(trigger)
        expect(screen.getByRole('menu')).toBeInTheDocument()
        fireEvent.mouseDown(document.body)
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('toggles an entry through its switch', async () => {
        render(<Harness refs={[ref({ id: 'a' })]} />)

        fireEvent.click(screen.getByRole('switch', { name: 'Disable Aria' }))

        await waitFor(() => expect(updateStoryCardRef).toHaveBeenCalledWith('s1', 'a', { enabled: false }))
    })

    it('removes an entry only after the confirm dialog', async () => {
        render(<Harness refs={[ref({ id: 'a' })]} />)

        fireEvent.click(screen.getByRole('button', { name: 'Remove Aria' }))
        const dialog = await screen.findByRole('dialog')
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
        expect(deleteStoryCardRef).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'Remove Aria' }))
        const dialog2 = await screen.findByRole('dialog')
        fireEvent.click(within(dialog2).getByRole('button', { name: 'Remove' }))
        await waitFor(() => expect(deleteStoryCardRef).toHaveBeenCalledWith('s1', 'a'))
    })

    it('edits a snapshot through the entry drawer', async () => {
        render(<Harness refs={[ref({ id: 'a', snapshot: snapshot({ race: 'elf' }) })]} />)

        fireEvent.click(screen.getByRole('button', { name: 'Edit Aria' }))
        const nameInput = await screen.findByTestId('codex-entry-name')
        fireEvent.change(nameInput, { target: { value: 'Aria the Red' } })
        fireEvent.change(screen.getByTestId('codex-entry-content'), { target: { value: 'A ranger.' } })
        fireEvent.click(screen.getByTestId('codex-entry-save'))

        await waitFor(() =>
            expect(updateStoryCardRef).toHaveBeenCalledWith('s1', 'a', {
                snapshot: {
                    id: 'card-x',
                    name: 'Aria the Red',
                    description: 'A ranger.',
                    race: 'elf',
                    story_card_kind: 'character',
                },
            }),
        )
    })

    it('opens the editor drawer from the row name — the one edit control', async () => {
        render(<Harness refs={[ref({ id: 'a' })]} />)

        fireEvent.click(screen.getByRole('button', { name: 'Edit Aria' }))

        expect(await screen.findByTestId('codex-entry-name')).toHaveValue('Aria')
    })

    it('clones selected lorebook entries through the two-step drawer', async () => {
        render(<Harness refs={[]} />)

        openAddMenu()
        fireEvent.click(screen.getByRole('menuitem', { name: 'Add lorebook' }))
        const book = await screen.findByTestId('codex-lorebook-option')
        fireEvent.click(book)

        // Both enabled entries are pre-checked; uncheck the second.
        const entries = await screen.findAllByTestId('codex-lorebook-entry')
        expect(entries).toHaveLength(2)
        fireEvent.click(entries[1])
        fireEvent.click(screen.getByTestId('codex-clone-entries-submit'))

        await waitFor(() => expect(addStoryCardRefs).toHaveBeenCalledTimes(1))
        // The picker lists the story's own workspace.
        expect(apiService.withWorkspace).toHaveBeenCalledWith(TEST_WORKSPACE_ID)
        const [, payloads] = addStoryCardRefs.mock.calls[0]
        expect(payloads).toHaveLength(1)
        expect(payloads[0]).toMatchObject({
            kind: 'lorebook_entry',
            cardId: 'entry-1',
            snapshot: {
                id: 'entry-1',
                name: 'The Glass Pact',
                description: 'An oath sworn on shattered mirrors.',
                source_lorebook_id: 'lb-1',
                story_card_kind: 'lorebook_entry',
            },
        })
    })
})

describe('CodexPanel in an archived workspace', () => {
    const ARCHIVED = 'This workspace is archived. Restore it to create or edit content.'
    // The story lives in Novel A, which is archived; the open workspace is not.
    const ARCHIVED_STORY = { workspaceId: OTHER_WORKSPACE_ID, isCurrent: () => true, detachedApi: () => null }
    let archivedState: WorkspaceTestState

    function ArchivedHarness({ refs }: { refs: StoryCardRef[] }) {
        return (
            <WorkspaceTestProvider state={archivedState}>
                <Panel refs={refs} storyWorkspace={ARCHIVED_STORY} />
            </WorkspaceTestProvider>
        )
    }

    beforeEach(() => {
        vi.clearAllMocks()
        archivedState = createWorkspaceTestState({
            api: apiService,
            workspaces: [
                testWorkspace(TEST_WORKSPACE_ID, 'Main library'),
                testWorkspace(OTHER_WORKSPACE_ID, 'Novel A', { archived_at: '2026-10-10T00:00:00Z' }),
            ],
        })
    })

    it('disables Add in the header and the empty state', () => {
        render(<ArchivedHarness refs={[]} />)

        const adds = screen.getAllByTestId('codex-add')
        expect(adds).toHaveLength(2)
        for (const add of adds) expect(add).toBeDisabled()
        fireEvent.click(adds[0])
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('keeps entries readable and filterable but never toggles, removes or edits them', async () => {
        render(<ArchivedHarness refs={[ref({ id: 'a' }), WORLD_REF]} />)

        expect(screen.getByRole('switch', { name: 'Disable Aria' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Remove Aria' })).toBeDisabled()
        fireEvent.click(screen.getByRole('switch', { name: 'Disable Aria' }))
        fireEvent.click(screen.getByRole('button', { name: 'Remove Aria' }))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

        fireEvent.change(screen.getByTestId('codex-filter'), { target: { value: 'drowned' } })
        expect(screen.getByText('Eldoria')).toBeInTheDocument()
        expect(screen.queryByText('Aria')).not.toBeInTheDocument()

        // The entry opens for reading, not editing.
        fireEvent.click(screen.getByRole('button', { name: 'Edit Eldoria' }))
        expect(await screen.findByTestId('codex-entry-name')).toHaveValue('Eldoria')
        expect(screen.getByTestId('codex-entry-name')).toHaveAttribute('readonly')
        expect(screen.getByTestId('codex-entry-content')).toHaveAttribute('readonly')
        expect(screen.getByTestId('codex-entry-archived')).toHaveTextContent(ARCHIVED)
        expect(screen.getByTestId('codex-entry-save')).toBeDisabled()
        expect(updateStoryCardRef).not.toHaveBeenCalled()
        expect(deleteStoryCardRef).not.toHaveBeenCalled()
        expect(addStoryCardRefs).not.toHaveBeenCalled()
    })
})
