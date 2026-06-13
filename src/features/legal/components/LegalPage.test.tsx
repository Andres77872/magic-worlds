import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { LegalPage } from './LegalPage'
import type { LegalPageId } from './legalContent'

const setPage = vi.fn()

vi.mock('@/app/hooks', () => ({
    useNavigation: () => ({ setPage }),
}))

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

const PAGE_CASES: Array<[LegalPageId, string, string]> = [
    ['about', 'A free preview for living stories', 'Do not use Magic Worlds for illegal content or activity.'],
    ['contact', 'Reach Magic Worlds', 'Do not send passwords or secrets.'],
    ['privacy', 'How Magic Worlds handles data', 'Local-only storage and zero-retention mode are not supported right now.'],
    ['disclaimer', 'Preview service limits', 'NSFW content is not allowed while the service is free.'],
]

describe('LegalPage', () => {
    it.each(PAGE_CASES)('renders the %s page content', (page, heading, expectedCopy) => {
        render(<LegalPage page={page} />)

        expect(screen.getByRole('heading', { name: heading })).toBeTruthy()
        expect(screen.getByText((text) => text.includes(expectedCopy))).toBeTruthy()
        expect(screen.getByText('Last updated June 12, 2026')).toBeTruthy()
        expect(screen.getByRole('link', { name: 'andres@arz.ai' })).toHaveAttribute('href', 'mailto:andres@arz.ai')
    })

    it('marks the active legal page and navigates to related pages', () => {
        render(<LegalPage page="privacy" />)

        const nav = within(screen.getByRole('navigation', { name: 'Legal pages' }))
        expect(nav.getByRole('button', { name: 'Privacy Policy' })).toHaveAttribute('aria-current', 'page')

        fireEvent.click(nav.getByRole('button', { name: 'Contact' }))
        fireEvent.click(screen.getByRole('button', { name: 'Explore' }))

        expect(setPage).toHaveBeenNthCalledWith(1, 'contact')
        expect(setPage).toHaveBeenNthCalledWith(2, 'landing')
    })
})
