import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { WorkspaceContext } from '@/app/providers/workspaceContext'
import type { ApiService } from '@/infrastructure/api'
import type { Lorebook, LorebookAttachment, LorebookEntry } from '@/shared'
import {
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    createWorkspaceTestState,
    type WorkspaceTestState,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { scanText } from '../loreTriggers'
import { useSessionLorebookEntries } from './useSessionLorebookEntries'

const mocks = vi.hoisted(() => {
    const mocks = { listLorebookAttachments: vi.fn(), getLorebook: vi.fn() }
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
function wrapper({ children }: { children: ReactNode }) {
    const value = workspace.value()
    const api = value.selectedWorkspaceId ? mocks.client(value.selectedWorkspaceId) as unknown as ApiService : null
    return <WorkspaceContext.Provider value={{ ...value, api }}>{children}</WorkspaceContext.Provider>
}

let lorebooks: Lorebook[] = []
vi.mock('@/app/hooks', () => ({
    useData: () => ({ lorebooks }),
}))

function bookWithKey(id: string, name: string, key: string): Lorebook {
    const entry: LorebookEntry = {
        id: `${id}-e`,
        lorebookId: id,
        title: 'Mirror pact',
        entryType: 'rule',
        content: 'Mirrors bind names.',
        keys: [key],
        secondaryKeys: [],
        selectiveLogic: 'any',
        enabled: true,
        caseSensitive: false,
        matchWholeWords: true,
        regex: false,
        insertionOrder: 0,
        priority: 0,
        insertionPosition: 'before_context',
    }
    return {
        id,
        name,
        description: null,
        tags: [],
        enabled: true,
        settings: { scanDepth: 8, tokenBudget: 1200, recursiveScanning: false, matchWholeWords: true, caseSensitive: false },
        entries: [entry],
        attachments: [],
    }
}

describe('useSessionLorebookEntries', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        lorebooks = []
        workspace = createWorkspaceTestState()
    })

    it('builds a matcher from a linked attachment resolved via the cache', async () => {
        lorebooks = [bookWithKey('lb-1', 'Glass Courts', 'mirror')]
        vi.mocked(apiService.listLorebookAttachments).mockResolvedValue([
            { id: 'att-1', lorebookId: 'lb-1', targetKind: 'character_chat', targetId: '9', mode: 'linked' },
        ])

        const { result } = renderHook(() => useSessionLorebookEntries('character_chat', '9'), { wrapper })

        await waitFor(() => expect(result.current.matcher).not.toBeNull())
        expect(result.current.entries.map((e) => e.lorebookName)).toContain('Glass Courts')
        const hits = scanText('she gazed into the mirror', result.current.matcher)
        expect(hits).toHaveLength(1)
        expect(hits[0]).toMatchObject({ keyword: 'mirror', lorebookName: 'Glass Courts' })
        expect(apiService.getLorebook).not.toHaveBeenCalled()
    })

    it('resolves a snapshot attachment without touching the cache or network', async () => {
        const snapshot = bookWithKey('lb-2', 'Frozen Codex', 'sigil')
        vi.mocked(apiService.listLorebookAttachments).mockResolvedValue([
            { id: 'att-2', lorebookId: 'lb-2', targetKind: 'adventure_session', targetId: '4', mode: 'snapshot', snapshot },
        ])

        const { result } = renderHook(() => useSessionLorebookEntries('adventure_session', '4'), { wrapper })

        await waitFor(() => expect(result.current.matcher).not.toBeNull())
        const hits = scanText('the ancient sigil glowed', result.current.matcher)
        expect(hits).toHaveLength(1)
        expect(hits[0]).toMatchObject({ keyword: 'sigil', lorebookName: 'Frozen Codex' })
    })

    it('has a null matcher when no lorebooks are attached', async () => {
        vi.mocked(apiService.listLorebookAttachments).mockResolvedValue([])
        const { result } = renderHook(() => useSessionLorebookEntries('character_chat', '9'), { wrapper })
        await waitFor(() => expect(apiService.listLorebookAttachments).toHaveBeenCalled())
        expect(result.current.matcher).toBeNull()
    })

    it('reads a session in its own workspace without the committed library cache', async () => {
        lorebooks = [bookWithKey('lb-1', 'Committed copy', 'glass')]
        vi.mocked(apiService.listLorebookAttachments).mockResolvedValue([
            { id: 'att-1', lorebookId: 'lb-1', targetKind: 'character_chat', targetId: '9', mode: 'linked' },
        ])
        vi.mocked(apiService.getLorebook).mockResolvedValue(bookWithKey('lb-1', 'Session book', 'mirror'))

        const { result } = renderHook(() => useSessionLorebookEntries('character_chat', '9', OTHER_WORKSPACE_ID), { wrapper })

        await waitFor(() => expect(result.current.matcher).not.toBeNull())
        expect(result.current.entries.map((e) => e.lorebookName)).toEqual(['Session book'])
        expect(workspacesOf(apiService.listLorebookAttachments)).toEqual([OTHER_WORKSPACE_ID])
        expect(workspacesOf(apiService.getLorebook)).toEqual([OTHER_WORKSPACE_ID])
    })

    it('drops the previous workspace attachments and ignores their late load after a switch', async () => {
        let finishPrevious!: (rows: LorebookAttachment[]) => void
        vi.mocked(apiService.listLorebookAttachments)
            .mockImplementationOnce(() => new Promise((resolve) => { finishPrevious = resolve }))
            .mockResolvedValue([])
        const snapshot = bookWithKey('lb-2', 'Frozen Codex', 'sigil')

        const { result, rerender } = renderHook(() => useSessionLorebookEntries('character_chat', '9'), { wrapper })
        await waitFor(() => expect(apiService.listLorebookAttachments).toHaveBeenCalledOnce())
        act(() => workspace.switchTo(OTHER_WORKSPACE_ID))
        rerender()
        await waitFor(() => expect(apiService.listLorebookAttachments).toHaveBeenCalledTimes(2))
        await act(async () => finishPrevious([
            { id: 'att-2', lorebookId: 'lb-2', targetKind: 'character_chat', targetId: '9', mode: 'snapshot', snapshot },
        ]))

        expect(workspacesOf(apiService.listLorebookAttachments)).toEqual([TEST_WORKSPACE_ID, OTHER_WORKSPACE_ID])
        expect(result.current.entries).toEqual([])
        expect(result.current.matcher).toBeNull()
    })
})
