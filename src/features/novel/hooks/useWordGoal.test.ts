import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useWordGoal } from './useWordGoal'

describe('useWordGoal', () => {
    beforeEach(() => window.localStorage.clear())

    it('persists and clears a per-chapter goal', () => {
        const { result } = renderHook(() => useWordGoal('s1', 'c1'))
        expect(result.current.goal).toBeNull()

        act(() => result.current.setGoal(2000))
        expect(result.current.goal).toBe(2000)
        expect(window.localStorage.getItem('magic_worlds:novel:wordGoal:s1:c1')).toBe('2000')

        act(() => result.current.setGoal(null))
        expect(result.current.goal).toBeNull()
        expect(window.localStorage.getItem('magic_worlds:novel:wordGoal:s1:c1')).toBeNull()
    })

    it('reads back a stored goal on mount', () => {
        window.localStorage.setItem('magic_worlds:novel:wordGoal:s1:c2', '1500')
        const { result } = renderHook(() => useWordGoal('s1', 'c2'))
        expect(result.current.goal).toBe(1500)
    })

    it('isolates goals per chapter', () => {
        const { result, rerender } = renderHook(({ chapter }) => useWordGoal('s1', chapter), { initialProps: { chapter: 'c1' } })
        act(() => result.current.setGoal(1000))
        rerender({ chapter: 'c2' })
        expect(result.current.goal).toBeNull()
        rerender({ chapter: 'c1' })
        expect(result.current.goal).toBe(1000)
    })

    it('ignores non-positive goals', () => {
        const { result } = renderHook(() => useWordGoal('s1', 'c3'))
        act(() => result.current.setGoal(0))
        expect(result.current.goal).toBeNull()
    })
})
