import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { i18n } from '@/app/i18n'
import { DocsPage } from './DocsPage'
import { DOC_SECTION_IDS, getDocsContent } from './docsContent'

const setPage = vi.fn()
const openLoginModal = vi.fn()
let authed = true
let restoreIntersectionObserver = false
const originalIntersectionObserver = globalThis.IntersectionObserver

function rectAt(top: number): DOMRect {
    return {
        bottom: top,
        height: 0,
        left: 0,
        right: 0,
        top,
        width: 0,
        x: 0,
        y: top,
        toJSON: () => ({}),
    } as DOMRect
}

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: authed, openLoginModal }),
    useNavigation: () => ({ setPage }),
}))

beforeEach(async () => {
    authed = true
    await i18n.changeLanguage('en')
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
        const content = getDocsContent(i18n.getFixedT('en'))
        render(<DocsPage />)

        const nav = within(screen.getByRole('navigation', { name: content.navAriaLabel }))
        for (const section of content.sections) {
            expect(nav.getByRole('button', { name: section.label })).toBeTruthy()
        }
        expect(nav.getByRole('button', { name: content.sections[0].label })).toHaveAttribute('aria-current', 'location')

        for (const section of content.sections) {
            expect(screen.getByRole('heading', { name: section.title })).toBeTruthy()
        }
    })

    it('renders the docs page in Spanish when the app language is Spanish', async () => {
        await i18n.changeLanguage('es')
        const content = getDocsContent(i18n.getFixedT('es'))

        const { container } = render(<DocsPage />)
        const pageText = container.textContent ?? ''

        expect(screen.getByRole('heading', { name: content.page.title })).toBeTruthy()
        expect(screen.getByRole('navigation', { name: content.navAriaLabel })).toBeTruthy()
        expect(screen.getByRole('button', { name: content.sections[0].label })).toHaveAttribute('aria-current', 'location')
        expect(screen.getByRole('heading', { name: content.sections[5].title })).toBeTruthy()
        expect(pageText).toContain('Estudio de voz')
        expect(pageText).toContain('Ajusta la interpretación')
        expect(pageText).toContain('Acepto e iniciar llamada')
        expect(pageText).toContain('El audio bruto del micrófono')
    })

    it('documents user voice preset creation separately from calls', () => {
        const { container } = render(<DocsPage />)
        const pageText = container.textContent ?? ''

        for (const text of [
            'Voice studio',
            'New preset',
            'Base voice',
            'speed, volume, pitch, emotion, and language boost',
            'Preview voice',
            'Narration voice',
            'My presets',
            'Clear voice',
            'A preset defines how a character can sound. A voice call is the live microphone conversation.',
        ]) {
            expect(pageText).toContain(text)
        }
    })

    it('documents only user voice-call controls', () => {
        const { container } = render(<DocsPage />)
        const pageText = container.textContent ?? ''

        for (const text of [
            'Start voice call',
            'I consent and start call',
            'Mute microphone',
            'Interrupt',
            'End call',
            'Raw microphone audio and full call recordings are not stored by default',
        ]) {
            expect(pageText).toContain(text)
        }

        for (const blocked of [
            'ad' + 'min',
            'root',
            'endpoint',
            'configuration',
            'voice ' + 'clone',
            'voice ' + 'library',
            'system ' + 'voice',
        ]) {
            expect(pageText.toLowerCase()).not.toContain(blocked)
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

        const content = getDocsContent(i18n.getFixedT('en'))
        const nav = within(screen.getByRole('navigation', { name: content.navAriaLabel }))
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

        expect(observe).toHaveBeenCalledTimes(DOC_SECTION_IDS.length)
        expect(nav.getByRole('button', { name: content.sections[4].label })).toHaveAttribute('aria-current', 'location')
        expect(nav.getByRole('button', { name: content.sections[0].label })).not.toHaveAttribute('aria-current')
    })

    it('scrolls the app main container when a section nav item is clicked', () => {
        const content = getDocsContent(i18n.getFixedT('en'))
        const scrollTo = vi.fn()
        const { container } = render(
            <div data-app-main>
                <DocsPage />
            </div>,
        )
        const appMain = container.querySelector<HTMLElement>('[data-app-main]')
        const playSection = document.getElementById('play')
        expect(appMain).toBeTruthy()
        expect(playSection).toBeTruthy()

        appMain!.scrollTop = 120
        playSection!.style.scrollMarginTop = '32px'
        Object.defineProperty(appMain, 'scrollTo', { configurable: true, value: scrollTo })
        vi.spyOn(appMain!, 'getBoundingClientRect').mockReturnValue(rectAt(10))
        vi.spyOn(playSection!, 'getBoundingClientRect').mockReturnValue(rectAt(610))

        fireEvent.click(screen.getByRole('button', { name: content.sections[4].label }))

        expect(scrollTo).toHaveBeenCalledWith({ top: 688, left: 0, behavior: 'smooth' })
        expect(screen.getByRole('button', { name: content.sections[4].label })).toHaveAttribute('aria-current', 'location')
    })

    it('gates create actions behind login when signed out', () => {
        const content = getDocsContent(i18n.getFixedT('en'))
        authed = false
        render(<DocsPage />)

        fireEvent.click(screen.getByRole('button', { name: content.primaryActions[0].label }))

        expect(openLoginModal).toHaveBeenCalledTimes(1)
        expect(setPage).not.toHaveBeenCalled()
    })

    it('navigates from an App map panel to its gallery when signed in', () => {
        const content = getDocsContent(i18n.getFixedT('en'))
        render(<DocsPage />)

        fireEvent.click(screen.getByRole('button', { name: content.mapItems[1].title }))

        expect(setPage).toHaveBeenCalledWith('gallery-characters')
        expect(openLoginModal).not.toHaveBeenCalled()
    })

    it('lets guests open the ungated Explore panel', () => {
        const content = getDocsContent(i18n.getFixedT('en'))
        authed = false
        render(<DocsPage />)

        fireEvent.click(screen.getByRole('button', { name: content.mapItems[0].title }))

        expect(setPage).toHaveBeenCalledWith('landing')
        expect(openLoginModal).not.toHaveBeenCalled()
    })

    it('renders the in-page search input', () => {
        const content = getDocsContent(i18n.getFixedT('en'))
        render(<DocsPage />)

        const search = screen.getByRole('searchbox', { name: content.search.label })
        expect(search).toHaveAttribute('placeholder', content.search.placeholder)
    })

    it('filters sections to those matching the query', () => {
        const content = getDocsContent(i18n.getFixedT('en'))
        const voice = content.sections[6] // 'voice'
        const start = content.sections[0]
        render(<DocsPage />)

        fireEvent.change(screen.getByRole('searchbox', { name: content.search.label }), {
            target: { value: voice.title },
        })

        // Matching section heading stays in the a11y tree; non-matching ones are
        // hidden (role queries exclude [hidden] subtrees).
        expect(screen.getByRole('heading', { name: voice.title })).toBeTruthy()
        expect(screen.queryByRole('heading', { name: start.title })).toBeNull()
    })

    it('shows an empty state when nothing matches', () => {
        const content = getDocsContent(i18n.getFixedT('en'))
        render(<DocsPage />)

        fireEvent.change(screen.getByRole('searchbox', { name: content.search.label }), {
            target: { value: 'zzzzz-no-such-topic' },
        })

        expect(screen.getByText(content.search.empty.title)).toBeTruthy()
        expect(screen.queryByRole('heading', { name: content.sections[0].title })).toBeNull()
    })

    it('restores every section when the query is cleared', () => {
        const content = getDocsContent(i18n.getFixedT('en'))
        render(<DocsPage />)

        const search = screen.getByRole('searchbox', { name: content.search.label })
        fireEvent.change(search, { target: { value: 'zzzzz-no-such-topic' } })
        expect(screen.queryByRole('heading', { name: content.sections[0].title })).toBeNull()

        fireEvent.change(search, { target: { value: '' } })
        for (const section of content.sections) {
            expect(screen.getByRole('heading', { name: section.title })).toBeTruthy()
        }
    })

    it('focuses search when "/" is pressed', () => {
        const content = getDocsContent(i18n.getFixedT('en'))
        render(<DocsPage />)

        const search = screen.getByRole('searchbox', { name: content.search.label })
        expect(document.activeElement).not.toBe(search)

        fireEvent.keyDown(document.body, { key: '/' })

        expect(document.activeElement).toBe(search)
    })
})
