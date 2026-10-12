import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import {
    createWorkspaceTestState,
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    testWorkspace,
    WorkspaceTestProvider,
} from './testing/workspaceTestUtils'
import { useWorkspaceReadOnly } from './useWorkspaceReadOnly'

const ARCHIVED = '2026-10-10T00:00:00Z'

function wrapperFor(selectedWorkspaceId: string) {
    const state = createWorkspaceTestState({
        selectedWorkspaceId,
        workspaces: [testWorkspace(TEST_WORKSPACE_ID, 'Main library'), testWorkspace(OTHER_WORKSPACE_ID, 'Novel A', { archived_at: ARCHIVED })],
    })
    return ({ children }: { children: ReactNode }) => <WorkspaceTestProvider state={state}>{children}</WorkspaceTestProvider>
}

describe('useWorkspaceReadOnly', () => {
    it('follows the selected workspace by default', () => {
        expect(renderHook(() => useWorkspaceReadOnly(), { wrapper: wrapperFor(TEST_WORKSPACE_ID) }).result.current).toBe(false)
        expect(renderHook(() => useWorkspaceReadOnly(), { wrapper: wrapperFor(OTHER_WORKSPACE_ID) }).result.current).toBe(true)
    })

    it("keys on a record's own workspace when given", () => {
        const wrapper = wrapperFor(TEST_WORKSPACE_ID)
        expect(renderHook(() => useWorkspaceReadOnly(OTHER_WORKSPACE_ID), { wrapper }).result.current).toBe(true)
        expect(renderHook(() => useWorkspaceReadOnly(null), { wrapper }).result.current).toBe(false)
    })

    it('stays writable outside a workspace provider or for an unknown workspace', () => {
        expect(renderHook(() => useWorkspaceReadOnly(OTHER_WORKSPACE_ID)).result.current).toBe(false)
        const wrapper = wrapperFor(TEST_WORKSPACE_ID)
        expect(renderHook(() => useWorkspaceReadOnly('3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f'), { wrapper }).result.current).toBe(false)
    })
})
