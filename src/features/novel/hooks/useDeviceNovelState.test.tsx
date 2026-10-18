import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { emptyNovelLifecycle } from '../persistence/novelDeviceLifecycle'
import type { DeviceNovelState } from '../persistence/deviceNovelStorage'
import { useDeviceNovelState } from './useDeviceNovelState'

const store = vi.hoisted(() => ({ read: vi.fn(), changed: null as (() => void) | null }))
vi.mock('../persistence/deviceNovelStorage', async (original) => ({ ...await original<typeof import('../persistence/deviceNovelStorage')>(), readDeviceNovel: store.read }))
vi.mock('../persistence/deviceReadDatabase', () => ({ subscribeDeviceReads: (callback: () => void) => { store.changed = callback; return () => { store.changed = null } } }))
afterEach(() => vi.clearAllMocks())
const scope = { apiOrigin: 'https://writing.example', userHash: 'author', workspaceId: 'desk', storyId: 'novel' }
const state = (revision: number, readOnly: boolean): DeviceNovelState => ({ state: { ...emptyNovelLifecycle(), root: { revision, readOnly } }, unavailable: false, unreadable: false })
it('keeps known root restrictions through failed and older refreshes and accepts a newer restore', async () => {
    store.read.mockResolvedValue(state(9, true))
    const view = renderHook(() => useDeviceNovelState(scope, () => true))
    await waitFor(() => expect(view.result.current.data?.state?.root?.readOnly).toBe(true))
    store.read.mockResolvedValue({ state: null, unavailable: true, unreadable: false })
    await act(async () => { store.changed?.() })
    expect(view.result.current.data?.state?.root?.readOnly).toBe(true)
    store.read.mockResolvedValue(state(8, false)); await act(async () => { store.changed?.() })
    expect(view.result.current.data?.state?.root?.revision).toBe(9)
    store.read.mockResolvedValue(state(10, false)); await act(async () => { store.changed?.() })
    expect(view.result.current.data?.state?.root).toEqual({ revision: 10, readOnly: false })
})
it('hides old scope immediately and ignores its delayed refresh after another workspace has loaded', async () => {
    store.read.mockResolvedValue(state(1, false))
    const view = renderHook(({ owner }) => useDeviceNovelState(owner, () => true), { initialProps: { owner: scope } })
    await waitFor(() => expect(view.result.current.data?.state?.root?.revision).toBe(1))
    let finish!: (value: DeviceNovelState) => void
    store.read.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve })).mockResolvedValueOnce(state(3, false))
    act(() => { store.changed?.() })
    view.rerender({ owner: { ...scope, workspaceId: 'another-desk' } })
    expect(view.result.current.data).toBeNull()
    await waitFor(() => expect(view.result.current.data?.state?.root?.revision).toBe(3))
    await act(async () => finish(state(99, true)))
    expect(view.result.current.data?.state?.root).toEqual({ revision: 3, readOnly: false })
})
