import { useFeatureFlags } from '@/shared/hooks/useFeatureFlags'
/**
 * In-app product docs (#/docs): a candlelit hero, a Guide / Roadmap view switch
 * (WAI-ARIA tabs) with one search that narrows whichever view is open, and
 * linkable state in the hash (`#/docs?view=roadmap&section=novel-studio`).
 *
 * - Guide: "On this page" nav + data-driven sections (GuideView).
 * - Roadmap: featured initiatives with phases + every area by status (RoadmapView).
 *
 * All copy lives in `docsContent.ts` / `roadmapContent.ts`. Create buttons and
 * App-map panels share one gated handler, so guests get the login modal
 * instead of a dead end. The page renders inside the app shell's `<main>`, so
 * it uses no landmark of its own beyond its navs.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpenText, Info, Route } from 'lucide-react'
import { useAuth, useNavigation } from '@/app/hooks'
import { docsHeroArt } from '@/assets/marketing'
import type { PageType } from '@/shared'
import { isPageFeatureEnabled } from '@/shared/featureFlags'
import { Button, Icon, IconTile, PageHeader, TabPanel, Tabs, useIsDesktop, type TabOption } from '@/ui/primitives'
import { DOC_SECTION_IDS, getDocsContent, sectionSearchText } from './docsContent'
import { initiativeSearchText, roadmapDoneSearchText, roadmapItemSearchText, type RoadmapInitiativeId } from './roadmapContent'
import { DocsQueryContext } from './docsQuery'
import { DocsSearchField } from './DocsSearchField'
import { focusDocsTarget, isAboveViewport, scrollDocsTargetIntoView } from './docsScroll'
import { GuideView } from './guide/GuideView'
import { RoadmapView } from './roadmap/RoadmapView'
import { INITIATIVE_ANCHORS } from './roadmap/roadmapMeta'
import { useDocsRoute, type DocsView } from '../hooks/useDocsRoute'
import { modifierKeyLabel, useDocsSearch } from '../hooks/useDocsSearch'
import { useScrollSpy } from '../hooks/useScrollSpy'

const VIEW_ID = 'docs-view'
const TOOLBAR_ID = 'docs-toolbar'
const TOC_ID = 'docs-toc'

/** Scroll after React has committed the newly shown view/section. */
function afterPaint(run: () => void) {
    requestAnimationFrame(run)
}

