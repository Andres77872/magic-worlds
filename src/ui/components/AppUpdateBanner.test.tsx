import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppUpdateBanner } from './AppUpdateBanner'

describe('AppUpdateBanner', () => {
    it('does not render when no update is available', () => {
        render(<AppUpdateBanner updateAvailable={false} />)

        expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('shows a reload action when an update is available', () => {
        const onReload = vi.fn()

        render(<AppUpdateBanner updateAvailable onReload={onReload} />)

        expect(screen.getByRole('status')).toHaveTextContent('A new version is available. Reload to update.')

        fireEvent.click(screen.getByRole('button', { name: /reload/i }))

        expect(onReload).toHaveBeenCalledTimes(1)
    })
})
