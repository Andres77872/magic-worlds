import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { workspaceStorageKey } from '@/shared/workspaceStorage'
import { DEFAULT_STUDIO_PANELS, useStudioView } from './useStudioView'

const scope = (userHash = 'writer', workspaceId = 'desk', apiOrigin = 'https://api.example', novelId = 'book') =>
    workspaceStorageKey('magic-worlds:novel-view:v1:' + novelId, { userHash, workspaceId, apiOrigin })
beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

it('restores selection/panels independently of reading and outline preferences without importing global flags', () => {
    const key = scope()
    localStorage.setItem('magic_worlds:novel:codexOpen', 'false')
    localStorage.setItem('magic_worlds:novel:typewriter', 'true')
    localStorage.setItem(key + ':reading', 'Retain this independent record')
    localStorage.setItem(key + ':outline', 'Retain this too')
    const view = renderHook(() => useStudioView(key))
    expect(view.result.current).toMatchObject(DEFAULT_STUDIO_PANELS)
    act(() => {
        view.result.current.selectUnit('scene-two')
        view.result.current.toggleFocusMode()
        view.result.current.toggleTypewriter()
        view.result.current.setNarrowPanel('codex')
        view.result.current.setCodexScope('scene')
    })
    expect(view.result.current).toMatchObject({ selectedUnit: 'scene-two', focusMode: true, typewriter: true, narrowPanel: 'codex', codexScope: 'scene' })
    view.unmount()
    const reopened = renderHook(() => useStudioView(key))
    expect(reopened.result.current).toMatchObject({ selectedUnit: 'scene-two', focusMode: true, typewriter: true, narrowPanel: 'codex', codexScope: 'scene' })
    act(() => { reopened.result.current.toggleFocusMode(); reopened.result.current.toggleFocusMode() })
    expect(reopened.result.current).toMatchObject({ focusMode: true, narrowPanel: null, codexOpen: true })
    act(() => reopened.result.current.setCodexOpen(false))
    expect(reopened.result.current).toMatchObject({ codexOpen: false, narrowPanel: null })
    expect(localStorage.getItem(key + ':reading')).toBe('Retain this independent record')
    expect(localStorage.getItem(key + ':outline')).toBe('Retain this too')
    expect(localStorage.getItem('magic_worlds:novel:codexOpen')).toBe('false')
    expect(localStorage.getItem('magic_worlds:novel:typewriter')).toBe('true')
})

it('isolates account/API/workspace/novel from the first render and retires stale or unmounted callbacks', () => {
    const first = scope()
    const view = renderHook(({ key }) => useStudioView(key), { initialProps: { key: first } })
    act(() => { view.result.current.selectUnit('scene-two'); view.result.current.toggleFocusMode() })
    const old = view.result.current
    for (const key of [scope('other'), scope('writer', 'other'), scope('writer', 'desk', 'https://other.example'), scope('writer', 'desk', 'https://api.example', 'other')]) {
        view.rerender({ key })
        expect(view.result.current).toMatchObject({ selectedUnit: null, ...DEFAULT_STUDIO_PANELS })
        act(() => { old.selectUnit('late-scene'); old.toggleTypewriter() })
        expect(localStorage.getItem(key)).toBeNull()
        expect(localStorage.getItem(key + ':panels')).toBeNull()
    }
    view.rerender({ key: first })
    expect(view.result.current).toMatchObject({ selectedUnit: 'scene-two', focusMode: true, typewriter: false })
    view.unmount()
    const before = localStorage.getItem(first)
    act(() => old.selectUnit('too-late'))
    expect(localStorage.getItem(first)).toBe(before)
})

it.each([
    '{bad JSON', JSON.stringify({ schemaVersion: 2, ...DEFAULT_STUDIO_PANELS }),
    JSON.stringify({ schemaVersion: 1, ...DEFAULT_STUDIO_PANELS, narrowPanel: 'unknown' }),
    JSON.stringify({ schemaVersion: 1, ...DEFAULT_STUDIO_PANELS, focusMode: 'true' }),
    JSON.stringify({ schemaVersion: 1, ...DEFAULT_STUDIO_PANELS, body: 'Never a view field' }), ' '.repeat(2049),
])('ignores invalid panel records without deleting or overwriting them', (raw) => {
    const key = scope()
    localStorage.setItem(key + ':panels', raw)
    const view = renderHook(() => useStudioView(key))
    expect(view.result.current).toMatchObject(DEFAULT_STUDIO_PANELS)
    expect(localStorage.getItem(key + ':panels')).toBe(raw)
    view.unmount()
})

it('keeps controls usable during storage failure, batches toggles correctly and retries only the changed record', () => {
    const key = scope()
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError') })
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError') })
    const view = renderHook(() => useStudioView(key))
    expect(view.result.current.viewStorageUnavailable).toBe(true)
    act(() => {
        view.result.current.selectUnit('retained-scene')
        view.result.current.toggleTypewriter()
        view.result.current.toggleTypewriter()
        view.result.current.setNarrowPanel('outline')
    })
    expect(view.result.current).toMatchObject({ selectedUnit: 'retained-scene', typewriter: false, narrowPanel: 'outline' })
    write.mockRestore()
    read.mockRestore()
    act(() => view.result.current.toggleFocusMode())
    expect(localStorage.getItem(key)).toBeNull()
    expect(view.result.current.viewStorageUnavailable).toBe(true)
    act(() => view.result.current.selectUnit('retained-scene'))
    expect(view.result.current.viewStorageUnavailable).toBe(false)
})
