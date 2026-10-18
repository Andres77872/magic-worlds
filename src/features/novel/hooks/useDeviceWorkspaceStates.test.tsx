import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { retainDeviceWorkspaceStates, useDeviceWorkspaceStates } from './useDeviceWorkspaceStates'
import type { DeviceWorkspaceStates } from '../persistence/deviceWorkspaceStorage'

const store = vi.hoisted(() => ({ list: vi.fn(), changed: null as (() => void) | null }))
vi.mock('../persistence/deviceWorkspaceStorage', async (original) => ({ ...await original<typeof import('../persistence/deviceWorkspaceStorage')>(), listDeviceWorkspaces: store.list }))
vi.mock('../persistence/deviceReadDatabase', () => ({ subscribeDeviceReads: (callback: () => void) => { store.changed = callback; return () => { store.changed = null } } }))
afterEach(() => vi.clearAllMocks())
const state = (rowVersion: number, archived: boolean): DeviceWorkspaceStates => ({ states: { desk: { id: 'desk', name: 'Writing desk', isDefault: false, rowVersion, archived } }, unreadableIds: [], unreadable: 0, unavailable: false })
it('retains known restrictions through failed, corrupt and older refreshes until a newer checked restore', () => {
    const known = state(9, true), unavailable = { states: {}, unreadableIds: [], unreadable: 0, unavailable: true }
    expect(retainDeviceWorkspaceStates(known, unavailable).states.desk.archived).toBe(true)
    const corrupt = retainDeviceWorkspaceStates(known, { ...unavailable, unavailable: false, unreadableIds: ['desk'], unreadable: 1 })
    expect(retainDeviceWorkspaceStates(corrupt, state(8, false))).toMatchObject({ states: { desk: { rowVersion: 9, archived: true } }, unreadableIds: ['desk'] })
    expect(retainDeviceWorkspaceStates(corrupt, state(10, false))).toMatchObject({ states: { desk: { rowVersion: 10, archived: false } }, unreadableIds: [] })
})
it('observes refresh signals and hides a retired owner before its delayed result arrives', async () => {
    const scope = { apiOrigin: 'https://writing.example', userHash: 'first' }, current = () => true
    store.list.mockResolvedValue(state(1, false))
    const view = renderHook(({ owner }) => useDeviceWorkspaceStates(owner, current), { initialProps: { owner: scope } })
    await waitFor(() => expect(view.result.current.data?.states.desk.rowVersion).toBe(1))
    store.list.mockResolvedValue(state(2, true))
    await act(async () => { store.changed?.() })
    expect(view.result.current.data?.states.desk.archived).toBe(true)
    let finish!: (value: DeviceWorkspaceStates) => void
    store.list.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve })).mockResolvedValueOnce(state(3, false))
    act(() => { store.changed?.() })
    view.rerender({ owner: { ...scope, userHash: 'second' } })
    expect(view.result.current.data).toBeNull()
    await waitFor(() => expect(view.result.current.data?.states.desk.rowVersion).toBe(3))
    await act(async () => finish(state(99, true)))
    expect(view.result.current.data?.states.desk).toMatchObject({ rowVersion: 3, archived: false })
})
