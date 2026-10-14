import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BREAK_NUDGE_IDLE_RESET_MS, useBreakNudge } from './useBreakNudge'

const MINUTE = 60_000

function setup(minutes: number | null, active = true) {
    return renderHook(({ minutes: m, active: a }) => useBreakNudge(m, a), { initialProps: { minutes, active } })
}

function advance(ms: number) {
    act(() => vi.advanceTimersByTime(ms))
}

beforeEach(() => {
    vi.useFakeTimers()
})

afterEach(() => {
    vi.useRealTimers()
})

describe('useBreakNudge', () => {
    it('shows after the interval of continuous activity', () => {
        const { result } = setup(20)
        advance(20 * MINUTE - 1)
        expect(result.current.visible).toBe(false)
        advance(1)
        expect(result.current.visible).toBe(true)
    })

    it('counts activity across short pauses', () => {
        const { result, rerender } = setup(20)
        advance(12 * MINUTE)
        rerender({ minutes: 20, active: false })
        advance(10 * MINUTE)
        rerender({ minutes: 20, active: true })
        advance(8 * MINUTE - 1)
        expect(result.current.visible).toBe(false)
        advance(1)
        expect(result.current.visible).toBe(true)
    })

    it('resets after 15 minutes idle, and retires a showing nudge', () => {
        expect(BREAK_NUDGE_IDLE_RESET_MS).toBe(15 * MINUTE)
        const { result, rerender } = setup(20)
        advance(19 * MINUTE)
        rerender({ minutes: 20, active: false })
        advance(BREAK_NUDGE_IDLE_RESET_MS)
        rerender({ minutes: 20, active: true })
        advance(19 * MINUTE)
        expect(result.current.visible).toBe(false)
        advance(MINUTE)
        expect(result.current.visible).toBe(true)

        rerender({ minutes: 20, active: false })
        // Still showing during a short pause (it waits for a dismissal) ...
        advance(BREAK_NUDGE_IDLE_RESET_MS - 1)
        expect(result.current.visible).toBe(true)
        // ... and gone after a real break.
        advance(1)
        expect(result.current.visible).toBe(false)
    })

    it('snoozes a dismissed nudge for another full interval', () => {
        const { result } = setup(10)
        advance(10 * MINUTE)
        expect(result.current.visible).toBe(true)

        act(() => result.current.dismiss())
        expect(result.current.visible).toBe(false)
        advance(10 * MINUTE - 1)
        expect(result.current.visible).toBe(false)
        advance(1)
        expect(result.current.visible).toBe(true)
    })

    it('never shows with no interval, or while idle', () => {
        const never = setup(null)
        advance(48 * 60 * MINUTE)
        expect(never.result.current.visible).toBe(false)

        const zero = setup(0)
        advance(60 * MINUTE)
        expect(zero.result.current.visible).toBe(false)

        const idle = setup(5, false)
        advance(60 * MINUTE)
        expect(idle.result.current.visible).toBe(false)
    })

    it('hides at once when the interval is withdrawn', () => {
        const { result, rerender } = setup(5)
        advance(5 * MINUTE)
        expect(result.current.visible).toBe(true)
        rerender({ minutes: null, active: true })
        expect(result.current.visible).toBe(false)
    })

    it('keeps a stable value between renders', () => {
        const { result, rerender } = setup(5)
        const first = result.current
        rerender({ minutes: 5, active: true })
        expect(result.current).toBe(first)
    })
})
