import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LorebookAssistantStreamEvent } from '@/shared'

const mocks = vi.hoisted(() => ({
    createLorebookAssistantConversation: vi.fn(), listLorebookAssistantConversations: vi.fn(),
    getLorebookAssistantConversation: vi.fn(), streamLorebookAssistantMessage: vi.fn(),
}))
vi.mock('@/infrastructure/api', async (importOriginal) => ({
    ...await importOriginal<typeof import('@/infrastructure/api')>(), apiService: mocks,
}))
import { ApiError } from '@/infrastructure/api'
import { useLorebookAssistant } from './useLorebookAssistant'

const conversation = { conversation_id: 7, lorebook_id: null, title: 'Lore' }
function options() {
    return { title: 'Lore', currentLorebook: {}, onLorebook: vi.fn(), isAuthenticated: true, onAuthRequired: vi.fn() }
}
function controlledStream() {
    const wire = { emit: (_event: LorebookAssistantStreamEvent) => {}, finish: () => {}, requestId: '' }
    mocks.streamLorebookAssistantMessage.mockImplementation((_id: number, _body: unknown, emit: typeof wire.emit, settings: { requestId: string }) => {
        wire.emit = emit
        wire.requestId = settings.requestId
        return new Promise<void>((resolve) => { wire.finish = resolve })
    })
    return wire
}
beforeEach(() => {
    vi.resetAllMocks()
    mocks.createLorebookAssistantConversation.mockResolvedValue({ conversation, messages: [], lorebook: null })
    mocks.listLorebookAssistantConversations.mockResolvedValue({ conversations: [] })
})

describe('lorebook assistant stream ownership', () => {
    it('invalidates an active turn when the editor switches lorebooks', async () => {
        const wire = controlledStream()
        const props = { ...options(), lorebookId: null as string | null }
        const { result, rerender } = renderHook((value) => useLorebookAssistant(value), { initialProps: props })
        let pending!: Promise<void>
        act(() => { pending = result.current.send('Create lore') })
        await waitFor(() => expect(wire.requestId).not.toBe(''))
        rerender({ ...props, lorebookId: 'another-book' })
        await act(async () => { wire.emit({ type: 'assistant_delta', delta: 'Old lore' }); wire.finish(); await pending })
        expect(result.current.status).toBe('idle')
        expect(result.current.turns).toEqual([])
        expect(props.onLorebook).not.toHaveBeenCalled()
    })

    it('keeps partial text when recovery finds only an older completed reply', async () => {
        const props = options()
        mocks.getLorebookAssistantConversation.mockResolvedValue({ conversation, messages: [{ message_id: 1, role: 'assistant', status: 'completed', content: 'Old reply', metadata: { request_id: 'old-request' } }], lorebook: { id: 'old-book' } })
        mocks.streamLorebookAssistantMessage.mockImplementation(async (_id: number, _body: unknown, emit: (event: LorebookAssistantStreamEvent) => void) => {
            emit({ type: 'assistant_delta', delta: 'New partial lore' })
            throw new ApiError(0, 'Stream ended', { code: 'stream_incomplete', action: 'reload_conversation' })
        })
        const { result } = renderHook(() => useLorebookAssistant(props))
        await act(async () => result.current.send('Continue'))
        const partial = result.current.turns[result.current.turns.length - 1]
        expect(partial?.message.content).toBe('New partial lore')
        expect(partial?.isInterrupted).toBe(true)
        expect(result.current.pendingLorebook).toBeNull()
        expect(props.onLorebook).not.toHaveBeenCalled()
    })

    it('ignores stale callbacks and cleanup after closing and sending a newer request', async () => {
        const first = controlledStream()
        const { result } = renderHook(() => useLorebookAssistant(options()))
        let firstPending!: Promise<void>
        act(() => { firstPending = result.current.send('First') })
        await waitFor(() => expect(first.requestId).not.toBe(''))
        act(() => result.current.closePanel())
        const second = controlledStream()
        let secondPending!: Promise<void>
        act(() => { secondPending = result.current.send('Second') })
        await waitFor(() => expect(second.requestId).not.toBe(''))
        await act(async () => { first.emit({ type: 'assistant_delta', delta: 'Stale' }); first.finish(); await firstPending })
        expect(result.current.status).toBe('streaming')
        expect(result.current.turns.some((turn) => turn.message.content === 'Stale')).toBe(false)
        await act(async () => { second.emit({ type: 'error', detail: 'Stopped' }); second.finish(); await secondPending })
        expect(result.current.status).toBe('idle')
    })
})
