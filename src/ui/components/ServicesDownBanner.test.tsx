import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ApiStatusContext, type ApiStatus } from '@/app/providers/apiStatusContext'
import { ServicesDownBanner } from './ServicesDownBanner'

function renderBanner(status: ApiStatus, showServicesDownBanner = false) {
    return render(
        <ApiStatusContext.Provider value={{ status, showServicesDownBanner }}>
            <ServicesDownBanner />
        </ApiStatusContext.Provider>,
    )
}

describe('ServicesDownBanner', () => {
    it('shows a persistent alert when the API is offline', () => {
        renderBanner('offline', true)

        expect(screen.getByRole('alert')).toHaveTextContent(
            'Services are down. Some actions may fail until the API is back online.',
        )
    })

    it('does not render for a transient offline status before the banner debounce threshold', () => {
        renderBanner('offline')

        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('does not render while the API is online or checking', () => {
        const { rerender } = renderBanner('online')
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()

        rerender(
            <ApiStatusContext.Provider value={{ status: 'checking', showServicesDownBanner: false }}>
                <ServicesDownBanner />
            </ApiStatusContext.Provider>,
        )
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
})
