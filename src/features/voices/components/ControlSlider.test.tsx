import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ControlSlider } from './ControlSlider'

function slider(props: Partial<Parameters<typeof ControlSlider>[0]> = {}) {
    const onChange = vi.fn()
    const { unmount } = render(<ControlSlider label="Stability" value={0.4} min={0} max={1} step={0.05} defaultValue={0.5} onChange={onChange} {...props} />)
    return { input: screen.getByRole('slider', { name: 'Stability' }), onChange, unmount }
}

describe('ControlSlider PageUp/PageDown (05 §10 Sliders)', () => {
    it('moves a 0.05-grid slider by ±0.25 and keeps the browser from paging it too', () => {
        const { input, onChange } = slider()
        const up = fireEvent.keyDown(input, { key: 'PageUp' })
        expect(up).toBe(false)
        expect(onChange).toHaveBeenLastCalledWith(0.65)
        fireEvent.keyDown(input, { key: 'PageDown' })
        expect(onChange).toHaveBeenLastCalledWith(0.15)
    })

    it('clamps at the limits and stays silent when already there', () => {
        const high = slider({ value: 0.9 })
        fireEvent.keyDown(high.input, { key: 'PageUp' })
        expect(high.onChange).toHaveBeenLastCalledWith(1)
        high.unmount()

        const top = slider({ value: 1 })
        fireEvent.keyDown(top.input, { key: 'PageUp' })
        expect(top.onChange).not.toHaveBeenCalled()
        top.unmount()

        const low = slider({ value: 0.1 })
        fireEvent.keyDown(low.input, { key: 'PageDown' })
        expect(low.onChange).toHaveBeenLastCalledWith(0)
    })

    it('snaps an off-grid value to the step grid from min (speed 0.7–1.2)', () => {
        const speed = slider({ value: 0.93, min: 0.7, max: 1.2, defaultValue: 1 })
        fireEvent.keyDown(speed.input, { key: 'PageUp' })
        expect(speed.onChange).toHaveBeenLastCalledWith(1.2)
        fireEvent.keyDown(speed.input, { key: 'PageDown' })
        expect(speed.onChange).toHaveBeenLastCalledWith(0.7)
    })

    it('leaves the other keys to the browser', () => {
        const { input, onChange } = slider()
        for (const key of ['ArrowUp', 'ArrowRight', 'Home', 'End']) expect(fireEvent.keyDown(input, { key })).toBe(true)
        expect(onChange).not.toHaveBeenCalled()
    })

    it('does nothing while disabled', () => {
        const { input, onChange } = slider({ disabled: true })
        expect(fireEvent.keyDown(input, { key: 'PageUp' })).toBe(true)
        expect(onChange).not.toHaveBeenCalled()
    })

    it.each([
        ['0.1 (a coarse speed slider)', 0.1, 0.5, 2],
        ['1 (an integer slider)', 1, -12, 12],
        ['0.5 (a coarse admin slider)', 0.5, 0, 5],
    ])('keeps the browser’s own page step on a %s grid', (_label, step, min, max) => {
        const { input, onChange } = slider({ step, min, max, value: min + step * 2, defaultValue: min })
        expect(fireEvent.keyDown(input, { key: 'PageUp' })).toBe(true)
        expect(fireEvent.keyDown(input, { key: 'PageDown' })).toBe(true)
        expect(onChange).not.toHaveBeenCalled()
    })

    it('takes an explicit page step, and null turns it off', () => {
        const custom = slider({ pageStep: 0.1 })
        fireEvent.keyDown(custom.input, { key: 'PageUp' })
        expect(custom.onChange).toHaveBeenLastCalledWith(0.5)
        custom.unmount()

        const off = slider({ pageStep: null })
        expect(fireEvent.keyDown(off.input, { key: 'PageUp' })).toBe(true)
        expect(off.onChange).not.toHaveBeenCalled()
    })
})
