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
    vi.unstubAllEnvs()
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
            'stability and similarity, plus speed when the selected voice supports it',
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
        render(<DocsPage />)
        const pageText = document.getElementById('voice')!.textContent ?? ''

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

    it.each(['en', 'es'])('explains unavailable novel workflows as WIP in %s', async (language) => {
        vi.stubEnv('VITE_FEATURE_NOVELS_ENABLED', 'false')
        await i18n.changeLanguage(language)
        const t = i18n.getFixedT(language)
        const note = t('docs.availability.disabled', { features: t('docs.availability.features.novels') })
        render(<DocsPage />)

        const writing = document.getElementById('writing')!
        expect(writing.textContent).toContain(note)
        expect(screen.queryByRole('button', { name: t('docs.map.items.novels.title') })).toBeNull()
        expect(writing.textContent).not.toMatch(/copy Markdown|copia Markdown|stash|guardar aparte/)
    })

    it('keeps enabled novel instructions available without a WIP note', () => {
        vi.stubEnv('VITE_FEATURE_NOVELS_ENABLED', 'true')
        const t = i18n.getFixedT('en')
        render(<DocsPage />)

        expect(screen.getByRole('button', { name: t('docs.map.items.novels.title') })).toBeTruthy()
        const novelInstructions = screen.getByText(t('docs.guides.writing.novels.body'))
        expect(novelInstructions.textContent).not.toContain('WIP')
        expect(novelInstructions.textContent).toContain('copy individual AI outputs')
    })

    it.each([
        ['false', 'true'],
        ['true', 'false'],
    ])('marks resources WIP when either owning flag is off (%s/%s)', (lorebooks, resources) => {
        vi.stubEnv('VITE_FEATURE_LOREBOOKS_ENABLED', lorebooks)
        vi.stubEnv('VITE_FEATURE_LOREBOOK_RESOURCES_ENABLED', resources)
        const t = i18n.getFixedT('en')
        const note = t('docs.availability.disabled', { features: t('docs.availability.features.lorebookResources') })
        render(<DocsPage />)

        expect(document.getElementById('resources')!.textContent).toContain(note)
        expect(within(document.getElementById('map')!).queryByRole('button', { name: t('docs.map.items.resources.title') })).toBeNull()
    })

    it('does not label one-on-one chat or calls disabled when only adventures and voice studio are off', () => {
        vi.stubEnv('VITE_FEATURE_ADVENTURES_ENABLED', 'false')
        vi.stubEnv('VITE_FEATURE_VOICES_ENABLED', 'false')
        vi.stubEnv('VITE_FEATURE_CALLS_ENABLED', 'true')
        const t = i18n.getFixedT('en')
        render(<DocsPage />)

        expect(document.getElementById('voice-presets')!.textContent).toContain('WIP')
        expect(document.getElementById('voice')!.textContent).not.toContain('WIP')
        expect(screen.getByText(t('docs.guides.play.oneOnOne.body')).textContent).not.toContain('WIP')
    })

    it.each(['en', 'es'])('renders the roadmap with disabled and planned features in %s', async (language) => {
        vi.stubEnv('VITE_FEATURE_NOVELS_ENABLED', 'false')
        vi.stubEnv('VITE_BILLING_ENABLED', 'false')
        await i18n.changeLanguage(language)
        const t = i18n.getFixedT(language)
        render(<DocsPage />)

        const roadmap = document.getElementById('roadmap')!
        expect(within(roadmap).getByRole('heading', { name: t('docs.sections.roadmap.title') })).toBeTruthy()
        expect(roadmap.textContent).toContain(t('docs.roadmap.reviewed'))
        const novel = roadmap.querySelector('[data-roadmap-item="novels"]')!
        const chara = roadmap.querySelector('[data-roadmap-item="charaStudio"]')!
        const billing = roadmap.querySelector('[data-roadmap-item="billing"]')!
        expect(novel.textContent).toContain(t('docs.roadmap.availability.disabled'))
        expect(novel.textContent).toContain(t('docs.roadmap.statuses.partial'))
        expect(novel.textContent).toContain(t('docs.roadmap.items.novels.next'))
        expect(chara.textContent).toContain(t('docs.roadmap.statuses.planned'))
        expect(chara.textContent).toContain(t('docs.roadmap.items.charaStudio.decision'))
        expect(billing.textContent).toContain(t('docs.roadmap.availability.disabled'))
    })

    it('keeps unfinished scope visible when the novel feature is enabled', () => {
        vi.stubEnv('VITE_FEATURE_NOVELS_ENABLED', 'true')
        const t = i18n.getFixedT('en')
        render(<DocsPage />)
        const novel = document.querySelector('[data-roadmap-item="novels"]')!
        expect(novel.textContent).toContain(t('docs.roadmap.availability.enabled'))
        expect(novel.textContent).toContain(t('docs.roadmap.statuses.partial'))
    })

    it('finds planned Chara Studio through docs search', () => {
        const t = i18n.getFixedT('en')
        render(<DocsPage />)
        fireEvent.change(screen.getByRole('searchbox', { name: t('docs.search.label') }), { target: { value: 'Chara Studio' } })
        expect(screen.getByRole('heading', { name: t('docs.sections.roadmap.title') })).toBeTruthy()
        expect(screen.queryByRole('heading', { name: t('docs.sections.start.title') })).toBeNull()
    })

    it('documents reusable Markdown and text resources', () => {
        const content = getDocsContent(i18n.getFixedT('en'))
        const resources = content.sections.find((section) => section.id === 'resources')
        render(<DocsPage />)

        expect(resources).toBeTruthy()
        expect(screen.getByRole('heading', { name: resources!.title })).toBeTruthy()
        const pageText = document.body.textContent ?? ''

        for (const text of [
            'Use Markdown, plain text, or PDF',
            '.md / .txt',
            'New text',
            'New Markdown',
            'Upload',
            'From URL',
            'authenticated importer',
            'Attach shared sources to lorebooks',
            'metadata sync',
        ]) {
            expect(pageText).toContain(text)
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
        expect(nav.getByRole('button', { name: content.sections.find((section) => section.id === 'play')!.label })).toHaveAttribute('aria-current', 'location')
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

        const playLabel = content.sections.find((section) => section.id === 'play')!.label
        fireEvent.click(screen.getByRole('button', { name: playLabel }))

        expect(scrollTo).toHaveBeenCalledWith({ top: 688, left: 0, behavior: 'smooth' })
        expect(screen.getByRole('button', { name: playLabel })).toHaveAttribute('aria-current', 'location')
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

    it('lets guests open App map gallery panels', () => {
        const content = getDocsContent(i18n.getFixedT('en'))
        authed = false
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
        const voice = content.sections.find((section) => section.id === 'voice')!
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
