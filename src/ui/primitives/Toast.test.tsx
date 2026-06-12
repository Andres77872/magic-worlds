import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Toast } from './Toast'

describe('Toast', () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it('renders success feedback as a polite status', () => {
        render(<Toast open tone="success" title="Share link copied" message="Lyra" onClose={() => {}} />)

        const toast = screen.getByRole('status', { name: 'Share link copied' })
        expect(within(toast).getByText('Lyra')).toBeInTheDocument()
    })

    it('renders error feedback as an alert', () => {
        render(<Toast open tone="error" title="Could not copy link" message="Try again." onClose={() => {}} />)

        const toast = screen.getByRole('alert', { name: 'Could not copy link' })
        expect(within(toast).getByText('Try again.')).toBeInTheDocument()
    })

    it('can be dismissed manually', () => {
        const onClose = vi.fn()
        render(<Toast open tone="success" title="Saved" onClose={onClose} />)

        fireEvent.click(screen.getByRole('button', { name: 'Dismiss notice' }))

        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('auto-dismisses after the configured delay', () => {
        vi.useFakeTimers()
        const onClose = vi.fn()
        render(<Toast open tone="success" title="Saved" autoCloseMs={3200} onClose={onClose} />)

        act(() => vi.advanceTimersByTime(3199))
        expect(onClose).not.toHaveBeenCalled()

        act(() => vi.advanceTimersByTime(1))
        expect(onClose).toHaveBeenCalledTimes(1)
    })
})
