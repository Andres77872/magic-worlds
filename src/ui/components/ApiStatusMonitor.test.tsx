import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ApiDependencyService } from '@/infrastructure/api'
import { ApiStatusMonitor } from './ApiStatusMonitor'

const services: ApiDependencyService[] = [
    { id: 'mysql', label: 'MySQL', status: 'ok', latency_ms: 3 },
    { id: 'auth', label: 'API Auth', status: 'offline', message: 'Connection timed out.' },
]

describe('ApiStatusMonitor', () => {
    it('opens the dependencies popover from the trigger and lists services', () => {
        render(<ApiStatusMonitor status="online" services={services} />)

        expect(screen.queryByRole('dialog')).toBeNull()

        const trigger = screen.getByRole('button')
        expect(trigger).toHaveAttribute('aria-expanded', 'false')
        fireEvent.click(trigger)

        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(trigger).toHaveAttribute('aria-expanded', 'true')
        expect(screen.getByText('MySQL')).toBeInTheDocument()
        expect(screen.getByText('API Auth')).toBeInTheDocument()
    })

    it('renders open with defaultOpen and shows latency', () => {
        render(<ApiStatusMonitor status="online" services={services} defaultOpen />)

        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText('3ms')).toBeInTheDocument()
    })

    it('shows the unavailable note when there are no service details', () => {
        render(<ApiStatusMonitor status="online" services={[]} defaultOpen />)

        // Falls back to the "details unavailable" copy rather than an empty list.
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.queryByText('MySQL')).toBeNull()
    })

    it('closes on Escape', () => {
        render(<ApiStatusMonitor status="online" services={services} defaultOpen />)

        const trigger = screen.getByRole('button')
        expect(trigger).toHaveAttribute('aria-expanded', 'true')
        fireEvent.keyDown(window, { key: 'Escape' })
        expect(trigger).toHaveAttribute('aria-expanded', 'false')
    })
})
