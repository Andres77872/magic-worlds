import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { workspaceStorageKey } from '@/shared/workspaceStorage'
import { apiStorageOrigin } from '@/shared/workspaceStorage'
import { API_BASE_URL } from '@/infrastructure/api/baseUrl'
import type { ManuscriptPosition } from '../editor/manuscript'

const identity = vi.hoisted(() => ({ userHash: 'position-author' }))
vi.mock('@/app/hooks', () => ({ useAuth: () => identity }))
import { useScenePosition } from './useScenePosition'
const point = (offset = 5, scrollTop = 400): ManuscriptPosition => ({ anchor: { nodeId: 'block-one', offset }, head: { nodeId: 'block-one', offset: 1 }, scrollTop })
const key = (story = 'book', scene = 'scene', workspaceId = 'desk', userHash = identity.userHash) => workspaceStorageKey(`magic-worlds:novel-position:v1:${story}:${scene}`, { apiOrigin: apiStorageOrigin(API_BASE_URL), userHash, workspaceId })
beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); identity.userHash = 'position-author' })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

it('debounces immutable positions and supplies the latest point before a recovery remount', () => {
    localStorage.setItem(key(), JSON.stringify(point(2)))
    const view = renderHook(() => useScenePosition('book', 'scene', 'desk'))
    expect(view.result.current.initialPosition).toEqual(point(2))
    const write = vi.spyOn(Storage.prototype, 'setItem')
    const captured = point(9, 900)
    act(() => { view.result.current.onPositionChange(point(4)); view.result.current.onPositionChange(captured) })
    captured.head.offset = 99
    expect(view.result.current.getInitialPosition()).toEqual(point(9, 900))
    expect(write).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(300))
    expect(write).toHaveBeenCalledTimes(1)
    expect(JSON.parse(localStorage.getItem(key())!)).toEqual(point(9, 900))
    view.unmount()
})

it('flushes before page hide and hidden visibility, and retires the callback after unmount', () => {
    const view = renderHook(() => useScenePosition('book', 'scene', 'desk'))
    act(() => { view.result.current.onPositionChange(point(7)); window.dispatchEvent(new Event('pagehide')) })
    expect(JSON.parse(localStorage.getItem(key())!)).toEqual(point(7))
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    act(() => { view.result.current.onPositionChange(point(8)); document.dispatchEvent(new Event('visibilitychange')) })
    expect(JSON.parse(localStorage.getItem(key())!)).toEqual(point(8))
    const old = view.result.current.onPositionChange
    act(() => old(point(9)))
    view.unmount()
    expect(JSON.parse(localStorage.getItem(key())!)).toEqual(point(9))
    const write = vi.spyOn(Storage.prototype, 'setItem')
    act(() => { old(point(10)); vi.runOnlyPendingTimers(); window.dispatchEvent(new Event('pagehide')) })
    expect(write).not.toHaveBeenCalled()
})

it('flushes the original scene on scope changes and rejects late old-scope position callbacks', () => {
    const firstKey = key()
    const view = renderHook(({ story, scene, workspace }) => useScenePosition(story, scene, workspace), { initialProps: { story: 'book', scene: 'scene', workspace: 'desk' } })
    act(() => view.result.current.onPositionChange(point(3)))
    const old = view.result.current
    for (const props of [{ story: 'book', scene: 'other', workspace: 'desk' }, { story: 'other', scene: 'scene', workspace: 'desk' }, { story: 'book', scene: 'scene', workspace: 'other' }]) {
        view.rerender(props)
        expect(view.result.current.getInitialPosition()).toBeNull()
        act(() => old.onPositionChange(point(99)))
    }
    identity.userHash = 'other-author'
    view.rerender({ story: 'book', scene: 'scene', workspace: 'desk' })
    expect(view.result.current.getInitialPosition()).toBeNull()
    expect(old.getInitialPosition()).toBeNull()
    act(() => old.onPositionChange(point(99)))
    expect(JSON.parse(localStorage.getItem(firstKey)!)).toEqual(point(3))
    expect(localStorage.length).toBe(1)
    view.unmount()
})

it.each([
    '{bad JSON', JSON.stringify({ ...point(), scrollTop: -1 }), JSON.stringify({ ...point(), schemaVersion: 9 }),
    JSON.stringify({ ...point(), anchor: { nodeId: '', offset: 0 } }),
    JSON.stringify({ ...point(), anchor: { nodeId: 'block', offset: Number.MAX_SAFE_INTEGER + 1 } }), ' '.repeat(2049),
])('ignores invalid stored points without deleting them', (raw) => {
    localStorage.setItem(key(), raw)
    const view = renderHook(() => useScenePosition('book', 'scene', 'desk'))
    expect(view.result.current.getInitialPosition()).toBeNull()
    expect(localStorage.getItem(key())).toBe(raw)
    view.unmount()
})

it('keeps the latest position usable during failed storage and clears the warning after successful retry', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError') })
    const view = renderHook(() => useScenePosition('book', 'scene', 'desk'))
    act(() => { view.result.current.onPositionChange(point(6)); vi.advanceTimersByTime(300) })
    expect(view.result.current.storageUnavailable).toBe(true)
    expect(view.result.current.getInitialPosition()).toEqual(point(6))
    write.mockRestore()
    act(() => window.dispatchEvent(new Event('pagehide')))
    expect(view.result.current.storageUnavailable).toBe(false)
    expect(JSON.parse(localStorage.getItem(key())!)).toEqual(point(6))
    view.unmount()
})
