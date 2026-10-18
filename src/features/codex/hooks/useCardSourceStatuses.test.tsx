import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { CardSourceStatusList } from '@/shared/types/workspace.types'
import { createWorkspaceTestState, OTHER_WORKSPACE_ID, WorkspaceTestProvider } from '@/shared/hooks/testing/workspaceTestUtils'
import { useCardSourceStatuses } from './useCardSourceStatuses'

const cards = [{ card_type: 'character' as const, card_id: 'c1' }]
const head = (number: number): CardSourceStatusList => ({ items: [{ ...cards[0], available: true,
    latest_version_id: `v${number}`, latest_version_number: number, has_draft: false }] })

describe('read-only source checks', () => {
    it('batches duplicate references and ignores late results after a workspace switch', async () => {
        let resolveOld!: (value: CardSourceStatusList) => void
        const old = new Promise<CardSourceStatusList>((resolve) => { resolveOld = resolve })
        const read = vi.fn().mockReturnValueOnce(old).mockResolvedValue(head(5))
        const workspace = createWorkspaceTestState({ api: { getCardSourceStatuses: read } })
        const wrapper = ({ children }: { children: ReactNode }) => <WorkspaceTestProvider state={workspace}>{children}</WorkspaceTestProvider>
        const { result, rerender } = renderHook(() => useCardSourceStatuses([...cards, ...cards]), { wrapper })
        await waitFor(() => expect(read).toHaveBeenCalledTimes(1))
        expect(read.mock.calls[0][1]).toHaveLength(1)
        act(() => workspace.switchTo(OTHER_WORKSPACE_ID))
        rerender()
        await waitFor(() => expect(result.current.state).toBe('ready'))
        expect(read.mock.calls[1][0]).toBe(OTHER_WORKSPACE_ID)
        expect(read.mock.calls[0][2].aborted).toBe(true)
        await act(async () => { resolveOld(head(2)); await old })
        expect(result.current.statuses.get('character:c1')?.latest_version_number).toBe(5)
    })

    it('reports check failure without treating it as source unavailability and permits a read-only retry', async () => {
        const read = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(head(3))
        const workspace = createWorkspaceTestState({ api: { getCardSourceStatuses: read } })
        const wrapper = ({ children }: { children: ReactNode }) => <WorkspaceTestProvider state={workspace}>{children}</WorkspaceTestProvider>
        const { result } = renderHook(() => useCardSourceStatuses(cards), { wrapper })
        await waitFor(() => expect(result.current.state).toBe('failed'))
        expect(result.current.statuses.size).toBe(0)
        act(() => result.current.recheck())
        await waitFor(() => expect(result.current.state).toBe('ready'))
        expect(result.current.statuses.get('character:c1')?.available).toBe(true)
    })
})
