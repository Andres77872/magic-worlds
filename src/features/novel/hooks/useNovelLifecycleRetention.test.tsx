import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { novel } from '@/test/fixtures/story'
import { studioIndex } from '@/test/fixtures/storyStudio'
import { useNovelLifecycleRetention } from './useNovelLifecycleRetention'

const store = vi.hoisted(() => ({ source: vi.fn(), root: vi.fn(), erased: vi.fn() }))
vi.mock('../persistence/deviceNovelStorage', async (original) => ({ ...await original<typeof import('../persistence/deviceNovelStorage')>(), rememberDeviceNovelSource: store.source, rememberDeviceNovelRoot: store.root, rememberDeviceNovelErased: store.erased }))
const scope = { apiOrigin: 'https://writing.example', userHash: 'author', workspaceId: 'desk' }
const source = studioIndex(novel({ organization: { workspace_id: scope.workspaceId } }))
const owner = { key: 'account-session', scope, current: () => true }
beforeEach(() => { vi.clearAllMocks(); for (const method of Object.values(store)) method.mockResolvedValue({ status: 'saved' }) })
afterEach(() => vi.restoreAllMocks())
it('retains checked lists and explicit root/terminal acknowledgements without loading a scene', async () => {
    const view = renderHook(() => useNovelLifecycleRetention(owner, [source], null))
    await waitFor(() => expect(store.source).toHaveBeenCalledWith({ ...scope, storyId: source.id }, source, expect.any(Function)))
    await act(async () => { await view.result.current.root(source.id, 9, true); await view.result.current.erased(source.id) })
    expect(store.root).toHaveBeenCalledWith({ ...scope, storyId: source.id }, 9, true, expect.any(Function))
    expect(store.erased).toHaveBeenCalledWith({ ...scope, storyId: source.id }, expect.any(Function))
    expect(view.result.current.failed).toBe(false)
})
it('retires old closures and in-flight publications on disable, owner change and unmount', async () => {
    const stories = [source], view = renderHook(({ observed }) => useNovelLifecycleRetention(observed, stories, null), { initialProps: { observed: owner as Omit<typeof owner, 'scope'> & { scope: typeof scope | null } } })
    await waitFor(() => expect(store.source).toHaveBeenCalledTimes(1))
    const current = store.source.mock.calls[0][2], old = view.result.current
    view.rerender({ observed: { ...owner, scope: null } })
    expect(current()).toBe(false)
    await act(async () => { expect(await old.erased(source.id)).toEqual({ status: 'retired' }) })
    expect(store.erased).not.toHaveBeenCalled()
    view.rerender({ observed: { ...owner, key: 'another-owner', scope: { ...scope, userHash: 'another-author' } } })
    await waitFor(() => expect(store.source).toHaveBeenCalledTimes(2))
    const latestCurrent = store.source.mock.calls[1][2]
    view.unmount(); expect(latestCurrent()).toBe(false)
})
it('keeps a newer failed root publication visible when an older list write completes later', async () => {
    let finish!: (value: { status: 'saved' }) => void
    store.source.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    store.root.mockResolvedValue({ status: 'limit' })
    const stories = [source], view = renderHook(() => useNovelLifecycleRetention(owner, stories, null))
    await waitFor(() => expect(store.source).toHaveBeenCalledTimes(1))
    await act(async () => { await view.result.current.root(source.id, 9, true) })
    expect(view.result.current.failed).toBe(true)
    await act(async () => finish({ status: 'saved' }))
    expect(view.result.current.failed).toBe(true)
})
