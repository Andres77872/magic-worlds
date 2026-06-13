import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { DocsPage } from './DocsPage'
import { SECTIONS } from './docsContent'

const setPage = vi.fn()
const openLoginModal = vi.fn()
let authed = true
let restoreIntersectionObserver = false
const originalIntersectionObserver = globalThis.IntersectionObserver

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: authed, openLoginModal }),
    useNavigation: () => ({ setPage }),
}))

beforeEach(() => {
    authed = true
})

afterEach(() => {
    if (restoreIntersectionObserver) {
        vi.stubGlobal('IntersectionObserver', originalIntersectionObserver)
        restoreIntersectionObserver = false
    }
    cleanup()
    vi.clearAllMocks()
})

describe('DocsPage', () => {
    it('renders one nav button per section and every section heading', () => {
        render(<DocsPage />)

        const nav = within(screen.getByRole('navigation', { name: 'Docs sections' }))
        for (const section of SECTIONS) {
            expect(nav.getByRole('button', { name: section.label })).toBeTruthy()
        }
        expect(nav.getByRole('button', { name: 'Start here' })).toHaveAttribute('aria-current', 'location')

        for (const heading of [
            'A practical first path',
            'What every rail item is for',
            'Find your work',
            'Build cards that the rest of the app can reuse',
            'Use the right mode for the scene',
            'Move from interactive play to reusable writing',
            'Generate, track, and reuse media',
            'Best practices',
        ]) {
            expect(screen.getByRole('heading', { name: heading })).toBeTruthy()
        }
    })

    it('updates the active nav item as sections enter the viewport', () => {
        let observerCallback: IntersectionObserverCallback | undefined
        const observe = vi.fn()
        const unobserve = vi.fn()
        const disconnect = vi.fn()
        restoreIntersectionObserver = true

        class MockIntersectionObserver {
            readonly root = null
            readonly rootMargin = ''
            readonly thresholds: number[] = []

            constructor(callback: IntersectionObserverCallback) {
                observerCallback = callback
            }

            observe = observe
            unobserve = unobserve
            disconnect = disconnect
            takeRecords = () => []
        }

        vi.stubGlobal(
            'IntersectionObserver',
            MockIntersectionObserver,
        )

        render(<DocsPage />)

        const nav = within(screen.getByRole('navigation', { name: 'Docs sections' }))
        const playSection = document.getElementById('play')
        expect(playSection).toBeTruthy()

        act(() => {
            observerCallback?.(
                [
                    {
                        isIntersecting: true,
                        target: playSection as Element,
                    } as IntersectionObserverEntry,
                ],
                {} as IntersectionObserver,
            )
        })

        expect(observe).toHaveBeenCalledTimes(SECTIONS.length)
        expect(nav.getByRole('button', { name: 'Play modes' })).toHaveAttribute('aria-current', 'location')
        expect(nav.getByRole('button', { name: 'Start here' })).not.toHaveAttribute('aria-current')
    })

    it('gates create actions behind login when signed out', () => {
        authed = false
        render(<DocsPage />)

        fireEvent.click(screen.getByRole('button', { name: 'Create character' }))

        expect(openLoginModal).toHaveBeenCalledTimes(1)
        expect(setPage).not.toHaveBeenCalled()
    })

    it('navigates from an App map panel to its gallery when signed in', () => {
        render(<DocsPage />)

        fireEvent.click(screen.getByRole('button', { name: 'Characters' }))

        expect(setPage).toHaveBeenCalledWith('gallery-characters')
        expect(openLoginModal).not.toHaveBeenCalled()
    })

    it('lets guests open the ungated Explore panel', () => {
        authed = false
        render(<DocsPage />)

        fireEvent.click(screen.getByRole('button', { name: 'Explore' }))

        expect(setPage).toHaveBeenCalledWith('landing')
        expect(openLoginModal).not.toHaveBeenCalled()
    })
})
