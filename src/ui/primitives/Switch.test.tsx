import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Switch, SwitchRow } from './Switch'

describe('Switch', () => {
    it('exposes switch semantics and toggles on click', () => {
        const onChange = vi.fn()
        render(<Switch checked={false} onChange={onChange} aria-label="Enabled" />)

        const control = screen.getByRole('switch', { name: 'Enabled' })
        expect(control).toHaveAttribute('aria-checked', 'false')

        fireEvent.click(control)
        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange).toHaveBeenCalledWith(true)
    })

    it('reflects the checked state', () => {
        render(<Switch checked onChange={() => {}} aria-label="Enabled" />)
        expect(screen.getByRole('switch', { name: 'Enabled' })).toHaveAttribute('aria-checked', 'true')
    })

    it('does not fire when disabled', () => {
        const onChange = vi.fn()
        render(<Switch checked={false} disabled onChange={onChange} aria-label="Enabled" />)

        fireEvent.click(screen.getByRole('switch', { name: 'Enabled' }))
        expect(onChange).not.toHaveBeenCalled()
    })
})

describe('SwitchRow', () => {
    it('labels the switch and wires the description', () => {
        render(
            <SwitchRow
                label="Constant"
                description="Always include this entry."
                checked={false}
                onChange={() => {}}
            />,
        )

        const control = screen.getByRole('switch', { name: 'Constant' })
        expect(control).toHaveAccessibleDescription('Always include this entry.')
    })

    it('toggles when the label is clicked', () => {
        const onChange = vi.fn()
        render(<SwitchRow label="Constant" checked={false} onChange={onChange} />)

        fireEvent.click(screen.getByText('Constant'))
        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange).toHaveBeenCalledWith(true)
    })
})
