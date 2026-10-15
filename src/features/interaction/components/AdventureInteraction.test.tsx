import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { act, fireEvent, render as baseRender, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Adventure, AdventureSnapshot, TurnEntry } from '@/shared'
import {
    createWorkspaceTestState,
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    testWorkspace,
    WorkspaceTestProvider,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { AdventureInteraction } from './AdventureInteraction'
import { SessionNarrationTierToggle } from './SessionNarrationTierToggle'

const mocks = vi.hoisted(() => ({
    loadTurns: vi.fn(),
    ensureSession: vi.fn(),
    setPage: vi.fn(),
    saveSnapshot: vi.fn(),
    configScope: null as { workspaceId: string } | null,
    leftPanel: null as {
        readOnly?: boolean
        onSnapshotChange?: (snapshot: AdventureSnapshot) => Promise<void>
        narratorPickerOpen?: boolean
        onNarratorPickerOpenChange?: (open: boolean) => void
        narrationTierSlot?: ReactNode
    } | null,
}))

let workspace = createWorkspaceTestState()
function wrap(ui: ReactElement) {
    return <WorkspaceTestProvider state={workspace}>{ui}</WorkspaceTestProvider>
}
function render(ui: ReactElement) {
    const view = baseRender(wrap(ui))
    return { ...view, rerender: (next: ReactElement) => view.rerender(wrap(next)) }
}
let adventure: Adventure | null
const draft: Adventure = {
    id: 'draft-1', draftId: 'draft-1', draft: { templateId: 't1', personaId: 'p1' },
    scenario: 'Open the gate', characters: [],
    snapshot: { template: { name: 'The gate', description: 'Open the gate', characters: [] } },
}

vi.mock('../../../app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: true }),
    useNavigation: () => ({ setPage: mocks.setPage, goBack: vi.fn() }),
    useData: () => ({ editingInProgress: adventure, ensureAdventureSession: mocks.ensureSession, saveInProgressSnapshot: mocks.saveSnapshot }),
}))
vi.mock('../chatSessionConfig', () => ({
    adventureChatConfig: (scope: { workspaceId: string }) => {
        mocks.configScope = scope
        return { loadTurns: mocks.loadTurns, workspaceId: scope.workspaceId }
    },
}))
vi.mock('./SessionNarrationTierToggle', () => ({ SessionNarrationTierToggle: () => null }))
vi.mock('./index', () => ({
    InteractionTopBar: () => null,
    SidePanelDrawer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    InteractionLeftPanel: (props: NonNullable<typeof mocks.leftPanel>) => {
        mocks.leftPanel = props
        return null
    },
    InteractionRightPanel: () => null,
    InteractionCenterPanel: ({ sessionId, turns, setTurns, ensureSession, onEditNarratorVoice }: {
        sessionId: number; turns: TurnEntry[]; setTurns: (turns: TurnEntry[]) => void; ensureSession?: () => Promise<number>
        onEditNarratorVoice?: () => void
    }) => <div>
        {onEditNarratorVoice && <button onClick={onEditNarratorVoice}>Change narrator voice</button>}
        <span data-testid="session-id">{String(sessionId)}</span>
        <input aria-label="Draft message" defaultValue="" />
        <span data-testid="transcript">{turns.map((turn) => turn.content).join(',')}</span>
        <button onClick={() => {
            setTurns([{ id: 'local-turn', type: 'user', content: 'Hello', timestamp: '' }])
            void ensureSession?.()
        }}>First interaction</button>
    </div>,
}))

