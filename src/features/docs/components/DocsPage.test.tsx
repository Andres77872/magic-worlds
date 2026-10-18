import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { i18n } from '@/app/i18n'
import { DocsPage } from './DocsPage'
import { DOC_SECTION_IDS, getDocsContent } from './docsContent'
import { ROADMAP_REVIEWED_DATE } from './roadmapContent'

const setPage = vi.fn()
const openLoginModal = vi.fn()
const replaceHash = vi.fn()
let authed = true
let currentHash = '#/docs'
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
    useNavigation: () => ({ setPage, currentHash, replaceHash }),
}))

/** Desktop (≥1024px) gets the sticky rail; narrower widths get the collapsible TOC. */
function stubViewport(desktop: boolean) {
    vi.stubGlobal('matchMedia', (query: string) => ({
        matches: desktop && query.includes('min-width: 1024px'),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
    }))
}

function roadmapPanel() {
    return document.getElementById('docs-roadmap')!
}

function openRoadmapTab() {
    fireEvent.click(screen.getByRole('tab', { name: i18n.getFixedT('en')('docs.views.roadmap') }))
}

beforeEach(async () => {
    authed = true
    currentHash = '#/docs'
    stubViewport(true)
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
    vi.unstubAllGlobals()
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
        setTestFeatureFlags({ novels: false })
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
        setTestFeatureFlags({ novels: true })
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
        setTestFeatureFlags({ lorebooks: (lorebooks === 'true') })
        setTestFeatureFlags({ lorebookResources: (resources === 'true') })
        const t = i18n.getFixedT('en')
        const note = t('docs.availability.disabled', { features: t('docs.availability.features.lorebookResources') })
        render(<DocsPage />)

        expect(document.getElementById('resources')!.textContent).toContain(note)
        expect(within(document.getElementById('map')!).queryByRole('button', { name: t('docs.map.items.resources.title') })).toBeNull()
    })

    it('keeps one-on-one chat available while the voices parent disables calls', () => {
        setTestFeatureFlags({ adventures: false })
        setTestFeatureFlags({ voices: false })
        setTestFeatureFlags({ calls: true })
        const t = i18n.getFixedT('en')
        render(<DocsPage />)

        expect(document.getElementById('voice-presets')!.textContent).toContain('WIP')
        expect(document.getElementById('voice')!.textContent).toContain('WIP')
        expect(screen.getByText(t('docs.guides.play.oneOnOne.body')).textContent).not.toContain('WIP')
    })

    it.each(['en', 'es'])('renders the roadmap with disabled and planned features in %s', async (language) => {
        setTestFeatureFlags({ novels: false })

        await i18n.changeLanguage(language)
        const t = i18n.getFixedT(language)
        render(<DocsPage />)

        const teaser = document.getElementById('roadmap')!
        expect(within(teaser).getByRole('heading', { name: t('docs.sections.roadmap.title') })).toBeTruthy()
        expect(teaser.textContent).toContain(t('docs.roadmap.reviewed'))

        fireEvent.click(screen.getByRole('tab', { name: t('docs.views.roadmap') }))
        const roadmap = roadmapPanel()
        expect(within(roadmap).getByRole('heading', { name: t('docs.roadmap.title') })).toBeTruthy()
        expect(roadmap.querySelector('time')?.getAttribute('datetime')).toBe(ROADMAP_REVIEWED_DATE)
        const novel = roadmap.querySelector('[data-roadmap-item="novels"]')!
        const chara = roadmap.querySelector('[data-roadmap-item="charaStudio"]')!
        const billing = roadmap.querySelector('[data-roadmap-item="billing"]')!
        expect(novel.textContent).toContain(t('docs.roadmap.availability.disabled'))
        expect(novel.textContent).toContain(t('docs.roadmap.statuses.partial'))
        expect(novel.textContent).toContain(t('docs.roadmap.items.novels.next'))
        expect(chara.textContent).toContain(t('docs.roadmap.statuses.planned'))
        expect(chara.textContent).toContain(t('docs.roadmap.items.charaStudio.decision'))
        expect(billing.textContent).toContain(t('docs.roadmap.availability.ungated'))
        expect(novel.querySelector('[data-stage]')?.getAttribute('data-stage')).toBe('off')
        expect(chara.querySelector('[data-stage]')?.getAttribute('data-stage')).toBe('planned')
    })

    it('keeps unfinished scope visible when the novel feature is enabled', () => {
        setTestFeatureFlags({ novels: true })
        const t = i18n.getFixedT('en')
        render(<DocsPage />)
        const novel = document.querySelector('[data-roadmap-item="novels"]')!
        expect(novel.textContent).toContain(t('docs.roadmap.availability.enabled'))
        expect(novel.textContent).toContain(t('docs.roadmap.statuses.partial'))
        expect(novel.querySelector('[data-stage]')?.getAttribute('data-stage')).toBe('progress')
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

        const guide = screen.getByRole('tabpanel', { name: content.views.guide })
        expect(within(guide).getByText(content.search.empty.title)).toBeTruthy()
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

    it('focuses search with Ctrl/⌘+K but not with a bare "/" (WCAG 2.1.4)', () => {
        const content = getDocsContent(i18n.getFixedT('en'))
        render(<DocsPage />)

        const search = screen.getByRole('searchbox', { name: content.search.label })
        expect(search).toHaveAttribute('aria-keyshortcuts', 'Control+K Meta+K')

        fireEvent.keyDown(document.body, { key: '/' })
        expect(document.activeElement).not.toBe(search)

        fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
        expect(document.activeElement).toBe(search)
    })

    it('clears the search with Escape', () => {
        const content = getDocsContent(i18n.getFixedT('en'))
        render(<DocsPage />)
        const search = screen.getByRole('searchbox', { name: content.search.label })

        fireEvent.change(search, { target: { value: 'voice' } })
        fireEvent.keyDown(search, { key: 'Escape' })

        expect(search).toHaveValue('')
    })

    it('shows the match count and marks matches in place', () => {
        render(<DocsPage />)
        fireEvent.change(screen.getByRole('searchbox', { name: i18n.t('docs.search.label') }), { target: { value: 'Interrupt' } })

        expect(screen.getByText(/sections? match/)).toBeTruthy()
        const marks = [...document.querySelectorAll('#voice mark')]
        expect(marks.length).toBeGreaterThan(0)
        expect(marks.every((mark) => mark.textContent!.toLowerCase() === 'interrupt')).toBe(true)
    })

    it('renders inside the app shell main without adding a second main landmark', () => {
        render(<DocsPage />)
        expect(document.querySelector('main')).toBeNull()
    })

    it('renders WIP notes apart from the instructions they qualify', () => {
        setTestFeatureFlags({ novels: false })
        const t = i18n.getFixedT('en')
        render(<DocsPage />)

        const novelBody = screen.getByText(t('docs.guides.writing.novels.body'))
        expect(novelBody.textContent).toBe(t('docs.guides.writing.novels.body'))
        const notes = [...document.querySelectorAll('#writing [data-availability-note]')]
        expect(notes.some((note) => note.textContent!.includes(t('docs.availability.features.novels')))).toBe(true)
    })

    it('records the selected guide section in the hash', () => {
        const content = getDocsContent(i18n.getFixedT('en'))
        render(<DocsPage />)
        const voice = content.sections.find((section) => section.id === 'voice')!

        fireEvent.click(within(screen.getByRole('navigation', { name: content.navAriaLabel })).getByRole('button', { name: voice.label }))

        expect(replaceHash).toHaveBeenLastCalledWith('#/docs?section=voice')
    })

    it('uses a collapsible "On this page" list on narrow screens with back-to-top links', () => {
        stubViewport(false)
        const content = getDocsContent(i18n.getFixedT('en'))
        render(<DocsPage />)

        const nav = screen.getByRole('navigation', { name: content.navAriaLabel })
        expect(nav.querySelector('details summary')?.textContent).toContain(content.nav.onThisPage)
        expect(within(document.getElementById('voice')!).getByRole('button', { name: content.nav.backToTop })).toBeTruthy()
    })

    describe('roadmap view', () => {
        it('switches views with tabs and records the view in the hash', () => {
            const t = i18n.getFixedT('en')
            render(<DocsPage />)

            expect(screen.getByRole('tab', { name: t('docs.views.guide') })).toHaveAttribute('aria-selected', 'true')
            openRoadmapTab()

            expect(screen.getByRole('tab', { name: t('docs.views.roadmap') })).toHaveAttribute('aria-selected', 'true')
            expect(replaceHash).toHaveBeenLastCalledWith('#/docs?view=roadmap')
            expect(screen.getByRole('heading', { name: t('docs.roadmap.title') })).toBeTruthy()
            expect(screen.queryByRole('heading', { name: t('docs.sections.start.title') })).toBeNull()
            expect(screen.getByRole('searchbox', { name: t('docs.search.label') })).toHaveAttribute('placeholder', t('docs.search.placeholderRoadmap'))
        })

        it('opens directly from a linked hash', () => {
            currentHash = '#/docs?view=roadmap&section=chara-studio'
            const t = i18n.getFixedT('en')
            render(<DocsPage />)

            expect(screen.getByRole('tab', { name: t('docs.views.roadmap') })).toHaveAttribute('aria-selected', 'true')
            const panelTitle = document.getElementById('chara-studio-title')!
            expect(panelTitle.textContent).toBe(t('docs.roadmap.initiatives.charaStudio.title'))
            expect(screen.getAllByRole('heading', { name: t('docs.roadmap.initiatives.charaStudio.title') })).toContain(panelTitle)
        })

        it('lays out Novel Studio phases in dependency order with the active step marked', () => {
            const t = i18n.getFixedT('en')
            render(<DocsPage />)
            openRoadmapTab()

            const novel = document.getElementById('novel-studio')!
            const phases = within(novel).getAllByRole('listitem').filter((item) => item.hasAttribute('data-phase-status'))
            expect(phases).toHaveLength(6)
            expect(phases[0]).toHaveAttribute('aria-current', 'step')
            expect(phases[0].textContent).toContain(t('docs.roadmap.initiatives.novels.phases.reliable.title'))
            expect(phases.slice(1).every((phase) => !phase.hasAttribute('aria-current'))).toBe(true)
            expect(phases[2].textContent).toContain(t('docs.roadmap.dependsOn', { count: 2, phases: `1 ${t('docs.roadmap.and')} 2` }))
            expect(novel.textContent).toContain(t('docs.roadmap.progress.current', { current: 1, total: 6 }))
            expect(novel.textContent).toContain(t('docs.roadmap.initiatives.novels.scope'))
            expect(novel.textContent).toContain(t('docs.roadmap.initiatives.novels.today.codex'))
        })

        it('keeps Chara Studio planned with mask editing under consideration', () => {
            const t = i18n.getFixedT('en')
            render(<DocsPage />)
            openRoadmapTab()

            const chara = document.getElementById('chara-studio')!
            expect(chara.querySelector('[aria-current="step"]')).toBeNull()
            const statuses = [...chara.querySelectorAll('[data-phase-status]')].map((phase) => phase.getAttribute('data-phase-status'))
            expect(statuses).toEqual(['planned', 'planned', 'planned', 'planned', 'considering'])
            expect(chara.textContent).toContain(t('docs.roadmap.progress.notStarted', { count: 5 }))
            expect(chara.querySelector('[data-stage]')?.getAttribute('data-stage')).toBe('planned')
        })

        it('filters areas by status with the legend toggles', () => {
            const t = i18n.getFixedT('en')
            render(<DocsPage />)
            openRoadmapTab()

            const filter = screen.getByRole('group', { name: t('docs.roadmap.labels.filter') })
            const planned = within(filter).getByRole('button', { name: new RegExp(t('docs.roadmap.stages.planned.label')) })
            fireEvent.click(planned)

            expect(planned).toHaveAttribute('aria-pressed', 'true')
            const shown = [...roadmapPanel().querySelectorAll('[data-roadmap-item]')].map((item) => item.getAttribute('data-roadmap-item'))
            const total = getDocsContent(t).roadmap.items.length
            expect(shown).toEqual(['charaStudio', 'groupCalls', 'patreon'])
            expect(screen.getByText(t('docs.roadmap.showing', { shown: 3, total }))).toBeTruthy()

            fireEvent.click(planned)
            expect(planned).toHaveAttribute('aria-pressed', 'false')
            expect(roadmapPanel().querySelectorAll('[data-roadmap-item]')).toHaveLength(total)
        })

        it('narrows the roadmap with the shared search and opens matching decisions', () => {
            const t = i18n.getFixedT('en')
            render(<DocsPage />)
            openRoadmapTab()

            fireEvent.change(screen.getByRole('searchbox', { name: t('docs.search.label') }), { target: { value: 'account linking' } })

            const shown = [...roadmapPanel().querySelectorAll('[data-roadmap-item]')].map((item) => item.getAttribute('data-roadmap-item'))
            expect(shown).toEqual(['patreon'])
            expect(document.getElementById('novel-studio')).toHaveAttribute('hidden')
            expect(roadmapPanel().querySelector('[data-roadmap-item="patreon"] details')).toHaveAttribute('open')
            const search = screen.getByRole('searchbox', { name: t('docs.search.label') })
            expect(document.getElementById(search.getAttribute('aria-describedby')!)!.textContent).toBe(t('docs.search.roadmapResults', { count: 1 }))
        })

        it('keeps legend counts in step with the search and offers a reset when a status hides every match', () => {
            const t = i18n.getFixedT('en')
            render(<DocsPage />)
            openRoadmapTab()

            const filter = screen.getByRole('group', { name: t('docs.roadmap.labels.filter') })
            const planned = within(filter).getByRole('button', { name: new RegExp(t('docs.roadmap.stages.planned.label')) })
            fireEvent.click(planned)
            fireEvent.change(screen.getByRole('searchbox', { name: t('docs.search.label') }), { target: { value: 'consent' } })

            expect(roadmapPanel().querySelectorAll('[data-roadmap-item]')).toHaveLength(0)
            expect(planned).not.toBeDisabled()
            expect(within(filter).getByRole('button', { name: new RegExp(t('docs.roadmap.labels.all')) }).textContent).toContain('1')
            expect(screen.getByText(t('docs.roadmap.labels.noAreas'))).toBeTruthy()

            fireEvent.click(screen.getByRole('button', { name: t('docs.roadmap.labels.showAll') }))
            expect([...roadmapPanel().querySelectorAll('[data-roadmap-item]')].map((item) => item.getAttribute('data-roadmap-item'))).toEqual(['calls'])
        })

        it('lists recently completed work apart from the open areas and narrows it with the search', () => {
            const t = i18n.getFixedT('en')
            const { done } = getDocsContent(t).roadmap
            render(<DocsPage />)
            openRoadmapTab()

            const section = document.getElementById('roadmap-done')!
            expect(section).not.toHaveAttribute('hidden')
            expect(within(section).getByRole('heading', { name: t('docs.roadmap.labels.done') })).toBeTruthy()
            const entries = [...section.querySelectorAll('[data-roadmap-done]')]
            expect(entries.map((entry) => entry.getAttribute('data-roadmap-done'))).toEqual(done.map((entry) => entry.id))
            expect(entries.some(entry => entry.textContent?.includes(t('docs.roadmap.items.core.title')))).toBe(true)
            expect(within(screen.getByRole('navigation', { name: t('docs.roadmap.labels.jump') })).getByRole('button', { name: t('docs.roadmap.labels.done') })).toBeTruthy()

            fireEvent.change(screen.getByRole('searchbox', { name: t('docs.search.label') }), { target: { value: 'call time' } })
            const visible = [...section.querySelectorAll('[data-roadmap-done]')].filter((entry) => !entry.hasAttribute('hidden'))
            expect(visible.map((entry) => entry.getAttribute('data-roadmap-done'))).toEqual(['planVoiceLimits'])
            expect(screen.queryByText(t('docs.roadmap.labels.emptyTitle'))).toBeNull()

            fireEvent.change(screen.getByRole('searchbox', { name: t('docs.search.label') }), { target: { value: 'account linking' } })
            expect(section).toHaveAttribute('hidden')
            expect(within(screen.getByRole('navigation', { name: t('docs.roadmap.labels.jump') })).queryByRole('button', { name: t('docs.roadmap.labels.done') })).toBeNull()
        })

        it('calls an off initiative\'s existing work built, not available', () => {
            setTestFeatureFlags({ novels: false })
            const t = i18n.getFixedT('en')
            render(<DocsPage />)
            openRoadmapTab()

            expect(document.getElementById('novel-studio-today')!.textContent).toBe(t('docs.roadmap.labels.builtSoFar'))
            expect(document.getElementById('chara-studio-today')!.textContent).toBe(t('docs.roadmap.labels.today'))
        })

        it('jumps from the guide summary to an initiative\'s phases', () => {
            const t = i18n.getFixedT('en')
            render(<DocsPage />)

            const teaser = document.querySelector('[data-roadmap-teaser="charaStudio"]')!
            fireEvent.click(within(teaser as HTMLElement).getByRole('button', { name: new RegExp(t('docs.roadmap.labels.viewPhases')) }))

            expect(replaceHash).toHaveBeenLastCalledWith('#/docs?view=roadmap&section=chara-studio')
            expect(screen.getByRole('tab', { name: t('docs.views.roadmap') })).toHaveAttribute('aria-selected', 'true')
        })
    })
})
