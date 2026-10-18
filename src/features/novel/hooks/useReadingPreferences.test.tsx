import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { workspaceStorageKey } from '@/shared/workspaceStorage'
import { DEFAULT_READING, readingPresets } from '../utils/readingPreferences'
import { useReadingPreferences } from './useReadingPreferences'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())
const scope = (userHash = 'author', workspaceId = 'desk', apiOrigin = 'https://api.example', novelId = 'novel') =>
    workspaceStorageKey('magic-worlds:novel-view:v1:' + novelId, { userHash, workspaceId, apiOrigin })

it('restores appearance independently for account, API, workspace and novel and rejects a late previous-scope setter', () => {
    const first = scope()
    const view = renderHook(({ key }) => useReadingPreferences(key), { initialProps: { key: first } })
    act(() => view.result.current.setPreferences(readingPresets.close))
    const stale = view.result.current.setPreferences
    for (const key of [scope('other'), scope('author', 'other'), scope('author', 'desk', 'https://other.example'), scope('author', 'desk', 'https://api.example', 'other')]) {
        view.rerender({ key })
        expect(view.result.current.preferences).toEqual(DEFAULT_READING)
        act(() => stale(readingPresets.spacious))
        expect(localStorage.getItem(key + ':reading')).toBeNull()
    }
    view.rerender({ key: first })
    expect(view.result.current.preferences).toEqual(readingPresets.close)
    view.unmount()
    act(() => stale(readingPresets.spacious))
    expect(JSON.parse(localStorage.getItem(first + ':reading')!)).toEqual({ schemaVersion: 1, ...readingPresets.close })
    const reopened = renderHook(() => useReadingPreferences(first))
    expect(reopened.result.current.preferences).toEqual(readingPresets.close)
})

it.each([
    '{bad JSON', JSON.stringify({ schemaVersion: 2, ...readingPresets.close }),
    JSON.stringify({ schemaVersion: 1, ...readingPresets.close, width: '10000px' }),
    JSON.stringify({ schemaVersion: 1, ...readingPresets.close, body: 'Must never become a preference' }),
    JSON.stringify({ schemaVersion: 1, font: 'sans' }), ' '.repeat(2049),
])('ignores corrupt/future/unbounded records without changing or deleting them', (raw) => {
    const key = scope()
    localStorage.setItem(key + ':reading', raw)
    const view = renderHook(() => useReadingPreferences(key))
    expect(view.result.current.preferences).toEqual(DEFAULT_READING)
    expect(localStorage.getItem(key + ':reading')).toBe(raw)
    view.unmount()
})

it('retains session choices after read/write storage failures and retries only the small scoped display record', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError') })
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError') })
    const view = renderHook(() => useReadingPreferences(scope()))
    expect(view.result.current.storageUnavailable).toBe(true)
    act(() => view.result.current.setPreferences(readingPresets.close))
    view.rerender()
    expect(view.result.current.preferences).toEqual(readingPresets.close)
    expect(view.result.current.storageUnavailable).toBe(true)
    write.mockRestore()
    act(() => view.result.current.setPreferences(readingPresets.spacious))
    expect(view.result.current.storageUnavailable).toBe(false)
    expect(localStorage.length).toBe(1)
})

it('uses session-only settings without an authenticated scope and never imports a global preference', () => {
    localStorage.setItem('magic_worlds:novel:reading', JSON.stringify({ schemaVersion: 1, ...readingPresets.close }))
    const view = renderHook(() => useReadingPreferences(null))
    expect(view.result.current.preferences).toEqual(DEFAULT_READING)
    act(() => view.result.current.setPreferences(readingPresets.spacious))
    expect(view.result.current.preferences).toEqual(readingPresets.spacious)
    expect(view.result.current.storageUnavailable).toBe(true)
    expect(localStorage.length).toBe(1)
})
