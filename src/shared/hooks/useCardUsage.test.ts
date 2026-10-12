import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { apiService } from '@/infrastructure/api'
import { invalidateCardUsage, useCardUsage } from './useCardUsage'
import { OTHER_WORKSPACE_ID, TEST_WORKSPACE_ID, WorkspaceTestProvider, createWorkspaceTestState } from './testing/workspaceTestUtils'

afterEach(() => {
    vi.restoreAllMocks()
})

const workspace = createWorkspaceTestState({ api: apiService })
const wrapper = ({ children }: { children: ReactNode }) => createElement(WorkspaceTestProvider, { state: workspace, children })

describe('useCardUsage', () => {
    it('returns null and never fetches while disabled', () => {
        const spy = vi.spyOn(apiService, 'getCardUsage')
        const { result } = renderHook(() => useCardUsage('character', 'disabled-1', { enabled: false }), { wrapper })
        expect(result.current).toBeNull()
        expect(spy).not.toHaveBeenCalled()
    })

    it('returns null when the target is incomplete', () => {
        const spy = vi.spyOn(apiService, 'getCardUsage')
        const { result } = renderHook(() => useCardUsage(null, undefined), { wrapper })
        expect(result.current).toBeNull()
        expect(spy).not.toHaveBeenCalled()
    })

    it('fetches usage when enabled and caches across hooks (one request per card)', async () => {
        const spy = vi
            .spyOn(apiService, 'getCardUsage')
            .mockResolvedValue({ sessions: 5, stories: 2 })

        const first = renderHook(() => useCardUsage('character', 'cache-1'), { wrapper })
        await waitFor(() => expect(first.result.current).toEqual({ sessions: 5, stories: 2 }))
        expect(spy).toHaveBeenCalledTimes(1)

        // A second mount for the same card reads from the module cache — no refetch.
        const second = renderHook(() => useCardUsage('character', 'cache-1'), { wrapper })
        await waitFor(() => expect(second.result.current).toEqual({ sessions: 5, stories: 2 }))
        expect(spy).toHaveBeenCalledTimes(1)
    })

    it('resolves to null when the request fails', async () => {
        vi.spyOn(apiService, 'getCardUsage').mockRejectedValue(new Error('boom'))
        const { result } = renderHook(() => useCardUsage('world', 'error-1'), { wrapper })
        // Stays null (informative-only — failures never surface).
        await waitFor(() => {})
        expect(result.current).toBeNull()
    })

    it('stays idle without a selected workspace (no unscoped private read)', () => {
        const spy = vi.spyOn(apiService, 'getCardUsage')
        const { result } = renderHook(() => useCardUsage('character', 'no-workspace-1'))
        expect(result.current).toBeNull()
        expect(spy).not.toHaveBeenCalled()
    })

    it('reads through the card workspace and caches per workspace', async () => {
        const withWorkspace = vi.spyOn(apiService, 'withWorkspace')
        const spy = vi.spyOn(apiService, 'getCardUsage').mockResolvedValue({ sessions: 1, stories: 0 })

        const own = renderHook(() => useCardUsage('item', 'scoped-1'), { wrapper })
        await waitFor(() => expect(own.result.current).toEqual({ sessions: 1, stories: 0 }))
        expect(withWorkspace).toHaveBeenLastCalledWith(TEST_WORKSPACE_ID)

        // The same card id under another workspace is a different cache entry.
        const other = renderHook(() => useCardUsage('item', 'scoped-1', { workspaceId: OTHER_WORKSPACE_ID }), { wrapper })
        await waitFor(() => expect(other.result.current).toEqual({ sessions: 1, stories: 0 }))
        expect(withWorkspace).toHaveBeenLastCalledWith(OTHER_WORKSPACE_ID)
        expect(spy).toHaveBeenCalledTimes(2)

        // Invalidation drops the card in every workspace.
        invalidateCardUsage('item', 'scoped-1')
        renderHook(() => useCardUsage('item', 'scoped-1'), { wrapper })
        await waitFor(() => expect(spy).toHaveBeenCalledTimes(3))
    })
})
