import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StudioSectionNav } from './StudioSectionNav'

afterEach(() => vi.unstubAllGlobals())

describe('StudioSectionNav', () => {
    it.each([false, true])('selects a section immediately and respects reduced motion (%s)', (reducedMotion) => {
        vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: reducedMotion })))
        render(
            <>
                <StudioSectionNav items={[{ id: 'identity', label: 'Identity' }, { id: 'history', label: 'History' }]} />
                <section id="identity" />
                <section id="history" />
            </>,
        )
        const scroll = vi.fn()
        document.getElementById('history')!.scrollIntoView = scroll

        fireEvent.click(screen.getByRole('button', { name: 'History' }))

        expect(screen.getByRole('button', { name: 'History' })).toHaveAttribute('aria-current', 'location')
        expect(screen.getByRole('button', { name: 'Identity' })).not.toHaveAttribute('aria-current')
        expect(scroll).toHaveBeenCalledWith({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
    })
})
