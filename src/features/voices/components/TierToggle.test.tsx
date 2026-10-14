import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CAPABILITIES_EL_FREE, CAPABILITIES_EL_PLUS, CAPABILITIES_EL_PRO } from '../fixtures'
import { TierToggle, defaultPreviewTier } from './TierToggle'

describe('TierToggle (R1-FE-02, D05)', () => {
    it('is a radiogroup over the plan’s tiers', () => {
        const onChange = vi.fn()
        render(<TierToggle capabilities={CAPABILITIES_EL_PLUS} value="standard" onChange={onChange} />)
        const group = screen.getByRole('radiogroup', { name: 'Narration quality' })
        expect(group).toBeInTheDocument()
        expect(screen.getByRole('radio', { name: /Standard/ })).toHaveAttribute('aria-checked', 'true')
        fireEvent.click(screen.getByRole('radio', { name: /Expressive/ }))
        expect(onChange).toHaveBeenCalledWith('expressive')
    })

    it('labels the Expressive option with the expressive_only badge (05 §5.1, AC-P8)', () => {
        render(<TierToggle capabilities={CAPABILITIES_EL_PRO} value="standard" onChange={vi.fn()} />)
        const expressive = screen.getByRole('radio', { name: 'Expressive' })
        expect(expressive.querySelector('[data-badge="expressive_only"]')).toHaveTextContent('Expressive')
        expect(screen.getByRole('radio', { name: 'Standard' }).querySelector('[data-badge]')).toBeNull()
    })

    it('moves and selects with the arrow keys, with one tab stop', () => {
        const onChange = vi.fn()
        render(<TierToggle capabilities={CAPABILITIES_EL_PRO} value="standard" onChange={onChange} />)
        const standard = screen.getByRole('radio', { name: 'Standard' })
        expect(standard).toHaveAttribute('tabindex', '0')
        expect(screen.getByRole('radio', { name: 'Expressive' })).toHaveAttribute('tabindex', '-1')
        fireEvent.keyDown(standard, { key: 'ArrowRight' })
        expect(onChange).toHaveBeenLastCalledWith('expressive')
        fireEvent.keyDown(standard, { key: 'ArrowLeft' })
        expect(onChange).toHaveBeenLastCalledWith('expressive')
        fireEvent.keyDown(standard, { key: 'Enter' })
        expect(onChange).toHaveBeenCalledTimes(2)
    })

    it('renders nothing without Expressive, or the upsell when asked and the capabilities were read', () => {
        const { container, rerender } = render(<TierToggle capabilities={CAPABILITIES_EL_FREE} value="standard" onChange={vi.fn()} />)
        expect(container).toBeEmptyDOMElement()
        rerender(<TierToggle capabilities={CAPABILITIES_EL_FREE} value="standard" onChange={vi.fn()} showUpsell />)
        expect(screen.getByText('Expressive narration is available on Plus and Pro.')).toBeInTheDocument()
        rerender(<TierToggle capabilities={null} value="standard" onChange={vi.fn()} showUpsell />)
        expect(container).toBeEmptyDOMElement()
    })

    it('starts from the stored preference when the plan allows it', () => {
        expect(defaultPreviewTier(CAPABILITIES_EL_PRO)).toBe('expressive')
        expect(defaultPreviewTier(CAPABILITIES_EL_PLUS)).toBe('standard')
        expect(defaultPreviewTier({ ...CAPABILITIES_EL_FREE, narration_tier: 'expressive' })).toBe('standard')
        expect(defaultPreviewTier(null)).toBe('standard')
    })
})