describe('AdventureInteraction draft lifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        workspace = createWorkspaceTestState()
        mocks.configScope = null
        mocks.leftPanel = null
        adventure = draft
        mocks.loadTurns.mockResolvedValue([])
        mocks.ensureSession.mockResolvedValue(17)
    })

    it('opens a draft without loading history or creating a session', async () => {
        render(<AdventureInteraction />)
        expect(await screen.findByTestId('session-id')).toHaveTextContent('NaN')
        expect(mocks.loadTurns).not.toHaveBeenCalled()
        expect(mocks.ensureSession).not.toHaveBeenCalled()
    })

    it('preserves the mounted composer and turns when the first interaction assigns an id', async () => {
        const { rerender } = render(<AdventureInteraction />)
        const input = await screen.findByRole('textbox', { name: 'Draft message' })
        fireEvent.change(input, { target: { value: 'Continue writing' } })
        fireEvent.click(screen.getByText('First interaction'))
        adventure = { ...draft, id: '17', draft: undefined, status: 'in-progress' }
        rerender(<AdventureInteraction />)
        await waitFor(() => expect(screen.getByTestId('session-id')).toHaveTextContent('17'))
        expect(screen.getByRole('textbox', { name: 'Draft message' })).toBe(input)
        expect(input).toHaveValue('Continue writing')
        expect(screen.getByTestId('transcript')).toHaveTextContent('Hello')
        expect(mocks.loadTurns).not.toHaveBeenCalled()
    })

    it('loads stored history when reopening a session created from a draft', async () => {
        adventure = { ...draft, id: '17', draft: undefined, status: 'in-progress' }
        mocks.loadTurns.mockResolvedValue([{ id: '21', type: 'user', content: 'Saved message', timestamp: '' }])
        render(<AdventureInteraction />)
        expect(await screen.findByTestId('transcript')).toHaveTextContent('Saved message')
        expect(mocks.loadTurns).toHaveBeenCalledWith(17)
    })

    it('resets the composer and transcript when a different draft is selected', async () => {
        const { rerender } = render(<AdventureInteraction />)
        fireEvent.change(await screen.findByRole('textbox', { name: 'Draft message' }), { target: { value: 'Previous draft' } })
        fireEvent.click(screen.getByText('First interaction'))
        adventure = { ...draft, id: 'draft-2', draftId: 'draft-2' }
        rerender(<AdventureInteraction />)
        expect(await screen.findByRole('textbox', { name: 'Draft message' })).toHaveValue('')
        expect(screen.getByTestId('transcript')).toBeEmptyDOMElement()
    })

    it('runs a session in the committed workspace when the server sent no origin', async () => {
        adventure = { ...draft, id: '17', draft: undefined, status: 'in-progress' }
        render(<AdventureInteraction />)
        await waitFor(() => expect(mocks.loadTurns).toHaveBeenCalledWith(17))
        expect(mocks.configScope?.workspaceId).toBe(TEST_WORKSPACE_ID)
    })

    it('runs a session in its own workspace (organization.workspace_id)', async () => {
        adventure = { ...draft, id: '17', draft: undefined, status: 'in-progress', organization: { workspace_id: OTHER_WORKSPACE_ID } }
        render(<AdventureInteraction />)
        await waitFor(() => expect(mocks.loadTurns).toHaveBeenCalledWith(17))
        expect(mocks.configScope?.workspaceId).toBe(OTHER_WORKSPACE_ID)
    })

    it('saves snapshot edits (narrator voice included) through the session workspace client', async () => {
        adventure = { ...draft, id: '17', draft: undefined, status: 'in-progress', organization: { workspace_id: OTHER_WORKSPACE_ID } }
        render(<AdventureInteraction />)
        await waitFor(() => expect(mocks.leftPanel).not.toBeNull())
        expect(mocks.leftPanel?.readOnly).toBe(false)

        const snapshot = { ...draft.snapshot!, narrate_thoughts: true }
        await mocks.leftPanel?.onSnapshotChange?.(snapshot)
        expect(mocks.saveSnapshot).toHaveBeenCalledWith('17', snapshot, expect.objectContaining({
            workspaceScope: expect.objectContaining({ workspaceId: OTHER_WORKSPACE_ID }),
        }))
    })

    it('marks the details panel read-only when the session workspace is archived', async () => {
        workspace = createWorkspaceTestState({
            workspaces: [
                testWorkspace(TEST_WORKSPACE_ID, 'Main library'),
                testWorkspace(OTHER_WORKSPACE_ID, 'Novel A', { archived_at: '2026-10-02T00:00:00Z' }),
            ],
        })
        adventure = { ...draft, id: '17', draft: undefined, status: 'in-progress', organization: { workspace_id: OTHER_WORKSPACE_ID } }
        render(<AdventureInteraction />)
        await waitFor(() => expect(mocks.leftPanel?.readOnly).toBe(true))
    })
})

describe('AdventureInteraction narration voice wiring (ER-G1)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        workspace = createWorkspaceTestState()
        mocks.leftPanel = null
        mocks.loadTurns.mockResolvedValue([])
        adventure = { ...draft, id: '17', draft: undefined, status: 'in-progress', organization: { workspace_id: OTHER_WORKSPACE_ID } }
    })

    function tierSlot(): ReactElement<{ api: unknown; basePath: string; sessionId: number; readOnly?: boolean }> {
        const slot = mocks.leftPanel?.narrationTierSlot as ReactElement<{ children: ReactNode }>
        return Children.toArray(slot.props.children).find(child => isValidElement(child) && child.type === SessionNarrationTierToggle) as ReactElement<{ api: unknown; basePath: string; sessionId: number; readOnly?: boolean }>
    }

    it('mounts the session tier toggle on the session workspace client', async () => {
        render(<AdventureInteraction />)
        await waitFor(() => expect(mocks.leftPanel?.narrationTierSlot).toBeTruthy())
        expect(tierSlot().type).toBe(SessionNarrationTierToggle)
        expect(tierSlot().props).toMatchObject({ basePath: 'adventure-sessions', sessionId: 17, readOnly: false })
        expect(tierSlot().props.api).toEqual(expect.objectContaining({ workspaceScope: expect.objectContaining({ workspaceId: OTHER_WORKSPACE_ID }) }))
    })

    it('has no tier toggle for a draft', async () => {
        adventure = draft
        render(<AdventureInteraction />)
        await waitFor(() => expect(mocks.leftPanel).not.toBeNull())
        expect(mocks.leftPanel?.narrationTierSlot ?? null).toBeNull()
    })

    it('opens the left panel narrator picker from the center panel and closes it through the panel', async () => {
        render(<AdventureInteraction />)
        await waitFor(() => expect(mocks.leftPanel?.narratorPickerOpen).toBe(false))
        fireEvent.click(await screen.findByRole('button', { name: 'Change narrator voice' }))
        await waitFor(() => expect(mocks.leftPanel?.narratorPickerOpen).toBe(true))
        act(() => mocks.leftPanel?.onNarratorPickerOpenChange?.(false))
        await waitFor(() => expect(mocks.leftPanel?.narratorPickerOpen).toBe(false))
    })

    it('never opens the narrator picker on a read-only session', async () => {
        workspace = createWorkspaceTestState({
            workspaces: [
                testWorkspace(TEST_WORKSPACE_ID, 'Main library'),
                testWorkspace(OTHER_WORKSPACE_ID, 'Novel A', { archived_at: '2026-10-02T00:00:00Z' }),
            ],
        })
        render(<AdventureInteraction />)
        await waitFor(() => expect(mocks.leftPanel?.readOnly).toBe(true))
        expect(screen.queryByRole('button', { name: 'Change narrator voice' })).not.toBeInTheDocument()
        expect(tierSlot().props.readOnly).toBe(true)
        act(() => mocks.leftPanel?.onNarratorPickerOpenChange?.(true))
        expect(mocks.leftPanel?.narratorPickerOpen).toBe(false)
    })
})
