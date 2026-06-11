import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiService } from '@/infrastructure/api'
import { ApiStatusProvider } from '@/app/providers/ApiStatusProvider'
import { useApiStatus } from './useApiStatus'

vi.mock('@/infrastructure/api', () => ({
    apiService: {
        getHealth: vi.fn(),
    },
}))

describe('useApiStatus', () => {
    const getHealth = vi.mocked(apiService.getHealth)

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
        getHealth.mockResolvedValue({ status: 'ok' })

        const { result } = renderHook(() => useApiStatus(), { wrapper })

        expect(result.current.status).toBe('checking')
        await flushPromises()
        expect(result.current.status).toBe('online')
        expect(getHealth).toHaveBeenCalledTimes(1)

        await act(async () => {
            await vi.advanceTimersByTimeAsync(10_000)
            await Promise.resolve()
        })

        expect(getHealth).toHaveBeenCalledTimes(2)
        expect(result.current.status).toBe('online')
    })

    it('marks the API offline when a later poll fails', async () => {
        getHealth
            .mockResolvedValueOnce({ status: 'ok' })
            .mockRejectedValueOnce(new Error('network down'))

        const { result } = renderHook(() => useApiStatus(), { wrapper })

        await flushPromises()
        expect(result.current.status).toBe('online')

        await act(async () => {
            await vi.advanceTimersByTimeAsync(10_000)
            await Promise.resolve()
        })

        expect(result.current.status).toBe('offline')
    })

    it('aborts the active health request on unmount', async () => {
        getHealth.mockImplementation(() => new Promise(() => undefined))

        const { unmount } = renderHook(() => useApiStatus(), { wrapper })

        expect(getHealth).toHaveBeenCalledTimes(1)
        const signal = getHealth.mock.calls[0][0]?.signal
        expect(signal?.aborted).toBe(false)

        unmount()

        expect(signal?.aborted).toBe(true)
    })
})
