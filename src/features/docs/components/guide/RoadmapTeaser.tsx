/**
 * The Guide's "Status & roadmap" section: a compact summary (areas per status,
 * where each featured initiative stands and what is next) that hands off to the
 * full Roadmap view instead of repeating it inside the guide.
 */
import { ArrowRight, CalendarClock, Search } from 'lucide-react'
import { Button, Icon, IconTile } from '@/ui/primitives'
import { HighlightText } from '../HighlightText'
import { ROADMAP_STAGES, type DocsRoadmap, type RoadmapInitiativeId, type RoadmapStage } from '../roadmapContent'
import { StageBadge } from '../roadmap/StageBadge'
import { STAGE_META } from '../roadmap/roadmapMeta'

interface RoadmapTeaserProps {
    roadmap: DocsRoadmap
    labels: { open: string; stagesLabel: string; nextUp: string; showMatches: string }
    /** While searching: "3 roadmap entries match", so a hit hidden in roadmap detail has a way in. */
    matches?: string
    onOpen: (initiative?: RoadmapInitiativeId) => void
}

export function RoadmapTeaser({ roadmap, labels, matches, onOpen }: RoadmapTeaserProps) {
    const counts = Object.fromEntries(ROADMAP_STAGES.map((stage) => [stage, 0])) as Record<RoadmapStage, number>
    for (const item of roadmap.items) counts[item.stage] += 1

    return (
        <div className="flex flex-col gap-5">
            {matches && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ember-500/30 bg-ember-500/[.07] px-4 py-3">
                    <p className="m-0 inline-flex items-center gap-2 font-ui text-sm text-fg-muted">
                        <Icon icon={Search} size={15} className="text-ember-300" />
                        {matches}
                    </p>
                    <Button variant="secondary" size="sm" iconRight={<Icon icon={ArrowRight} size={14} />} onClick={() => onOpen()}>
                        {labels.showMatches}
                    </Button>
                </div>
            )}
            <dl aria-label={labels.stagesLabel} className="m-0 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {ROADMAP_STAGES.map((stage) => {
                    const meta = STAGE_META[stage]
                    return (
                        <div key={stage} className="flex min-w-0 flex-col gap-1 rounded-xl border border-line-faint bg-surface-raised px-4 py-3">
                            <dt className="flex items-center gap-2 font-ui text-label font-semibold text-fg-muted">
                                <span className={meta.text}>
                                    <Icon icon={meta.icon} size={15} />
                                </span>
                                {roadmap.stages[stage].label}
                            </dt>
                            <dd className="m-0 font-display text-h3 font-semibold leading-none text-fg lining-nums tabular-nums">{counts[stage]}</dd>
                        </div>
                    )
                })}
            </dl>

            <div className="grid gap-4 md:grid-cols-2">
                {roadmap.initiatives.map((initiative) => {
                    const next = initiative.phases.find((phase) => phase.status === 'current') ?? initiative.phases.find((phase) => phase.status === 'planned')
                    return (
                        <div key={initiative.id} data-roadmap-teaser={initiative.id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-line-faint bg-surface-raised p-4">
                            <div className="flex items-center gap-3">
                                <IconTile icon={initiative.icon} tone="arcane" size="sm" />
                                <div className="min-w-0 flex-1">
                                    <h3 className="m-0 font-display text-xl font-semibold leading-snug text-fg">
                                        <HighlightText text={initiative.title} />
                                    </h3>
                                    <p className="m-0 font-mono text-caption text-fg-subtle">{initiative.progress}</p>
                                </div>
                                <StageBadge stage={initiative.stage} label={roadmap.stages[initiative.stage].label} />
                            </div>
                            {next && (
                                <p className="m-0 font-ui text-body text-fg-muted">
                                    <span className="font-semibold text-fg">{labels.nextUp}: </span>
                                    <HighlightText text={next.title} />
                                </p>
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                className="mt-auto self-start"
                                iconRight={<Icon icon={ArrowRight} size={14} />}
                                onClick={() => onOpen(initiative.id)}
                                aria-label={`${roadmap.labels.viewPhases}: ${initiative.title}`}
                            >
                                {roadmap.labels.viewPhases}
                            </Button>
                        </div>
                    )
                })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="m-0 inline-flex items-center gap-2 font-mono text-caption text-fg-subtle">
                    <Icon icon={CalendarClock} size={14} />
                    <time dateTime={roadmap.reviewedDate}>{roadmap.reviewed}</time>
                </p>
                <Button variant="primary" size="sm" iconRight={<Icon icon={ArrowRight} size={15} />} onClick={() => onOpen()}>
                    {labels.open}
                </Button>
            </div>
        </div>
    )
}
