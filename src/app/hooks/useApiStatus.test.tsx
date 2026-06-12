import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiService } from '@/infrastructure/api'
import { ApiStatusProvider } from '@/app/providers/ApiStatusProvider'
import { useApiStatus } from './useApiStatus'

vi.mock('@/infrastructure/api', () => ({
    apiService: {
        getHealth: vi.fn(),
        getDependencyHealth: vi.fn(),
    },
}))

describe('useApiStatus', () => {
    const getHealth = vi.mocked(apiService.getHealth)
    const getDependencyHealth = vi.mocked(apiService.getDependencyHealth)

    const wrapper = ({ children }: { children: ReactNode }) => (
        <ApiStatusProvider>{children}</ApiStatusProvider>
    )

    const flushPromises = async () => {
        await act(async () => {
            await Promise.resolve()
        })
    }

    beforeEach(() => {
        vi.useFakeTimers()
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('checks immediately and polls every 10 seconds by default', async () => {
        getDependencyHealth.mockResolvedValue({
            status: 'ok',
            checked_at: '2026-06-11T20:11:09.721371Z',
            services: [{ id: 'magic_worlds_api', label: 'Magic Worlds API', status: 'ok', components: [] }],
        })

        const { result } = renderHook(() => useApiStatus(), { wrapper })

        expect(result.current.status).toBe('checking')
        await flushPromises()
        expect(result.current.status).toBe('online')
        expect(result.current.services).toHaveLength(1)
        expect(result.current.checkedAt).toBe('2026-06-11T20:11:09.721371Z')
        expect(getDependencyHealth).toHaveBeenCalledTimes(1)
        expect(getHealth).not.toHaveBeenCalled()

        await act(async () => {
            await vi.advanceTimersByTimeAsync(10_000)
            await Promise.resolve()
        })

        expect(getDependencyHealth).toHaveBeenCalledTimes(2)
        expect(result.current.status).toBe('online')
    })

    it('marks the API offline when a dependency poll reports offline', async () => {
        getDependencyHealth
            .mockResolvedValueOnce({ status: 'ok', services: [] })
            .mockResolvedValueOnce({
                status: 'offline',
                services: [{ id: 'user_providers', label: 'User / Auth Providers', status: 'offline', components: [] }],
            })

        const { result } = renderHook(() => useApiStatus(), { wrapper })

        await flushPromises()
        expect(result.current.status).toBe('online')

        await act(async () => {
            await vi.advanceTimersByTimeAsync(10_000)
            await Promise.resolve()
        })

        expect(result.current.status).toBe('offline')
        expect(result.current.services?.[0]?.id).toBe('user_providers')
    })

    it('falls back to the legacy health endpoint when dependency details are unavailable', async () => {
        getDependencyHealth.mockRejectedValue(new Error('not found'))
        getHealth.mockResolvedValue({ status: 'ok' })

        const { result } = renderHook(() => useApiStatus(), { wrapper })

        await flushPromises()

        expect(result.current.status).toBe('online')
        expect(result.current.services).toEqual([])
        expect(getHealth).toHaveBeenCalledTimes(1)
    })

    it('aborts the active health request on unmount', async () => {
        getDependencyHealth.mockImplementation(() => new Promise(() => undefined))

        const { unmount } = renderHook(() => useApiStatus(), { wrapper })

        expect(getDependencyHealth).toHaveBeenCalledTimes(1)
        const signal = getDependencyHealth.mock.calls[0][0]?.signal
        expect(signal?.aborted).toBe(false)

        unmount()

        expect(signal?.aborted).toBe(true)
    })
})
