import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useContext } from 'react'
import { apiService } from '@/infrastructure/api'
import { ApiStatusContext } from './apiStatusContext'
import { API_STATUS_BANNER_OFFLINE_THRESHOLD, ApiStatusProvider } from './ApiStatusProvider'

vi.mock('@/infrastructure/api', () => ({
    apiService: {
        getDependencyHealth: vi.fn(),
        getHealth: vi.fn(),
    },
}))

function Probe() {
    const value = useContext(ApiStatusContext)
    return <div>{value?.status}:{String(value?.showServicesDownBanner)}</div>
}

afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
})

describe('ApiStatusProvider', () => {
    it('shows degraded state without contributing to the outage banner', async () => {
        vi.useFakeTimers()
        vi.mocked(apiService.getDependencyHealth).mockResolvedValue({
            status: 'degraded',
            services: [{ id: 'llm', label: 'LLM', status: 'degraded' }],
        })
        render(<ApiStatusProvider pollIntervalMs={10}><Probe /></ApiStatusProvider>)
        await act(async () => { await vi.advanceTimersByTimeAsync(10 * (API_STATUS_BANNER_OFFLINE_THRESHOLD + 1)) })
        expect(screen.getByText('degraded:false')).toBeInTheDocument()
    })
})
