import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SharedCardResource } from '@/shared'
import {
    createWorkspaceTestState,
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    WorkspaceTestProvider,
    type WorkspaceTestState,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { useProfileSharedCards } from './useProfileSharedCards'

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: true }),
}))

const api = {
    listMyPublicCards: vi.fn(),
    listMyShareLinks: vi.fn(),
}

const card = (id: string) => ({ card_id: id, card_type: 'character', share_token: null } as unknown as SharedCardResource)

let workspace: WorkspaceTestState
const wrapper = ({ children }: { children: ReactNode }) => <WorkspaceTestProvider state={workspace}>{children}</WorkspaceTestProvider>

describe('useProfileSharedCards', () => {
    beforeEach(() => {
        setTestFeatureFlags({ communityCards: true })
        api.listMyPublicCards.mockResolvedValue({ items: [card('pub-1')] })
        api.listMyShareLinks.mockResolvedValue({ items: [card('link-1')] })
    })

    afterEach(() => {
        vi.clearAllMocks()
        vi.unstubAllEnvs()
    })

    it('reads sharing lists in the committed workspace and names it', async () => {
        workspace = createWorkspaceTestState({ api })
        const { result } = renderHook(() => useProfileSharedCards(), { wrapper })

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.publicCards).toHaveLength(1)
        expect(result.current.shareLinks).toHaveLength(1)
        expect(result.current.workspaceId).toBe(TEST_WORKSPACE_ID)
        expect(result.current.workspaceName).toBe('Main library')
    })

    it('waits for a committed workspace before reading', () => {
        workspace = createWorkspaceTestState({ api, selectedWorkspaceId: null })
        const { result } = renderHook(() => useProfileSharedCards(), { wrapper })

        expect(result.current.isLoading).toBe(true)
        expect(api.listMyPublicCards).not.toHaveBeenCalled()
    })

    it('never shows the previous workspace lists after a switch', async () => {
        workspace = createWorkspaceTestState({ api })
        const { result, rerender } = renderHook(() => useProfileSharedCards(), { wrapper })
        await waitFor(() => expect(result.current.publicCards).toHaveLength(1))

        api.listMyPublicCards.mockReturnValue(new Promise(() => {}))
        workspace.switchTo(OTHER_WORKSPACE_ID)
        rerender()

        expect(result.current.publicCards).toHaveLength(0)
        expect(result.current.workspaceId).toBeNull()
    })
})
