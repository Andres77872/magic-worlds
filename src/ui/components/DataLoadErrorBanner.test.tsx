import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LoadingState } from '@/shared'

const loadData = vi.fn(async () => {})
let loadingState: LoadingState = { isLoading: false }

vi.mock('@/app/hooks', () => ({
    useData: () => ({ loadingState, loadData }),
}))

import { DataLoadErrorBanner } from './DataLoadErrorBanner'

describe('DataLoadErrorBanner', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        loadingState = { isLoading: false }
    })

    it('renders nothing while loading or without an error', () => {
        const { rerender } = render(<DataLoadErrorBanner />)
        expect(screen.queryByRole('status')).toBeNull()

        loadingState = { isLoading: true, error: 'boom' }
        rerender(<DataLoadErrorBanner />)
        expect(screen.queryByRole('status')).toBeNull()
    })

    it('shows on a load error and retries silently', async () => {
        loadingState = { isLoading: false, error: 'Some content failed to load — try refreshing.' }
        render(<DataLoadErrorBanner />)

        expect(screen.getByRole('status')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
        await waitFor(() => expect(loadData).toHaveBeenCalledWith({ silent: true }))
    })

    it('dismiss hides the banner; a new error re-surfaces it', () => {
        loadingState = { isLoading: false, error: 'first failure' }
        const { rerender } = render(<DataLoadErrorBanner />)

        fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
        expect(screen.queryByRole('status')).toBeNull()

        loadingState = { isLoading: false, error: 'second failure' }
        rerender(<DataLoadErrorBanner />)
        expect(screen.getByRole('status')).toBeInTheDocument()
    })
})
