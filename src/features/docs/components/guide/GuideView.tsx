import { useFeatureFlags } from '@/shared/hooks/useFeatureFlags'
/**
 * The Docs "Guide" view: an "On this page" nav beside data-driven sections.
 * Section order, tone and copy come from `docsContent.ts`; this file only maps
 * a section id to its block layout.
 */
import { Compass, Server } from 'lucide-react'
import type { PageType } from '@/shared'
import { isPageFeatureEnabled } from '@/shared/featureFlags'
import { SectionHeader } from '@/ui/primitives'
import { guideItemsFor, type DocsContent, type NavSection } from '../docsContent'
import type { RoadmapInitiativeId } from '../roadmapContent'
import { GuideNav } from './GuideNav'
import { GuideSection } from './GuideSection'
import { FeatureGrid, MapPanel, PracticeList, StepList, UtilityRow } from './GuideBlocks'
import { RoadmapTeaser } from './RoadmapTeaser'

interface GuideViewProps {
    docs: DocsContent
    /** Id of the "On this page" nav, the target of section "Back to top". */
    tocId: string
    activeId: string
    isMatch: (id: string) => boolean
    filtering: boolean
    desktop: boolean
    onSelectSection: (id: string) => void
    onBackToTop: () => void
    onOpenPage: (page: PageType, gated?: boolean) => void
    onOpenRoadmap: (initiative?: RoadmapInitiativeId) => void
    /** Roadmap match summary while searching, shown in the roadmap section. */
    roadmapMatches?: string
    empty: { title: string; body: string }
}

/** Play modes and voice guides read better as wide two-up rows. */
const WIDE_SECTIONS = new Set(['play'])

export function GuideView({
    docs,
    tocId,
    activeId,
    isMatch,
    filtering,
    desktop,
    onSelectSection,
    onBackToTop,
    onOpenPage,
    onOpenRoadmap,
    roadmapMatches,
    empty,
}: GuideViewProps) {
    useFeatureFlags()
    const noMatches = filtering && !docs.sections.some((section) => isMatch(section.id))

    const renderBody = (section: NavSection) => {
        switch (section.id) {
            case 'start':
                return <StepList items={docs.quickStart} />
            case 'roadmap':
                return (
                    <RoadmapTeaser
                        roadmap={docs.roadmap}
                        labels={{
                            open: docs.teaser.open,
                            stagesLabel: docs.teaser.stagesLabel,
                            nextUp: docs.roadmap.labels.nextUp,
                            showMatches: docs.teaser.showMatches,
                        }}
                        matches={roadmapMatches}
                        onOpen={onOpenRoadmap}
                    />
                )
            case 'map':
                return (
                    <>
                        <SectionHeader icon={Compass} title={docs.mapHeadings.primaryWorkspaces} />
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {docs.mapItems
                                .filter((item) => isPageFeatureEnabled(item.page))
                                .map((item) => (
                                    <MapPanel
                                        key={item.title}
                                        icon={item.icon}
                                        title={item.title}
                                        tone={item.tone}
                                        tag={item.tag}
                                        onOpen={() => onOpenPage(item.page, item.gated)}
                                    >
                                        {item.body}
                                    </MapPanel>
                                ))}
                        </div>
                        <SectionHeader icon={Server} title={docs.mapHeadings.utilityRail} />
                        <div className="grid gap-x-8 sm:grid-cols-2">
                            {docs.utilityItems.map((item) => (
                                <UtilityRow key={item.title} icon={item.icon} title={item.title} tone={item.tone} tag={item.tag}>
                                    {item.body}
                                </UtilityRow>
                            ))}
                        </div>
                    </>
                )
            case 'best-practices':
                return <PracticeList label={docs.callout.bestPracticesLabel} practices={docs.bestPractices} />
            default:
                return <FeatureGrid items={guideItemsFor(docs, section.id)} tone={section.tone} wide={WIDE_SECTIONS.has(section.id)} />
        }
    }

    return (
        <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-[220px_minmax(0,1fr)] xl:gap-10">
            <aside className="min-w-0 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:self-start lg:overflow-y-auto">
                <GuideNav
                    id={tocId}
                    sections={docs.sections}
                    activeId={activeId}
                    isMatch={isMatch}
                    filtering={filtering}
                    onSelect={onSelectSection}
                    ariaLabel={docs.navAriaLabel}
                    heading={docs.nav.onThisPage}
                    desktop={desktop}
                />
            </aside>

            <div className="flex min-w-0 flex-col gap-8">
                {noMatches && (
                    <div className="rounded-xl border border-line-faint bg-surface-raised p-8 text-center">
                        <h2 className="m-0 font-display text-xl font-semibold text-fg">{empty.title}</h2>
                        <p className="m-0 mt-2 font-ui text-body text-fg-muted">{empty.body}</p>
                    </div>
                )}
                {docs.sections.map((section) => (
                    <GuideSection
                        key={section.id}
                        section={section}
                        hidden={!isMatch(section.id)}
                        backToTop={desktop ? undefined : { label: docs.nav.backToTop, onClick: onBackToTop }}
                    >
                        {renderBody(section)}
                    </GuideSection>
                ))}
            </div>
        </div>
    )
}