export function DocsPage() {
    useFeatureFlags()
    const { t } = useTranslation()
    const docs = useMemo(() => getDocsContent(t), [t])
    const { setPage } = useNavigation()
    const { isAuthenticated, openLoginModal } = useAuth()
    const desktop = useIsDesktop()
    const { route, navigate } = useDocsRoute()
    const view = route.view
    const searchRef = useRef<HTMLInputElement | null>(null)
    const { query, setQuery, normalized, settled } = useDocsSearch(searchRef)
    const [activeSection, setActiveSection] = useScrollSpy(DOC_SECTION_IDS, view === 'guide')
    const [modifier] = useState(modifierKeyLabel)

    // Per-section haystacks, rebuilt only when the language (docs) changes.
    const searchIndex = useMemo(() => docs.sections.map((section) => [section.id, sectionSearchText(docs, section.id)] as const), [docs])
    const filtering = normalized.length > 0
    const matchedIds = useMemo(
        () => (filtering ? new Set(searchIndex.filter(([, text]) => text.includes(normalized)).map(([id]) => id)) : null),
        [searchIndex, normalized, filtering],
    )
    const isMatch = useCallback((id: string) => !matchedIds || matchedIds.has(id), [matchedIds])
    const roadmapMatches = useMemo(() => {
        if (!filtering) return 0
        const items = docs.roadmap.items.filter((item) => roadmapItemSearchText(item).includes(normalized)).length
        const initiatives = docs.roadmap.initiatives.filter((initiative) => initiativeSearchText(initiative).includes(normalized)).length
        const done = docs.roadmap.done.filter((entry) => roadmapDoneSearchText(entry).includes(normalized)).length
        return items + initiatives + done
    }, [docs.roadmap, normalized, filtering])

    const resultText = !filtering
        ? ''
        : view === 'guide'
          ? t('docs.search.results', { count: matchedIds?.size ?? 0 })
          : t('docs.search.roadmapResults', { count: roadmapMatches })

    // A deep link (`section=`) lands on its target once, after first layout.
    const [initialSection] = useState(route.section)
    useEffect(() => {
        if (!initialSection) return
        afterPaint(() => {
            scrollDocsTargetIntoView(initialSection)
            focusDocsTarget(initialSection)
        })
    }, [initialSection])

    const goToSection = (id: string) => {
        setActiveSection(id)
        navigate({ view: 'guide', section: id })
        const land = () => {
            scrollDocsTargetIntoView(id)
            focusDocsTarget(id)
        }
        // A filtered-out target is laid out only after the search clears.
        if (!isMatch(id)) {
            setQuery('')
            afterPaint(land)
        } else {
            land()
        }
    }

    const switchView = (next: DocsView) => {
        navigate({ view: next, section: null })
        if (isAboveViewport(TOOLBAR_ID)) afterPaint(() => scrollDocsTargetIntoView(TOOLBAR_ID))
    }

    const jumpInRoadmap = (anchor: string) => {
        navigate({ view: 'roadmap', section: anchor })
        // Like the Guide nav: a target the search hides is shown by clearing it.
        if (document.getElementById(anchor)?.hidden) setQuery('')
        afterPaint(() => {
            scrollDocsTargetIntoView(anchor)
            focusDocsTarget(anchor)
        })
    }

    const openRoadmap = (initiative?: RoadmapInitiativeId) => {
        if (initiative) {
            jumpInRoadmap(INITIATIVE_ANCHORS[initiative])
        } else {
            navigate({ view: 'roadmap', section: null })
            afterPaint(() => scrollDocsTargetIntoView(TOOLBAR_ID))
        }
    }

    const backToToc = () => {
        scrollDocsTargetIntoView(TOC_ID)
        document.querySelector<HTMLElement>(`#${TOC_ID} summary`)?.focus({ preventScroll: true })
    }

    const goToPage = (page: PageType, gated?: boolean) => {
        if (gated && !isAuthenticated) {
            openLoginModal()
            return
        }
        setPage(page)
    }

    const viewOptions: TabOption<DocsView>[] = [
        { value: 'guide', label: docs.views.guide, icon: <Icon icon={BookOpenText} size={16} /> },
        { value: 'roadmap', label: docs.views.roadmap, icon: <Icon icon={Route} size={16} /> },
    ]
    const actions = docs.primaryActions.filter((action) => isPageFeatureEnabled(action.page))
    const primaryPage = actions.some((action) => action.page === 'adventure') ? 'adventure' : actions[0]?.page

    return (
        <DocsQueryContext.Provider value={normalized}>
            <div className="relative mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-4 py-6 sm:px-8 sm:py-10">
                <section aria-labelledby="docs-title" className="relative overflow-hidden rounded-2xl border border-line-faint">
                    <img src={docsHeroArt} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-[.22]" />
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/85 to-ink-900/60"
                    />
                    <div className="relative p-5 sm:p-8">
                        <PageHeader
                            eyebrow={docs.page.eyebrow}
                            title={<span id="docs-title">{docs.page.title}</span>}
                            subtitle={docs.page.subtitle}
                            size="lg"
                            icon={<IconTile icon={Info} tone="arcane" size="md" />}
                            actions={
                                <div className="flex flex-wrap gap-2">
                                    {actions.map((action) => (
                                        <Button
                                            key={action.page}
                                            variant={action.page === primaryPage ? 'primary' : 'secondary'}
                                            size="sm"
                                            iconLeft={<Icon icon={action.icon} size={15} />}
                                            onClick={() => goToPage(action.page, action.gated)}
                                        >
                                            {action.label}
                                        </Button>
                                    ))}
                                </div>
                            }
                        />
                        <div
                            id={TOOLBAR_ID}
                            className="mt-6 flex scroll-mt-6 flex-col gap-4 border-t border-line-faint pt-5 md:flex-row md:items-start md:justify-between"
                        >
                            <Tabs
                                options={viewOptions}
                                value={view}
                                onChange={switchView}
                                idBase={VIEW_ID}
                                aria-label={docs.views.label}
                                variant="pill"
                                className="self-start"
                            />
                            <DocsSearchField
                                inputRef={searchRef}
                                value={query}
                                onChange={setQuery}
                                label={docs.search.label}
                                placeholder={view === 'guide' ? docs.search.placeholder : docs.search.placeholderRoadmap}
                                clearLabel={docs.search.clear}
                                shortcut={{ modifier, hint: docs.search.shortcutHint }}
                                resultText={resultText}
                                announcement={settled ? resultText : ''}
                            />
                        </div>
                    </div>
                </section>

                <TabPanel value="guide" idBase={VIEW_ID} active={view}>
                    <GuideView
                        tocId={TOC_ID}
                        docs={docs}
                        activeId={activeSection}
                        isMatch={isMatch}
                        filtering={filtering}
                        desktop={desktop}
                        onSelectSection={goToSection}
                        onBackToTop={backToToc}
                        onOpenPage={goToPage}
                        onOpenRoadmap={openRoadmap}
                        roadmapMatches={roadmapMatches ? t('docs.search.roadmapResults', { count: roadmapMatches }) : undefined}
                        empty={docs.search.empty}
                    />
                </TabPanel>
                <TabPanel value="roadmap" idBase={VIEW_ID} active={view}>
                    <RoadmapView roadmap={docs.roadmap} onJump={jumpInRoadmap} />
                </TabPanel>
            </div>
        </DocsQueryContext.Provider>
    )
}
