import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Tooltip } from './Tooltip'

function stubRect(element: Element, rect: Partial<DOMRect> = {}) {
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
        ...rect,
    } as DOMRect)
}

function renderTooltip(props: Partial<Parameters<typeof Tooltip>[0]> = {}) {
    render(
        <Tooltip label="Open lorebook" {...props}>
            <button type="button">Trigger</button>
        </Tooltip>,
    )

    const trigger = screen.getByRole('button', { name: 'Trigger' })
    const wrapper = trigger.parentElement as HTMLElement
    stubRect(wrapper)
    return { trigger, wrapper }
}

describe('Tooltip', () => {
    it('shows on hover in a fixed body portal above app popovers', () => {
        const { wrapper } = renderTooltip()

        fireEvent.mouseEnter(wrapper)

        const tooltip = screen.getByRole('tooltip', { name: 'Open lorebook' })
        expect(tooltip.parentElement).toBe(document.body)
        expect(wrapper).not.toContainElement(tooltip)
        expect(tooltip).toHaveStyle({ position: 'fixed' })
        expect(tooltip).toHaveClass('z-[100]')
    })

    it('shows on keyboard focus', () => {
        const { trigger } = renderTooltip()

        fireEvent.focus(trigger)

        expect(screen.getByRole('tooltip', { name: 'Open lorebook' })).toBeInTheDocument()
    })

    it('does not render when disabled', () => {
        const { trigger, wrapper } = renderTooltip({ disabled: true })

        fireEvent.mouseEnter(wrapper)
        fireEvent.focus(trigger)

        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })

    it('keeps the tooltip clamped inside the viewport on resize', () => {
        const { wrapper } = renderTooltip()
        stubRect(wrapper, { top: 0, left: 1000, right: 1040, bottom: 40 })

        fireEvent.mouseEnter(wrapper)
        const tooltip = screen.getByRole('tooltip', { name: 'Open lorebook' })
        vi.spyOn(tooltip, 'offsetWidth', 'get').mockReturnValue(120)
        vi.spyOn(tooltip, 'offsetHeight', 'get').mockReturnValue(28)

        fireEvent.resize(window)

        expect(Number(tooltip.style.left.replace('px', ''))).toBeLessThanOrEqual(window.innerWidth - 8)
        expect(Number(tooltip.style.top.replace('px', ''))).toBeGreaterThanOrEqual(8)
    })
})
