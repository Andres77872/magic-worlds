import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { WorkspaceContext } from '@/app/providers/workspaceContext'
import type { ApiService } from '@/infrastructure/api'
import type { Lorebook } from '@/shared'
import {
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    createWorkspaceTestState,
    testWorkspace,
    type WorkspaceTestState,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { SessionLorebookPanel } from './SessionLorebookPanel'

const mocks = vi.hoisted(() => {
    const mocks = { listLorebookAttachments: vi.fn(), putLorebookAttachment: vi.fn(), deleteLorebookAttachment: vi.fn() }
    // One scoped client per workspace, like `apiService.withWorkspace`; the mocks record it as `this`.
    const clients = new Map<string, object>()
    const client = (workspaceId: string) => {
        if (!clients.has(workspaceId)) clients.set(workspaceId, { workspaceScope: { workspaceId, initialCollectionIds: [] }, ...mocks })
        return clients.get(workspaceId)!
    }
    return { ...mocks, client }
})
vi.mock('@/infrastructure/api', () => ({
    apiService: { withWorkspace: (workspaceId: string) => mocks.client(workspaceId) },
}))
const apiService = mocks
/** The workspace (`X-Workspace-Id`) of each call a client mock received. */
const workspacesOf = (mock: Mock) => mock.mock.contexts.map((client) => (client as { workspaceScope: { workspaceId: string } }).workspaceScope.workspaceId)

let workspace: WorkspaceTestState
function Scoped({ children }: { children: ReactNode }) {
    const value = workspace.value()
    const api = value.selectedWorkspaceId ? mocks.client(value.selectedWorkspaceId) as unknown as ApiService : null
    return <WorkspaceContext.Provider value={{ ...value, api }}>{children}</WorkspaceContext.Provider>
}
const renderPanel = (ui: ReactElement) => render(<Scoped>{ui}</Scoped>)

const setLorebooks = vi.fn()
let lorebooks: Lorebook[] = []

vi.mock('@/app/hooks', () => ({
    useData: () => ({ lorebooks, setLorebooks }),
    useFloatingWindows: () => ({ openWindow: vi.fn(), closeWindow: vi.fn(), closeAll: vi.fn(), focusWindow: vi.fn(), windows: [] }),
}))

const GLASS_BOOK: Lorebook = {
    id: 'lb-1',
    name: 'Glass Courts',
    description: 'Court etiquette and old pacts.',
    tags: ['court'],
    enabled: true,
    settings: { scanDepth: 8, tokenBudget: 1200, recursiveScanning: false, matchWholeWords: true, caseSensitive: false },
    entries: [
        {
            id: 'entry-1',
            lorebookId: 'lb-1',
            title: 'Mirror pact',
            entryType: 'rule',
            content: 'Mirrors bind names.',
            keys: ['mirror'],
            secondaryKeys: [],
            selectiveLogic: 'any',
            enabled: true,
            constant: false,
            caseSensitive: false,
            matchWholeWords: true,
            regex: false,
            isSecret: false,
            insertionOrder: 0,
            priority: 0,
            insertionPosition: 'before_context',
        },
    ],
    attachments: [
        { id: 'att-1', lorebookId: 'lb-1', targetKind: 'character_chat', targetId: '9', mode: 'linked' },
    ],
}

const MOON_BOOK: Lorebook = {
    ...GLASS_BOOK,
    id: 'lb-2',
    name: 'Moon Codex',
    description: 'Moonlit city facts.',
    tags: ['moon'],
    entries: [],
    attachments: [],
    metadata: {
        resources: [
            {
                id: 'resource-1',
                title: 'Reliquary notes',
                triggers: ['silver reliquary'],
                fileName: 'reliquary.txt',
                fileType: 'txt',
                content: 'The reliquary opens at moonrise.',
                extractionStatus: 'completed',
                extraction: {
                    keywords: ['moonrise key'],
                    shortSummary: 'Notes about the silver reliquary.',
                    longSummary: 'The silver reliquary opens at moonrise.',
                    notes: [],
                    snippets: [
                        {
                            id: 'snippet-1',
                            title: 'Reliquary opening',
                            content: 'The reliquary opens at moonrise.',
                            triggers: ['moonrise lock'],
                            source: 'reliquary.txt',
                        },
                    ],
                },
            },
        ],
    },
}

describe('SessionLorebookPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        setTestFeatureFlags({ lorebooks: true })
        setTestFeatureFlags({ lorebookResources: true })
        lorebooks = [GLASS_BOOK, MOON_BOOK]
        vi.mocked(apiService.listLorebookAttachments).mockResolvedValue([
            { id: 'att-1', lorebookId: 'lb-1', targetKind: 'character_chat', targetId: '9', mode: 'linked' },
        ])
        vi.mocked(apiService.putLorebookAttachment).mockResolvedValue({
            id: 'att-2',
            lorebookId: 'lb-2',
            targetKind: 'character_chat',
            targetId: '9',
            mode: 'linked',
        })
        vi.mocked(apiService.deleteLorebookAttachment).mockResolvedValue(undefined)
        workspace = createWorkspaceTestState()
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('loads and renders lorebooks attached to the active target', async () => {
        renderPanel(<SessionLorebookPanel targetKind="character_chat" targetId="9" />)

        await waitFor(() => expect(apiService.listLorebookAttachments).toHaveBeenCalledWith('character_chat', '9'))
        expect(workspacesOf(apiService.listLorebookAttachments)).toEqual([TEST_WORKSPACE_ID])
        expect(await screen.findByText('Glass Courts')).toBeInTheDocument()
        expect(screen.getByText('Court etiquette and old pacts.')).toBeInTheDocument()
    })

    it('adds selected lorebooks as linked attachments and prevents duplicates', async () => {
        renderPanel(<SessionLorebookPanel targetKind="character_chat" targetId="9" />)

        expect(await screen.findByText('Glass Courts')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Add lorebook' }))

        expect(screen.getAllByTestId('session-lorebook-option')[0]).toBeDisabled()
        fireEvent.click(screen.getByRole('button', { name: /Moon Codex/i }))
        fireEvent.click(screen.getByTestId('session-lorebook-add-submit'))

        await waitFor(() => {
            expect(apiService.putLorebookAttachment).toHaveBeenCalledWith({
                lorebookId: 'lb-2',
                targetKind: 'character_chat',
                targetId: '9',
                mode: 'linked',
                snapshot: null,
            })
        })
        expect(await screen.findByText('Moon Codex')).toBeInTheDocument()
        expect(setLorebooks).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({
                id: 'lb-2',
                attachments: [expect.objectContaining({ id: 'att-2', targetKind: 'character_chat', targetId: '9' })],
            }),
        ]))
    })

    it('searches attachable lorebooks by resource metadata', async () => {
        renderPanel(<SessionLorebookPanel targetKind="character_chat" targetId="9" />)

        expect(await screen.findByText('Glass Courts')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Add lorebook' }))
        fireEvent.change(screen.getByTestId('session-lorebook-search'), { target: { value: 'silver reliquary' } })

        const drawer = screen.getByRole('dialog')
        expect(within(drawer).getByRole('heading', { name: 'Add lorebooks' })).toBeInTheDocument()
        expect(within(drawer).getByRole('button', { name: /Moon Codex/i })).toBeInTheDocument()
        expect(within(drawer).getByText('0 entries · 1 resources')).toBeInTheDocument()
        expect(within(drawer).queryByRole('button', { name: /Glass Courts/i })).not.toBeInTheDocument()
    })

    it('removes an attachment and updates lorebook state', async () => {
        renderPanel(<SessionLorebookPanel targetKind="character_chat" targetId="9" />)

        expect(await screen.findByText('Glass Courts')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Remove Glass Courts' }))

        await waitFor(() => expect(apiService.deleteLorebookAttachment).toHaveBeenCalledWith('att-1'))
        await waitFor(() => expect(screen.queryByText('Glass Courts')).not.toBeInTheDocument())
        expect(setLorebooks).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({ id: 'lb-1', attachments: [] }),
        ]))
    })

    it('links and unlinks in the session workspace the host passes', async () => {
        renderPanel(<SessionLorebookPanel targetKind="character_chat" targetId="9" workspaceId={TEST_WORKSPACE_ID} />)

        expect(await screen.findByText('Glass Courts')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Add lorebook' }))
        fireEvent.click(screen.getByRole('button', { name: /Moon Codex/i }))
        fireEvent.click(screen.getByTestId('session-lorebook-add-submit'))
        expect(await screen.findByText('Moon Codex')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Remove Glass Courts' }))
        await waitFor(() => expect(apiService.deleteLorebookAttachment).toHaveBeenCalledWith('att-1'))

        expect(workspacesOf(apiService.listLorebookAttachments)).toEqual([TEST_WORKSPACE_ID])
        expect(workspacesOf(apiService.putLorebookAttachment)).toEqual([TEST_WORKSPACE_ID])
        expect(workspacesOf(apiService.deleteLorebookAttachment)).toEqual([TEST_WORKSPACE_ID])
    })

    it('offers no lorebooks of the committed workspace to a session in another one', async () => {
        renderPanel(<SessionLorebookPanel targetKind="character_chat" targetId="9" workspaceId={OTHER_WORKSPACE_ID} />)

        await waitFor(() => expect(workspacesOf(apiService.listLorebookAttachments)).toEqual([OTHER_WORKSPACE_ID]))
        fireEvent.click(screen.getByRole('button', { name: 'Add lorebook' }))
        expect(screen.queryAllByTestId('session-lorebook-option')).toHaveLength(0)
        expect(screen.getByText('No saved lorebooks yet')).toBeInTheDocument()
    })

    it('closes the picker on a workspace switch and keeps a late link out of the new workspace', async () => {
        let finish!: (value: unknown) => void
        vi.mocked(apiService.putLorebookAttachment).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
        const ui = <SessionLorebookPanel targetKind="character_chat" targetId="9" />
        const { rerender } = renderPanel(ui)

        expect(await screen.findByText('Glass Courts')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Add lorebook' }))
        fireEvent.click(screen.getByRole('button', { name: /Moon Codex/i }))
        fireEvent.click(screen.getByTestId('session-lorebook-add-submit'))
        await waitFor(() => expect(apiService.putLorebookAttachment).toHaveBeenCalledOnce())

        act(() => workspace.switchTo(OTHER_WORKSPACE_ID))
        rerender(<Scoped>{ui}</Scoped>)
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
        await act(async () => finish({ id: 'att-2', lorebookId: 'lb-2', targetKind: 'character_chat', targetId: '9', mode: 'linked' }))

        expect(workspacesOf(apiService.putLorebookAttachment)).toEqual([TEST_WORKSPACE_ID])
        expect(setLorebooks).not.toHaveBeenCalled()
        expect(screen.queryByText('Moon Codex')).not.toBeInTheDocument()
    })

    it('lists but never changes the links of a session whose workspace is archived', async () => {
        workspace = createWorkspaceTestState({
            workspaces: [
                testWorkspace(TEST_WORKSPACE_ID, 'Main library'),
                testWorkspace(OTHER_WORKSPACE_ID, 'Novel A', { archived_at: '2026-10-10T00:00:00Z' }),
            ],
        })
        renderPanel(<SessionLorebookPanel targetKind="character_chat" targetId="9" workspaceId={OTHER_WORKSPACE_ID} />)

        expect(await screen.findByText('Unavailable lorebook')).toBeInTheDocument()
        expect(workspacesOf(apiService.listLorebookAttachments)).toEqual([OTHER_WORKSPACE_ID])
        expect(screen.getByRole('button', { name: 'Add lorebook' })).toBeDisabled()
        const remove = screen.getByRole('button', { name: 'Remove Unavailable lorebook' })
        expect(remove).toBeDisabled()
        fireEvent.click(remove)
        expect(apiService.deleteLorebookAttachment).not.toHaveBeenCalled()
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
})
