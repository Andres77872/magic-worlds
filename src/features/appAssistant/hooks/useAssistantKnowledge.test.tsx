import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    createWorkspaceTestState,
    OTHER_WORKSPACE_ID,
    WorkspaceTestProvider,
    type WorkspaceTestState,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { useAssistantKnowledge } from './useAssistantKnowledge'

const auth = vi.hoisted(() => ({ isAuthenticated: true, accountKey: 'account-a', userHash: 'user-a' }))
const library = vi.hoisted(() => ({ characters: [], worlds: [], items: [], templateAdventures: [], lorebooks: [], stories: [] }))

vi.mock('@/app/hooks', () => ({
    useAuth: () => auth,
    useData: () => library,
}))
vi.mock('@/app/hooks/useAuth', () => ({
    useAuth: () => auth,
}))

const api = { getLorebookResources: vi.fn() }
const resource = (id: string) => ({ id, title: `Resource ${id}`, fileName: `${id}.md`, content: 'Lore.' })

let workspace: WorkspaceTestState
const wrapper = ({ children }: { children: ReactNode }) => <WorkspaceTestProvider state={workspace}>{children}</WorkspaceTestProvider>

describe('useAssistantKnowledge (Workspace R1)', () => {
    beforeEach(() => {
        vi.stubEnv('VITE_FEATURE_LOREBOOKS_ENABLED', 'true')
        vi.stubEnv('VITE_FEATURE_LOREBOOK_RESOURCES_ENABLED', 'true')
        api.getLorebookResources.mockResolvedValue([resource('res-a')])
        workspace = createWorkspaceTestState({ api })
    })

    afterEach(() => {
        vi.clearAllMocks()
        vi.unstubAllEnvs()
    })

    it('reads lorebook resources from the committed workspace', async () => {
        const { result } = renderHook(() => useAssistantKnowledge(null), { wrapper })

        await waitFor(() => expect(result.current.library.resources).toHaveLength(1))
        expect(api.getLorebookResources).toHaveBeenCalledWith(0, 100)
        expect(result.current.resourcesLoading).toBe(false)
    })

    it('never offers the previous workspace resources after a switch', async () => {
        const { result, rerender } = renderHook(() => useAssistantKnowledge(null), { wrapper })
        await waitFor(() => expect(result.current.library.resources).toHaveLength(1))

        api.getLorebookResources.mockReturnValue(new Promise(() => {}))
        workspace.switchTo(OTHER_WORKSPACE_ID)
        rerender()

        expect(result.current.library.resources).toHaveLength(0)
        expect(result.current.resourcesLoading).toBe(true)
        expect(api.getLorebookResources).toHaveBeenCalledTimes(2)
    })

    it('waits for a committed workspace before reading', () => {
        workspace = createWorkspaceTestState({ api, selectedWorkspaceId: null })
        const { result } = renderHook(() => useAssistantKnowledge(null), { wrapper })

        expect(api.getLorebookResources).not.toHaveBeenCalled()
        expect(result.current.library.resources).toHaveLength(0)
    })
})
