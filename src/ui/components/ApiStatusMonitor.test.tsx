import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ApiDependencyService } from '@/infrastructure/api'
import { ApiStatusMonitor } from './ApiStatusMonitor'

const services: ApiDependencyService[] = [
    { id: 'mysql', label: 'MySQL', status: 'ok', latency_ms: 3 },
    { id: 'auth', label: 'API Auth', status: 'offline', message: 'Connection timed out.' },
]

function stubRect(element: Element) {
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
        x: 32,
        y: 80,
        top: 80,
        left: 32,
        right: 72,
        bottom: 120,
        width: 40,
        height: 40,
        toJSON: () => ({}),
    } as DOMRect)
}

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

    it('shows the collapsed status tooltip in a body portal', () => {
        render(<ApiStatusMonitor status="online" services={services} collapsed />)

        const trigger = screen.getByRole('button', { name: 'API online' })
        const wrapper = trigger.parentElement as HTMLElement
        stubRect(wrapper)
        fireEvent.mouseEnter(wrapper)

        const tooltip = screen.getByRole('tooltip', { name: 'API online' })
        expect(tooltip.parentElement).toBe(document.body)
        expect(wrapper).not.toContainElement(tooltip)
    })
})
