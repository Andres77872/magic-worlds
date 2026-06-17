import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { apiService } from '@/infrastructure/api'
import { useCardUsage } from './useCardUsage'

afterEach(() => {
    vi.restoreAllMocks()
})

describe('useCardUsage', () => {
    it('returns null and never fetches while disabled', () => {
        const spy = vi.spyOn(apiService, 'getCardUsage')
        const { result } = renderHook(() => useCardUsage('character', 'disabled-1', { enabled: false }))
        expect(result.current).toBeNull()
        expect(spy).not.toHaveBeenCalled()
    })

    it('returns null when the target is incomplete', () => {
        const spy = vi.spyOn(apiService, 'getCardUsage')
        const { result } = renderHook(() => useCardUsage(null, undefined))
        expect(result.current).toBeNull()
        expect(spy).not.toHaveBeenCalled()
    })

    it('fetches usage when enabled and caches across hooks (one request per card)', async () => {
        const spy = vi
            .spyOn(apiService, 'getCardUsage')
            .mockResolvedValue({ sessions: 5, stories: 2 })

        const first = renderHook(() => useCardUsage('character', 'cache-1'))
        await waitFor(() => expect(first.result.current).toEqual({ sessions: 5, stories: 2 }))
        expect(spy).toHaveBeenCalledTimes(1)

        // A second mount for the same card reads from the module cache — no refetch.
        const second = renderHook(() => useCardUsage('character', 'cache-1'))
        await waitFor(() => expect(second.result.current).toEqual({ sessions: 5, stories: 2 }))
        expect(spy).toHaveBeenCalledTimes(1)
    })

    it('resolves to null when the request fails', async () => {
        vi.spyOn(apiService, 'getCardUsage').mockRejectedValue(new Error('boom'))
        const { result } = renderHook(() => useCardUsage('world', 'error-1'))
        // Stays null (informative-only — failures never surface).
        await waitFor(() => {})
        expect(result.current).toBeNull()
    })
})
