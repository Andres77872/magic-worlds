/**
 * The Docs "Roadmap" view. Order follows how readers scan a public roadmap:
 * a dated header with the no-dates promise, the featured initiatives with
 * "today" kept apart from ordered phases, every product area grouped by one
 * status whose legend doubles as the filter, then recently completed work.
 * The page search narrows all three; nothing here commits to dates or
 * percentages.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, CalendarClock, CalendarOff, Route } from 'lucide-react'
import { Button, Callout, Icon, IconTile, PageHeader } from '@/ui/primitives'
import {
    ROADMAP_STAGES,
    initiativeSearchText,
    roadmapDoneSearchText,
    roadmapItemSearchText,
    type DocsRoadmap,
    type RoadmapInitiativeId,
    type RoadmapStage,
} from '../roadmapContent'
import { useDocsQuery } from '../docsQuery'
import { InitiativePanel } from './InitiativePanel'
import { RecentlyDone } from './RecentlyDone'
import { RoadmapAreaCard } from './RoadmapAreaCard'
import { StageFilter } from './StageFilter'
import { INITIATIVE_ANCHORS, ROADMAP_AREAS_ANCHOR, ROADMAP_DONE_ANCHOR, STAGE_META } from './roadmapMeta'

interface RoadmapViewProps {
    roadmap: DocsRoadmap
    /** Scroll to an in-view anchor (and record it in the URL). */
    onJump: (anchor: string) => void
}

