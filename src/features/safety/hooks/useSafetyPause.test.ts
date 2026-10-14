import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VoiceSafetyNoticeFrame } from '@/shared/types/interaction.types'
import { useSafetyPause } from './useSafetyPause'

const NOW = Date.parse('2026-10-13T12:00:00Z')

function frame(retry: number | null): VoiceSafetyNoticeFrame {
    return { type: 'voice_safety_notice', kind: 'self_harm', retry_after_seconds: retry }
}

beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
})

afterEach(() => {
    vi.useRealTimers()
})

describe('useSafetyPause', () => {
    it('is idle by default (every caller without the frame keeps today’s behaviour)', () => {
        const { result } = renderHook(() => useSafetyPause())
        expect(result.current).toMatchObject({ isPaused: false, pausedUntil: null, retryAfterSeconds: null, noticeOpen: false })
    })

    it('pauses on a notice, opens it, and ends when the retry passes', () => {
        const { result } = renderHook(() => useSafetyPause())
        act(() => result.current.onNotice(frame(600)))

        expect(result.current).toMatchObject({ isPaused: true, retryAfterSeconds: 600, noticeOpen: true, pausedUntil: NOW + 600_000 })

        act(() => result.current.dismiss())
        expect(result.current.noticeOpen).toBe(false)
        expect(result.current.isPaused).toBe(true)

        act(() => vi.advanceTimersByTime(600_000 - 1))
        expect(result.current.isPaused).toBe(true)
        act(() => vi.advanceTimersByTime(1))
        expect(result.current).toMatchObject({ isPaused: false, pausedUntil: null, retryAfterSeconds: null })
    })

    it('holds an open-ended pause for the life of the surface', () => {
        const { result } = renderHook(() => useSafetyPause())
        act(() => result.current.onNotice(frame(null)))
        act(() => vi.advanceTimersByTime(24 * 60 * 60_000))
        expect(result.current).toMatchObject({ isPaused: true, pausedUntil: null, retryAfterSeconds: null, noticeOpen: true })
    })

    it('ignores anything that is not a notice frame', () => {
        const { result } = renderHook(() => useSafetyPause())
        act(() => result.current.onNotice({ type: 'delta' } as unknown as VoiceSafetyNoticeFrame))
        expect(result.current.isPaused).toBe(false)
    })

    it('treats a junk retry as open-ended', () => {
        const { result } = renderHook(() => useSafetyPause())
        act(() => result.current.onNotice({ ...frame(null), retry_after_seconds: -1 }))
        expect(result.current).toMatchObject({ isPaused: true, pausedUntil: null, retryAfterSeconds: null })
    })

    it('seeds a pause the server already reports, without opening the notice', () => {
        const until = new Date(NOW + 5 * 60_000).toISOString()
        const { result } = renderHook(() => useSafetyPause(until))
        expect(result.current).toMatchObject({ isPaused: true, noticeOpen: false, pausedUntil: NOW + 5 * 60_000 })

        act(() => vi.advanceTimersByTime(5 * 60_000))
        expect(result.current.isPaused).toBe(false)
    })

    it('ignores a seed already past, or unparseable', () => {
        const past = renderHook(() => useSafetyPause(new Date(NOW - 1000).toISOString()))
        act(() => vi.advanceTimersByTime(0))
        expect(past.result.current.isPaused).toBe(false)

        const junk = renderHook(() => useSafetyPause('not a date'))
        expect(junk.result.current.isPaused).toBe(false)
    })

    it('keeps the later end of a live pause and a seed', () => {
        const until = new Date(NOW + 10 * 60_000).toISOString()
        const { result } = renderHook(() => useSafetyPause(until))
        act(() => result.current.onNotice(frame(60)))
        expect(result.current.pausedUntil).toBe(NOW + 10 * 60_000)

        act(() => vi.advanceTimersByTime(60_000))
        expect(result.current).toMatchObject({ isPaused: true, noticeOpen: false })
        act(() => vi.advanceTimersByTime(9 * 60_000))
        expect(result.current.isPaused).toBe(false)
    })
})
