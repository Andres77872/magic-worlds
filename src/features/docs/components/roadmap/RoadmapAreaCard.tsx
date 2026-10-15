/**
 * One product area in the roadmap list. The status badge leads; build state and
 * availability stay visible as metadata; the open decision is secondary detail
 * behind a disclosure that opens itself when the search matches inside it.
 */
import { ArrowRight, ChevronRight } from 'lucide-react'
import { Button, Icon } from '@/ui/primitives'
import { HighlightText } from '../HighlightText'
import { useDocsQuery } from '../docsQuery'
import type { DocsRoadmap, DocsRoadmapItem } from '../roadmapContent'
import { StageBadge } from './StageBadge'

interface RoadmapAreaCardProps {
    item: DocsRoadmapItem
    roadmap: DocsRoadmap
    onViewPhases?: () => void
}

export function RoadmapAreaCard({ item, roadmap, onViewPhases }: RoadmapAreaCardProps) {
    const query = useDocsQuery()
    const decisionMatches = query.length > 0 && item.decision.toLowerCase().includes(query)
    const { labels } = roadmap
    return (
        <li data-roadmap-item={item.id} className="flex min-w-0 flex-col rounded-xl border border-line-faint bg-surface-raised p-4 sm:p-5">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <h5 className="m-0 min-w-0 font-display text-xl font-semibold leading-snug text-fg">
                    <HighlightText text={item.title} />
                </h5>
                <StageBadge stage={item.stage} label={roadmap.stages[item.stage].label} />
            </div>
            <p className="m-0 mt-1.5 font-ui text-caption text-fg-subtle">
                <span className="font-semibold text-fg-muted">{labels.build}:</span> <HighlightText text={item.status} />
                <span aria-hidden> · </span>
                <HighlightText text={item.availability} />
            </p>
            <dl className="m-0 mt-3 flex flex-col gap-2.5 font-ui text-body">
                <div>
                    <dt className="text-label font-semibold text-fg">{labels.current}</dt>
                    <dd className="m-0 text-fg-muted">
                        <HighlightText text={item.current} />
                    </dd>
                </div>
                <div>
                    <dt className="text-label font-semibold text-fg">{labels.next}</dt>
                    <dd className="m-0 text-fg-muted">
                        <HighlightText text={item.next} />
                    </dd>
                </div>
            </dl>
            <div className="mt-auto flex flex-col gap-3 pt-3">
                <details
                    // Re-key on the forced state so a search match opens it without
                    // fighting the reader's own toggles afterwards.
                    key={decisionMatches ? 'match' : 'idle'}
                    open={decisionMatches || undefined}
                    className="group border-t border-line-faint pt-3"
                >
                    <summary className="inline-flex min-h-6 cursor-pointer list-none items-center gap-1.5 rounded-xs font-ui text-label font-semibold text-fg-subtle transition-colors hover:text-fg [&::-webkit-details-marker]:hidden">
                        <Icon icon={ChevronRight} size={14} className="transition-transform group-open:rotate-90" />
                        {labels.decision}
                    </summary>
                    <p className="m-0 mt-2 font-ui text-body text-fg-muted">
                        <HighlightText text={item.decision} />
                    </p>
                </details>
                {onViewPhases && (
                    <Button variant="secondary" size="sm" className="self-start" iconRight={<Icon icon={ArrowRight} size={14} />} onClick={onViewPhases}>
                        {labels.viewPhases}
                    </Button>
                )}
            </div>
        </li>
    )
}
