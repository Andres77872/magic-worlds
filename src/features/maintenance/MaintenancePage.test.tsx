import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LANGUAGE_STORAGE_KEY } from '@/app/i18n/languages'
import MaintenancePage from './MaintenancePage'

describe('MaintenancePage', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
        localStorage.clear()
    })

    it('works without application providers or network access and preserves stored work', () => {
        const fetch = vi.fn(() => { throw new Error('The backend is unavailable') })
        vi.stubGlobal('fetch', fetch)
        localStorage.setItem('magic_worlds:token', 'retained-token')
        localStorage.setItem('maintenance-test:draft', 'An unfinished chapter')
        const onReload = vi.fn()

        render(<MaintenancePage initialLanguage="en" onReload={onReload} />)

        expect(screen.getByRole('main')).toBeInTheDocument()
        expect(screen.getByRole('heading', { level: 1, name: 'A pause between chapters.' })).toBeInTheDocument()
        expect(screen.getByText('Under maintenance')).toBeInTheDocument()
        expect(screen.getByRole('img', { name: /closed, gold-edged storybook/i })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
        expect(onReload).toHaveBeenCalledOnce()
        expect(fetch).not.toHaveBeenCalled()
        expect(localStorage.getItem('magic_worlds:token')).toBe('retained-token')
        expect(localStorage.getItem('maintenance-test:draft')).toBe('An unfinished chapter')
    })

    it('uses the saved language and switches copy, document metadata and local preference', () => {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, 'es')
        const fetch = vi.fn()
        vi.stubGlobal('fetch', fetch)

        render(<MaintenancePage />)

        expect(screen.getByRole('heading', { level: 1, name: 'Una pausa entre capítulos.' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Español' })).toHaveAttribute('aria-pressed', 'true')
        expect(document.documentElement.lang).toBe('es')
        expect(document.title).toBe('En mantenimiento · Magic Worlds')

        fireEvent.click(screen.getByRole('button', { name: 'English' }))

        expect(screen.getByRole('heading', { level: 1, name: 'A pause between chapters.' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')
        expect(document.documentElement.lang).toBe('en')
        expect(document.title).toBe('Under maintenance · Magic Worlds')
        expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en')
        expect(fetch).not.toHaveBeenCalled()
    })

    it('supports browser language and local switching when storage is blocked', () => {
        vi.spyOn(navigator, 'language', 'get').mockReturnValue('es-MX')
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage blocked') })
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked') })

        render(<MaintenancePage />)

        expect(screen.getByRole('heading', { name: 'Una pausa entre capítulos.' })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'English' }))
        expect(screen.getByRole('heading', { name: 'A pause between chapters.' })).toBeInTheDocument()
    })

    it('restores the document metadata when leaving the page', () => {
        document.title = 'Original page'
        document.documentElement.lang = 'en'
        document.documentElement.dir = 'ltr'

        const { unmount } = render(<MaintenancePage initialLanguage="es" />)
        expect(document.documentElement.lang).toBe('es')
        unmount()

        expect(document.title).toBe('Original page')
        expect(document.documentElement.lang).toBe('en')
        expect(document.documentElement.dir).toBe('ltr')
    })
})