export function RoadmapView({ roadmap, onJump }: RoadmapViewProps) {
    const { t } = useTranslation()
    const query = useDocsQuery()
    const [stage, setStage] = useState<RoadmapStage | 'all'>('all')
    const phaseLabel = (number: number) => t('docs.roadmap.phase', { number })

    // Legend counts follow the search, so each toggle says what it would show.
    const searchedItems = useMemo(
        () => roadmap.items.filter((item) => !query || roadmapItemSearchText(item).includes(query)),
        [roadmap.items, query],
    )
    const counts = useMemo(() => {
        const result = Object.fromEntries(ROADMAP_STAGES.map((entry) => [entry, 0])) as Record<RoadmapStage, number>
        for (const item of searchedItems) result[item.stage] += 1
        return result
    }, [searchedItems])

    const matchingInitiatives = useMemo(
        () => roadmap.initiatives.filter((initiative) => !query || initiativeSearchText(initiative).includes(query)),
        [roadmap.initiatives, query],
    )
    const matchingItems = useMemo(
        () => searchedItems.filter((item) => stage === 'all' || item.stage === stage),
        [searchedItems, stage],
    )
    const groups = ROADMAP_STAGES.map((entry) => ({ stage: entry, items: matchingItems.filter((item) => item.stage === entry) })).filter(
        (group) => group.items.length > 0,
    )
    const visibleInitiatives = new Set<RoadmapInitiativeId>(matchingInitiatives.map((initiative) => initiative.id))
    const visibleDone = useMemo(
        () => new Set(roadmap.done.filter((entry) => !query || roadmapDoneSearchText(entry).includes(query)).map((entry) => entry.id)),
        [roadmap.done, query],
    )
    // "Nothing matches" is about the search alone; a status filter hiding hits gets its own reset.
    const nothing = matchingInitiatives.length === 0 && searchedItems.length === 0 && visibleDone.size === 0

    const jumps = [
        ...roadmap.initiatives
            .filter((initiative) => visibleInitiatives.has(initiative.id))
            .map((initiative) => ({ anchor: INITIATIVE_ANCHORS[initiative.id], label: initiative.title })),
        { anchor: ROADMAP_AREAS_ANCHOR, label: roadmap.labels.areas },
        ...(visibleDone.size > 0 ? [{ anchor: ROADMAP_DONE_ANCHOR, label: roadmap.labels.done }] : []),
    ]

    return (
        <div id="docs-roadmap" className="flex min-w-0 flex-col gap-10">
            <header className="flex flex-col gap-5">
                <PageHeader
                    as="h2"
                    size="md"
                    eyebrow={t('docs.sections.roadmap.eyebrow')}
                    title={roadmap.title}
                    subtitle={roadmap.intro}
                    icon={<IconTile icon={Route} tone="ember" size="sm" />}
                    actions={
                        <p className="m-0 inline-flex items-center gap-2 rounded-full border border-line-faint bg-surface-raised px-3 py-1.5 font-mono text-caption text-fg-muted">
                            <Icon icon={CalendarClock} size={14} className="text-fg-subtle" />
                            <time dateTime={roadmap.reviewedDate}>{roadmap.reviewed}</time>
                        </p>
                    }
                />
                <Callout tone="warning" icon={<Icon icon={CalendarOff} size={16} />} role="note">
                    {roadmap.note}
                </Callout>
                <nav aria-label={roadmap.labels.jump} className="flex flex-wrap items-center gap-x-1 gap-y-2">
                    <span className="mr-2 font-ui text-eyebrow font-semibold uppercase text-fg-subtle">{roadmap.labels.jump}</span>
                    {jumps.map((jump) => (
                        <button
                            key={jump.anchor}
                            type="button"
                            onClick={() => onJump(jump.anchor)}
                            className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 font-ui text-label font-semibold text-ember-300 transition-colors hover:bg-ember-500/10 hover:text-ember-200"
                        >
                            <Icon icon={ArrowDown} size={14} />
                            {jump.label}
                        </button>
                    ))}
                </nav>
            </header>

            {nothing && (
                <div className="rounded-xl border border-line-faint bg-surface-raised p-8 text-center">
                    <h3 className="m-0 font-display text-xl font-semibold text-fg">{roadmap.labels.emptyTitle}</h3>
                    <p className="m-0 mt-2 font-ui text-body text-fg-muted">{roadmap.labels.emptyBody}</p>
                </div>
            )}

            <div className="grid min-w-0 gap-6 xl:grid-cols-2">
                {roadmap.initiatives.map((initiative) => (
                    <InitiativePanel
                        key={initiative.id}
                        initiative={initiative}
                        stageLabel={roadmap.stages[initiative.stage].label}
                        labels={{
                            today: roadmap.labels.today,
                            builtSoFar: roadmap.labels.builtSoFar,
                            coming: roadmap.labels.coming,
                            scope: roadmap.labels.scope,
                        }}
                        phaseLabel={phaseLabel}
                        hidden={!visibleInitiatives.has(initiative.id)}
                    />
                ))}
            </div>

            <section id={ROADMAP_AREAS_ANCHOR} aria-labelledby={`${ROADMAP_AREAS_ANCHOR}-title`} className="flex min-w-0 scroll-mt-8 flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                    <h3 id={`${ROADMAP_AREAS_ANCHOR}-title`} tabIndex={-1} className="m-0 font-display text-h3 font-semibold text-fg">
                        {roadmap.labels.areas}
                    </h3>
                    <p className="m-0 max-w-prose font-ui text-body text-fg-subtle">{roadmap.labels.areasIntro}</p>
                </div>
                <StageFilter roadmap={roadmap} counts={counts} total={searchedItems.length} value={stage} onChange={setStage} />
                <p role="status" className="m-0 min-h-5 font-ui text-caption text-fg-subtle">
                    {stage !== 'all' ? t('docs.roadmap.showing', { shown: matchingItems.length, total: roadmap.items.length }) : ''}
                </p>
                {matchingItems.length === 0 && !nothing && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line-faint bg-surface-raised px-4 py-3">
                        <p className="m-0 font-ui text-body text-fg-muted">{roadmap.labels.noAreas}</p>
                        {stage !== 'all' && (
                            <Button variant="secondary" size="sm" onClick={() => setStage('all')}>
                                {roadmap.labels.showAll}
                            </Button>
                        )}
                    </div>
                )}
                {groups.map((group) => {
                    const meta = STAGE_META[group.stage]
                    const headingId = `roadmap-group-${group.stage}`
                    return (
                        <section key={group.stage} aria-labelledby={headingId} className="flex min-w-0 flex-col gap-3">
                            <h4 id={headingId} className="m-0 flex items-center gap-2 font-ui text-label font-semibold uppercase tracking-[0.12em] text-fg-muted">
                                <span className={meta.text}>
                                    <Icon icon={meta.icon} size={16} />
                                </span>
                                {roadmap.stages[group.stage].label}
                                <span className="font-mono text-caption font-normal normal-case tracking-normal text-fg-subtle">{group.items.length}</span>
                            </h4>
                            <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2 2xl:grid-cols-3">
                                {group.items.map((item) => (
                                    <RoadmapAreaCard
                                        key={item.id}
                                        item={item}
                                        roadmap={roadmap}
                                        onViewPhases={item.initiative ? () => onJump(INITIATIVE_ANCHORS[item.initiative!]) : undefined}
                                    />
                                ))}
                            </ul>
                        </section>
                    )
                })}
            </section>

            <RecentlyDone
                entries={roadmap.done}
                visible={visibleDone}
                labels={{ title: roadmap.labels.done, intro: roadmap.labels.doneIntro, area: roadmap.labels.doneArea }}
            />
        </div>
    )
}
