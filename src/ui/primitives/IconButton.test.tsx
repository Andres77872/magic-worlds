import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { X } from 'lucide-react'
import { IconButton } from './IconButton'

describe('IconButton', () => {
    it('exposes the label as aria-label and title', () => {
        render(
            <IconButton label="Dismiss" size="sm">
                <X size={14} />
            </IconButton>,
        )

        const button = screen.getByRole('button', { name: 'Dismiss' })
        expect(button).toHaveAttribute('title', 'Dismiss')
    })

    it.each(['sm', 'md'] as const)('extends the %s touch target on coarse pointers', (size) => {
        render(
            <IconButton label="Dismiss" size={size}>
                <X size={14} />
            </IconButton>,
        )

        const button = screen.getByRole('button', { name: 'Dismiss' })
        expect(button.className).toContain('pointer-coarse:after:absolute')
        expect(button.className).toContain('relative')
    })

    it('leaves the lg size (already 44px) without a hit-area overlay', () => {
        render(
            <IconButton label="Dismiss" size="lg">
                <X size={14} />
            </IconButton>,
        )

        expect(screen.getByRole('button', { name: 'Dismiss' }).className).not.toContain('pointer-coarse')
    })
})
