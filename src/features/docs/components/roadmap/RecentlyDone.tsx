/**
 * "Recently completed": bounded work finished since earlier reviews, so the
 * roadmap shows progress and not only what is left. Each entry names the area
 * it belongs to; a finished fix never implies that area's whole roadmap is done.
 */
import { CircleCheck } from 'lucide-react'
import { Icon } from '@/ui/primitives'
import { HighlightText } from '../HighlightText'
import type { RoadmapDoneEntry } from '../roadmapContent'
import { ROADMAP_DONE_ANCHOR } from './roadmapMeta'

interface RecentlyDoneProps {
    entries: RoadmapDoneEntry[]
    /** Entries the page search hides (kept mounted, like the other roadmap blocks). */
    visible: ReadonlySet<string>
    labels: { title: string; intro: string; area: string }
}

export function RecentlyDone({ entries, visible, labels }: RecentlyDoneProps) {
    const headingId = `${ROADMAP_DONE_ANCHOR}-title`
    return (
        <section
            id={ROADMAP_DONE_ANCHOR}
            aria-labelledby={headingId}
            hidden={visible.size === 0}
            className="flex min-w-0 scroll-mt-8 flex-col gap-5"
        >
            <div className="flex flex-col gap-1.5">
                <h3 id={headingId} tabIndex={-1} className="m-0 font-display text-h3 font-semibold text-fg">
                    {labels.title}
                </h3>
                <p className="m-0 max-w-prose font-ui text-body text-fg-subtle">{labels.intro}</p>
            </div>
            <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2 2xl:grid-cols-3">
                {entries.map((entry) => (
                    <li
                        key={entry.id}
                        data-roadmap-done={entry.id}
                        hidden={!visible.has(entry.id)}
                        className="flex min-w-0 gap-3 rounded-xl border border-line-faint bg-surface-raised p-4"
                    >
                        <span className="mt-0.5 shrink-0 text-verdant-500">
                            <Icon icon={CircleCheck} size={18} />
                        </span>
                        <div className="flex min-w-0 flex-col gap-1">
                            <p className="m-0 font-ui text-eyebrow font-semibold uppercase text-fg-subtle">
                                <span className="sr-only">{labels.area}: </span>
                                <HighlightText text={entry.areaTitle} />
                            </p>
                            <h4 className="m-0 font-ui text-body font-semibold text-fg">
                                <HighlightText text={entry.title} />
                            </h4>
                            <p className="m-0 font-ui text-body text-fg-muted">
                                <HighlightText text={entry.body} />
                            </p>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    )
}
